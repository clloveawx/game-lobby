'use strict';

const Logger = require('pomelo-logger').getLogger('log', __filename);
const async = require('async');
const jsonMgr = require('./config/data/JsonMgr');
const util = require('./app/utils');
const schedule = require('node-schedule');
const db = require('./app/utils/db/mongodb');

//connector服务器
exports.connector = app =>{
	jsonMgr.init('server', ()=>{});    //放一份配置文件
};

//初始化hall服务器
exports.hall = app =>{

	const {platformMgr, playerMgr, systemMgr} = require('./app/utils/db/dbMgr');

	async.waterfall([

		cb =>{
			// 初始化配置表
			jsonMgr.init('server', ()=>{
				return cb();
			});
		},

		cb =>{
			// 根据游戏配置表加载游戏
			return cb(null, jsonMgr.get('games').datas);
		},

		(games, cb) =>{
			//加载数据库中的系统游戏
			db.getDao('system_games').load(function(err, dbgames){
				if(err){
					throw new Error(err);
				}
				return cb(null, games, dbgames);
			}, {});
		},

		(games, dbgames, cb) =>{
			//根据配置表游戏和数据库游戏 得到加载到redis内存中的游戏
			if(!games || games.length == 0){
				throw new Error('未找到配置表游戏信息');
			}else{
				//游戏奖池配置
				const roomJackpot = (room) =>{
					if(room.open){
						room.jackpotShow.otime = Date.now();
						room.jackpotShow.ctime = Date.now();
						room.jackpotShow.show = room.jackpot;
						room.jackpotShow.rand = (10000 <= room.jackpot && room.jackpot < 2000000) ?
							room.jackpot * 0.001 : util.random(200, 500);

						//开启的房间的定时器任务
						// require('./app/domain/hall/jackpotShow/jackpotMgr').addSchedule({
						// 	env:'system',
						// 	nid: room.nid,
						// 	roomCode: room.roomCode
						// });
					}
				};

				games.forEach(game =>{
					const pushGame = systemMgr.instanceGame(game);
					//找到数据库中对应的游戏
					const dbgame = dbgames.find(dg => dg.nid == game.nid);
					if(dbgame){
						//数据库中有该游戏 更新游戏热度和联机大奖
						pushGame.heatDegree = dbgame.heatDegree;
						pushGame.onlineAwards = dbgame.onlineAwards;

						//加载数据库游戏房间并实例化到redis
						db.getDao('system_rooms').load(function(err, rooms){
							if(err){
								console.error(err);
							}
							rooms.forEach(room =>{
								room = systemMgr.instanceRoom(room);
								roomJackpot(room);

								systemMgr.udtGameRoom(game.nid, room.roomCode, room, true).then(() =>{

								}).catch(err => {
									console.error('保存房间失败'+err);
								});
							});
						}, {nid: game.nid});
					}else{
						//根据配置表实例化游戏时需创建游戏的房间
						const newRoom = (num) =>{
							if(num >= game.minRoom){
								return;
							}
							//获取所有的游戏房间 用以确定新建房间的roomCode
							systemMgr.allGameRooms(game.nid).then(rs =>{
								const room = systemMgr.instanceRoom({nid: game.nid, roomCode: util.pad(rs.length + 1, 3)});
								roomJackpot(room);

								//保存游戏房间
								systemMgr.udtGameRoom(game.nid, room.roomCode, room).then(() =>{
									newRoom(++num);
								}).catch(err => {
									console.error('保存房间失败'+err);
								});
							});
						};
						newRoom(0);
					}
					//更新游戏到redis内存
					systemMgr.udtGame(game.nid, pushGame, true);
				});
				return cb();
			}
		},

		cb =>{
			//同步所有平台基础信息到redis
			db.getDao('platform').load(function(err, platforms){
				if(err || !platforms){
					Logger.error("同步所有平台基础信息到redis:" + err);
					return cb();
				}
				const dealPlatformOne = (num) =>{
					if(num >= platforms.length){
						return cb();
					}
					const platform = platforms[num];
					platform.vipModel = 'discount';   //现在所有vip平台都是折扣模式
					//将平台数据加入redis
					platformMgr.platformIntoRedis(platformMgr.instancePlatform(platform), true).then(() =>{
						dealPlatformOne(++num);
					}).catch(err => {
						console.error('保存平台失败'+platform.creator + err);
					});
				};
				dealPlatformOne(0);
			}, {});
		},

		cb =>{
			//同步所有平台游戏到redis
			db.getDao('platform_games').load(function(err, pGames){
				if(err || !pGames){
					Logger.error("同步所有平台游戏到redis:" + err);
					return cb();
				}
				const dealPGameOne = (num) =>{
					if(num >= pGames.length){
						return cb();
					}
					const pGame = platformMgr.instancePlatformGame(pGames[num]);
					//将平台游戏数据加入redis
					platformMgr.udtPlatformGame(pGame, true).then(() =>{
						dealPGameOne(++num);
					}).catch(err => {
						console.error('保存平台游戏失败' + platform.viper + err);
					});

				};
				dealPGameOne(0);
			}, {});

		},

		cb =>{
			//同步所有平台游戏房间信息到redis
			db.getDao('platform_rooms').load(function(err, pRooms){
				if(err || !pRooms){
					Logger.error("同步所有平台游戏到redis:" + err);
					return cb();
				}
				const dealPRoomOne = (num) =>{
					if(num >= pRooms.length){
						return cb();
					}
					const pRoom = platformMgr.instancePlatformRoom(pRooms[num]);
					//将平台游戏房间数据加入redis
					platformMgr.getPlatformGameRoom(pRoom, true).then(() =>{
						dealPRoomOne(++num);
					}).catch(err => {
						console.error('保存平台游戏失败' + platform.viper + err);
					});
				};
				dealPRoomOne(0);
			}, {});
		},

	], function(err){
		if(err){
			console.error('大厅服务器初始化失败' + err);
		}
		console.log('大厅服务器初始化成功');
		// 后续可配置各种定时器
	});
};