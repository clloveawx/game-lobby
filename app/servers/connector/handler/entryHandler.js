'use strict';

const TokenService = require('../../../services/TokenService');
const sessionService = require('../../../services/sessionService');
const mailService = require('../../../services/MailService');

const playerMgr = require('../../../utils/db/dbMgr/playerMgr');
const platformMgr = require('../../../utils/db/dbMgr/platformMgr');
const systemMgr = require('../../../utils/db/dbMgr/systemMgr');
const userMgr = require('../../../utils/db/dbMgr/userMgr');
const censusMgr = require('../../../utils/db/dbMgr/censusMgr');
const async = require('async');
const utils = require('../../../utils');
const mongoDB = require('../../../utils/db/mongodb');
const JsonMgr = require('../../../../config/data/JsonMgr');

const gutils = require('../../../domain/games/util');

module.exports = function(app) {
  return new Handler(app);
};

var Handler = function(app) {
  this.app = app;
};

/**
 * 链接服务器 获取账户信息
 * @route: connector.entryHandler.entry
 * @param: uid, token
 */
Handler.prototype.entry = function({uid, token, inviteCode, isRobot = 0}, session, next) {

	const _this = this;

	async.waterfall([
		cb => auth(token, cb),          // 验证token
		cb => this.app.get('sessionService').kick(uid, cb),   // 先踢掉
		cb => session.bind(uid, cb),    // 再绑定
		cb => {
			// 监听离线
			session.on('closed', userLeave.bind(null, this.app));
			
			//在redis和数据库中查找玩家
			playerMgr.getPlayer({uid}, function(err, player) {
				if (err) {
					return cb(`从redis查找玩家${uid}失败`, err);
				}
				if (!player) {    //创建新账号
					const playerModel = mongoDB.getDao('player_info');
					const gameVersion = JsonMgr.get('gameBeat').getById(1).gameVersion;
					mongoDB.getDao('user_info').load_by_uid(function(err, user) {
						if (err) {
							console.error('查找user失败', err);
						}
						playerModel.add(cb, {uid, isRobot, inviteCode, gameVersion, _uid: user._id});
					}, {uid});
				} else {
					return cb(null, playerMgr.newPlayer(player));
				}
			});
		},
		(player, cb) =>{
			if(!player) {
				return next(null, {code: 500, error: '未找到玩家信息'+uid});
			}
			const result = {   //定义最终返回给前台的结果
				user: null,
				games: [],
				VIP_ENV: null,
				viper: null,
				//modeDeclaration: false,
				model: null,
				gameMembers: null,
				startingGoldActivity: false,
				isTodayLogin: false,
				payConfig: null,
				bindPhone: null,
				lastGame: null,
				lastRoom: null,
				closeGames: {},
			};

			//处理玩家月卡
			// if(player.monthlyCard && player.monthlyCard.active && player.monthlyCard.receiveDates.length >= 30){
			// 	player.monthlyCard = {'active': false, 'alert': true, 'receiveDates': [], 'today': true, 'joined': true};
			// }
			// if(player.monthlyCard && player.monthlyCard.active && player.monthlyCard.joined == null){
			// 	player.monthlyCard.joined = true;
			// }else if(player.monthlyCard && !player.monthlyCard.active && player.monthlyCard.joined == null){
			// 	player.monthlyCard.joined = false;
			// }

			player.init(session.frontendId, utils.ip(session));

			const [loginTime, zerotime] = [player.loginTime, utils.zerotime()];
			if(zerotime > loginTime || !loginTime){
				result.isTodayLogin = true;
			}
			player.loginTime = Date.now();

			//初始化玩家游戏记录
			if(utils.isVoid(player.gamesRecord)){
				player.gamesRecord = {
					platform: {},
					system: {},
				};
			}
			return cb(null, player, result);
		},
		(player, result, cb) =>{
			//处理平台创建问题
			if(player.vip && !player.needPlatform){   //不需要创建平台的vip
				result.VIP_ENV = true;
				// 获取 vip平台游戏列表
				platformMgr.getPlatformGames({viper: player.viperId}, function(err, games){
					console.log('=============查看平台下游戏列表的返回格式',{games});
					if(err){
						return next(null, err);
					}
					result.viper = player.viperId;
					// 玩家会进入到该平台
					platformMgr.getPlatform({viper: player.viperId}, function(err, platform){
						if(err){
							return next(null, err);
						}
						platform.envMembers.push({uid: player.uid, sid: player.sid});
						// if(platform.vipModel == null){
						// 	result.modeDeclaration = true;
						// }
						games = gutils.gameFieldsReturn(games, true);

						//平台游戏显示
						gutils.pGameNeedBuy(games).then(gs =>{

							result.games = gs;
							result.model = platform.vipModel;
							result.gameMembers = platform.gameMembers;

							//修改平台的数据到redis
							platformMgr.platformIntoRedis(platform).then(() =>{
								return cb(null, player, result);
							}).catch(err =>{
								console.error('进入游戏 修改平台数据失败');
							});
						}).catch(err =>{
							return next(null, err);
						});
					});
				});
			}else if(player.vip && player.needPlatform){   //需要创建平台
				if(player.inviteCode){   //如果玩家有邀请码,不能创建平台
					return next(null, {code: 500, error: '玩家已有邀请码，无法创建平台'});
				}else {
					player.inviteCodeBindTime = Date.now();   //建立vip平台的时间
					player.needPlatform = false;
					player.viperId = uid;

					//实例化一个新平台
					const newPlatform = platformMgr.createPlatform(player.uid);
					newPlatform.members.push(player.uid); //自己为平台第一个成员
					newPlatform.vipModel = 'discount';	 //将平台固定为折扣模式
					result.VIP_ENV = true;
					result.model = newPlatform.vipModel;
					result.viper = player.uid;
					// 玩家会进入到该平台
					newPlatform.envMembers.push({uid: player.uid, sid: player.sid});

					//现在该平台下还没有任何已购买的游戏
					gutils.pGameNeedBuy([]).then(gs =>{

						//result.modeDeclaration = true;
						result.games = gs;
						result.model = newPlatform.vipModel;
						result.gameMembers = newPlatform.gameMembers;

						//修改平台的数据到redis
						platformMgr.platformIntoRedis(newPlatform).then(() =>{

							//修改vip玩家的数据到redis
							playerMgr.updatePlayer(player, function(err){
								if(err){
									return next(null, err);
								}
								return cb(null, player, result);
							});
						}).catch(err =>{
							console.error('进入游戏 修改平台数据失败');
						});
					}).catch(err =>{
						return next(null, err);
					});
				}
			}else{    //玩家不是vip的情况
				//玩家存在vip环境
				if(player.viperId){
					result.VIP_ENV = true;
					//获取该vip平台
					platformMgr.getPlatform({viper: player.viperId}, function(err, platform){
						if(err){
							return next(null, err);
						}
						result.viper = player.viperId;
						// 玩家会进入到该平台
						platform.envMembers.push({uid: player.uid, sid: player.sid});
						result.model = platform.vipModel;
						// 获取 vip平台游戏列表
						platformMgr.getPlatformGames({viper: player.viperId}, function(err, games) {
							console.log('=============查看平台下游戏列表的返回格式', {games});
							if (err) {
								return next(null, err);
							}
							result.games = gamesWeightSort(games);
							//修改平台的数据到redis
							platformMgr.platformIntoRedis(platform).then(() =>{
								return cb(null, player, result);
							}).catch(err =>{
								console.error('进入游戏 修改平台数据失败');
							});
						});
					});
				}else{
					//普通玩家
					result.VIP_ENV = false;
					//获取所有系统游戏
					systemMgr.allGames().then(function(allGames){
						result.games = allGames;
						// 玩家进入到普通环境
						censusMgr.addPlayerIntoSystem(player.uid).then(() =>{
							return cb(null, player, result)
						}).catch(err =>{
							console.error(`玩家${player.uid}加入系统游戏环境失败` + err);
						})
					}).catch(err =>{
						console.error(`玩家${player.uid}获取所有的系统游戏失败` + err);
						return next(null, {code:500, error: '获取所有的系统游戏失败' + err});
					});
				}
			}
		},
		
		//处理版本问题
		(player, result, cb) =>{
			//成功进入一次 加一个
			//require('../../../domain/hall/player/census').loginTotal.add(uid);

			//增加登录记录
			userLoginRecord({uid}, player);

			//记录玩家登录时间
			player.loginTime = Date.now();
			player.loginCount += 1;
			let payConfig = JsonMgr.get('payConfig');
			let goldTable = JsonMgr.get('gold');
			result.bindPhone = goldTable.getById(200).num;
			let payType = {};
			payConfig.datas.forEach(m=>{
				payType[m.name] = m.url;
			});

			//处理玩家最近游戏以及房间问题
			const env = result.viper ? result.viper : 'system';
			if(utils.isVoid(player.lastGameContents['system'])){
				player.lastGameContents['system'] = {nid:'', room:{}};
			}
			if(utils.isVoid(player.lastGameContents[env])){
				player.lastGameContents[env] = {nid:'', room:{}};
			}
			result.lastGame = player.lastGameContents[env].nid;
			result.lastRoom = player.lastGameContents[env].room;

			const closeGame = mongoDB.getDao('close_game');
			const inviteCodeModel = mongoDB.getDao('invite_code_info');
			let allgames = JsonMgr.get('games');
			let list = [], activation;
			let gameVersion = JsonMgr.get('gameBeat').getById(1).gameVersion;
			
			if(gameVersion == 1){    //网吧版
				async.waterfall([
					callback => {
						closeGame.find({}, function(err, arr){
							if(err){
								return callback();
							}
							allgames.datas.forEach(m=>{
								const temp = arr.find(x => x.nid === m.nid);
								if(temp){
									result.closeGames[temp.nid] = temp.status;
								}else{
									result.closeGames[m.nid] = true;
								}
							});
							return callback();
						});
					},
					(callback) =>{
						//渠道游戏开关控制显示的游戏列表
						gutils.channelGameSwich({player, games: result.games, gameVersion}).then(games =>{
							list = games;
							return callback();
						})
					},
					(callback) =>{
						//处理启动金
						mongoDB.getDao('starting_gold').load_one(function(err, doc){
							if(err){
								return next(null, err);
							}
							const date = utils.dateKey();
							if(doc && doc.activation){
								result.startingGoldActivity = doc.activation;
								if(!player.allowances){
									player.allowances = {
										num: 2000 + 500 * (doc.day - 1),
										today: false,
										tomNum: 0,
										date : date,
									}
								}else{
									if(player.allowances.date != date){
										if(player.allowances.today){
											player.allowances.today = false;
										}
										player.allowances.num = 2000 + 500 * (doc.day - 1);
										player.allowances.date = date;
									}
								}
							}else{
								player.allowances = null;
							}
							return callback();
						}, {});
					}
				], function(){
					//设置玩家到redis
					playerMgr.updatePlayer(player, function(err){
						if(err){
							return next(null, err);
						}

						result.user = player.strip();
						result.games = list;
						result.payConfig = payType;
						
						return cb(null, result);
					});
				});
			}else {                  //vip 版本
				closeGame.find({}, function(err, arr){
					if(err){
						console.error('查找关闭游戏失败');
					}
					allgames.datas.forEach(m=>{
						const temp = arr.find(x => x.nid === m.nid);
						if(temp){
							result.closeGames[temp.nid] = temp.status;
						}else{
							result.closeGames[m.nid] = true;
						}
					});
					//设置玩家到redis
					playerMgr.updatePlayer(player, function(err) {
						if (err) {
							return next(null, err);
						}

						result.user = player.strip();
						result.payConfig = payType;
						
						return cb(null, result);
					});
				});
			}
		},
	], (err, {user, games, VIP_ENV, viper, payConfig, bindPhone, model, gameMembers, lastGame, lastRoom, closeGames, startingGoldActivity,isTodayLogin})=> {
		if(err) {
			return next(null, {code: 500, error: '处理玩家进入游戏失败'});
		}

		sessionService.sessionSet(session, {VIP_ENV, viper, model});
		console.log(user.nickname + '====================进入游戏');
		next(null, {
			code: 200,
			user,
			games: gutils.gameFieldsReturn(games),
			vipScence:VIP_ENV,
			payConfig,
			bindPhone,
			model,
			gameMembers,
			lastGame,
			lastRoom,
			closeGames,
			startingGoldActivity,
			isTodayLogin
		});
	});
};

// 身份验证
const auth = function (token, cb) {
	const res = TokenService.parse(token);
	if (!res) {
		return cb(new Error('token非法'));
	}
	if (!TokenService.checkExpire(res)) {
		return cb(new Error('token过时'));
	}
	cb(null);
};

//玩家登录记录
const userLoginRecord = ({uid, params}, playerInfo) =>{
	const playerLoginRecord = mongoDB.getDao('player_login_record');
	const [starTime, endTime] = [utils.zerotime(), utils.zerotime() + 24*60*60*1000];
	
	const addRecord = ({nickname, gold, integral, addRmb}) =>{
		playerLoginRecord.add(function(err){
			if(err){
				console.error('增加登录记录失败' + err);
			}
		}, {
			conds: {uid, loginTime: {'$gt': starTime, '$lt': endTime}},
			$set: (params && params.$set) || {
				nickname,
				loginTime: Date.now(),
				gold,
				integral,
				addRmb,
			},
			config: {
				upsert: true
			}
		});
	};
	
	if(!playerInfo){
		playerMgr.getPlayer({uid}, function(err, player){
			if(err){
				console.log(`查找玩家${uid}失败 userLoginRecord`, err);
			}
			if(!player){
				console.log(`未找到玩家${uid} userLoginRecord`);
			}
			addRecord({nickname: player.nickname, gold: player.gold, integral: player.integral, addRmb: player.addRmb});
		})
	}else{
		addRecord({
			nickname: playerInfo.nickname,
			gold: playerInfo.gold,
			integral: playerInfo.integral,
			addRmb: playerInfo.addRmb,
		});
	}
};

// 退出
function userLeave(app, session){
	if(!session || !session.uid) {
		return;
	}
	// /const isUserExist = list.indexOf(session.uid) !== -1;
	
	const {uid, isVip, nid, roomCode, viper} = gutils.sessionInfo(session);
	
	//先做离开房间和游戏的处理
	offlineLeave({uid, nid, roomCode, isVip, viper}, function(err){
		if(err){
			console.error('处理掉线离开出错:', err);
		}
		sessionService.sessionSet(session, {game: null, roomCode: null, VIP_ENV: null});
		
		leave({uid}, function(){
			session.unbind(uid, function(){});
		});
	});
}

/**
 * 掉线离开
 */
function offlineLeave({uid, nid, roomCode, isVip, viper}, next){
	
	//先找到该玩家
	playerMgr.getPlayer({uid}, function(err, player) {
		if(err){
			return next(`查找玩家${uid}失败 offlineLeave:`, err);
		}
		if(!player){
			return next(`未找到玩家${uid} offlineLeave:`);
		}
		// vip环境需要把玩家从环境中离开
		if(isVip){
			platformMgr.getPlatform({viper}, function(err, platform){
				platform.removeEnvMember(uid);
				// 说明玩家在某个游戏中
				if(nid && !player.vip){
					platform.removeGameMember(nid, uid);
				}
				platform.udtPlatformToRedis();
			});
		}else{
			censusMgr.deleteplayerIntoSystem(uid);
		}
		
		if(nid == null){
			return next(null);
		}else{
			
			gutils.getGameByEnv({viper, nid}).then(game =>{
				
				//玩家从游戏中离开
				const userGameIndex = game.users.findIndex(user => user.uid == uid);
				if(userGameIndex != -1){
					game.users.splice(userGameIndex, 1);
					gutils.udtGameByEnv(game);
				}
				
				//判断玩家是否进入房间
				if(roomCode == null){
					return next(null);
				}else{
					player.leaveRoomTime = Date.now();
					
					//生成积分记录
					const addRecord = function () {
						const integralModel = require('../../../utils/db/mongodb').getDao('integral_record');
						integralModel.create({
							viperUid: viper,
							uid,
							nickname: player.nickname,
							duration: player.leaveRoomTime - player.enterRoomTime,
							createTime: player.leaveRoomTime,
							integral: player.roomProfit,
							gname: game.zname,
							settleStatus: false
						}, function(err, data){
							if(err || !data){
								console.error('生成积分记录失败');
							}
							player.roomProfit = 0;
							playerMgr.updatePlayer(player, function(){});
						});
					};
					
					//玩家离开房间
					gutils.getRoomByEnv({viper, nid, roomCode}).then(room =>{
						const userRoomIndex = room.users.findIndex(user => user.uid == uid);
						if(userRoomIndex != -1){
							room.users.splice(userRoomIndex, 1);
							gutils.udtRoomByEnv(room);
						}
					});
					
					//做每个游戏玩家离开房间的逻辑处理
					switch (nid){
						// case '1': case '2': case '7':
						// 	this.app.rpc.games.gameRemote.slotsOfflineMail(null, {
						// 		isVip, uid, roomCode, viper, nid,
						// 	}, function(err){
						// 		if(err){
						// 			return next({error: err});
						// 		}
						// 		if(isVip){
						// 			addRecord();
						// 		}
						// 		console.log(`${game.nid} 中掉线离开`);
						// 		return next(null);
						// 	});
						// 	break;
						// case '4':
						// 	this.app.rpc.games.gameRemote.getUserProfit(null, {isVip, uid, roomCode, viper, offLine: true}, function(err, profit){
						// 		if(err){
						// 			return next({error: err});
						// 		}
						// 		if(isVip){
						// 			addRecord();
						// 		}
						// 		if(profit == null){
						// 			return next(null);
						// 		}
						// 		const moneyType = isVip ? 'integral' : 'gold';
						// 		user[moneyType] += profit;
						// 		return next(null);
						// 	});
						// 	break;
						// case '12':
						// 	this.app.rpc.pharaoh.mainRemote.getUserProfit(null, {isVip, uid, roomCode, viper, offLine: true}, function(err, profit){
						// 		if(err){
						// 			return next({error: err});
						// 		}
						// 		if(isVip){
						// 			addRecord();
						// 		}
						// 		if(profit == null){
						// 			return next(null);
						// 		}
						// 		const moneyType = isVip ? 'integral' : 'gold';
						// 		user[moneyType] += profit;
						// 		return next(null);
						// 	});
						// 	break;
						// case '3':
						// 	this.app.rpc.huoguo.mainRemote.kickUserFromChannel(null, {roomCode, uid, isVip, viper}, function(data){
						// 		return next(null);
						// 	});
						// 	break;
						// case '8':
						// 	this.app.rpc.games.baijiaRemote.leave(null,uid,game.nid,isVip,roomCode,(err)=>{
						// 		console.log(err);
						// 		return next(null);
						// 	});
						// 	break;
						// case '9':
						// 	this.app.rpc.games.bairenRemote.leave(null, uid, game.nid,isVip,roomCode,(err) => {
						// 		console.log(err);
						// 		console.log(`${game.nid} 中掉线离开`);
						// 		return next(null);
						// 	});
						// 	break;
						// case '11':
						// 	this.app.rpc.games.attRemote.leave(null, uid, game.nid,isVip,(err) => {
						// 		console.log(err);
						// 		console.log(`${game.nid} 中掉线离开`);
						// 		return next(null);
						// 	});
						// 	break;
						// case '15':
						// 	this.app.rpc.games.bipaiRemote.leave(null,uid,game.nid,isVip,(err)=>{
						// 		console.log(err);
						// 		return next(null);
						// 	});
						// 	break;
						// case '17':
						// 	this.app.rpc.games.dotRemote.leave(null,uid,game.nid,isVip,(err)=>{
						// 		console.log(err);
						// 		return next(null);
						// 	});
						// 	break;
						// case '10':
						// 	this.app.rpc.games.pirateRemote.leave(null,uid,isVip,(err)=>{
						// 		if(isVip){
						// 			addRecord();
						// 		}
						// 		console.log(err);
						// 		return next(null);
						// 	});
						// 	break;
						default:
							if(isVip){
								addRecord();
							}
							console.log(`${game.name} 中掉线离开`);
							return next(null);
					}
				}
			});
		}
	});
}

function slotsOfflineMail({isVip, uid, roomCode, viper, nid}){
	switch(nid){
		case '1':
			const slots777Memory = require('../../../domain/games/slots777/memory');
			envRecord = isVip ? slots777Memory.vipRecord : slots777Memory.record;
			if(!envRecord[uid]){
				return next(null);
			}
			record = util.last(envRecord[uid].record);
			if(envRecord[uid] && (Date.now() - envRecord[uid].time) < 1000 * 3){
				sendMail({name: "slots777", bet: record.bet, win: record.win, isVip}, uid);
			}
			return next(null);
	}
}

/**
 * slots游戏掉线邮件
 */
const sendMail = (opts, uid, littleGame = false) =>{
	const moneyType = opts.isVip ? "积分" : "金币";
	mailService.generatorMail({
		name: '游戏中断',
		content: littleGame ? '由于断线/退出游戏, 您在'+opts.name+'中的盈利已自动结算' + '\n赢得'+opts.win+`${moneyType}。`
			: '由于断线/退出游戏, 您在'+opts.name+'游戏中押注'+opts.bet+ `${moneyType}已自动结算` + '\n赢得'+opts.win+`${moneyType}。`,
		//attachment: {[opts.isVip ? 'integral' : 'gold']: opts.win},
	}, uid, function(err, mailDocs){});
};

/**
 * 用户离线
 */
function leave({uid}, cb) {
	playerMgr.getPlayer({uid}, function(err, player) {
		if (err) {
			return next(`查找玩家${uid}失败 leave:`, err);
		}
		if (!player) {
			return next(`未找到玩家${uid} leave:`);
		}
		player.lastLogoutTime = Date.now();
		
		playerMgr.updatePlayer(player, function(){
			//离线记录
			userLoginRecord({uid, $set: {
				'leaveTime':Date.now(),
			}}, player);
			
			console.log(`${player.nickname} 成功下线`);
			return cb();
		});
	});
}