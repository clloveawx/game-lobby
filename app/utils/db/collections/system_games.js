'use strict';

/**
 *系统游戏
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');
const Schema = mongoose.Schema;

//系统游戏模型
const SystemGamesSchema = new Schema({
	nid: String,
	heatDegree: Number,
	onlineAwards: Number,
});

SystemGamesSchema.plugin(plugin, {index: true});

//根据条件加载所有的游戏
SystemGamesSchema.statics.load = function(callback, params){
	this.find(params).exec(function(err, games){
		if(err){
			return callback({code: 500, error: '加载系统游戏失败'});
		}
		return callback(null, games);
	});
};

exports.model = mongoose.model('system_games', SystemGamesSchema, 'system_games');
