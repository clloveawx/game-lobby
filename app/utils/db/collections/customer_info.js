'use strict';

/**
 * 客服消息记录
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;

const CustomerInfoSchema = new Schema({
	
	uid: String,
	content: String,
	nickname: String,
	vip: String,
	inviteCode: String,
	isSolve: Number,     //1为没处理,2为处理中3为已处理
	createTime: string,
	type: Number,        // 1: 意见反馈   2: 代理申请
	name: String,
	phone: Number,
	qq: Number,
	weixin: String,
	passStatus: Number,
	remark: String,
	passType: Number,    // 0:未处理 1:通过 2:拒绝
});

//InviteCodeInfoSchema.plugin(plugin, {index: true});

//新增
CustomerInfoSchema.statics.add = function(callback, params) {
	
	this.create(params, function(err, info){
		if(err){
			return callback({code: 500, error: "新增客服消息失败" + err});
		}
		return callback(null, info);
	});
};

//按照指定条件查找一条
CustomerInfoSchema.statics.load_one = function(callback, params) {
	
	this.findOne(params, function(err, info){
		if(err){
			return callback({code: 500, error: "查找客服消息失败" + err});
		}
		return callback(null, info);
	});
};

//按照指定条件查找
CustomerInfoSchema.statics.load = function(callback, params) {
	
	this.find(params, function(err, codeInfos){
		if(err){
			return callback({code: 500, error: "查找客服消息失败"+err});
		}
		return callback(null, codeInfos);
	});
};

exports.model = mongoose.model('customer_info', CustomerInfoSchema, 'customer_info');
