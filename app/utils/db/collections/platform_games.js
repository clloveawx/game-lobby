'use strict';

/**
 *vip平台游戏信息
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
const Mixed = Schema.Types.Mixed;

const PlatformGamesInfoSchema = new Schema({

	viper: String,      //游戏所在的平台创建者
	nid: String,
	name: String,
	zname: String,
	sname: String,

	roomUserLimit: Number,
	createTime: Number,

	gameStartTime: Number,
	gameHaveTime: Number,
	onlineAwards: Number,    //联机大奖奖池
});

//PlatformGamesInfoSchema.plugin(plugin, {index: true});

//按照指定条件进行查找一条数据
PlatformGamesInfoSchema.statics.load_one = function(callback, params) {

	this.findOne(params, function(err, game){
		if(err){
			return callback({code: 500, error: "查找平台游戏失败"+err});
		}
		return callback(null, game);
	});
};

//按照指定条件进行查找
PlatformGamesInfoSchema.statics.load = function(callback, params) {

	this.find(params, function(err, games){
		if(err){
			return callback({code: 500, error: "查找平台游戏失败"+err});
		}
		return callback(null, games);
	});
};

exports.model = mongoose.model('platform_games', PlatformGamesInfoSchema, 'platform_games');
