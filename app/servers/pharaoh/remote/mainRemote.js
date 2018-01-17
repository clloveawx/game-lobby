'use strict';

const indianaMemory = require('../../../domain/games/egypt/memory');
const indianaConfig = require('../../../domain/games/egypt/config');
const util = require('../../../utils');

module.exports = function(app) {
	return new Remote(app);
};

var Remote = function(app) {
	this.app = app;
};

/**
 * 根据uid处理 夺宝游戏的玩家累积盈利
 * 离开游戏的同时清除其铲子记录 并结算(非掉线情况)
 */
Remote.prototype.getUserProfit = ({isVip, uid, offLine, viper, roomCode, saveProfit = false}, next) =>{
    if(isVip == null || uid == null){
        return next('参数有误  Remote.prototype.getUserRecord');
    }
    if(offLine == false && !saveProfit){
        indianaConfig.shovelNum[isVip ? viper : 'system'][roomCode][uid] = 0;
    }
    let profit;
    const envRecord = isVip ? indianaMemory.vipRecord[viper] : indianaMemory.record;
    if(util.isVoid(envRecord) || util.isVoid(envRecord[roomCode]) || util.isVoid(envRecord[roomCode][uid])){
        return next(null, null);
    }else{
        if(offLine == false && !saveProfit){
            envRecord[roomCode][uid].shovelNum = 0;
            profit = envRecord[roomCode][uid].profit;
            envRecord[roomCode][uid].profit = 0;
            envRecord[roomCode][uid].littleGame = {};
            envRecord[roomCode][uid].littleGameJackpot = 0;
            return next(null, profit);
        }
        return next(null, null);
    }
};