'use strict';

/**
 *vip平台基础信息信息
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
const Mixed = Schema.Types.Mixed;

const PlatformInfoSchema = new Schema({

	creator: String,
	invitationCode: String,
	members: [],

	vipModel: String,
	afterModel: String,
	modelEffectTime: Mixed,

	concatWay: String,
	concater: String,
});

PlatformInfoSchema.plugin(plugin, {index: true});

//按照指定条件进行查找
PlatformInfoSchema.statics.load = function(callback, params) {

	this.find(params, function(err, platforms){
		if(err){
			return callback({code: 500, error: "查找平台失败"+err});
		}
		return callback(null, platforms);
	});
};

//按照指定条件进行查找一条数据
PlatformInfoSchema.statics.load_one = function(callback, params) {

	this.findOne(params, function(err, platform){
		if(err){
			return callback({code: 500, error: "查找平台失败"+err});
		}
		return callback(null, platform);
	});
};

//查找并更新
PlatformInfoSchema.statics.find_one_and_update = function(callback, params){
	if(!params.conds){
		return callback({code: 500, error: '请传入查询条件'});
	}
	if(!params.$set){
		return callback({code: 500, error: '请传入更新条件'});
	}
	if(!params.config){
		params.config = {new: true};
	}else{
		params.config['new'] = true
	}
	this.findOneAndUpdate(params.conds, {'$set': params.$set}, params.config).exec(function(err, user){
		if(err){
			return callback({code: 500, error: '更新平台失败'});
		}
		return callback(null, user);
	});
};

exports.model = mongoose.model('platform', PlatformInfoSchema, 'platform');
