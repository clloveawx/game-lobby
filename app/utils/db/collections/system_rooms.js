'use strict';

/**
 *系统游戏的所有房间
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
const Mixed = Schema.Types.Mixed;

const SystemRoomsSchema = new Schema({
	nid: String,
	roomCode: String,
	jackpot: Number,
	runningPool: Number,
	profitPool: Number,
	outRate: Number,
	socialDot: Number,
	matchDot: Number,
	winTotal: Number,
	consumeTotal: Number,
	boomNum: Number,
	open: Boolean,
	disableTime: Number,  //停用时间
});

SystemRoomsSchema.plugin(plugin, {index: true});

SystemRoomsSchema.statics.load = function(callback, params){
	this.find(params).exec(function(err, rooms){
		if(err){
			console.log(`加载游戏房间失败`+err);
		}
		return callback(null, rooms);
	});
};


exports.model = mongoose.model('system_rooms', SystemRoomsSchema, 'system_rooms');
