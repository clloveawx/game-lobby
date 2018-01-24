'use strict';

/**
 *公告
 */
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UpdateAnnouncementSchema = new Schema({
	id: Number,
	name: String,
	createTime: Number,
	content: String,
});

//根据条件加载一条
UpdateAnnouncementSchema.statics.load_one = function(params){
	this.findOne(params, function(err, doc){
		if(err){
			return callback({code: 500, error: "查找公告失败"+err});
		}
		return callback(null, doc);
	});
};

exports.model = mongoose.model('update_announcement', UpdateAnnouncementSchema, 'update_announcement');
