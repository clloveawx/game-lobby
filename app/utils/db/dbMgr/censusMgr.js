'use strict';

/**
 *   数据统计
 */
const redisClient = require('../redis').client();
const Promise = require('bluebird');

module.exports = {

	/**
	 * 访问量统计(系统加vip)
	 */
	gameVist({nid, uid}){
		if(!nid){
			console.error('请传入访问量统计nid');
		}
		if(!uid){
			console.error('请传入访问量统计uid');
		}
		redisClient.sadd(`vist:${nid}`, uid).then(() =>{
			redisClient.incr(`vist:total`);
		}).catch(err =>{
			console.error('增加访问量失败'+err);
		});
	},
	
	
	/**
	 * 记录系统环境中的玩家(使用集合类型)
	 * 关闭服务器时需要清空
	 */
	addPlayerIntoSystem(uid){
		return redisClient.sadd('system:env:players', uid);
	},
	
	/**
	 * 删除某个玩家
	 */
	deleteplayerIntoSystem(uid){
		return redisClient.srem('system:env:players', uid);
	},
	
	/**
	 * 记录每个游戏处在机器列表的玩家
	 * 添加
	 */
	addPlayerToRoomLists({viper, nid, uid, sid}){
		const env = viper ? viper : 'system';
		return redisClient.sadd(`${env}:${nid}:out:users`, JSON.stringify({uid, sid}));
	},
	/**
	 * 记录每个游戏处在机器列表的玩家
	 * 删除
	 */
	removePlayerFromRoomLists({viper, nid, uid, sid}){
		const env = viper ? viper : 'system';
		return redisClient.srem(`${env}:${nid}:out:users`, JSON.stringify({uid, sid}));
	},
	/**
	 * 记录每个游戏处在机器列表的玩家
	 * 获取
	 */
	getPlayerAtRoomLists({viper, nid}){
		const env = viper ? viper : 'system';
		return redisClient.smembers(`${env}:${nid}:out:users`).then(users =>{
			return Promise.resolve(users.map(user => JSON.parse(user)));
		});
	},
	
	/**
	 * 记录slots777社交比赛  添加
	 */
	add777Social({viper, roomCode}){
		const env = viper ? viper : 'system';
		return redisClient.sadd(`slots777:social:${env}`, `${roomCode}`);
	},
	
	/**
	 * 记录slots777社交比赛  是否存在
	 */
	exists777Social({viper, roomCode}){
		const env = viper ? viper : 'system';
		return redisClient.sismember(`slots777:social:${env}`, `${roomCode}`);
	},
	/**
	 * 记录slots777社交比赛  删除
	 */
	remove777Social({viper, roomCode}){
		const env = viper ? viper : 'system';
		return redisClient.srem(`slots777:social:${env}`, `${roomCode}`);
	},
};