'use strict';

/**
 *   大厅数据统计
 */
const redisClient = require('../redis').client();

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
		return redisClient.sadd('ordinaryEnvPlayers', uid);
	},

	/**
	 * 删除某个玩家
	 */
	deleteplayerIntoSystem(uid){
		return redisClient.srem('ordinaryEnvPlayers', uid);
	},
};