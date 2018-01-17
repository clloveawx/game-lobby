// 'use strict';
//
// const logger = require('pomelo-logger').getLogger('log', __filename);
// const db = require('../../utils/db/mongodb');
// const PlayerMgr = require('../../domain/hall/player/PlayerMgr');
// const platformMgr = require('../../domain/vipPlatform/PlatformMgr');
// const GameMgr = require('../../domain/ordinaryPlatform/GamesMgr');
// const util = require('../../utils');
//
// //
// exports.afterStartAll = function (app) {
//
// };
//
// const dealPlayerDao = (cb) =>{
// 	const players = PlayerMgr.players();
// 	const keys = Object.keys(players);
// 	const dao = db.getDao('player_info'), len = keys.length;
//
// 	const next = function (i) {
// 		if(i >= len){
// 			return cb();
// 		}
// 		const player = players[keys[i]];
// 		if(!player)
// 			return next(i+1);
// 		// 设置下线时间
// 		player.lastLogoutTime = Date.now();
// 		// 刷新数据库
// 		dao.update({uid: player.uid}, {$set: player.wrapDatebase()}, function(err, res) {
// 			err && logger.error(player.uid, '保存玩家数据库失败');
// 			next(i+1);
// 		});
// 	};
// 	next(0);
// };
//
// const dealPlatformDao = (cb) =>{
// 	const platforms = util.clone(platformMgr.platforms());
// 	const keys = Object.keys(platforms);
// 	const dao = db.getDao('platform'), len = keys.length;
// 	const next = function (i) {
// 		if(i >= len){
// 			return cb();
// 		}
// 		const platform = platforms[keys[i]];
// 		if(!platform)
// 			return next(i+1);
// 		platform.games.forEach(game =>{
// 			game.users = [];
// 			game.rooms.forEach(room =>{
// 				room.users = [];
// 			})
// 		});
// 		// 刷新数据库
// 		dao.update({'creator.uid': keys[i]}, {$set: {
// 			"games": platform.games,
//         	"members": platform.members,
//
// 			"vipModel": platform.vipModel,
// 			"afterModel": platform.afterModel,
// 			"modelEffectTime": platform.modelEffectTime
// 		}}, {upsert: true}, function(err, res) {
// 			next(i+1);
// 		});
// 	};
// 	next(0);
// };
//
// const dealsysGamesDao = (cb) =>{
// 	const games = util.clone(GameMgr.Games());
// 	const dao = db.getDao('system_games'), len = games.length;
// 	const next = function (i) {
// 		if(i >= len){
// 			return cb();
// 		}
// 		const game = games[i];
// 		if(!game)
// 			return next(i+1);
// 		game.rooms.forEach(room =>{
// 			room.users = [];
// 			room.socialRound = null;
// 		});
// 		// 刷新数据库
// 		dao.update({'nid': game.nid}, {$set: {
// 			"heatDegree": game.heatDegree,
// 			"rooms": game.rooms,
// 			"onlineAwards": game.onlineAwards,
// 		}}, {upsert: true}, function(err, res) {
// 			next(i+1);
// 		});
// 	};
// 	next(0);
// };
// // 服务器关闭前
// exports.beforeShutdown = function (app, cb) {
// 	// const promises = [];
// 	// promises.push([dealPlayerDao(), dealPlatformDao()]);
// 	// Promise.all(promises).then(function(){
// 	// 	cb();
// 	// })
// 	dealPlatformDao(function () {
// 		dealPlayerDao(function(){
// 			dealsysGamesDao(cb);
// 		});
// 	});
// };
