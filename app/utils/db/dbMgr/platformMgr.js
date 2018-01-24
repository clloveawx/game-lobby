'use strict';

const redisClient = require('../redis').client();
const mongoDB = require('../mongodb');
const Pomelo = require('pomelo');
const syncMgr = require('./syncMgr');
const Promise = require('bluebird');
const util = require('../../index');

const Platform = require('../classes/Platform');
const PGame = require('../classes/PlatformGame');
const PRoom = require('../classes/PlatformRoom');

module.exports = {

/**********************平台基础信息相关************************************/

	/**
	 * 从redis中读取指定平台信息
	 * 若不存在则到数据库读取并加载到redis，设置过期时间为1天
	 */
	getPlatform({viper}, callback){
		if(!viper){
			return callback({code: 500, error: '请传入viper'});
		}
		redisClient.hget('platforms', viper, function(err, platform){
			if(err){
				return callback({code: 500, error: 'redis 获取平台失败'+err});
			}
			if(!platform){
				const platformModel = require('../mongodb').getDao('platform');
				platformModel.load_one(function(err, platform){
					if(err){
						return callback(err);
					}
					if(!platform){
						return callback({code: 500, error: '未在数据库中找到平台'});
					}
					redisClient.hset('platforms', viper, JSON.stringify(platform), function(){
						return callback(null, new Platform(platform));
					});
				}, {viper});
			}else{
				return callback(null, new Platform(JSON.parse(platform)));
			}
		});
	},

	/**
	 * 修改指定平台的数据
	 */
	platformIntoRedis(platform, compare = false){
		if(!platform){
			return Promise.reject({code: 500, error: '请传入平台信息'});
		}
		const viper = platform.creator;
		const udtPlatform = () =>{
			return redisClient.hset('platforms', viper, JSON.stringify(platform)).then(() =>{
				//缓存更新后需要新建同步任务
				syncMgr.taskExistsPlatform(viper).then(exists =>{
					if(!exists){
						syncMgr.addPlatformTask(viper).then(() =>{
							Pomelo.app.get('sync').exec('infoSync.updatePlatform', {viper});
						});
					}
				});
				return Promise.resolve();
			});
		};
		if(compare){
			return redisClient.hexists('platforms', viper).then(exists =>{
				if(exists){
					//如果redis中该平台还有玩家,需要清除
					redisClient.hget('platforms', viper).then(rplatform =>{
						rplatform = JSON.parse(rplatform);
						if(!util.isVoid(rplatform.envMembers) || !util.isVoid(rplatform.gameMembers)){
							platform.envMembers = [];
							platform.gameMembers = {};
							return udtPlatform();
						}else{
							return Promise.resolve();
						}
					});
				}else{
					return udtPlatform();
				}
			});
		}else{
			return udtPlatform();
		}
	},

	/**
	 * 实例化一个平台
	 */
	instancePlatform(platform){
		return new Platform(platform);
	},

	/**
	 * 创建一个平台
	 */
	createPlatform(uid){
		return new Platform({
			creator: uid,
		});
	},

	/**
	 * 从redis中获取指定平台
	 */
	getPlatformFromRedis(viper){
		return redisClient.hget('platforms', viper);
	},

/***************************平台游戏相关****************************************/

	/**
	 * 读取指定平台中的所有游戏
	 */
	getPlatformGames({viper}, callback){
		if(!viper){
			return callback({code: 500, error: '请传入viper'});
		}
		redisClient.hgetall(`${viper}:games`).then(games =>{
			if(util.isVoid(games)){
				return callback(null, []);
			}
			return callback(null, util.values(games).map(g => JSON.parse(g)));
		});
	},

	/**
	 * 读取指定平台中指定游戏
	 */
	getPlatformGame({viper, nid}, callback){
		if(!viper){
			return callback({code: 500, error: '请传入viper'});
		}
		if(!nid){
			return callback({code: 500, error: '请传入nid'});
		}
		redisClient.hget(`${viper}:games`, nid, function(err, game){
			if(err){
				console.error(`获取平台${viper}的游戏${nid}失败`, err);
				return callback({code: 500, error: `获取平台${viper}的游戏${nid}失败`});
			}
			return callback(null, JSON.parse(game));
		});
	},

	/**
	 * 修改指定平台中的指定游戏
	 */
	udtPlatformGame(gameInfo, compare = false){
		if(!gameInfo){
			return Promise.reject({code: 500, error: '请传入更新后的平台游戏'});
		}
		const {viper, nid} = gameInfo;
		const udtPlatformGame = () =>{
			return redisClient.hset(`${viper}:games`, nid, JSON.stringify(gameInfo)).then(() =>{
				//缓存更新后需要新建同步任务
				syncMgr.taskExistsPlatformGame(viper, nid).then(exists =>{
					if(!exists){
						syncMgr.addPlatformGameTask(viper, nid).then(() =>{
							Pomelo.app.get('sync').exec('infoSync.updatePlatformGame', {viper, nid});
						});
					}
				});
				return Promise.resolve();
			});
		};

		if(compare){
			return redisClient.hexists(`${viper}:games`, nid).then(exists =>{
				if(exists){
					redisClient.hget(`${viper}:games`, nid).then(pgame =>{
						pgame = JSON.parse(pgame);
						if(!util.isVoid(pgame.users)){
							gameInfo.envMembers = [];
							return udtPlatformGame();
						}else{
							return Promise.resolve();
						}
					});
				}else{
					return udtPlatformGame();
				}
			});
		}else{
			return udtPlatformGame();
		}
	},

	/**
	 * 实例化一个平台游戏
	 */
	instancePlatformGame(pGame){
		return new PGame(pGame);
	},

	/**
	 * 从redis中获取指定平台指定游戏
	 */
	getPlatformGameFromRedis(viper, nid){
		return redisClient.hget(`${viper}:games`, nid);
	},

/***************************平台游戏房间相关****************************************************/

	/**
	 * 获取指定平台中的所有房间
	 */
	getPlatformRooms({viper}, callback){
		if(!viper){
			return callback({code: 500, error: '请传入viper'});
		}
		redisClient.keys(`${viper}:rooms`, callback);
	},

	/**
	 * 获取指定平台中指定游戏的所有房间(roomInfo代表返回房间信息)
	 */
	getPlatformGameRooms({viper, nid, roomInfo = false}, callback){
		if(!viper){
			return callback({code: 500, error: '请传入viper'});
		}
		if(!nid){
			return callback({code: 500, error: '请传入nid'});
		}
		if(roomInfo){
			redisClient.keys(`${viper}:rooms:${nid}:*`).then(keys =>{
				redisClient.mget(keys).then(rooms =>{
					rooms = rooms.map(room =>{
						return JSON.parse(room);
					});
					return callback(null, rooms);
				});
			})
		}else{
			redisClient.keys(`${viper}:rooms:${nid}:*`, callback);
		}
	},

	/**
	 * 获取指定平台中指定游戏的指定房间
	 */
	getPlatformGameRoom({viper, nid, roomCode}){
		if(!viper){
			return Promise.reject({code: 500, error: '请传入viper'});
		}
		if(!nid){
			return Promise.reject({code: 500, error: '请传入nid'});
		}
		if(!roomCode){
			return Promise.reject({code: 500, error: '请传入roomCode'});
		}
		return redisClient.get(`${viper}:rooms:${nid}:${roomCode}`);
	},

	/**
	 * 修改指定平台中指定游戏的指定房间
	 * flush为是否立即同步
	 */
	udtPlatformGameRoom(roomInfo, compare = false, flush = false){

		if(!roomInfo){
			return Promise.reject({code: 500, error: '请传入修改后的房间信息'});
		}
		const {viper, nid, roomCode} = roomInfo;
		
		//同时更新房间的出分率
		if(roomInfo.consumeTotal != 0){
			roomInfo.outRate = Number((roomInfo.winTotal / roomInfo.consumeTotal).toFixed(2));
		}

		const udtPlatformRoom = () =>{

			return redisClient.set(`${viper}:rooms:${nid}:${roomCode}`, JSON.stringify(roomInfo)).then(() =>{
				//缓存更新后需要新建同步任务
				syncMgr.taskExistsPlatformRoom(viper, nid, roomCode).then(exists =>{
					if(!exists){
						syncMgr.addPlatformRoomTask(viper, nid, roomCode).then(() =>{
							Pomelo.app.get('sync').exec('infoSync.updatePlatformRoom', {viper, nid, roomCode});
						});
					}
				});
				return Promise.resolve();
			});
		};

		if(compare){
			return redisClient.exists(`${viper}:rooms:${nid}:${roomCode}`).then(exists =>{
				if(exists){
					redisClient.hget(`${viper}:games`, nid).then(proom =>{
						proom = JSON.parse(proom);
						if(!util.isVoid(proom.users)){
							roomInfo.users = [];
							return udtPlatformRoom();
						}else{
							return Promise.resolve();
						}
					});
				}else{
					return udtPlatformRoom();
				}
			});
		}else{
			return udtPlatformRoom();
		}
	},

	/**
	 * 实例化一个平台游戏房间
	 */
	instancePlatformRoom(pRoom){
		return new PRoom(pRoom);
	},


	/**
	 * 从redis中获取指定平台指定游戏的指定房间
	 */
	getPlatformRoomFromRedis(viper, nid, roomCode){
		return redisClient.get(`${viper}:rooms:${nid}:${roomCode}`);
	},
};