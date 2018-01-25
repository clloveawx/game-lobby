'use strict';

/**
 * 大喇叭
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;

const BigPostNoticeSchema = new Schema({
	nickname: String,
	content: String,
	uid: String,
	time: Number,
});

BigPostNoticeSchema.plugin(plugin, {index: true});

//增加记录
BigPostNoticeSchema.statics.add = function(callback, params){
	
	this.create(params, function(err, doc){
		if(err || !doc){
			console.error('增加大喇叭失败', err);
		}
		return callback();
	});
};

exports.model = mongoose.model('big_post_notice', BigPostNoticeSchema, 'big_post_notice');
