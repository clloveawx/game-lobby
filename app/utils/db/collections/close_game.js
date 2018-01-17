'use strict';

/**
 *需要关闭的游戏
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const CloseGameSchema = new Schema({
	nid: String,
	status: Boolean,
	closeTime: Number,
});

CloseGameSchema.plugin(plugin, {index: true});

//根据条件加载所有的关闭游戏
CloseGameSchema.statics.load = function(params){

	this.find(function(err, docs){
		if(err){
			return callback({code: 500, error: '查找所有关闭游戏失败'});
		}
		return callback(null, docs);
	}, params);
};

exports.model = mongoose.model('close_game', CloseGameSchema, 'close_game');
