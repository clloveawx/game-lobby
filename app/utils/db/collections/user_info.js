'use strict';

/**
 *玩家基础信息
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;

const UserInfoSchema = new Schema({

	guestid: String,   //游客id
	uid: {type: String, index: true},
	loginIP: [],
	cellPhone: String,
	passWord: String,      //手机号登录密码
	isOnline: Boolean,
	userName: String,      //账号
	userWord: String,      //账号登录密码
	isOpenAgency: Boolean,
	remark: String,
	openTime: Number,
	email: String,
	type: Number,
	
});

UserInfoSchema.plugin(plugin, {index: true});

//新建或者更新
UserInfoSchema.statics.save = function(callback, params){
	if(!params.uid){
		return callback({code: 500, error: '请传入uid'});
	}
	const uid = params.uid;
	const _this = this;
	this.findOne({uid}).exec(function(err, udoc){
		if(err){
			return callback({code: 500, error: `查找玩家失败${uid}`});
		}
		if(!udoc){
			_this.create(params, function(err, user){
				if(err || !user){
					return callback({code: 500, error: '创建玩家失败'});
				};
				return callback(null, user);
			});
		}else{
			for(let i in params){
				udoc[i] = params[i];
			}
			udoc.save(function(err, user){
				if(err){
					return callback({code: 500, error: '更新玩家失败'});
				}
				return callback(null, user);
			});
		}
	});
};

//按照指定uid进行查找
UserInfoSchema.statics.load_by_uid = function(callback, {uid}) {
	if (!uid) {
		return callback({code: 500, error: "请传入uid"});
	}
	this.findOne({uid}, function(err, user){
		if(err){
			return callback({code: 500, error: "查找玩家失败"+err});
		}
		return callback(null, user);
	});
};

//按照指定条件进行查找一个玩家
UserInfoSchema.statics.load_one = function(callback, params) {

	this.findOne(params, function(err, user){
		if(err){
			return callback({code: 500, error: "查找玩家失败"+err});
		}
		return callback(null, user);
	});
};

//查找并更新
UserInfoSchema.statics.find_one_and_update = function(callback, params){
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

exports.model = mongoose.model('user_info', UserInfoSchema, 'user_info');
