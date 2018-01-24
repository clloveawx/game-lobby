
'use strict';

/**
 *  社交比赛的记录
 */
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const SocialRecordSchema = new Schema({
	
	viper: String,
	nid: String,
	roomCode: String,
	uid: String,
	win: Number,
	type: String,   //货币类型
	
});

//增加
SocialRecordSchema.statics.add = function(callback, params){
	this.create(params, function(err){
		if(err){
			console.error('增加社交比赛记录失败', err);
		}
		return callback();
	});
};

exports.model = mongoose.model('social_record', SocialRecordSchema, 'social_record');
