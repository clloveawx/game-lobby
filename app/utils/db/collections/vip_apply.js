'use strict';

/**
 * 玩家提交的vip申请
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const VipApplySchema = new Schema({
	
	uid: {type: String, index: true},
	status: Number,     //申请状态  1-申请中 2-已同意 3-已拒绝
	reason: String,     // 申请原因
	userInfo: {
		type: ObjectId,
		ref: 'user_info',
	},
	playerInfo: {
		type: ObjectId,
		ref: 'player_info',
	},
});

VipApplySchema.plugin(plugin, {index: true});


exports.model = mongoose.model('vip_apply', VipApplySchema, 'vip_apply');
