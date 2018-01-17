'use strict';

const Pomelo = require('pomelo');
const redisClient = require('../redis').client();
const mongoDB = require('../mongodb');
const util = require('../../index');
const Game = require('../classes/SystemGame');
const Room = require('../classes/SystemRoom');
const syncMgr = require('./syncMgr');
const Promise = require('bluebird');

module.exports = {

/**************************游戏相关部分***************************************/
	/**
	 * 从redis中读取指定游戏的数据
	 * 如果该玩家不在redis,则从数据库读取
	 */
	getGame({nid}, callback){
		if(!nid){
			return callback({code: 500, error: '请传入nid'});
		}
		redisClient.hexists('games', nid, function(err, exists){
			if(err){
				return callback({code: 500, error: '判断游戏是否在redis内存出错'});
			}
			if(exists){
				redisClient.hget('games', nid, function(err, game){
					if(err){
						return callback({code: 500, error: '获取redis中的游戏出错'+nid});
					}
					return callback(null, JSON.parse(game));
				});
			}else{
				const gameModel = mongoDB.getDao('system_games');
				gameModel.findOne({nid}, function(err, game){
					if(err){
						return callback({code: 500, error: '在数据库查找游戏数据失败'});
					}
					if(!game){
						return callback({code: 500, error: '在数据库未找到指定游戏'});
					}
					redisClient.hset('games', nid, Json.stringify(game),function(){
						return callback(null, game);
					});
				});
			}
		});
	},

	/**
	 * 从redis中获取所有的系统游戏
	 * 返回值是对象
	 * 字段的值需要反序列化
	 */
	allGames(){
		return redisClient.hgetall('games').then(games =>{
			const gs = [];
			for(let i in games){
				gs.push(JSON.parse(games[i]));
			}
			return Promise.resolve(gs);
		});
	},

	/**
	 * 修改指定的游戏数据
	 * 当重启服务器时从数据库拉取数据到redis中时判断redis中是否存在该数据
	 */
	udtGame(nid, gameInfo, compare = false){
		if(!nid){
			return Promise.reject({code: 500, error: '请传入nid'});
		}
		const udtGame = () =>{
			return redisClient.hset('games', nid, JSON.stringify(gameInfo)).then(() =>{
				//缓存更新后需要新建同步任务
				syncMgr.taskExistsGame(nid).then(exists =>{
					if(!exists){
						syncMgr.addSystemGameTask(nid).then(() =>{
							Pomelo.app.get('sync').exec('infoSync.updateSystemGame', {nid});
						});
					}
				});
				return Promise.resolve();
			});
		};
		if(compare){
			return redisClient.hexists('games', nid).then(exists =>{
				if(exists){
					redisClient.hget('games', nid).then(game =>{
						game = JSON.parse(game);
						if(game.users && game.users.length > 0){
							gameInfo.users = [];
							return udtGame();
						}else{
							return Promise.resolve();
						}
					});
				}else{
					return udtGame();
				}
			});
		}else{
			return udtGame();
		}
	},

	/**
	 * 批量修改游戏
	 */
	udtGameMulti(gamesInfo){
		if(util.isVoid(gamesInfo)){
			return Promise.reject({code: 500, error: '请传入需要更新的游戏信息'});
		}
		return redisClient.hmset('games', gamesInfo);
	},

	/**
	 * 实例化系统游戏
	 */
	instanceGame(game){
		return new Game(game);
	},

	/**
	 * 从redis中获取指定系统游戏
	 */
	getSystemGameFromRedis(nid){
		if(!nid){
			return Promise.reject({code: 500, error: '请传入nid'});
		}
		return redisClient.hget('games', nid);
	},

/**********************************房间相关********************************************/
	/**
	 * 从redis中读取指定游戏,指定房间的数据
	 */
	getGameRoom({nid, roomCode}, callback){
		if(!nid){
			return callback({code: 500, error: '请传入nid'});
		}
		if(!roomCode){
			return callback({code: 500, error: '请传入roomCode'});
		}
		redisClient.exists(`rooms:${nid}:${roomCode}`, function(err, exists){
			if(err){
				return callback({code: 500, error: '判断指定游戏的房间是否在redis内存出错'});
			}
			if(exists){
				redisClient.get(`rooms:${nid}:${roomCode}`, function(err, room){
					if(err){
						return callback({code: 500, error: '获取redis中的指定游戏的房间出错'});
					}
					return callback(null, JSON.parse(room));
				});
			}else{
				const roomModel = mongoDB.getDao('system_rooms');
				roomModel.findOne({nid, roomCode}, function(err, room){
					if(err){
						console.error('在数据库查找指定游戏指定房间数据失败',{nid, roomCode});
						return callback({code: 500, error: '在数据库查找指定游戏指定房间数据失败'});
					}
					if(!room){
						return callback({code: 500, error: '在数据库未找到指定游戏的指定房间'});
					}
					redisClient.hset('games', nid, function(){
						return callback(null, room);
					});
				});
			}
		});
	},

	/**
	 * 从redis中获取指定游戏的所有房间(第二个参数代表返回房间信息)
	 */
	allGameRooms(nid, roomInfo = false){
		if(!nid){
			return Promise.reject({code: 500, error: '请传入nid'});
		}
		if(!roomInfo){
			return redisClient.keys(`rooms:${nid}:*`);
		}else{
			return redisClient.keys(`rooms:${nid}:*`).then(keys =>{
				return redisClient.mget(keys).then(rooms =>{
					rooms = rooms.map(room =>{
						return JSON.parse(room);
					});
					return Promise.resolve(rooms);
				});
			});
		}
	},

	/**
	 * 修改指定的游戏指定房间的数据
	 * 当重启服务器时从数据库拉取数据到redis中时判断redis中是否存在该数据
	 */
	udtGameRoom(nid, roomCode, roomInfo, compare = false){
		if(!nid){
			return Promise.reject({code: 500, error: '请传入nid'});
		}
		if(!roomCode){
			return Promise.reject({code: 500, error: '请传入roomCode'});
		}
		if(!roomInfo){
			return Promise.reject({code: 500, error: '请传入修改后的房间信息'});
		}

		const udtRoom = () =>{
			return redisClient.set(`rooms:${nid}:${roomCode}`, JSON.stringify(roomInfo)).then(() =>{
				//缓存更新后需要新建同步任务 如果任务已存在 无需创建
				syncMgr.taskExistsGameRoom(nid, roomCode).then(exists =>{
					console.log('================是否可以增加更新房间的任务',exists)
					if(!exists){
						syncMgr.addSystemGameRoomTask(nid, roomCode).then(() =>{
							console.log('================增加更新房间的任务成功',{nid, roomCode})
							Pomelo.app.get('sync').exec('infoSync.updateSystemRoom', {nid, roomCode});
						});
					}
				});
				return Promise.resolve();
			})
		};

		if(compare){
			return redisClient.exists(`rooms:${nid}:${roomCode}`).then(exists =>{
				if(exists){
					//如果redis中该房间还有玩家,需要清除
					redisClient.get(`rooms:${nid}:${roomCode}`).then(room =>{
						room = JSON.parse(room);
						if(room.users && room.users.length > 0){
							roomInfo.users = [];
							return udtRoom();
						}else{
							return Promise.resolve();
						}
					});
				}else{
					return udtRoom();
				}
			});
		}else{
			return udtRoom();
		}
	},

	/**
	 * 实例化一个游戏房间
	 */
	instanceRoom(room){
		return new Room(room);
	},

	/**
	 * 从redis中获取指定系统游戏的指定房间
	 */
	getSystemRoomFromRedis(nid, roomCode){
		return redisClient.get(`rooms:${nid}:${roomCode}`);
	},

};