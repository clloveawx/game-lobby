
'use strict';

/**
 *  积分场游戏的记录
 */
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const IntegralRecordSchema = new Schema({
	
	viper: String,
	uid: String,
	nickname: String,
	duration: Number,   //游戏持续时间
	createTime: Number,
	integral: Number,
	zname: String,
	
});

//增加
IntegralRecordSchema.statics.add = function(callback, params){
	this.create(params, function(err){
		if(err){
			console.error('增加积分场游戏记录失败', err);
		}
		return callback();
	});
};

exports.model = mongoose.model('integral_record', IntegralRecordSchema, 'integral_record');
