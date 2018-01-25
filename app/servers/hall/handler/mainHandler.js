'use strict';

const integralService = require('../../../services/integralService');
const jsonMgr = require('../../../../config/data/JsonMgr');


const Logger = require('pomelo-logger').getLogger('log', __filename);
const gutils = require('../../../domain/games/util');
const util = require('../../../utils');
const db = require('../../../utils/db/mongodb');
const MessageService = require('../../../services/MessageService');
const sessionService = require('../../../services/sessionService');
const Promise = require('bluebird');
const async = require('async');

const {playerMgr, platformMgr, systemMgr, censusMgr} = require('../../../utils/db/dbMgr');

module.exports = function(app) {
	return new mainHandler(app);
};

var mainHandler = function(app) {
	this.app = app;
};

/**
 * created by CL
 * 进入指定的游戏
 * @return {rooms} 房间列表
 * @route hall.mainHandler.enterGame
 */
mainHandler.prototype.enterGame = ({nid}, session, next) =>{
	if(!nid){
		return next(null, {code: 500, error: '参数有误 enterGame'});
	}
	const {uid, isVip, viper} = gutils.sessionInfo(session);
	playerMgr.getPlayer({uid}, function(err, player){
		if(err){
			return next(null, err);
		}
		if(!player){
			return next(null, {code: 500, error: `玩家不存在: ${uid}`});
		}

		async.waterfall([
			// 获取所在环境的游戏,房间
			cb =>{
				// vip环境
				if(isVip){
					// 检查平台
					platformMgr.getPlatform({viper}, function(err, platform){
						if(err){
							return next(null, err);
						}
						//查找平台上的指定游戏
						platformMgr.getPlatformGame({viper, nid}, function(err, game){
							if(err){
								return next(null, err);
							}
							if(!game){
								return callback(null, {code: 500, error: `该平台${viper}不存在指定游戏${nid}`});
							}
							if(game.gameStartTime + game.gameHaveTime < Date.now()){
								return next(null, {code: 500, error: '该游戏时间已到期,请联系房主续约'});
							}

							//查找该游戏的所有房间
							platformMgr.getPlatformGameRooms({viper, nid}, function(err, rooms){
								if(err){
									return next(null, err);
								}

								if(!player.vip){   //如果该玩家不是vip,增加游戏环境记录
									platform.addGameMember(nid, uid);
									//保存平台的修改
									platformMgr.platformIntoRedis(platform);
								}
								return cb(null, game, rooms);
							});
						});
					});
				}else{
					//普通环境
					systemMgr.getGame({nid}, function(err, game){
						if(err){
							return next(null, err);
						}
						//游戏机器
						systemMgr.allGameRooms(nid, true).then(rooms =>{
							return cb(null, game, rooms);
						}).catch(err =>{
							console.error(`获取系统游戏${nid}的房间失败`, err);
							return next(null, {code: 500, error: `获取系统游戏${nid}的房间失败`});
						})
					});
				}
			},
			//判断是否增加房间
			(game, rooms, cb) =>{
				if(game.users.findIndex(user => user.uid == uid) != -1){
					return next(null, {code: 500, error: `玩家${uid}已在游戏${nid}中`});
				}
				//用于判断是否应该增加房间
				const addRoomJudge = (openRooms, userLen, roomLimit) =>{
					if(userLen / (openRooms.length * roomLimit) >= 0.8){
						return true;
					}
					if(util.all(room => room.users.length == roomLimit)(rooms)){
						return true;
					}
					return false;
				};
				let addRoom = addRoomJudge(rooms, game.users.length, game.roomUserLimit);
				if(addRoom){
					//判断是否存在关闭的房间(优先增加已存在但已经关闭的房间)
					const closeRooms = rooms.filter(room =>!room.open).sort((r1, r2) => r2.jackpot - r1.jackpot);
					let newRoom;
					if(closeRooms[0]){     //开启已关闭的奖池最多的房间
						closeRooms[0].open = true;
						newRoom = gutils.newRoomJackpot(closeRooms[0]);
						return cb(null, game, rooms.concat(newRoom));
					}else{  //创建新的游戏房间
						gutils.insRoom({isVip, viper, nid}, game.users).then(insRoom =>{
							newRoom = gutils.newRoomJackpot(insRoom, true);
							return cb(null, game, rooms.concat(newRoom));
						});
					}
				}else{
					return cb(null, game, rooms);
				}
			},
			(game, rooms, cb) =>{
				//修正每个房间的奖池显示
				rooms.forEach(room =>{
					let passTime = (Date.now() - room.jackpotShow.ctime) / 1000;
					if(passTime > 300){
						passTime = 300;
					}
					room.jackpotShow.show = passTime * room.jackpotShow.rand;
					//保存房间的修改
					gutils.udtRoomByEnv(room);
				});
				return cb(null, game, rooms);
			}
		], function(err, game, rooms){

			//玩家进入游戏
			game.users.push({uid, sid: player.sid});
			//保存游戏的修改
			gutils.udtGameByEnv(game);

			//绑定进入的游戏
			sessionService.sessionSet(session, {'game': nid});
			//census.gameTotal[nid].add(uid);
			let envLGC = player.lastGameContents[viper ? viper : 'system'];
			return next(null, {
				code: 200,
				rooms: rooms.filter(room =>room.open),
				lastRoom: envLGC.room,
				lastGame: envLGC.nid,
			});
		});
	});
};

/**
 * created by CL
 * 切换环境
 * @route: hall.mainHandler.changeEnv
 */
mainHandler.prototype.changeEnv = ({}, session, next) =>{

	const {uid, isVip, viper} = gutils.sessionInfo(session);
	const VIP_ENV = !isVip;

	playerMgr.getPlayer({uid}, function(err, player) {
		if(err) {
			return next(null, err);
		}
		if(!player) {
			return next(null, {code: 500, error: `玩家不存在: ${uid}`});
		}
		if(player.viperId == null){
			return next(null, {code: 500, error: '该玩家没有进入vip场的权限'});
		}
		if(player.isPrompting == false){    //判断是否弹出提示
			player.isPrompting = true;
		}
		sessionService.sessionSet(session, {VIP_ENV});   //绑定环境
		let games;

		async.waterfall([
			cb =>{

				//获取应该进入的平台
				platformMgr.getPlatform({viper: player.viperId}, function(err, platform){
					if(err){
						return next(null, err);
					}
					if(VIP_ENV){  //切换进入平台环境
						//绑定玩家进入的平台环境,玩家进入平台环境,退出普通环境
						sessionService.sessionSet(session, {viper: platform.creator});
						platform.addEnvMembers({uid, sid: player.sid});
						censusMgr.deleteplayerIntoSystem(uid);
						//绑定平台的经营模式
						sessionService.sessionSet(session, {model: platform.vipModel});
						//保存平台的修改
						platformMgr.platformIntoRedis(platform).then(()=>{}).catch(err =>{
							console.error(`保存平台${player.viperId}的修改失败`, err);
						});

						platformMgr.getPlatformGames({viper: player.viperId}, function(err, pgames){
							if(err){
								return next(null, {code: 500, error: `获取平台${player.viperId}游戏列表失败`});
							}
							pgames = gutils.gameFieldsReturn(pgames);
							if(player.vip){   //vip房主可以看到未购买的游戏
								//平台游戏显示
								gutils.pGameNeedBuy(pgames).then(gs =>{
									games = gs;
									return cb(null, games);
								});
							}else{
								games = gutils.gamesWeightSort(pgames);
								return cb(null, games);
							}
						});
					}else{
						//从vip环境进入普通环境
						sessionService.sessionSet(session, {viper: null});
						platform.removeEnvMember(uid);
						//保存平台的修改
						platformMgr.platformIntoRedis(platform).then(()=>{}).catch(err =>{
							console.error(`保存平台${player.viperId}的修改失败`, err);
						});
						censusMgr.addPlayerIntoSystem(uid);
						sessionService.sessionSet(session, {model: null});
						//显示所有系统游戏
						systemMgr.allGames().then(gs =>{
							games = gutils.gamesWeightSort(gs);
							return cb(null, games);
						});
					}
				});
			},
		], function(err, games){
			const env = viper ? viper : 'system';
			let lastGame = player.lastGameContents[env].nid;
			//保存玩家的修改
			playerMgr.updatePlayer(player, function(err){
				if(err){
					console.error(`保存玩家${uid}的修改失败`, err);
				}
			});

			return next(null, {
				code: 200,
				VIP_ENV,
				games: gutils.gameFieldsReturn(games),
				lastGame,
				lastRoom: player.lastGameContents[env].room,
			});
		});
	});
};

/**
 * created by CL
 * 根据邀请码进入vip环境
 * @route: hall.mainHandler.changeEnvByCode
 */
mainHandler.prototype.changeEnvByCode = ({inviteCode}, session, next) =>{
	if(inviteCode == null){
		return next(null, {code: 500, error:'请输入邀请码'});
	}
	const {uid, viper} = gutils.sessionInfo(session);

	playerMgr.getPlayer({uid}, function(err, player) {
		if (err) {
			return next(null, err);
		}
		if (!player) {
			return next(null, {code: 500, error: `玩家不存在: ${uid}`});
		}
		if(player.vip || !util.isVoid(player.inviteCode)){
			return next(null, {code: 500, error: '该玩家已经是vip 或 已有邀请码'});
		}
		const inviteCodeMgr = require('../../../domain/hall/inviteCode/inviteCodeMgr');

		async.waterfall([
			cb =>{
				//处理邀请码信息
				inviteCodeMgr.findOneInviteCodeInfo({inviteCode: inviteCode.toUpperCase()}, function(err, doc){
					if(err){
						return next(null, {code: 500, error: '查找出错'+ err});
					}
					if(!doc){
						return next(null, {code: 500, error: '请输入有效邀请码'});
					}
					const index = doc.inviteRecords.findIndex(u => u == uid);
					if(index != -1){
						return next(null, {code: 500, error: '玩家已经存在于该邀请码环境'});
					}
					if(doc.effectiveTimes != null && doc.effectiveTimes <= 0){
						return next(null, {code: 500, error: '该邀请码有效次数已用完'});
					}
					return cb(null, doc);
				});
			},
			(codeInfo, cb) =>{
				//处理平台
				platformMgr.getPlatform({viper: codeInfo.viper}, function(err, platform){
					if(platform == null){
						return next(null, {code: 500, error: `未找到平台${codeInfo.viper},请输入有效邀请码`});
					}

					// 同时绑定该邀请码到玩家信息账户 还要绑定到平台
					player.inviteCode = codeInfo.inviteCode;
					player.viperId = codeInfo.viper;
					player.inviteCodeBindTime = Date.now();

					//添加玩家积分变化记录
					if(codeInfo.integral > 0){
						player.integral += codeInfo.integral;

						db.getDao('change_integral').add(function(){}, {
							uid: player.uid,
							integral : codeInfo.integral,
							type: 'add',
							time : Date.now(),
							inviteCode : inviteCode,
							viperId: codeInfo.viper,
						});
					}

					platform.addMember(uid);
					platform.addEnvMembers({uid, sid: player.sid});
					censusMgr.deleteplayerIntoSystem(uid);
					sessionService.sessionSet(session, {
						'VIP_ENV': true,
						viper: platform.creator,
						model: platform.vipModel,
					});
					return cb(null, codeInfo, platform);
				});
			},
			(codeInfo, platform, cb) =>{
				//平台游戏
				platformMgr.getPlatformGames({viper: codeInfo.viper}, function(err, pgames) {
					if(err) {
						return next(null, {code: 500, error: `获取平台${codeInfo.viper}游戏列表失败`});
					}
					const games = gutils.gamesWeightSort(pgames);

					//根据邀请配置的初始积分扣除房主v点
					if(codeInfo.integral && codeInfo.integral > 0){
						playerMgr.getPlayer({uid: codeInfo.viper}, function(err, vipPlayer){
							if(err){
								console.error(err);
							}
							if(platform.vipModel == 'discount'){
								vipPlayer.vdot -= codeInfo.integral * 0.001;
								//保存vip玩家的修改
								playerMgr.updatePlayer(vipPlayer, function(err){
									if(err){
										console.error(`保存玩家${codeInfo.viper}的修改失败`, err);
									}
								});
							}
						});
					}
					return cb(null, codeInfo, platform, games);
				})
			},
			(codeInfo, platform, games, cb) =>{
				//更新数据库中的邀请码信息
				codeInfo.inviteRecords.push(uid);
				const updateInfo = {'$set': {inviteRecords: codeInfo.inviteRecords}};
				if(codeInfo.effectiveTimes != null){
					updateInfo['$inc'] = {effectiveTimes : -1};
				}
				inviteCodeMgr.updateInviteCode({
					inviteCode: inviteCode.toUpperCase()
				}, updateInfo, {}, function(err) {
					if(err) {
						return next(null, {code: 500, error: '更新邀请码数据失败' + err});
					}
					return cb(null, platform, games);
				})
			},
		], function(err, platform, games){

			const env = viper ? viper : 'system';
			//处理玩家上次游戏
			if(util.isVoid(player.lastGameContents[env])){
				player.lastGameContents[env] = {nid:'', room:{}};
			}
			//保存玩家数据修改 和 平台数据修改
			platformMgr.platformIntoRedis(platform).then(()=>{
				playerMgr.updatePlayer(player, function(err){
					if(err){
						console.error(`保存玩家${player.uid}的修改失败`, err);
					}
				});
			}).catch(err =>{
				console.error(`保存平台${platform.creator}的修改失败`, err);
			});
			const lastGame = player.lastGameContents[env].nid;

			return next(null, {
				code: 200,
				games: gutils.gameFieldsReturn(games),
				integral: player.integral,
				lastGame,
				lastRoom: player.lastGameContents[env].room,
			});
		});
	});
};

/**
 * 积分记录点击
 * @params: {search, __range}
 * @route: hall.mainHandler.integralClick
 */
mainHandler.prototype.integralClick = ({search, __range}, session, next) =>{

	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	if(player.vip){   //代理
		integralService.findIntegral({search, __range, viperUid: uid, vip: true}, function(err, docs){
			if(err){
				return next(null, {code: 500, error: '查询积分记录失败'});
			}
			return next(null, {code: 200, docs});
		});
	}else{     //在vip场游戏的非代理玩家
		integralService.findIntegral({search, __range, uid: uid, vip: false}, function(err, docs){
			if(err){
				return next(null, {code: 500, error: '查询积分记录失败'});
			}
			let noSettleIntegral = docs.reduce((num, doc) =>{
				if(doc.settleStatus == false){
					return num + doc.integral;
				}else{
					return num;
				}
			}, 0);
			noSettleIntegral = noSettleIntegral > 0 ? `+${noSettleIntegral}` : `${noSettleIntegral}`;
			return next(null, {code: 200, docs, noSettleNum: noSettleIntegral});
		});
	}
};

/**
 * 结算
 * @param {uid}
 * @route: hall.mainHandler.settleIntegral
 */
mainHandler.prototype.settleIntegral = ({uid}, session, next) =>{

	const viperUid = session.uid;
	const player = PlayerMgr.getPlayer(viperUid);
	if(!player.vip){
		return next(null, {code: 500, error:'玩家非代理'});
	}
	integralService.updateIntegral({settleStatus: true, uid, viperUid}, function(err, docs){
		if(err){
			return next(null, {code: 500, error: '查询积分记录失败'});
		}
		return next(null, {code: 200, docs});
	});
};

/**
 * 排行榜
 * hall.mainHandler.findGameRecord
 */
mainHandler.prototype.findGameRecord = ({uid, nids, num, ranking = false}, session, next) =>{
	const service = require('../../../services/gameRecordService');
	if(ranking){
		const zt = util.zerotime();
		// service.rankGameRecord({cond: {createTime: {'$gte': zt, '$lt': Date.now()}, robot: null, profit:{$gt: 0}}}, function(err, result){
		// 	const rewards = [100, 80, 64, 48, 38, 26, 18, 12, 8, 5];
		// 	// const arr = RankMgr.ranks();
		// 	// result = result.concat(arr);
		// 	// result.sort((e1, e2) => e2.winTotal-e1.winTotal);
		// 	// result = result.slice(0,10);
		// 	result.forEach((u, i) =>{
		// 		u.rank = i + 1;
		// 		u.fragment = rewards[i];
		// 	});
		// 	return next(null, {code: 200, result});
		// }) 
		service.rankRmbRecord({cond: {time: {'$gte': zt, '$lt': Date.now()}}}, function(err, result){
			const rewards = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
			result.forEach((u, i) =>{
				u.rank = i + 1;
				u.fragment = parseInt(u.allPay * rewards[i] * 0.01 * 10);
			});
			
			return next(null, {code: 200, result});
		}) 
	}else{
		const condition = {num: num,nids};
		condition.playStatus = {'$in': [null, 1]};
		if(uid){
			condition.uid = uid;
		}
		service.findGameRecord(condition, function(err, result){
			if(err){
				return next(null, {code: 500, error: '查找游戏记录出错'})
			}
			return next(null, {code: 200, result});
		})
	}
};

/**
 * 邀请码管理
 */
mainHandler.prototype.inviteCodeMgr = ({}, session, next) =>{
	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	if(!player || !player.vip){
		return next(null, {code: 500, error:'玩家不是vip'});
	}
	//获取平台
	const platform = vipPlatformMgr.getPlatform(uid);
	//平台上的所有除自己之外的玩家的uid
	const members = platform.members.map(n => n.uid);
	const promises = [];
	const dealOne = (uid) =>{
		//现在内存找,没找到去数据库找
		return new Promise((resolve, reject) =>{
			const user = PlayerMgr.getPlayer(uid);
			if(user){
				resolve({nickname: user.nickname, integral: user.integral||0, inviteCodeBindTime: user.inviteCodeBindTime||0,targetUid:user.uid});
			}else{
				require('../../../utils/db/mongodb').getDao('player_info').findOne({uid:uid}, function(err, data){
					if(err){
						console.error('查找玩家失败:',uid);
					}
					resolve({nickname: data.nickname, integral: data.integral||0, inviteCodeBindTime: data.inviteCodeBindTime||0,targetUid:data.uid});
				})
			}
		});
	};
	for(let i = 0; i < members.length; i++){
		promises.push(dealOne(members[i]));
	}
	Promise.all(promises).then((docs) =>{
		const results = docs.filter(doc => !util.isVoid(doc));
		return next(null, {code: 200, results});
	})
};

/**
 * 积分填充
 */
mainHandler.prototype.addIntergral = ({targetUid, num, inviteCode}, session, next) =>{
	const inviteCodeInfo = db.getDao('invite_code_info');
	if(!targetUid){
	// if(!targetUid || !isNaN(Number(num)) || Number(num) <= 0){
		return next(null, {code: 500, error:"参数出错"});
	}
	num = Number(num);
	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	if(!player || !player.vip){
		return next(null, {code: 500, error:'玩家不是vip'});
	}
	if(player.vdot <= 0 && num > 0){
		return next(null, {code: 500, error: 'v点不足'});
	}
	let isRebat = false;
	let bound = {};
	// if(bound){
	// 	if(!bound.boundUid || bound.rebat < 0){
	// 		return next(null, {code: 500, error:"返利参数出错"});
	// 	}
	// 	isRebat = true;
	// }
	new Promise((resolve, reject) =>{
		// if(bound){
		// 	if(!bound.boundUid || bound.rebate < 0){
		// 		return next(null, {code: 500, error:"返利参数出错"});
		// 	}
		// 	isRebat = true;
		// 	resolve();
		// }else{
			inviteCodeInfo.findOne({inviteCode:inviteCode},function(err,invite){
				if(invite && invite.boundUid){
					bound.boundUid = invite.boundUid;
					bound.rebate = invite.rebate ?invite.rebate:0;
					isRebat = true;
				}else{
					bound.rebate = 0;
				}
				resolve();
			});
		// }
	}).then(() =>{
		let dealUids, samePerson = bound && targetUid == bound.boundUid && isRebat;
		if(isRebat && targetUid != bound.boundUid){
			dealUids = [targetUid].concat([bound.boundUid]);
		}else {
			dealUids = [targetUid];
		}
		//const dealUids = isRebat ? [targetUid].concat([bound.boundUid]) : [targetUid];
		let targetNickname;
		let viperId;
		const dealOne = function(oneUid){
			const targetPlayer = PlayerMgr.getPlayer(oneUid);
			console.log('targetPlayer...',targetPlayer);
			if(targetPlayer){
				return new Promise((resolve, reject) =>{
					if(oneUid == targetUid){
						if(!targetNickname){
							targetNickname = targetPlayer.nickname;
							viperId = targetPlayer.viperId;
						}
						targetPlayer.integral += samePerson ? (num > 0 ? Number(num) * (1 + bound.rebate * 0.01) : num) : Number(num);
						MessageService.pushMessageByUids('addCoin', { //返利积分通知
								integral:targetPlayer.integral,
					       }, targetPlayer.uids()); 
						if(isRebat ){
							const addnum = bound.rebate * 0.01 * Number(num);
							const addrebate = bound.rebate ;
							const  isback = true;
							addChangeIntegralRecord(targetUid,targetNickname,addnum,addrebate,isback,inviteCode,viperId);
						}
						// if(session.get('model') == 'discount' && Number(num) > 0){
						// 	player.vdot -= Number(num)  * 0.001;
						// 	//更新房主的V点
						// 	MessageService.pushMessageByUids('addCoin', { //返利积分通知
						// 		vdot:player.vdot,
					 //        }, player.uids()); 
						// }
					}else{
						if(num > 0){
							targetPlayer.integral += Number(num) * bound.rebate * 0.01;
							const addnum = bound.rebate * 0.01 * Number(num);
							const addrebate = bound.rebate ;
							const  isback = true;
							addChangeIntegralRecord(targetPlayer.uid,targetPlayer.nickname,addnum,addrebate,isback,targetPlayer.inviteCode,targetPlayer.viperId);
							MessageService.pushMessageByUids('addCoin', { //返利积分通知
								integral:targetPlayer.integral,
					        }, targetPlayer.uids()); 
						}
					}
					resolve(null);
				})
			}else{
				console.log('oneUid...',oneUid);
				return require('../../../utils/db/mongodb').getDao('player_info').findOne({uid: oneUid}, function(err, user){
					if(err || !user){
						console.error('查找目标玩家失败',oneUid, err);
						return next(null, {code:500, error:'查找目标玩家失败'});
					}
					if(oneUid == targetUid){
						if(!targetNickname){
							targetNickname = user.nickname;
							viperId = user.viperId;
						}
						user.integral += samePerson ? (num > 0 ? Number(num) * (1 + bound.rebate * 0.01) : num) : Number(num);
						if(isRebat){
							const addnum = bound.rebate * 0.01 * Number(num);
							const addrebate = bound.rebate ;
							const  isback = true;
							addChangeIntegralRecord(user.uid,user.nickname,addnum,addrebate,isback,user.inviteCode,viperId);
						}
						// if(session.get('model') == 'discount' && Number(num) > 0){
						// 	// if(bound && bound.boundUid != uid){
						// 	// 	player.vdot -= Number(num) * (1 + bound.rebate * 0.01)  * 0.001;
						// 	// }else{
						// 		player.vdot -= Number(num)  * 0.001;
						// 	// }//折扣模式下扣除V点10%
						// 	//更新房主的V点
						// 	MessageService.pushMessageByUids('addCoin', { //返利积分通知
						// 		vdot:player.vdot,
					 //        }, player.uids()); 

						// }
					}else{
						if(num > 0){ //返回比列积分
							user.integral += Number(num) * bound.rebate * 0.01;
							const addnum = bound.rebate * 0.01 * Number(num);
							const addrebate = bound.rebate ;
							const  isback = true;
							addChangeIntegralRecord(user.uid,user.nickname,addnum,addrebate,isback,user.inviteCode,user.viperId);
						}
					}
					user.save(function(err){
						if(err){
							console.error('在数据库更新玩家积分失败');
						}
					});
				});
			}
		};
		const promises = [];
		for(let i = 0; i < dealUids.length; i++){
			promises.push(dealOne(dealUids[i]));
		}
		Promise.all(promises).then(function(){
			const integralRecord = db.getDao('change_integral');

			let record = {
				uid:targetUid,
				nickname:targetNickname,
				integral : num,
				isback : false,
				rebate: bound.rebate,
				type: num >0 ? 'add':'del',
				time : Date.now(),
				inviteCode : inviteCode,
				viperId :viperId,
			}
			console.log('积分记录',record);
			integralRecord.create(record, function (err, res) {
				if (err || !res) {
					console.error('积分记录保存失败！');
				}
			});
			return next(null, {code: 200,vdot:player.vdot});
		}).catch(err => console.error(err));
	})
};

 //添加返利积分记录
function addChangeIntegralRecord(targetUid,targetNickname,addnum,addrebate,isback,inviteCode,viperId){
	const integralRecord = db.getDao('change_integral');
			let record = {
				uid:targetUid,
				nickname:targetNickname,
				integral : addnum,
				rebate: addrebate,
				isback : isback,
				type: addnum >0 ? 'add':'del',
				time : Date.now(),
				inviteCode : inviteCode,
				viperId :viperId,
			}
			console.log('积分记录',record);
			integralRecord.create(record, function (err, res) {
				if (err || !res) {
					console.error('积分记录保存失败！');
				}
			});
}
/**
 * 请求某个游戏的数据  -系统环境
 * @param {nid}
 * @route: hall.mainHandler.systemGameInfos
 */
mainHandler.prototype.systemGameInfos = ({nid}, session, next) =>{
	
	const game = GamesMgr.getGame(nid);
	if(!game){
		return next(null, {code: 500, error: '未找到指定游戏'});
	} 
	return next(null, {code: 200, infos: game.rooms});
};

/**
 * 轮盘开奖
 * @{params} {bet}  e.g. 10000/100000/1000000
 * @route: hall.mainHandler.roulette
 */
mainHandler.prototype.roulette = ({bet}, session, next) =>{
	if(![10000, 100000, 1000000].includes(Number(bet))){
		return next(null, {code: 500, error: '轮盘压住倍数有误'});
	}
	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	if(player.gold < bet){
		return next(null, {code: 500, error: '玩家金币不足'});
	}
	player.gold -= bet;
	const isRecharge = player.addRmb > 0;
	const awards = {r0: 5,r1: 8, r2: 10, r3: 12, r4: 16, r5: 20, r6: 30, r7: 40};
	const strWeight = [0, 7, 91.2, 0.8, 0.4, 0.3, 0.2, 0.1];   //充值过得权重
	const strWeightSpe = [0, 1, 0, 0, 0, 0, 0, 0];
	const comWeight = [72, 26.8, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2];

	let selectWeight, type;
	if(isRecharge){
		type = 'A';
		if(player.roulette > 0){
			selectWeight = strWeight;
			player.roulette--;
		}else{
			selectWeight = strWeightSpe;
			player.roulette = util.random(1, 3);
		}
	}else{
		selectWeight = comWeight;
		type = 'B';
	}
	const constructWeightArray = selectWeight.map((e,i) =>{
		return {['r'+i]: e};
	});
	const select = util.selectEle(constructWeightArray);
	const award = awards[select] * bet / 10000;
	player.props += award;
	//增加轮盘记录
	require('../../../utils/db/mongodb').getDao('roulette_record').create({uid, type, bet, award, select});

	return next(null, {code: 200, props: player.props, select, award, gold: player.gold});
};

/**
 * 每日夺宝信息
 * @route: hall.mainHandler.dailyIndianaInfo
 */
mainHandler.prototype.dailyIndianaInfo = ({}, session, next) =>{
	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	if(player.dailyIndianaSign.alert){
		player.dailyIndianaSign.alert = false;
	}
	const date = util.dateKey();
	const now = new Date();
	const yestertoday = util.dateKey(new Date(Date.now() - 1000 * 60 * 60 * 24));
	const [hour, minute] = [now.getHours(), now.getMinutes()];
	const dailyIndianaModel = require('../../../utils/db/mongodb').getDao('daily_indiana');
	const countDown = (date, hour, minute, curTime = Date.now()) =>{
		return new Date(Number(date.substr(0, 4)), Number(date.substr(4, 2)) - 1, Number(date.substr(6, 2)),hour, minute).getTime() - curTime;
	};
	async.waterfall([
		cb =>{
			dailyIndianaModel.count({}, function(err, count){
				if(err){
					return cb({code: 500, error: '计算期数失败'+err});
				}
				return cb(null, count);
			});
		},
		(count, cb) =>{
			if(hour < 8){   //八点以前
				dailyIndianaModel.findOne({date: yestertoday}).exec(function(err, doc){
					if(err){
						return cb({code: 500, error: '查找结算面板失败yesterday' + err});
					}
					if(!doc){
						return cb(null, {
							join: false,
							roundback: countDown(date, 8, 0),
							result: {},
							joinsNum: 0,
							jackpot: 0,
							phase: count,
						});
					}else{
						return cb(null, {
							join: false,
							roundback: countDown(date, 8, 0),
							result: (doc.winningNote && doc.winningNote.specialAward[0]) || {},
							joinsNum: doc.participant.length || 0,
							jackpot: doc.jackpot,
							phase: count,
						});
					}
				});
			}else if(hour < 23 || (hour == 23 && minute < 30)){  //参与阶段15的时间改成23

				dailyIndianaModel.findOne({date}).exec(function(err, doc){
					if(err){
						return cb({code: 500, error:'查找今日夺宝记录失败'+err});
					}
					if(!doc){
						dailyIndianaModel.create({
							date,
							jackpot: 5000,
							participant: [],
							awardNote: {
								specialAward: {num: 5000, real: 1, show: 1},
								firstAward: {num: 0, real: 0, show: 0},
								luckAward: {num: 0, real: 0, show: 0},
							},
							winningNote: {specialAward: [], firstAward: [], luckAward: []}, 
						}, function(err, doc){
							if(err){
								return cb({code: 500, error: '创建今日夺宝信息失败'+err})
							}
							return cb(null, {
								join: true,
								roundback: countDown(date, 23, 30),
								result: {
									date,
									jackpot: doc.jackpot,
									participant: doc.participant,
									awardNote: [doc.awardNote.specialAward, doc.awardNote.firstAward, doc.awardNote.luckAward],
								},
								phase: count + 1,
							});
						});
					}else{
						return cb(null, {
							join: true,
							roundback: countDown(date, 23, 30),
							result: {
								date,
								jackpot: doc.jackpot,
								participant: doc.participant,
								awardNote: [doc.awardNote.specialAward, doc.awardNote.firstAward, doc.awardNote.luckAward],
							},
							phase: count,
						})
					}
				});
			}else {
				dailyIndianaModel.findOne({date}).exec(function(err, doc){
					if(err){
						return cb({code: 500, error: '查找结算面板失败today' + err});
					}
					const tomorrow = util.dateKey(new Date(Date.now() + 1000 * 60 * 60 * 24));
					if(!doc){
						return cb(null, {
							join: false,
							roundback: countDown(tomorrow, 8, 0, util.zerotime(Date.now() + 1000 * 60 * 60 * 24)) + countDown(tomorrow, 0, 0),
							result: {},
							joinsNum: 0,
							jackpot: 0,
							phase: count,
						});
					}else{
						return cb(null, {
							join: false,
							roundback: countDown(tomorrow, 8, 0, util.zerotime(Date.now() + 1000 * 60 * 60 * 24)) + countDown(tomorrow, 0, 0),
							result: (doc.winningNote && doc.winningNote.specialAward[0]) || {},
							joinsNum: doc.participant.length || 0,
							jackpot: doc.jackpot,
							phase: count,
						});
					}
				});
			}
		},
	], (err, {join, result, roundback, joinsNum, jackpot, phase}) =>{
		if(err){
			return next(null, err);
		}
		return next(null, {code: 200, join, result, roundback, joinsNum, jackpot, phase});
	});
};

/**
 * 每日夺宝 （参与）
 * @route: hall.mainHandler.dailyIndianaSign
 */
mainHandler.prototype.dailyIndianaSign = ({leave = false}, session, next) =>{
	
	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	if(player.dailyIndianaSign && player.dailyIndianaSign.sign == false){
		return next(null, {code: 500, error: '今日已参与,请明日再来！'});
	}
	if(player.props < 1){
		return next(null, {code: 500, error: '玩家奖券不足'});
	}
	const date = util.dateKey();
	const dailyIndianaModel = require('../../../utils/db/mongodb').getDao('daily_indiana');
	dailyIndianaModel.findOne({date}).exec(function(err, doc){
		if(err){
			return next(null, {code: 500, error: '查找夺宝信息失败'+err});
		}
		if(!doc){
			return next(null, {code: 500, error:'未找到今日夺宝数据'});
		}
		player.props -= 1;
		doc.participant.push({uid, nickname: player.nickname, headurl: player.headurl});
		doc.jackpot += 1000;
		if(doc.participant.length <= 40){
			doc.awardNote.specialAward = {num: doc.jackpot, real: 1, show: 1};
		}else if(doc.participant.length > 40 && doc.participant.length <=100){
			doc.awardNote.specialAward = {num: doc.jackpot * 0.3, real: 1, show: 1};
			const firstAwardNum = 10 - Math.ceil(5000 / (doc.jackpot * 0.7 / 10));
			doc.awardNote.firstAward = {num: doc.jackpot * 0.7 / firstAwardNum, real: firstAwardNum, show: 10};
		}else{
			doc.awardNote.specialAward = {num: doc.jackpot * 0.1, real: 1, show: 1};
			doc.awardNote.firstAward = {num: doc.jackpot * 0.3 / 10, real: 10, show: 10};
			const luckShowNum = Math.ceil(doc.participant.length * 0.4);
			const luckRealNum = luckShowNum - Math.ceil(5000 / (doc.jackpot * 0.6 / luckShowNum));
			doc.awardNote.luckAward = {num: doc.jackpot * 0.6 / luckRealNum, real: luckRealNum, show: luckShowNum};
		}
		player.dailyIndianaSign.sign = false;
		const udtInfo = {
			date : doc.date,
			jackpot: doc.jackpot,
			participant: doc.participant,
			awardNote: doc.awardNote,
			winningNote: doc.winningNote
		};
		dailyIndianaModel.findByIdAndUpdate(doc._id, {"$set": udtInfo}, {new: true},function(){});
		return next(null, {code: 200, result: doc, props: player.props});
	});
};