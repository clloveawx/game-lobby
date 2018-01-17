'use strict';

/**
 *玩家详细信息
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
const Mixed = Schema.Types.Mixed;
const utils = require('../../index');

const inviteCodeModel = require('./invite_code_info').model;   //查找邀请码集合

const PlayerInfoSchema = new Schema({
	
	_uid: {type: ObjectId, ref: 'user_info'},   //用来引用user_info
	uid: {type: String, index: true},
	sex: Number,
	integral: Number,
	addRmb: Number,
	selfbank: Number,
	inviteCode: {type: String, index: true},
	lastLogoutTime: Number,
	loginTime: Number,
	createTime: Number,
	vip: Boolean,
	nameChanged: Boolean,
	isPrompting: Boolean,
	vipStartTime: Number,
	props: Number,
	vipEffectiveTime: Number,
	vdot: Number,
	gamesRecord: Mixed,
	alipay: String,
	inviteCodeBindTime: Number,
	isRobot: Number,
	viperId: String,
	needPlatform: Boolean,

	pirateMiniGames: {},
	pirateMiniGamesIntegral: {},
	pirateBox: [],
	pirateBoxIntegral:[],
	freespinNum: Number,
	freespinNumIntegral: Number,

	protocolAgree: Boolean,
	allowances: Mixed,
	renewalReminder: Boolean,
	rechargeReminder: Boolean,
	loginCount: Number,
	unlock: {},
	lastGameContents: {},
	address: String,
	roulette: Number,
	addExchange: Number,
	dailyIndianaSign: Mixed,
	monthlyCard: Mixed,

	isOpenAgency: Boolean,
	remark: String,
	openTime: Number,
	type: Number,
});

//PlayerInfoSchema.plugin(plugin, {index: true});

/**
 * 新建一条玩家数据插入数据库
 */
function insertPlayer({player, codeInfo, _uid}, callback){
	const playerInfoToMongo = player.wrapDatebase();
	playerInfoToMongo._uid = _uid;
	this.create(playerInfoToMongo, function(err, newPlayer){
		if(err || !newPlayer){
			return callback({code: 500, error: '新建玩家失败'+uid});
		}
		// 如果邀请码信息存在
		if(codeInfo && player.uid !== codeInfo.uid){    //扫码进入的玩家不是邀请码所有者
			codeInfo.inviteRecords.push(player.uid);
			inviteCodeModel.update_one(function(){}, {
				conds: {inviteCode: codeInfo.inviteCode},
				$set: {inviteRecords: codeInfo.inviteRecords},
			})
		}
		return callback(null, require('../dbMgr/playerMgr').newPlayer(newPlayer));
	});
};

//新建玩家
PlayerInfoSchema.statics.add = function(callback, {uid, isRobot, inviteCode, gameVersion, _uid}){
	if(!uid){
		return callback({code: 500, error: '请传入uid'});
	}
	const _this = this;
	const playerMgr = require('../dbMgr/playerMgr');
	const player = playerMgr.newPlayer({uid, vip: false, isRobot});
	if(!inviteCode){     //没有邀请码,直接创建玩家
		insertPlayer.call(this, {player, _uid}, callback);
	}else {    //相当于扫码进入
		inviteCodeModel.load_one(function(err, codeInfo){
			if(err){
				return callback(err);
			}
			if(!codeInfo){   //该邀请码不存在
				return callback({code: 500, error: '该邀请码无效'+inviteCode});
			}
			if(gameVersion == 1){   //网吧版
				//新建玩家
				player.inviteCode = inviteCode;
				insertPlayer.call(_this, {player, codeInfo, _uid}, callback);
			}else{   //vip版本
				if(codeInfo.effectiveTimes != null && codeInfo.effectiveTimes <= data.inviteRecords.length){
					return callback({code: 500, error: '该邀请码的有效次数已用完'+inviteCode});
				}
				//绑定玩家信息
				player.inviteCode = inviteCode;
				player.viperId = codeInfo.uid;
				player.integral = codeInfo.integral;

				//返利
				if(codeInfo.boundUid && codeInfo.rebate){
					playerMgr.getPlayer({uid: codeInfo.boundUid}, function(err, boundUser){
						if(err || !boundUser){
							return callback({code: 500, error: '查找返利者失败'+codeInfo.boundUid});
						}
						boundUser.integral += codeInfo.integral * codeInfo.rebate * 0.01;
						//重新更新玩家数据
						playerMgr.updatePlayer(codeInfo.boundUid, boundUser, function(err){
							if(err){
								return callback(err);
							}
						});
					});
				}
				//添加积分改变的记录
				if(codeInfo.integral > 0){
					require('../mongodb').getDao('change_integral').create({
						uid,
						integral: player.integral,
						isback: false,
						rebate: codeInfo.rebate,
						type: 'add',
						time: Date.now(),
						inviteCode: player.inviteCode,
						viperId: player.viperId,
					}, function(){});
				}
				insertPlayer.call(_this, {player, codeInfo, _uid}, callback);
			}
		}, {inviteCode});
	}
};

//按照指定uid进行查找
PlayerInfoSchema.statics.load_by_uid = function(callback, {uid}) {
	if (!uid) {
		return callback({code: 500, error: "请传入uid"});
	}
	this.findOne({uid}, function(err, player){
		if(err){
			return callback({code: 500, error: "查找玩家失败"+err});
		}
		return callback(null, player);
	});
};

//按照指定条件进行查找
PlayerInfoSchema.statics.load = function(callback, params, select = {}) {

	this.find(params, select)
		.populate('_uid', 'nickname cellphone password')
		.exec(function(err, players){
			if(err){
				console.error('查找玩家失败', err);
			}
			return callback(null, players);
		});
};

//查找并更新
PlayerInfoSchema.statics.find_one_and_update = function(callback, params){
	if(!params.conds){
		return callback({code: 500, error: '请传入查询条件'});
	}
	if(!params.$set){
		return callback({code: 500, error: '请传入更新条件'});
	}
	this.findOneAndUpdate(params.conds, {'$set': params.$set}, params.config || {}).exec(function(err, user){
		if(err){
			return callback({code: 500, error: '更新玩家失败'});
		}
		return callback(null, user);
	});
};


exports.model = mongoose.model('player_info', PlayerInfoSchema, 'player_info');
