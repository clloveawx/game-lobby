'use strict';

const redisClient = require('../redis').client();
const mongoDB = require('../mongodb');
const bluebird = require('bluebird');
const async = require('async');

module.exports = {
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
};