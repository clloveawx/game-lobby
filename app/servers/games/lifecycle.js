// 'use strict';
//
// const db = require('../../utils/db/mongodb');
// const util = require('../../utils');
// const async = require('async');
//
// exports.afterStartAll = function (app) {
//
// };
//
// const dealSpaceIndiana = (callback) =>{
// 	const spaceIndianaMemory = require('../../domain/games/Indiana/memory');
// 	const spaceIndianaConfig = require('../../domain/games/Indiana/config.js');
// 	db.getDao('indiana_record').findOneAndUpdate({game: '4'}, {'$set': {
// 		"record": spaceIndianaMemory.record,
// 		"vipRecord": spaceIndianaMemory.vipRecord,
// 		"littleGame": spaceIndianaMemory.littleGame,
// 		"moneyChange": spaceIndianaMemory.moneyChange,
// 		"shovelNum": spaceIndianaConfig.shovelNum,
// 		"viperMoneyChange": spaceIndianaMemory.viperMoneyChange,
// 	}}, {upsert: true}, function(err){
// 		if(err){
// 			winston.error('记录太空夺宝游戏记录失败'+err);
// 		}
// 		return callback();
// 	});
// };
//
// const dealSlots777 = (callback) =>{
// 	const slots777Memory = require('../../domain/games/slots777/memory');
// 	const slots777Config = require('../../domain/games/slots777/config');
// 	db.getDao('slots_record').findOneAndUpdate({game: '1'}, {'$set': {
// 		"record": slots777Memory.record,
// 		"vipRecord": slots777Memory.vipRecord,
// 		"unlock": slots777Memory.littleGame,
// 		"moneyChange": slots777Memory.moneyChange,
// 		"awardRegulation": slots777Config.shovelNum,
// 	}}, {upsert: true}, function(err){
// 		if(err){
// 			winston.error('记录slots777游戏记录失败'+err);
// 		}
// 		return callback();
// 	});
// };
//
// const dealHamburger = (callback) =>{
// 	const hamburgerMemory = require('../../domain/games/hamburger/memory');
// 	const hamburgerConfig = require('../../domain/games/hamburger/config');
// 	db.getDao('slots_record').findOneAndUpdate({game: '2'}, {'$set': {
// 		"record": hamburgerMemory.record,
// 		"vipRecord": hamburgerMemory.vipRecord,
// 		"moneyChange": hamburgerMemory.moneyChange,
// 		"awardRegulation": hamburgerConfig.shovelNum,
// 	}}, {upsert: true}, function(err){
// 		if(err){
// 			winston.error('记录汉堡游戏记录失败'+err);
// 		}
// 		return callback();
// 	});
// };
//
// const dealXiyouji = (callback) =>{
// 	const xiyoujiMemory = require('../../domain/games/xiyouji/memory');
// 	const xiyoujiConfig = require('../../domain/games/xiyouji/config');
// 	db.getDao('slots_record').findOneAndUpdate({game: '7'}, {'$set': {
// 		"record": xiyoujiMemory.record,
// 		"vipRecord": xiyoujiMemory.vipRecord,
// 		"system": xiyoujiMemory.system,
// 		"vip": xiyoujiMemory.vip,
// 		"moneyChange": xiyoujiMemory.moneyChange,
// 		"awardRegulation": xiyoujiConfig.awardRegulation,
// 	}}, {upsert: true}, function(err){
// 		if(err){
// 			winston.error('记录西游记游戏记录失败'+err);
// 		}
// 		return callback();
// 	});
// };
//
// // 服务器关闭前
// exports.beforeShutdown = function (app, cb) {
//
// 	async.parallel([
// 		(callback) =>{
// 			dealSpaceIndiana(callback);
// 		},
// 		(callback) =>{
// 			dealSlots777(callback);
// 		},
// 		(callback) =>{
// 			dealHamburger(callback);
// 		},
// 		(callback) =>{
// 			dealXiyouji(callback);
// 		}
//
// 	],function(err, results){
// 		if(err){
// 			console.error('games服务器关闭前游戏内存记录失败',err);
// 		}
// 		console.log('games服务器关闭前游戏内存记录成功');
// 	})
// };
