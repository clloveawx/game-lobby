'use strict';

const async = require('async');
const jsonMgr = require('./config/data/JsonMgr');
const util = require('./app/utils');
const schedule = require('node-schedule');
const db = require('./app/utils/db/mongodb');

const {platformMgr, playerMgr, systemMgr} = require('./app/utils/db/dbMgr');

//connector服务器
exports.connector = app =>{
	jsonMgr.init('server', ()=>{});    //放一份配置文件
};

//初始化hall服务器
exports.hall = app =>{
	async.waterfall([
		cb =>{
			// 初始化配置表
			jsonMgr.init('server', ()=>{
				return cb();
			});
		},

		cb =>{
			// 根据游戏配置表加载游戏
			return cb(null, jsonMgr.get('games').datas);
		},

		(games, cb) =>{
			//加载数据库中的系统游戏
			db.getDao('system_games').load(function(err, dbgames){
				if(err){
					throw new Error(err);
				}
				return cb(null, games, dbgames);
			}, {});
		},

		(games, dbgames) =>{
			//根据配置表游戏和数据库游戏 得到加载到redis内存中的游戏
			if(!games || games.length == 0){
				throw new Error('未找到配置表游戏信息');
			}else{
				games.forEach(game =>{
					const pushGame = systemMgr.instanceGame(game);
					//找到数据库中对应的游戏
					const dbgame = dbgames.find(dg => dg.nid == game.nid);
					if(dbgame){
						//数据库中有该游戏 更新游戏热度和联机大奖
						pushGame.heatDegree = dbgame.heatDegree;
						pushGame.onlineAwards = dbgame.onlineAwards;
					}
				});
			}
		},

	], function(err, ){

	});
};