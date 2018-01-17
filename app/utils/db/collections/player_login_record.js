'use strict';

/**
 *玩家登陆信息
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const PlayerLoginRecordInfoSchema = new Schema({
	uid: String,
	nickname: String,
	loginTime: Number,
	leaveTime: Number,
	gold: {},
	integral: Number,
	addRmb: Number,
});

PlayerLoginRecordInfoSchema.plugin(plugin, {index: true});

//新建或者更新
PlayerLoginRecordInfoSchema.statics.add = function(callback, params){

	const _this = this;
	this.update(params.conds, {$set: params.$set}, params.config || {}).exec(err =>{
		if(err){
			return callback({code: 500, error: '玩家登陆记录更新失败'+err});
		}
	});
};

exports.model = mongoose.model('player_login_record', PlayerLoginRecordInfoSchema, 'player_login_record');
