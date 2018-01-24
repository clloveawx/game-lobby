
'use strict';

/**
 *  slots游戏的内存记录
 */
const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const Mixed = Schema.Types.Mixed;

const SlotsRecordSchema = new Schema({
	
	game: String,
	record: Mixed,
	vipRecord: Mixed,
	awardRegulation: Mixed,

});

//查找并更新
SlotsRecordSchema.statics.find_one_and_update = function(callback, params){
	if(!params.conds){
		return callback({code: 500, error: '请传入查询条件'});
	}
	if(!params.$set){
		return callback({code: 500, error: '请传入更新条件'});
	}
	this.findOneAndUpdate(params.conds, {'$set': params.$set}, params.config || {}).exec(function(err){
		if(err){
			console.error(`更新游戏内存失败`, err);
			return callback({code: 500, error: `更新游戏内存失败`});
		}
		return callback(null);
	});
};

exports.model = mongoose.model('slots_record', SlotsRecordSchema, 'slots_record');
