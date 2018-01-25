'use strict';

const InviteCode = require('./inviteCode');
const Async = require('async');
const PlayerMgr = require('../player/PlayerMgr');
const MongoDB = require('../../../utils/db/mongodb');
const InviteCodeInfoDao = MongoDB.getDao("invite_code_info");
const Logger = require('pomelo-logger').getLogger('log', __filename);

const InviteCodeMgr = module.exports;

/**
 * 获取邀请码
 * */
InviteCodeMgr.refreshInviteCodeInternal = (uid, callback) => {
	const recursiveFind = function () {
		const inviteCode = generateInviteCode();
		InviteCodeMgr.findOneInviteCodeInfo({inviteCode: inviteCode}, function (error, data) {
			if (error) {
				return callback(error);
			}
			//有找到则重新生成邀请码
			if (data) {
				return recursiveFind();
			}
			//否则直接返回
			return callback(null, inviteCode);
		});
	};
	recursiveFind();
};

//网吧版本调用的普通玩家生成邀请码的接口
InviteCodeMgr.internetPlayerInviteCode  = ({uid}, callback) =>{
	const player = PlayerMgr.getPlayer(uid);
	const addGoldRebates = MongoDB.getDao('add_gold_rebates');
	if(!player){
		return callback({message: '未找到玩家'});
	}
	//判断该玩家是否是一级
	const master = !player.inviteCode;
	let  secRebate ;
	Async.waterfall([
		cb => {  //查看该玩家是否存在邀请码信息
			InviteCodeMgr.findOneInviteCodeInfo({uid}, function(err, data){
				if(err){
					return cb(err);
				}
				if(data){
					addGoldRebates.findOne({rebateId:'123456'},function(err,rebates){
						addGoldRebates.findOne({rebateId:'234567'},function(err,secRebates){
							if(rebates){
								data.rebate = rebates.rebate;
								data['secRebate'] = secRebates.rebate;
								console.log('data.......',data);
								return cb(null, data);
							}
						});
					});
				}else{
					//生成邀请码信息
					InviteCodeMgr.refreshInviteCodeInternal(uid, function(err, code){
						err && cb(err);
						addGoldRebates.findOne({rebateId:'123456'},function(err,rebates){
							err && cb(err);
							addGoldRebates.findOne({rebateId:'234567'},function(err,secRebates){
								err && cb(err);
								secRebate =  secRebates.rebate;
								new Promise((resolve, reject) =>{
									if(master){
										resolve({superior:'',viper:uid,secondViper:''});
									}else{
										InviteCodeMgr.findOneInviteCodeInfo({inviteCode: player.inviteCode}, function(err, data){
											err && cb(err);
											if(!data){
												cb(new Error('未找到上级邀请码信息'+player.inviteCode));
											}
											if(data.uid === data.viper){
												resolve({superior:data.uid,viper:data.viper,secondViper:uid});
											}else{
												resolve({superior:data.uid,viper:data.viper,secondViper:data.secondViper});
											}
										})
									}
								}).then(({superior,viper,secondViper}) =>{
									const inviteCodeInfo = new InviteCode({
										inviteCode: code,
										superior,
										uid,
										integral: 0,
										effectiveTimes: Infinity,
										rebate: rebates.rebate,
										viper:viper,
										secondViper,
									});
									InviteCodeInfoDao.create(inviteCodeInfo.wrapForDatabase(), (err, data) => {
										if (err) {
											return cb(err);
										} else if (!data) {
											return cb(new Error("插入出错：未返回值"));
										} else {
											return cb(null, data);
										}
									});
								})
							});
						});
					})
				}
			});
		},
		(inviteCodeInfo, cb) =>{
			const result = {inviteCode: inviteCodeInfo.inviteCode, totalNum: inviteCodeInfo.inviteRecords.length, rebate: inviteCodeInfo.rebate,secRebate:secRebate};
			//总返利的金币数量
			const goldBackRecord = MongoDB.getDao('gold_back_record');
			goldBackRecord.aggregate()
			.match({upPlayerUid: uid,})
			.group({_id: "", totalAdd: {$sum: "$backGold"}})
			.project({_id: 0, totalAdd: 1})
			.exec(function(err, datas) {
				err && cb(err);
				result.totalAdd = datas[0] && datas[0].totalAdd || 0;
				return cb(null, result);
			})
		},
	], function(err, result){
		if(err){
			return callback({message: err});
		}
		//统计所有二级人数
		InviteCodeInfoDao.find({superior: uid}, function(err, docs){
			if(err){
				return callback({message: err});
			}
			const records = docs.reduce((record, doc) =>{
				const cur = record.concat(doc.inviteRecords);
				return cur;
			}, []);
			console.log('网吧返利邀请统计',result);
			result.juniors = records.length;
			return callback(null, result);
		})
	});
};










//外网版本调用的普通玩家生成邀请码的接口
InviteCodeMgr.commonPlayerInviteCode = ({uid}, callback) =>{
	
	const player = PlayerMgr.getPlayer(uid);
	if(!player){
		return callback({message: '未找到玩家'});
	}
	if(player.vip){
		return callback({message: '玩家已是vip'});
	}
	if(!player.inviteCode){
		return callback({message: '玩家没有邀请码'});
	}
	Async.waterfall([
		cb => {  //查看该玩家是否存在邀请码信息
			InviteCodeMgr.findOneInviteCodeInfo({uid}, function(err, data){
				if(err){
					return cb(err);
				}
				if(data){
					return cb(null, data);
				}else{
					//生成邀请码信息
					InviteCodeMgr.refreshInviteCodeInternal(uid, function(err, code){
						err && cb(err);
						InviteCodeMgr.findOneInviteCodeInfo({inviteCode: player.inviteCode}, function(err, doc){
							err && cb(err);
							if(!doc){
								return cb('未找到玩家邀请码对应的信息');
							}
							const inviteCodeInfo = new InviteCode({
								inviteCode: code,
								uid,
								viper: doc.viper,
								integral: 0,
								effectiveTimes: Infinity,
								rebate: doc.rebate,
							});
							InviteCodeInfoDao.create(inviteCodeInfo.wrapForDatabase(), (err, data) => {
								if (err) {
									return cb(err);
								} else if (!data) {
									return cb(new Error("插入出错：未返回值"));
								} else {
									return cb(null, data);
								}
							});
						})
					})
				}
			});
		},
		(inviteCodeInfo, cb) =>{
			const result = {inviteCode: inviteCodeInfo.inviteCode, totalNum: inviteCodeInfo.inviteRecords.length, rebate: inviteCodeInfo.rebate};
			//总上分数量
			const changeIntegralModel = MongoDB.getDao('change_integral');
			changeIntegralModel.aggregate()
			.match({inviteCode: result.inviteCode, viperId: inviteCodeInfo.viper, type: 'add'})
			.group({_id: "", totalAdd: {$sum: "$integral"}})
			.project({_id: 0, totalAdd: 1})
			.exec(function(err, datas) {
				err && cb(err);
				result.totalAdd = datas[0] && datas[0].totalAdd || 0;
				result.totalRebates = result.totalAdd * inviteCodeInfo.rebate * 0.01;
				return cb(null, result);
			})
		},
	], function(err, result){
		if(err){
			return callback({message: err});
		}
		return callback(null, result);
	});
};

/**
 * 生成邀请码
 * */
function generateInviteCode() {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	
	for (let i = 0; i < 4; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

/**
 * 配置邀请码
 * */
InviteCodeMgr.configureInviteCodeInternal = (uid, inviteCode, integral, rebate, boundUid, odd, effectiveTimes, next) => {
	integral = Number(integral);
	Async.waterfall([
		callback => {
			InviteCodeMgr.findOneInviteCodeInfo({inviteCode: inviteCode}, (error, data) => {
				if (error) {
					return callback(error);
				}
				if (data) {
					return callback(new Error("该邀请码已被其他人配置"));
				}
				return callback(null);
			});
		},
		callback => {
			if (!boundUid) {
				return callback(null);
			}
			if(odd){
				return callback(null);
			}
			getPlayerFromBufferOrDatabase(boundUid, player => {
				if (!player) {
					return callback(new Error("请输入正确的ID号码"));
				}
				if(player.vip){
					return callback(new Error("绑定返利者是vip"));
				}
				//验证该玩家是否是房主下面的玩家
				InviteCodeMgr.findOneInviteCodeInfo({inviteCode: player.inviteCode}, (error, data) => {
					if (error) {
						return callback(error);
					}
					if (data.viper != uid) {
						return callback(new Error("该返利者不是这个房主下面的玩家"));
					}
					return callback(null);
				});
			})
		},
		// callback => {
		//     if(!boundUid){
		//         return callback(null);
		//     }
		//     InviteCodeMgr.findOneInviteCodeInfo({boundUid: boundUid}, (error, data) => {
		//             if (error) {
		//                 return callback(error);
		//             }
		//             if (data) {
		//                 return callback(new Error("该返利者已被绑定"));
		//             }
		//             return callback(null);
		//         });
		// },
		callback => {
			//生成一条记录插入到 invite_code_info
			const inviteCodeInfo = new InviteCode({
				inviteCode: inviteCode,
				uid: uid,
				viper: uid,
				boundUid: boundUid,
				integral: integral,
				rebate: rebate,
				effectiveTimes,
			});
			// new Promise((resolve, reject) =>{
			//     if(boundUid){
			//         updatePlayerFromBufferOrDatabase({uid, boundUid, info: {inviteCode, integral}}, function(err, data){
			//             if(err){
			//                 return callback(new Error("更新出错：updatePlayerFromBufferOrDatabase"));
			//             }
			//             inviteCodeInfo.inviteRecords = [data.uid];
			
			//             resolve();
			//         });
			//     }else{
			//         resolve();
			//     }
			// }).then(function(){
			//插入数据库
			InviteCodeInfoDao.create(inviteCodeInfo.wrapForDatabase(), (err, res) => {
				if (err) {
					return callback(err);
				} else if (!res) {
					return callback(new Error("插入出错：未返回值"));
				} else {
					return callback(null);
				}
			});
			// });
		}
	], error => {
		return next(error);
	});
};

/**
 * 获取 inviteCode 信息
 * */
InviteCodeMgr.findOneInviteCodeInfo = (where, callback) => {
	InviteCodeInfoDao.findOne(where, (error, data) => {
		if (error) {
			return callback(error)
		}
		return callback(null, data);
	});
};

/**
 * 打开邀请码库
 * */
InviteCodeMgr.listInviteCodesInternal = (uid, callback) => {
	const player = PlayerMgr.getPlayer(uid);
	if(!player || !player.vip){
		return callback({message: '未找到玩家或者玩家不是vip'});
	}
	const fields = "-_id inviteCode integral boundUid rebate viper uid effectiveTimes inviteRecords";
	getInviteCodesFromDatabase({'$or': [{uid}, {viper: uid, 'inviteRecords.0': {'$exists': 1}}]}, fields, {createTime : 1},(error, records) => {
		if (error) {
			return callback(error);
		}
		console.log('records.....',records);
		const list = records.map( m => {
			// console.log('inviteCode....',inviteCode);
			// inviteCode.number = index + 1;
			// return inviteCode;
			return {
				
				inviteCode : m.inviteCode,
				uid:m.uid,
				integral:m.integral,
				boundUid:m.boundUid,
				rebate : m.rebate,
				effectiveTimes:m.effectiveTimes,
				peopleLength : m.inviteRecords.length,
			}
		});
		console.log('====================list',list)
		return callback(null, list);
	});
};

/**
 * 根据条件 query 获取指定字段 fields 的记录
 * */
function getInviteCodesFromDatabase(query, fields, sortConditions, callback) {
	InviteCodeInfoDao.find(query, fields).sort(sortConditions).exec((error, records) => {
		if (error) {
			return callback(error);
		} else if (!records) {
			return callback(new Error("获取记录错误：未返回值"));
		}
		return callback(null, records);
	});
}

/**
 * 查看某个邀请码下的具体信息
 * */
InviteCodeMgr.viewInviteCodeInternal = (inviteCode, callback) => {
	const getPlayerPromise = uid => {
		return new Promise((resolve, reject) => {
			getPlayerFromBufferOrDatabase(uid, player => {
				if (!player) {
					return reject(new Error("未找到玩家:" + uid));
				}
				return resolve(player);
			});
		});
	};
	
	InviteCodeMgr.findOneInviteCodeInfo({inviteCode: inviteCode}, (error, inviteCodeInfo) => {
		if (error) {
			return callback(error);
		}
		if (!inviteCodeInfo) {
			return callback(new Error("根据邀请码未找到邀请码信息:" + inviteCode));
		}
		
		//构建 promise 数组
		let searchPromises = [];
		inviteCodeInfo.inviteRecords.forEach(uidAndTime => {
			let args;
			if(Object.prototype.toString.call(uidAndTime) == "[object Object]"){
				args = uidAndTime.uid;
			}else{
				args = uidAndTime;
			}
			searchPromises.push(getPlayerPromise(args));
		});
		//并行执行
		Promise.all(searchPromises)
		.then(players => {
			//只取昵称和积分
			const codePlayers = players.map(player => {
				// console.log('===============',player)
				return {uid: player.uid, nickname: player.nickname, integral: player.integral};
			});
			return callback(null, codePlayers);
		})
		.catch(error => {
			return callback(error);
		});
	});
};

/**
 * 获取玩家信息
 * */
function getPlayerFromBufferOrDatabase(uid, callback) {
	let boundPlayer = PlayerMgr.getPlayer(uid);
	if (boundPlayer) {
		return callback(boundPlayer);
	}
	const playerDao = MongoDB.getDao('player_info');
	playerDao.findOne({uid: uid}, (error, data) => {
		if (error) {
			Logger.error("查找数据库出错：" + error.message);
			return callback(null)
		}
		return callback(data);
	});
};

/**
 * 更新玩家
 * */
function updatePlayerFromBufferOrDatabase({uid, boundUid, info}, callback) {
	let boundPlayer = PlayerMgr.getPlayer(boundUid);
	if (boundPlayer) {
		boundPlayer.inviteCode = info.inviteCode;
		boundPlayer.integral += info.integral;
		boundPlayer.viperId = uid;
		return callback(null, boundPlayer);
	}
	const playerDao = MongoDB.getDao('player_info');
	playerDao.findOneAndUpdate({uid: boundUid}, {'$set': {'inviteCode': info.inviteCode, 'integral': info.integral, 'viperId': uid}}, {new: true}, function(error, res) {
		if (error) {
			Logger.error("查找数据库出错：" + error.message);
			return callback(null)
		}
		return callback(null, res);
	});
}

/**
 * 更新邀请码数据
 * */
InviteCodeMgr.updateInviteCode = (where, fields, options, callback) => {
	InviteCodeInfoDao.update(where, fields, options, (error, data) => {
		if (error) {
			return callback ? callback(error) : null;
		} else if (!data) {
			return callback ? callback(new Error("更新未返回数据")) : null;
		}
		return callback ? callback(null, data) : null;
	});
};