'use strict';

/**
 * vip游戏购买记录
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;

const PurchaseRecordSchema = new Schema({
	
	uid: {type: String, index: true},
	consume: Number,
	zname: String,
	
});

PurchaseRecordSchema.plugin(plugin, {index: true});

//增加记录
PurchaseRecordSchema.statics.add = function(callback, params){
	
	this.create(params, function(err, doc){
		if(err || !doc){
			console.error(`增加玩家${params.uid}购买游戏${params.zname}记录失败`, err);
		}
		return callback();
	});
};

exports.model = mongoose.model('purchase_record', PurchaseRecordSchema, 'purchase_record');
