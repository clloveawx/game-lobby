'use strict';

const Pomelo = require('pomelo');
const redisClient = require('../redis').client();
const mongoDB = require('../mongodb');
const userModel = mongoDB.getDao('user_info');
const syncMgr = require('./syncMgr');
const Promise = require('bluebird');

module.exports = {
	/**
	 * 从redis中读取指定玩家的数据
	 * 如果该玩家不在redis,则从数据库读取,  若数据库中也没有就根据参数判断是否创建
	 * 并设置过期时间为1天
	 */
	getUser({uid}, callback){
		if(!uid){
			return callback({code: 500, error: '请传入uid'});
		}
		redisClient.hexists('users', uid, function(err, exists){
			if(err){
				return callback({code: 500, error: '判断user_info是否在redis内存出错'});
			}
			if(exists){
				redisClient.hget('users', uid, function(err, user){
					if(err){
						return callback({code: 500, error: '获取redis中的user_info出错'+uid});
					}
					return callback(null, JSON.parse(user));
				});
			}else{
				userModel.load_by_uid(function(err, user){
					if(err){
						return callback(err);
					}
					redisClient.hset('users', uid, JSON.stringify(user), function(err, user){
						if(err){
							console.error('redis设置user_info出错'+uid);
						}
						redisClient.expire('users', 60 * 60 * 24);
					});
					callback(null, user);
				}, {uid});
			}
		});
	},

	/**
	 * 更新redis中的指定玩家数据
	 */
	updateUser(userInfo, callback){
	
		if(!userInfo){
			return callback({code: 500, error: '请传入更新玩家信息'});
		}
		const uid = userInfo.uid;
		redisClient.hset('users', uid, JSON.stringify(userInfo)).then(() =>{
			redisClient.expire('users', 60 * 60 * 24);
			//缓存更新后需要新建同步任务
			syncMgr.taskExistsUser(uid).then(exists =>{
				if(!exists){
					syncMgr.addUserTask(uid).then(() =>{
						Pomelo.app.get('sync').exec('infoSync.updateUser', uid);
					});
				}
			});
			return callback();
		}).catch(err =>{
			console.error('更新redis玩家信息失败', err);
			return callback({code: 500, error: '更新redis玩家信息失败'+uid});
		});
	},

	/**
	 * 仅从redis内存中获取指定玩家
	 */
	getUserFromRedis(uid){
		if(!uid){
			return Promise.reject('请传入uid');
		}
		return redisClient.hget('users', uid);
	},
};