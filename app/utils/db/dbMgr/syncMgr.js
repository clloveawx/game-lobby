'use strict';

/**
 *   同步redis数据到mongodb任务
 */
const redisClient = require('../redis').client();

module.exports = {

/****************user_info相关********************************/

/**
 * 增加同步任务 user_info
 */
addUserTask(uid){
	return redisClient.sadd('sync:user', uid);
},
/**
 * 查看是否存在某个user的更新任务
 */
taskExistsUser(uid){
	return redisClient.sismember('sync:user', uid);
},
/**
 * 删除某个user的更新任务
 */
delUserTask(uid){
	return redisClient.srem('sync:user', uid);
},


/****************player_info相关********************************/

	 /**
	 * 增加同步任务 player_info
	 */
	addPlayerTask(uid){
		return redisClient.sadd('sync:player', uid);
	},
	/**
	 * 查看是否存在某个玩家的更新任务
	 */
	taskExistsPlayer(uid){
		return redisClient.sismember('sync:player', uid);
	},
	/**
	 * 删除某个玩家的更新任务
	 */
	delPlayerTask(uid){
		return redisClient.srem('sync:player', uid);
	},


/****************system_games相关********************************/

	/**
	 * 增加同步任务
	 */
	addSystemGameTask(nid){
		return redisClient.sadd('sync:system:games', nid);
	},
	/**
	 * 查看是否存在某个游戏的更新任务
	 */
	taskExistsGame(nid){
		return redisClient.sismember('sync:system:games', nid);
	},
	/**
	 * 删除某个系统游戏的更新任务
	 */
	delGameTask(nid){
		return redisClient.srem('sync:system:games', nid);
	},


/****************system_rooms相关********************************/

	/**
	 * 增加同步任务
	 */
	addSystemGameRoomTask(nid, roomCode){
		return redisClient.sadd(`sync:system:rooms:${nid}`, roomCode);
	},
	/**
	 * 查看是否存在某个游戏房间的更新任务
	 */
	taskExistsGameRoom(nid, roomCode){
		return redisClient.sismember(`sync:system:rooms:${nid}`, roomCode);
	},
	/**
	 * 删除某个系统游戏房间的更新任务
	 */
	delGameRoomTask(nid, roomCode){
		return redisClient.srem(`sync:system:rooms:${nid}`, roomCode);
	},

/************************platform相关***************************************/

	/**
	 * 增加同步任务
	 */
		addPlatformTask(viper){
		return redisClient.sadd(`sync:platform`, viper);
	},
	/**
	 * 查看是否存在某个平台的更新任务
	 */
	taskExistsPlatform(viper){
		return redisClient.sismember(`sync:platform`, viper);
	},
	/**
	 * 删除某个平台的更新任务
	 */
	delPlatformTask(viper){
		return redisClient.srem(`sync:platform`, viper);
	},

/****************************platform_games相关*************************************************/
	/**
	 * 增加同步任务
	 */
	addPlatformGameTask(viper, nid){
		return redisClient.sadd(`sync:games:${viper}`, nid);
	},
	/**
	 * 查看是否存在某个平台游戏的更新任务
	 */
	taskExistsPlatformGame(viper, nid){
		return redisClient.sismember(`sync:games:${viper}`, nid);
	},
	/**
	 * 删除某个平台游戏的更新任务
	 */
	delPlatformGameTask(viper, nid){
		return redisClient.srem(`sync:games:${viper}`, nid);
	},

/****************************platform_rooms相关*************************************************/
	/**
	 * 增加同步任务
	 */
	addPlatformRoomTask(viper, nid, roomCode){
		return redisClient.sadd(`sync:rooms:${viper}:${nid}`, roomCode);
	},
	/**
	 * 查看是否存在某个平台游戏房间的更新任务
	 */
	taskExistsPlatformRoom(viper, nid, roomCode){
		return redisClient.sismember(`sync:rooms:${viper}:${nid}`, roomCode);
	},
	/**
	 * 删除某个平台游戏房间的更新任务
	 */
	delPlatformRoomTask(viper, nid, roomCode){
		return redisClient.srem(`sync:rooms:${viper}:${nid}`, roomCode);
	},
};