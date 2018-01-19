'use strict';

/**
 *邀请码记录
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;

const InviteCodeInfoSchema = new Schema({
	inviteCode: {type: String, index: true},
	uid: {type: String, index: true},
	viper: String,
	superior: String,
	promoterId: String,
	createTime: Number,
	boundUid: String,
	integral: Number,
	secondViper: String,
	rebate: Number,
	inviteRecords: [],
	games: [],
	effectiveTimes: Number,
});

//InviteCodeInfoSchema.plugin(plugin, {index: true});

//按照指定条件查找一条
InviteCodeInfoSchema.statics.load_one = function(callback, params) {

	this.findOne(params, function(err, codeInfo){
		if(err){
			return callback({code: 500, error: "查找邀请码失败"+err});
		}
		return callback(null, codeInfo);
	});
};

//按照指定条件查找
InviteCodeInfoSchema.statics.load = function(callback, params) {
	
	this.find(params, function(err, codeInfos){
		if(err){
			return callback({code: 500, error: "查找邀请码失败"+err});
		}
		return callback(null, codeInfos);
	});
};

//跟新指定的邀请码信息
InviteCodeInfoSchema.statics.update_one = function(callback, params){
	if(!params.conds){
		return callback({code: 500, error: '请传入查询条件'});
	}
	if(!params.$set){
		return callback({code: 500, error: '请传入更新项'});
	}
	if(params.config){
		params.config['new'] = true;
	}
	this.findOneAndUpdate(params.conds, {'$set': params.$set}, params.config || {new: true})
		.exec(function(err, info){
			if(err){
				return callback({code: 500, error: '更新邀请码信息失败'});
			}
			return callback(null, info);
		});
};

exports.model = mongoose.model('invite_code_info', InviteCodeInfoSchema, 'invite_code_info');
