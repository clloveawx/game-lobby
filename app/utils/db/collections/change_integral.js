'use strict';

/**
 * 玩家积分增减记录
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const ChangeIntegralSchema = new Schema({
	uid: String,
	nickname: String,
	integral: Number,
	rebate: Number,
	isback: Boolean,
	type: String,
	time: Number,
	inviteCode: String,
	viperId: String,
});

ChangeIntegralSchema.plugin(plugin, {index: true});

//增加记录
ChangeIntegralSchema.statics.add = function(callback, params){

	this.create(params, function(err, doc){
		if(err || !doc){
			console.error('增加玩家积分增减记录失败', err);
		}
		return callback();
	});
};

exports.model = mongoose.model('change_integral', ChangeIntegralSchema, 'change_integral');
