'use strict';

/**
 *vip平台游戏房间信息
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
const Mixed = Schema.Types.Mixed;

const PlatformRoomsInfoSchema = new Schema({

	viper: String,    //房间所在的平台创建者
	nid: String,       //房间所在的游戏
	roomCode: String,
	createTime: Number,   //购买机器时间
	jackpot: Number,
	profitPool: Number,
	socialDot: Number,  //社交点
	matchDot: Number,
	outRate: Number,
	winTotal: Number,
	consumeTotal: Number,
	boomNum: Number,
	open: Boolean,
	disableTime: Number, //停用时间
	jackpotShow: {},      //奖池显示配置
});

//PlatformRoomsInfoSchema.plugin(plugin, {index: true});

//按照指定条件进行查找一条数据
PlatformRoomsInfoSchema.statics.load_one = function(callback, params) {

	this.findOne(params, function(err, game){
		if(err){
			return callback({code: 500, error: "查找平台游戏失败"+err});
		}
		return callback(null, game);
	});
};

//按照指定条件进行查找
PlatformRoomsInfoSchema.statics.load = function(callback, params) {

	this.find(params, function(err, game){
		if(err){
			return callback({code: 500, error: "查找平台游戏失败"+err});
		}
		return callback(null, game);
	});
};


exports.model = mongoose.model('platform_rooms', PlatformRoomsInfoSchema, 'platform_rooms');
