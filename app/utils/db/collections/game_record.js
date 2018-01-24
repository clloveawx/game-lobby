
'use strict';

/**
 *  金币场游戏记录
 */
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const GameRecordSchema = new Schema({
	
	uid: String,
	nickname: String,
	nid: String,
	gname: String,
	createTime: Number,
	input: Number,
	multiple: Number,
	profit: Number,
	gold: {},
	playStatus: Number,
});

exports.model = mongoose.model('game_record', GameRecordSchema, 'game_record');
