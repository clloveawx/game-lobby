'use strict';

const Pomelo = require('pomelo');
const redisClient = require('../redis').client();
const mongoDB = require('../mongodb');
const async = require('async');
const Player = require('../classes/Player');
const playerModel = mongoDB.getDao('player_info');
const syncMgr = require('./syncMgr');

module.exports = {
	/**
	 * 实例化一个玩家
	 */
	newPlayer(player){
		return new Player(player);
	},

	/**
	 * 从redis中读取指定玩家的数据
	 * 如果该玩家不在redis,则从数据库读取,  若数据库中也没有就根据参数判断是否创建
	 * 并设置过期时间为1天
	 */
	getPlayer({uid}, callback){
		if(!uid){
			return callback({code: 500, error: '请传入uid'});
		}
		redisClient.hexists('players', uid, function(err, exists){
			if(err){
				return callback({code: 500, error: '判断玩家是否在redis内存出错'});
			}
			if(exists){
				redisClient.hget('players', uid, function(err, player){
					if(err){
						return callback({code: 500, error: '获取redis中的玩家出错'+uid});
					}
					return callback(null, JSON.parse(player));
				});
			}else{
				playerModel.load_by_uid(function(err, player){
					if(err){
						return callback(err);
					}
					redisClient.hset('players', uid, JSON.stringify(player), function(err){
						if(err){
							console.error('redis设置玩家出错'+uid);
						}
						redisClient.expire('players', 60 * 60 * 24);
					});
					callback(null, player);
				}, {uid});
			}
		});
	},

	/**
	 * 更新redis中的指定玩家数据
	 */
	updatePlayer(playerInfo, callback){

		if(!playerInfo){
			return callback({code: 500, error: '请传入更新玩家信息'});
		}
		const uid = playerInfo.uid;
		redisClient.hset('players', uid, JSON.stringify(playerInfo)).then(() =>{
			redisClient.expire('players', 60 * 60 * 24);

			//缓存更新后需要新建同步任务
			syncMgr.taskExistsPlayer(uid).then(exists =>{
				if(!exists){
					syncMgr.addPlayerTask(uid).then(() =>{
						Pomelo.app.get('sync').exec('infoSync.updatePlayer', {uid});
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
	getPlayerFromRedis(uid){
		if(!uid){
			return Promise.reject({code: 500, error: '请传入uid'});
		}
		return redisClient.hget('players', uid);
	},

	/**
	 * 获取玩家完整信息 user_info + player_info
	 */
	getPlayerTotalInfo(uid){
		if(!uid){
			return Promise.reject({code: 500, error: '请传入uid'});
		}
		const _this = this;
		return new Promise((resolve, reject) =>{
			_this.getPlayer({uid}, function(err, player){
				if(err){
					return reject(err);
				}
				require('./userMgr').getUser({uid}, function(err, user){
					if(err){
						return reject(err);
					}
					return resolve({player, user});
				});
			});
		}).catch(err =>{
			console.error('获取玩家完整信息 user_info + player_info失败', err);
		})
	},

};