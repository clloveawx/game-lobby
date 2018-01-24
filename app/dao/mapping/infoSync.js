'use strict';

const db = require('../../utils/db/mongodb');
const {playerMgr, systemMgr, platformMgr, syncMgr, userMgr} = require('../../utils/db/dbMgr');

const Logger = require('pomelo-logger').getLogger('log', __filename);

module.exports = {
	
	/**
	 * 同步user数据 user_info
	 */
	updateUser(dbclient, {uid}, callback){
		//查看是否有更新任务
		syncMgr.taskExistsUser(uid).then(exists =>{
			if(!exists){
				return;
			}
			//查看redis中是否有缓存
			userMgr.getUserFromRedis(uid).then(user =>{
				if(!user){
					Logger.error("updateUser 未在缓存中找到值:" + uid);
					return;
				}
				//更新redis玩家到数据库
				const userModel = db.getDao('user_info');
				userModel.update({uid}, {'$set': JSON.parse(user)}, {upsert: true}, function(err){
					if(err){
						Logger.error("updateUser 更新失败:" + uid);
					}
					//删除更新任务
					syncMgr.delUserTask(uid).then(() =>{});
				});
			});
		});
	},
	
	/**
	 * 同步玩家数据 player_info
	 */
	updatePlayer(dbclient, {uid}, callback){
		//查看是否有更新任务
		syncMgr.taskExistsPlayer(uid).then(exists =>{
			if(!exists){
				return;
			}
			//查看redis中是否有缓存
			playerMgr.getPlayerFromRedis(uid).then(player =>{
				if(!player){
					Logger.error("updatePlayer 未在缓存中找到值:" + uid);
					return;
				}
				//更新redis玩家到数据库
				const playerModel = db.getDao('player_info');
				playerModel.update({uid}, {'$set': JSON.parse(player)}, {upsert: true}, function(err){
					if(err){
						Logger.error("updatePlayer 更新失败:" + uid);
					}
					//删除更新任务
					syncMgr.delPlayerTask(uid).then(() =>{});
				});
			});
		});
	},
	
	/**
	 * 立即同步玩家数据 player_info
	 */
	updatePlayerFlush(dbclient, {uid, playerInfo}, callback){
		//更新redis玩家到数据库
		const playerModel = db.getDao('player_info');
		playerModel.update({uid}, {'$set': playerInfo}, {upsert: true}, function(err){
			if(err){
				Logger.error("updatePlayerFlush 更新失败:" + err);
			}
		});
	},
	
	/**
	 * 同步系统游戏数据 system_games
	 */
	updateSystemGame(dbclient, {nid}, callback){
		//查看是否有更新任务
		syncMgr.taskExistsGame(nid).then(exists =>{
			if(!exists){
				return;
			}
			//查看redis中是否有缓存
			systemMgr.getSystemGameFromRedis(nid).then(game =>{
				if(!game){
					Logger.error("updateSystemGame 未在缓存中找到值:" + nid);
					return;
				}
				//更新redis玩家到数据库
				const gameModel = db.getDao('system_games');
				gameModel.update({nid}, {'$set': JSON.parse(game)}, {upsert: true}, function(err){
					if(err){
						Logger.error("updateSystemGame 更新失败:" + nid);
					}
					//删除更新任务
					syncMgr.delGameTask(nid).then(() =>{});
				});
			});
		});
	},

	/**
	 * 同步系统游戏房间数据 system_rooms
	 */
	updateSystemRoom(dbclient, {nid, roomCode}, callback){
		//查看是否有更新任务
		syncMgr.taskExistsGameRoom(nid, roomCode).then(exists =>{
			if(!exists){
				return;
			}
			//查看redis中是否有缓存
			systemMgr.getSystemRoomFromRedis(nid, roomCode).then(room =>{
				if(!room){
					Logger.error("updateSystemRoom 未在缓存中找到值:" + nid + roomCode);
					return;
				}
				//更新redis玩家到数据库
				const roomModel = db.getDao('system_rooms');
				roomModel.update({nid, roomCode}, {'$set': JSON.parse(room)}, {upsert: true}, function(err){
					if(err){
						Logger.error("updateSystemRoom 更新失败:" + nid);
					}
					//删除更新任务
					syncMgr.delGameRoomTask(nid, roomCode).then(() =>{});
				});
			});
		});
	},

	/**
	 * 同步平台基础信息  platform
	 */
	updatePlatform(dbclient, {viper}, callback){
		//查看是否有更新任务
		syncMgr.taskExistsPlatform(viper).then(exists =>{
			if(!exists){
				return;
			}
			//查看redis中是否有缓存
			platformMgr.getPlatformFromRedis(viper).then(platform =>{
				if(!platform){
					Logger.error("updatePlatform 未在缓存中找到值:" + viper);
					return;
				}
				//更新redis平台到数据库
				const platformModel = db.getDao('platform');
				platformModel.update({'creator': viper}, {'$set': JSON.parse(platform)}, {upsert: true}, function(err){
					if(err){
						Logger.error("updatePlatform 更新失败:" + viper);
					}
					//删除更新任务
					syncMgr.delPlatformTask(viper).then(() =>{});
				});
			});
		});
	},


	/**
	 * 同步平台游戏信息  platform_games
	 */
	updatePlatformGame(dbclient, {viper, nid}, callback){
		//查看是否有更新任务
		syncMgr.taskExistsPlatformGame(viper, nid).then(exists =>{
			if(!exists){
				return;
			}
			//查看redis中是否有缓存
			platformMgr.getPlatformGameFromRedis(viper, nid).then(pGame =>{
				if(!pGame){
					Logger.error("updatePlatformGame 未在缓存中找到值:" + viper + nid);
					return;
				}
				//更新redis平台游戏到数据库
				const pGameModel = db.getDao('platform_games');
				pGameModel.update({viper, nid}, {'$set': JSON.parse(pGame)}, {upsert: true}, function(err){
					if(err){
						console.error("updatePlatformGame 更新失败:", err);
						Logger.error("updatePlatformGame 更新失败:" + viper + nid);
					}
					//删除更新任务
					syncMgr.delPlatformGameTask(viper, nid).then(() =>{});
				});
			});
		});
	},

	/**
	 * 同步平台游戏房间信息  platform_rooms
	 */
	updatePlatformRoom(dbclient, {viper, nid, roomCode}, callback){
		//查看是否有更新任务
		syncMgr.taskExistsPlatformRoom(viper, nid, roomCode).then(exists =>{
			if(!exists){
				return;
			}
			//查看redis中是否有缓存
			platformMgr.getPlatformRoomFromRedis(viper, nid, roomCode).then(pRoom =>{
				if(!pRoom){
					Logger.error("updatePlatformRoom 未在缓存中找到值:" + viper + nid);
					return;
				}
				//更新redis平台游戏到数据库
				const pRoomModel = db.getDao('platform_rooms');
				pRoomModel.update({viper, nid, roomCode}, {'$set': JSON.parse(pRoom)}, {upsert: true}, function(err){
					if(err){
						Logger.error("updatePlatformRoom 更新失败:" + viper + nid);
					}
					//删除更新任务
					syncMgr.delPlatformRoomTask(viper, nid, roomCode).then(() =>{});
				});
			});
		});
	},

};
