'use strict';

const db = require('../../utils/db/mongodb');

exports.afterStartAll = function (app) {

};

// 服务器关闭前
exports.beforeShutdown = function (app, cb) {
	
	const slots777Memory = require('../../domain/games/slots777/memory');
	db.getDao('slots_record').find_one_and_update(function(err){
		if(err){
			console.error('记录slots777游戏内存失败', err);
		}
		console.log('slots777服务器关闭前游戏内存记录成功');
	},{
		conds: {game: '1'},
		$set: {
			"record": slots777Memory.record,
			"vipRecord": slots777Memory.vipRecord,
			"awardRegulation": slots777Memory.awardRegulation,
		},
		config: {upsert: true},
	});
};
