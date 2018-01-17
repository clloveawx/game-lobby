'use strict';
let  sessionId ; //验证码的标识

const TokenService = require('../../../services/TokenService');
const sessionService = require('../../../services/sessionService');
const isOnline = require('../../../http/isOnline');
const RongcloudSmsService = require('../../../services/RongcloudSmsService');

const playerMgr = require('../../../utils/db/dbMgr/playerMgr');
const platformMgr = require('../../../utils/db/dbMgr/platformMgr');
const systemMgr = require('../../../utils/db/dbMgr/systemMgr');
const userMgr = require('../../../utils/db/dbMgr/userMgr');
const usefulInfoMgr = require('../../../utils/db/dbMgr/usefulInfoMgr');
const async = require('async');
const utils = require('../../../utils');
const mongoDB = require('../../../utils/db/mongodb');
const JsonMgr = require('../../../../config/data/JsonMgr');

const Promise = require('bluebird');
const gamesWeightSort = require('../../../domain/games/util').gamesWeightSort;

const list = [];

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

	if(list.indexOf(uid) !== -1){
		return next(null, {code: 500, error: '玩家已经进入游戏平台'});
	}
	list.push(uid);

	async.waterfall([
		cb => auth(token, cb),          // 验证token
		cb => this.app.get('sessionService').kick(uid, cb),   // 先踢掉
		cb => session.bind(uid, cb),    // 再绑定
		cb => {
			// 监听离线
			session.on('closed', userLeave.bind(null, this.app));

			const playerModel = mongoDB.getDao('player_info');
			playerModel.load_by_uid(function(err, player){
				if(err){
					cb(err);
				}
				if(!player){
					const gameVersion = JsonMgr.get('gameBeat').getById(1).gameVersion;
					console.log('没有玩家新建==============================');
					mongoDB.getDao('user_info').load_by_uid(function(err, user){
						if(err){
							console.error('查找user失败', err);
						}
						playerModel.add(cb, {uid, isRobot, inviteCode, gameVersion, _uid: user._id});
					}, {uid});
				}else{
					cb(null, playerMgr.newPlayer(player));
				}
			}, {uid});
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
						const nowTime = Date.now();
						games = games.map(g =>{
							return {
								nid: g.nid,
								roomUserLimit: g.roomUserLimit,
								topicon: g.topicon,
								name: g.name,
								time: g.gameStartTime + g.gameHaveTime - nowTime,
							}
						});

						//平台游戏显示
						pGameNeedBuy(games).then(gs =>{

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

					//现在改平台下还没有任何已购买的游戏
					pGameNeedBuy([]).then(gs =>{

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
						platform.envMembers.push(player.uid);
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
					systemMgr.allGames().then(games =>{
						result.games = games;
					}).catch(err =>{
						console.error('获取所有系统游戏失败' + err);
						return next(null, {code: 500, error: '获取所有系统游戏失败'});
					});


					systemMgr.allGames().then(function(allGames){
						result.games = allGames;
						// 玩家进入到普通环境
						usefulInfoMgr.addPlayerIntoSystem(player.uid).then(() =>{
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
		(player, result, cb) =>{     //处理版本问题
			//成功进入一次 加一个
			//require('../../../domain/hall/player/census').loginTotal.add(uid);

			//增加登录记录
			userLoginRecord(player.uid);

			//记录玩家登录时间
			player.loginTime = Date.now();
			player.loginCount += 1;
			let payConfig = JsonMgr.get('payConfig');
			let goldTable = JsonMgr.get('gold');
			result.bindPhone = goldTable.getById(200).num;
			let payType={};
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
						if(player.inviteCode){
							inviteCodeModel.load_one(function(err, codeInfo){
								if(err){
									return next(null, err);
								}
								inviteCodeModel.load_one(function(err, viperCodeInfo){
									if(err){
										return next(null, err);
									}
									if(viperCodeInfo.games.length > 0){
										result.games.forEach(m =>{
											const temp = viperCodeInfo.games.find(x => x.nid === m.nid);
											if(temp && temp.status === true){
												list.push(m);
											}
										});
									}else{
										//这个是渠道下面的玩家,然后该渠道没有设置哪些游戏是否开放
										list = result.games;
									}
									return callback();
								}, {
									uid: codeInfo.viper,
								});
							}, {
								inviteCode: player.inviteCode,
							});
						}else{ //这个是渠道本身没有邀请码进行查询自己开放了哪些有些
							inviteCodeModel.load_one(function(err, codeInfo){
								if(err){
									return next(null, err);
								}
								if(codeInfo && codeInfo.games.length > 0){
									result.games.forEach(m=>{
										const temp = codeInfo.games.find(x => x.nid === m.nid);
										if(temp && temp.status === true){
											list.push(m);
										}
									});
								}else{ //这个是渠道本身进入的接口然后没有设置哪些游戏开放
									list = result.games;
								}
								return callback();
							}, {
								uid
							});
						}
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

						//获取user_info
						userMgr.getUser({uid: player.uid}, function(err, user){
							if(err){
								console.error('进入游戏大厅获取user-info失败', err);
							}
							cb(null, result, user);
						});
					});
				});
			}else {                  //vip 版本
				console.log('33333333333333333333333333333333333333');
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

						//获取user_info
						userMgr.getUser({uid: player.uid}, function(err, user){
							if(err){
								console.error('进入游戏大厅获取user-info失败', err);
							}
							cb(null, result, user);
						});
					});
				});
			}
		}
	], (err, {user, games, VIP_ENV, viper, payConfig, bindPhone, modeDeclaration, model, gameMembers, lastGame, lastRoom,closeGames, startingGoldActivity,isTodayLogin}, userInfo)=> {
		if(err) {
			list.remove(uid);
			return next(null, {code: 500, error: '处理玩家进入游戏失败'});
		}
		list.remove(uid);
		sessionService.sessionSet(session, {VIP_ENV, viper, model});
		console.log(userInfo.nickname + '====================进入游戏');
		next(null, {code: 200, user, games: games.filter(g =>![].includes(g.nid)).map(game => {
			const {nid, heatDegree, roomUserLimit, topicon, name, needBuy,time} = game;
			return {nid, heatDegree, roomUserLimit, topicon, name, needBuy,time};
		}), vipScence:VIP_ENV, payConfig, bindPhone, modeDeclaration, model, gameMembers, lastGame, lastRoom, closeGames, startingGoldActivity,isTodayLogin});
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

//平台游戏显示 未购买的游戏
const pGameNeedBuy = (pGames) =>{
	//获取平台显示的需要购买的游戏列表
	return systemMgr.allGames().then(function(allGames){
		console.log('查看所有系统游戏的显示格式================',allGames);
		//未购买的游戏列表
		const addGames = allGames.filter(game => !pGames.map(g => g.nid).includes(game.nid));
		addGames.forEach(g =>{
			g.needBuy = true;
		});
		return Promise.resolve(gamesWeightSort(pGames).concat(addGames));
	}).catch(err =>{
		return Promise.reject({code:500, error: '获取所有的系统游戏失败' + err});
	});
};

//玩家登录记录
const userLoginRecord = (uid) =>{
	const playerLoginRecord = mongoDB.getDao('player_login_record');
	const [starTime, endTime] = [utils.zerotime(), utils.zerotime() + 24*60*60*1000];

	playerMgr.getPlayerTotalInfo(uid).then(({player, user}) =>{
		playerLoginRecord.add(function(err){
			if(err){
				console.error('增加登录记录失败' + err);
			}
		}, {
			conds: {uid, loginTime: {'$gt': starTime, '$lt': endTime}},
			$set: {
				nickname: user.nickname,
				loginTime: Date.now(),
				gold: user.gold,
				integral: player.integral,
				addRmb: player.addRmb,
			},
			config: {
				upsert: true
			}
		});
	}).catch(err =>{
		console.error('玩家登录记录失败', err);
	});
};

// 退出
function userLeave(app, session){
	if(!session || !session.uid) {
		return;
	}
	const isUserExist = list.indexOf(session.uid) !== -1;

	const uid = session.uid;
    const nid = session.get('game');
    const roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
	//先做离开房间和游戏的处理
	app.rpc.hall.gameRemote.offlineLeave(session, {uid,nid,roomCode,isVip, viper: session.get('viper')}, (err)=>{
		if(err){
			console.error(err);
		}
		sessionService.sessionSet(session, {game: null, roomCode: null, VIP_ENV: null});
		if(isUserExist){
			return;
		}
		app.rpc.hall.playerRemote.leave(session, {uid: session.uid, nid}, (user) => {
			session.unbind(uid, function(){
				const isplayer = isOnline.getLeave();
				if(isplayer) {
					isOnline.removeLeave(uid);
					isplayer.cb()
				};
				console.log(user.nickname, '离开游戏');
			})
		});
	})
}

/**
 * 用户切换帐号
 * @param {cellPhone, passWord}
 * @route connector.entryHandler.isCanChange
 */
Handler.prototype.isCanChange = function ({cellPhone, passWord}, session, next){
	let uid = session.uid;
	if(!cellPhone){
		return next(null, {code: 500, error:'请输入账号'});
	}
	if(!passWord){
		return next(null, {code: 500, error:'请输入密码'});
	}
	const app = this.app;
	this.app.rpc.hall.playerRemote.changeAccount(session, {uid, passWord, cellPhone}, (err, isCanChange) =>{
		if(err){
			return next(null, err)
		}
		return next(null, {code: 200, isCanChange});
	})
};	

/*
*  获取验证码
**/
Handler.prototype.getCellCode = function (msg, session, next) {
	let cellPhone = msg.cellPhone;
	const dao = db.getDao('user_info');
	dao.findOne({cellPhone:cellPhone},function(err,data){
		if(err){
			return next(null,{code:500,error:'获取验证码失败'});
		}else{
			RongcloudSmsService.getAuthcode(cellPhone,function(err,data){
				sessionId = data.sessionId;
				return next(null, {code: 200});
			});
		}
	});
};

/*
*  找回密码
**/
Handler.prototype.getBackPassWord = function (msg, session, next) {
	const dao = db.getDao('user_info');
	let code = msg.code;
	RongcloudSmsService.auth(sessionId,code,function(err,data){
		if(data.success ===true){
			dao.findOneAndUpdate({cellPhone: msg.cellPhone}, {$set: {passWord:msg.passWord}},{new:true}, function(err, res) {
				err && logger.error('保存数据库失败');
				if(err){
					return next(null, {code: 500,error:'验证失败'})
				}		
				return next(null, {code: 200,id:res.id})
			});
		}else{
			return next(null, {code: 500,error:'验证失败'})
		}
	});
};