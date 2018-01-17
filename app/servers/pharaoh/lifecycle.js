// 'use strict';
//
// const db = require('../../utils/db/mongodb');
// const util = require('../../utils');
//
// exports.afterStartAll = function (app) {
//
// };
//
// // 服务器关闭前
// exports.beforeShutdown = function (app, cb) {
// 	const spaceIndianaMemory = require('../../domain/games/egypt/memory');
// 	const spaceIndianaConfig = require('../../domain/games/egypt/config');
// 	db.getDao('indiana_record').findOneAndUpdate({game: '12'}, {'$set': {
// 		"record": spaceIndianaMemory.record,
// 		"vipRecord": spaceIndianaMemory.vipRecord,
// 		"littleGame": spaceIndianaMemory.littleGame,
// 		"moneyChange": spaceIndianaMemory.moneyChange,
// 		"shovelNum": spaceIndianaConfig.shovelNum,
// 		"viperMoneyChange": spaceIndianaMemory.viperMoneyChange,
// 	}}, {upsert: true}, function(err){
// 		if(err){
// 			winston.error('记录太空夺宝游戏记录失败');
// 		}
// 		return cb();
// 	});
// };
