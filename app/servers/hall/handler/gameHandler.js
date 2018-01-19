'use strict';

const async = require('async');
const gutils = require('../../../domain/games/util');
const {playerMgr, platformMgr, systemMgr, censusMgr} = require('../../../utils/db/dbMgr');
const sessionService = require('../../../services/sessionService');
const jsonMgr = require('../../../../config/data/JsonMgr');
const msgService = require('../../../services/MessageService');
const util = require('../../../utils');
const db = require('../../../utils/db/mongodb');

const pomelo = require('pomelo');

module.exports = function(app) {
    return new gameHandler(app);
};

var gameHandler = function(app) {
    this.app = app;
};

/**
 * created by CL
 * 处理进入房间
 */
function dealEnterRoom({roomCode, session, fast = false}, next){
	
	if(roomCode == null && !fast){
		return next(null, {code: 500, error: '缺少参数  hall.gameHandler.enterRoom'});
	}
	const {isVip, viper, uid, nid, sid} = gutils.sessionInfo(session);
	const env = viper == null ? 'system' : viper;
	const moneyType = isVip ? 'integral' : 'gold';
	const _app = this.app;
	let minBet = 0, maxBet;   //777游戏房间押注额度控制
	
	async.waterfall([
		cb =>{
			playerMgr.getPlayer({uid}, function(err, player) {
				if (err) {
					return next(null, err);
				}
				if (!player) {
					return next(null, {code: 500, error: `玩家不存在: ${uid}`});
				}
				if(player.vip && isVip){
					return next(null, {code: 500, error: 'vip玩家不能进入机器!'})
				}
				//根据环境获取游戏
				gutils.getGameByEnv({viper, nid}).then(game =>{
					if(!game){
						return next(null, {code: 500, error: `未找到游戏${nid}`});
					}
					if(nid !== game.nid){
						return next(null, {code: 500, error:'玩家已进入其他游戏'});
					}
					if(fast){
						//获取该游戏所有有空位房间
						gutils.getRoomsByGame(game).then(rooms =>{
							// 所有未坐满的房间(开启的+关闭的)
							const canUseRooms = rooms.filter(room => {
								if(['1'.includes(nid)]){   //777游戏有进入房间的金钱限制
									const avgAward = room.users.length === 0 ? 0 : room.matchDot / 0.1 / room.users.length;
									const avgBet = avgAward / (600 / 10) / 0.71;
									return (room.users.length < game.roomUserLimit) && (player[moneyType] >= avgBet * 5);
								}else{
									return room.users.length < game.roomUserLimit;
								}
							});
							//按照房间人数正序 房间奖池倒序 房间号正序
							const selectRoom = util.sortWith([
								(r1, r2) => r1.users.length - r2.users.length,
								(r1, r2) => r2.jackpot - r1.jackpot,
								(r1, r2) => Number(r1.roomCode) - Number(r2.roomCode)
							])(canUseRooms)[0];
							
							//如果没有符合条件的房间,新建一个房间
							if(selectRoom == null){
								gutils.insRoom({isVip, viper, nid}, game.users).then(insRoom =>{
									const newRoom = gutils.newRoomJackpot(insRoom, true);
									return cb(null, player, game, newRoom);
								});
							}else{
								//如果选到的是已经关闭的房间,则将该房间开启
								if(selectRoom.open = false){
									selectRoom.open = true;
								}
								return cb(null, player, game, selectRoom);
							}
						});
					}else{
						//根据环境获取房间
						gutils.getRoomByEnv({viper, nid, roomCode}).then(room =>{
							if(!room){
								return next(null, {code: 500, error: `未找到房间${roomCode}`});
							}
							if(room.users.find(user => user.uid === uid)){
								return next(null, {code:500, error: '玩家已在游戏中'});
							}
							if(room.users.length === game.roomUserLimit){
								return next(null, {code: 500, error: '该机器无法容纳更多玩家'});
							}
							return cb(null, player, game, room);
						});
					}
				});
			})
		},
		(player, game, room, cb) =>{
			//处理777游戏  和 火锅游戏
			if(nid === '1'){
				
				//处理能否进入房间控制 房间社交比赛 房间最小押注
				const avgAward = room.users.length === 0 ? 0 : room.matchDot / 0.1 / room.users.length;
				const avgBet = avgAward / (600 / 10) / 0.71;
				if(player[moneyType] >= avgBet * 5){
					//房间里没有玩家并且房间里没有社交比赛回合时, 在该房间创建回合
					if(room.users.length === 0 && room.socialRound == null){
						//TODO  room会丢失引用关系，里面的处理已经不通了
						require('../../../services/socialService')(room, viper);
					}
					
					minBet = avgBet / 250 > 250000 ? 250000 : avgBet / 250;
				}else{
					return next(null, {code: 500, error: `进入该房间需要金额为${Math.ceil(avgBet * 5)}`});
				}
				
				//处理最大押注解锁
				if(player.unlock[nid] == null){
					player.unlock[nid] = {};
				}
				if(player.unlock[nid][env] == null){
					player.unlock[nid][env] = 0;
				}
				if(player[moneyType] * 0.1 >= player.unlock[nid][env] * 25){
					player.unlock[nid][env] = Math.floor(player[moneyType] * 0.1 * 0.04);
					if(player.unlock[nid][env] > 10000){
						player.unlock[nid][env] = 10000;
					}
				}
				maxBet = player.unlock[nid][env];
				
				return cb(null, player, game, room);
			}else if(nid === '3'){
				//对于火锅游戏,如果该房间没有开始回合，则开启回合
				_app.rpc.huoguo.mainRemote.findRound(session, isVip, viper, roomCode, sid, uid, room, (doc) =>{
					
					if(room.users.filter(u =>!u.uid.startsWith("ai")).length <= 1 && room.socialRound == null){
						require('../../../domain/games/hotpot/socialRound.js')(room, null, _app);
						//this.app.rpc.huoguo.mainRemote.startSocialRound(null,room,function(){});
					}
					if(doc && doc.aiLeave){
						// 如果需要从房间里离开一个机器人
						const userIndex = room.users.findIndex(user => user.uid === doc.uid);
						room.users.splice(userIndex, 1);
						
						//通知处在机器列表的所有玩家有人退出机器
						censusMgr.getPlayerAtRoomLists({viper, nid}).then(msgUsers =>{
							msgService.pushMessageByUids('changeRoomInfo', {
								users: room.users,
								nid,
								roomCode,
							}, msgUsers);
						});
					}
					return cb(null, player, game, room);
				});
			}else{
				return cb(null, player, game, room);
			}
		},
		(player, game, room, cb) =>{
			//处理移植的游戏
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			return cb(null, player, game, room);
		}
	], function(err, player, game, room){
		
		player.enterRoomTime = Date.now();
		room.users.push({uid, sid});
		sessionService.sessionSet(session, {roomCode});
		
		let envLGC = player.lastGameContents[env];
		if(envLGC.nid != nid){
			envLGC.nid = nid;
		}
		envLGC.room[nid] = roomCode;
		
		//通知前端有人进入机器
		censusMgr.getPlayerAtRoomLists({viper, nid}).then(msgUsers =>{
			msgService.pushMessageByUids('changeRoomInfo', {
				users: room.users,
				nid,
				roomCode,
			}, msgUsers);
		});
		
		//保存玩家的修改
		playerMgr.updatePlayer(player, function(err){
			if(err){
				console.error(`保存玩家${uid}的修改失败`, err);
			}
			//保存房间的修改
			gutils.udtRoomByEnv(room).then(() =>{
				return next(null, {
					code:200,
					user: player,
					roomCode,
					users: room.users,
					minBet,
					maxBet,
					socialDot: room.socialDot
				});
			});
		});
	});
}

/**
 * created by CL
 * 进入房间
 * @route：hall.gameHandler.enterRoom
 */
gameHandler.prototype.enterRoom = function({roomCode}, session, next) {
	dealEnterRoom({roomCode, session}, next);
};

/**
 * created by CL
 * 快速进入房间
 * @route: hall.gameHandler.enterRoomQuickly
 */
gameHandler.prototype.enterRoomQuickly = ({}, session, next) =>{
	dealEnterRoom({roomCode, session, fast: true}, next);
};

/**
 * created by CL
 * 离开游戏(退出到游戏大厅页)
 * @route: hall.gameHandler.leaveGame
 */
gameHandler.prototype.leaveGame = ({}, session, next) =>{

  const {uid, nid, isVip, viper} = gutils.sessionInfo(session);
	const env = viper == null ? 'system' : viper;
	const nowTime = Date.now();
	
	let gameMembers;
	async.waterfall([
	  cb =>{
		  playerMgr.getPlayer({uid}, function(err, player) {
			  if (err) {
				  return next(null, err);
			  }
			  if (!player) {
				  return next(null, {code: 500, error: `玩家不存在: ${uid}`});
			  }
			  
			  //根据环境获取 当前游戏 和 大厅游戏列表
        if(isVip){
	        platformMgr.getPlatform({viper}, function(err, platform) {
		        if (err) {
			        return next(null, err);
		        }
		        platformMgr.getPlatformGames({viper}, function(err, pgames){
			        if(err){
				        console.error(`查找平台${viper}下的所有游戏数据失败`, err);
			        }
			        platformMgr.getPlatformGame({viper, nid}, function(err, pgame){
				        if(err){
					        return next(null, err);
				        }
				        if(!pgame){
					        return next(null, {code: 500, error: `未找到平台${viper}游戏${nid}`});
				        }
				        if(player.vip){   //vip房主
					        const games = gutils.gameFieldsReturn(pgames, true);
					        gutils.pGameNeedBuy(games).then(pgs =>{
						        gameMembers = platform.gameMembers;
					        	return cb(null, player, pgame, pgs);
					        });
				        }else{
					        platform.removeGameMember(nid, uid);
					        const games = gutils.gameFieldsReturn(pgames.filter(g => g.gameStartTime + g.gameHaveTime > nowTime), true);
					        return cb(null, player, pgame, gamesWeightSort(games));     //非房主看不到每个游戏中的人数
				        }
			        })
		        });
	        });
        }else{
          systemMgr.getGame({nid}, function(err, game){
          	if(err){
          		return next(null, err);
	          }
	          systemMgr.allGames().then(games =>{
	          	return cb(null, player, game, games);
	          });
          });
        }
		  });
    },
		(player, game, games, cb) =>{
			if(!game){
				return next(null, {code: 500, error: '游戏未找到 hall.gameHandler.leaveGame'})
			}
			//玩家离开游戏
			const userIndex = game.users.findIndex(user => user.uid == uid);
			game.users.splice(userIndex, 1);
			sessionService.sessionSet(session, {game: null});
			//保存游戏的修改
			gutils.udtGameByEnv(game);
			
			const gameVersion = JsonMgr.get('gameBeat').getById(1).gameVersion;
			//渠道游戏开关控制显示的游戏列表
			gutils.channelGameSwich({player, games, gameVersion}).then(games =>{
				return cb(null, player, games);
			});
		},
  ], function(err, player, games){
		const lastGame = player.lastGameContents[env].nid;
		const lastRoom = player.lastGameContents[env].room;
		
		return next(null, {
			code: 200,
			games: gutils.gameFieldsReturn(games),
			gameMembers,
			lastGame,
			lastRoom,
		});
  });
};

/**
 * create by CL
 * 离开房间(退出到机器列表页)
 * saveProfit 为夺宝游戏退出时是否保存进度使用
 * @route: hall.gameHandler.leaveRoom
 */
gameHandler.prototype.leaveRoom = function({saveProfit = false}, session, next){
	
	const {uid, nid, roomCode, isVip, viper} = gutils.sessionInfo(session);
	const env = viper == null ? 'system' : viper;
	const moneyType = isVip ? 'integral' : 'gold';
	
	async.waterfall([
		cb =>{
			playerMgr.getPlayer({uid}, function(err, player) {
				if (err) {
					return next(null, err);
				}
				if (!player) {
					return next(null, {code: 500, error: `玩家不存在: ${uid}`});
				}
				//根据环境获取 游戏 和 房间
				gutils.getGameByEnv({viper, nid}).then(game =>{
					if(!game){
						return next(null, {code: 500, error: '游戏未找到 hall.gameHandler.leaveRoom'});
					}
					gutils.getRoomByEnv({viper, nid, roomCode}).then(room =>{
						if(!room){
							return next(null, {code: 500, error: '游戏房间未找到 hall.gameHandler.leaveRoom'});
						}
						return cb(null, player, game, room);
					});
				});
			});
		},
		(player, game, room, cb) =>{
			//离开游戏处理
			switch (nid){
				case '4':
					this.app.rpc.games.gameRemote.getUserProfit(session, {isVip, uid, offLine: false, viper: session.get('viper'), roomCode, saveProfit}, function(err, profit){
						if(err){
							return next(null, {code: 500, error: err});
						}
						createIntegralRecord();
						userOutRoom();
						if(profit == null){
							return next(null, {code: 200, rooms: game.rooms});
						}
						user[moneyType] += profit;
						return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]: user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
					});
					break;
				case '12':
					this.app.rpc.pharaoh.mainRemote.getUserProfit(session, {isVip, uid, offLine: false, viper: session.get('viper'), roomCode, saveProfit}, function(err, profit){
						if(err){
							return next(null, {code: 500, error: err});
						}
						createIntegralRecord();
						userOutRoom();
						if(profit == null){
							return next(null, {code: 200, rooms: game.rooms.filter(r => r.open)});
						}
						user[moneyType] += profit;
						return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]: user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
					});
					break;
				case '3':
					this.app.rpc.huoguo.mainRemote.kickUserFromChannel(null, {roomCode, uid, isVip, viper: session.get('viper')}, function(data){
						createIntegralRecord();
						userOutRoom();
						return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]: user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
					});
					break;
				case '8':
					this.app.rpc.games.baijiaRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
						if(err){
							return next(null,{code:500,error:err});
						}
						createIntegralRecord();
						userOutRoom();
						return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
						
						
					});
					break;
				case '9':
					this.app.rpc.games.bairenRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
						if(err) {
							return next(null, {code: 500, error: err});
						}
						createIntegralRecord();
						userOutRoom();
						return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
						
					});
					break;
				case '11':
					this.app.rpc.games.attRemote.exit(null,uid,game.nid,isVip,(err)=>{
						if(err) {
							return next(null, {code: 500, error: err});
						}
						createIntegralRecord();
						userOutRoom();
						return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
						
					});
					break;
				case '15':
					this.app.rpc.games.bipaiRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
						if(err) {
							return next(null, {code: 500, error: err});
						}
						createIntegralRecord();
						userOutRoom();
						return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
						
						
					});
					break;
				case '17':
					this.app.rpc.games.dotRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
						if(err) {
							return next(null, {code: 500, error: err});
						}
						createIntegralRecord();
						userOutRoom();
						return next(null, {code: 200, rooms: game.rooms, [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
					});
					break;
				default:
					createIntegralRecord();
					userOutRoom();
					return next(null, {code: 200, rooms: game.rooms.filter(room => room.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
			}
			
			
		}
	], function(err, ){
		//TODO 修正每个房间的奖池显示
	});
	
	
	//对于夺宝游戏, 在离开房间之后要将其积累的盈利取出, 并清除记录
	// game.rooms.forEach(room =>{
	// 	let passTime = (Date.now() - room.jackpotShow.ctime) / 1000;
	// 	if(passTime > 300){
	// 		passTime = 300;
	// 	}
	// 	room.jackpotShow.show = passTime * room.jackpotShow.rand;
	// })
	
	
	//玩家退出房间
	const userOutRoom = function () {
		const userIndex = room.users.findIndex(user => user.uid == uid);
		room.users.splice(userIndex, 1);
		sessionService.sessionSet(session, {roomCode: null});
		const roomUids = [];
		const users= room.users;
		game.rooms.forEach(room => roomUids.concat(room.users.map(user =>user.uid)));
		const msgUserIds = game.users.map(user => {
			return {uid:user.uid,sid:user.sid}
		}).filter(obj => !roomUids.includes(obj.uid));
		msgService.pushMessageByUids('changeRoomInfo', { //通知前端有人退出机器
			users,
			nid,
			roomCode,
		}, msgUserIds);
	}
	
	//生成积分记录
	const createIntegralRecord = function () {
		if(isVip){
			integralModel.create({
				viperUid: viperUid,
				uid: uid,
				nickname: user.nickname,
				duration: user.leaveRoomTime - user.enterRoomTime,
				createTime: user.leaveRoomTime,
				integral: user.roomProfit,
				gname :game.zname,
				settleStatus: false
			}, function(err, data){
				if(err || !data){
					console.error('生成积分记录失败');
				}
				user.roomProfit = 0;
			});
		}
	}
	
	const integralModel = require('../../../utils/db/mongodb').getDao('integral_record');//积分数据库
	

	
	const lastRoom = user.lastGameContents[env].room;
	
	// 记录停用时间
	if(room.users.length == 0){
		room.disableTime = Date.now();
	}

};


/**
 * created by CL
 * 奖池填充  (填充到 基础奖池)
 * @route:hall.gameHandler.jackpotFilling
 */
gameHandler.prototype.jackpotFilling = ({nid, roomCode, num}, session, next) =>{
	
	const uid = session.uid;
	
	if(num == null){
		return next(null, {code: 500, error: '请正确输入充值数量'});
	}
	if(nid == null){
		nid = session.get('game');
	}
	if(!roomCode){
		return next(null, {code: 500, error: '请输入房间编号'});
	}
	playerMgr.getPlayer({uid}, function(err, player) {
		if(err) {
			return next(null, err);
		}
		if (!player) {
			return next(null, {code: 500, error: `玩家不存在: ${uid}`});
		}
		if(!player.vip){
			return next(null, {code: 500, error: '没有充值资格'});
		}
		
		//获取需要充值的游戏房间
		platformMgr.getPlatformGameRoom({viper: player.viperId, nid, roomCode}).then(room =>{
			if(!room){
				return next(null, {code: 500, error: `未找到该平台${player.viperId}游戏${nid}房间${roomCode}`});
			}
			if(num < 0 && Math.abs(num) > room.jackpot){
				return next(null, {code: 500, error: '积分扣除大于房间奖池不能进行扣除！'});
			}
			room.jackpot += parseInt(num);
			player.vdot -= Number(num)  * 0.001;
			
			//保存房主和房间的修改
			platformMgr.udtPlatformGameRoom(room).then(() =>{
				playerMgr.updatePlayer(player, function(err){
					if(err){
						console.error(`保存玩家${uid}的修改失败`, err);
					}
				});
			});
			
			msgService.pushMessageByUids('addCoin', {
				vdot: player.vdot,
			}, {uid, sid: player.sid});
			return next(null, {code: 200,  jackpot: room.jackpot});
		});
	});
};

/**
 * created by CL
 * 请求slots777比赛的状态信息
 * @route: hall.gameHandler.matchStatus
 */
gameHandler.prototype.matchStatus = ({}, session, next) =>{
	
	const {viper, nid, roomCode} = gutils.sessionInfo(session);

	//根据环境获取房间
	gutils.getRoomByEnv({viper, nid, roomCode}).then(room =>{
		if(!room){
			return next(null, {code: 500, error: '请求slots777比赛的状态信息出错:游戏房间未找到'});
		}
		return next(null, {code: 200, status: room.socialRound, socialDot: room.socialDot});
	}).catch(err =>{
		return next(null, {code: 500, error: '获取房间失败'});
	});
};


/**
 * 离开房间(退出到机器列表页)
 * @route: hall.gameHandler.leaveRoom
 */
gameHandler.prototype.leaveRoom = function({saveProfit = false}, session, next){

    const uid = session.uid;
    const nid = session.get('game');
    const roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const user = PlayerMgr.getPlayer(uid);
    const env = viper == null ? 'system' : viper;
    if(!user){
        return next(null, {code: 500, error:'未找到玩家'});
    }
    let game, viperUid;
    if(isVip){
        game = vipPlatformMgr.getGameByUid(viper, nid);
        viperUid = viper;
        user.leaveRoomTime = Date.now();
    }else{
        game = GamesMgr.getGame(nid);
    }
    if(!game){
        return next(null, {code: 500, error: '游戏未找到 hall.gameHandler.leaveRoom'})
    }
    const room = game.rooms.find(room => room.roomCode == roomCode);
    if(!room){
        return next(null, {code: 500, error: '游戏房间未找到 hall.gameHandler.leaveRoom'})
    }

    //修正每个房间的奖池显示
	game.rooms.forEach(room =>{
		let passTime = (Date.now() - room.jackpotShow.ctime) / 1000;
		if(passTime > 300){
			passTime = 300;
		}
		room.jackpotShow.show = passTime * room.jackpotShow.rand;
    })
    
    const userIndex = room.users.findIndex(user => user.uid == uid);

    //玩家退出房间
    const userOutRoom = function () {
        room.users.splice(userIndex, 1);
        sessionService.sessionSet(session, {roomCode: null});
        const roomUids = [];
        const users= room.users;
        game.rooms.forEach(room => roomUids.concat(room.users.map(user =>user.uid)));
        const msgUserIds = game.users.map(user => {
            return {uid:user.uid,sid:user.sid}
        }).filter(obj => !roomUids.includes(obj.uid));
        msgService.pushMessageByUids('changeRoomInfo', { //通知前端有人退出机器
            users,
            nid,
            roomCode,
        }, msgUserIds);
    }

    //生成积分记录
    const createIntegralRecord = function () {
        if(isVip){
            integralModel.create({
                viperUid: viperUid,
                uid: uid,
                nickname: user.nickname,
                duration: user.leaveRoomTime - user.enterRoomTime,
                createTime: user.leaveRoomTime,
                integral: user.roomProfit,
                gname :game.zname,
                settleStatus: false
            }, function(err, data){
                if(err || !data){
                    console.error('生成积分记录失败');
                }
                user.roomProfit = 0;
            });
        }
    }

    const integralModel = require('../../../utils/db/mongodb').getDao('integral_record');//积分数据库

    //对于夺宝游戏, 在离开房间之后要将其积累的盈利取出, 并清除记录
    const moneyType = isVip ? 'integral' : 'gold';

    const lastRoom = user.lastGameContents[env].room;

    // 记录停用时间
    if(room.users.length == 0){
        room.disableTime = Date.now();
    }
    //离开游戏
    switch (game.nid){
        case '4':
            this.app.rpc.games.gameRemote.getUserProfit(session, {isVip, uid, offLine: false, viper: session.get('viper'), roomCode, saveProfit}, function(err, profit){
                if(err){
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                if(profit == null){
                    return next(null, {code: 200, rooms: game.rooms});
                }
                user[moneyType] += profit;
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]: user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
            });
            break;
        case '12':
            this.app.rpc.pharaoh.mainRemote.getUserProfit(session, {isVip, uid, offLine: false, viper: session.get('viper'), roomCode, saveProfit}, function(err, profit){
                if(err){
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                if(profit == null){
                    return next(null, {code: 200, rooms: game.rooms.filter(r => r.open)});
                }
                user[moneyType] += profit;
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]: user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
            });
            break;
        case '3':
            this.app.rpc.huoguo.mainRemote.kickUserFromChannel(null, {roomCode, uid, isVip, viper: session.get('viper')}, function(data){
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]: user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
            });
            break;
        case '8':
            this.app.rpc.games.baijiaRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
                if(err){
                    return next(null,{code:500,error:err});
                }
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});


            });
            break;
        case '9':
            this.app.rpc.games.bairenRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
                if(err) {
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});

            });
            break;
        case '11':
            this.app.rpc.games.attRemote.exit(null,uid,game.nid,isVip,(err)=>{
                if(err) {
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});

            });
            break;
        case '15':
            this.app.rpc.games.bipaiRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
                if(err) {
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});


            });
            break;
        case '17':
            this.app.rpc.games.dotRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
                if(err) {
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms, [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
            });
            break;
        default:
            createIntegralRecord();
            userOutRoom();
            return next(null, {code: 200, rooms: game.rooms.filter(room => room.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
    }
};



/**
 * 奖池填充  (填充到 基础奖池)
 * @route:hall.gameHandler.jackpotFilling
 */
gameHandler.prototype.jackpotFilling = ({nid, roomCode, num}, session, next) =>{
    if(num == null){
        return next(null, {code: 500, error:'请正确输入充值数量'});
    }
    if(nid == null){
        nid = session.get('game');
    }
    const isVip = session.get('VIP_ENV');
    const uid = session.uid;
    const player = PlayerMgr.getPlayer(uid);
    if(!player.vip){
        return next(null, {code: 500, error:'没有充值资格'});
    }
    const game = vipPlatformMgr.getGameByUid(uid, nid);
    if(!game){
        return next(null, {code: 500, error:'游戏未找到'});
    }
    const room = game.rooms.find(room => room.roomCode == roomCode);
    if(!room){
        return next(null, {code: 500, error: '游戏房间未找到 '})
    }
    if(num < 0 && Math.abs(num) > room.jackpot ){
        return next(null, {code: 500, error: '积分扣除大于房间奖池不能进行扣除！'})
    }
    room.jackpot += parseInt(num);
    player.vdot -= Number(num)  * 0.001;
    //更新房主的V点
    msgService.pushMessageByUids('addCoin', { 
        vdot:player.vdot,
    }, player.uids()); 
    // if(room.jackpot < 0){
    //     room.jackpot = 0;
    // }
    return next(null, {code: 200,  jackpot: room.jackpot});
};

/**
 * 请求slots777比赛的状态信息
 * @route: hall.gameHandler.matchStatus
 */
gameHandler.prototype.matchStatus = ({}, session, next) =>{

    const nid = session.get('game');
    const roomCode = session.get('roomCode');
    const viper = session.get('viper');
    const game = viper ? vipPlatformMgr.getGameByUid(viper, nid) : GamesMgr.getGame(nid);
    const room = game.rooms.find(room => room.roomCode == roomCode);
    if(!game || !room){
        return next(null, {code: 500, error:'请求slots777比赛的状态信息出错'});
    }
    console.error('当前房间社交点',room.socialDot)
    return next(null, {code: 200, status: room.socialRound, socialDot: room.socialDot});
};





/**
 * 查看某个游戏的联机大奖奖池
 * @route: hall.gameHandler.onlineAwards
 */
gameHandler.prototype.onlineAwards = ({nid, viper, num, set = false}, session, next) =>{
    viper = viper || session.get('viper');
    nid = nid || session.get('game');
    if(!nid){
        return next(null, {code: 500, error:'请传入nid 或进入游戏'});
    }
    const game = viper ? vipPlatformMgr.getGameByUid(viper, nid) : GamesMgr.getGame(nid);
    if(set){
        game.onlineAwards = num;
    }
    return next(null, {code: 200, onlineAwards: game.onlineAwards || 0});
};

/**
 * 更改游戏奖池
 * @route: hall.gameHandler.setJackpot
 */
gameHandler.prototype.setJackpot = ({nids}, session, next) =>{

    if(util.isVoid(nids)){
        nids = ['2', '4', '12', '1', '7', '10'];
    }
    const operators = [];
    nids.forEach(nid =>{
        const game = GamesMgr.getGame(nid);
        game.rooms.filter(r => r.open).forEach(room =>{
            if(room.jackpot > 3000000){
                const before = room.jackpot;
                room.jackpot = util.random(1000000, 2000000);
                operators.push({nid, roomCode:room.roomCode, before, after: room.jackpot});
            }
        })
    })
    return next(null, {code: 200, operators});
};