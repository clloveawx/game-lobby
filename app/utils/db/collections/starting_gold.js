'use strict';

/**
 *启动金活动
 */
const mongoose = require('mongoose');
const plugin = require('../common/plugins');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const StartingGoldSchema = new Schema({
	activation: Boolean,
	limit: Number,
	day: Number,
	date: [],
});

StartingGoldSchema.plugin(plugin, {index: true});

//根据条件加载活动
StartingGoldSchema.statics.load_one = function(params){
	this.findOne(params, function(err, doc){
		if(err){
			return callback({code: 500, error: "查找启动金活动失败"+err});
		}
		return callback(null, doc);
	});
};


exports.model = mongoose.model('starting_gold', StartingGoldSchema, 'starting_gold');
