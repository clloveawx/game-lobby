'use strict';

const indianaMemory = require('../../../domain/games/Indiana/memory');
const indianaConfig = require('../../../domain/games/Indiana/config');
const hamburMemory = require('../../../domain/games/hamburger/memory');
const mailService = require('../../../services/MailService');
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
            return next(null, profit);
        }
        return next(null, null);
    }
};

/**
 * slots游戏掉线邮件
 */
const sendMail = (opts, uid, littleGame = false) =>{
    const moneyType = opts.isVip ? "积分" : "金币";
    mailService.generatorMail({
        name: '游戏中断',
        content: littleGame ? '由于断线/退出游戏, 您在'+opts.name+'中的盈利已自动结算' + '\n赢得'+opts.win+`${moneyType}。`
            : '由于断线/退出游戏, 您在'+opts.name+'游戏中押注'+opts.bet+ `${moneyType}已自动结算` + '\n赢得'+opts.win+`${moneyType}。`,
        attachment: {[opts.isVip ? 'integral' : 'gold']: opts.win},
    }, uid, function(err, mailDocs){});
}
Remote.prototype.slotsOfflineMail = ({isVip, uid, roomCode, nid, viper}, next) =>{
    let envRecord, record;
    switch(nid){
        case '1':
            const slots777Memory = require('../../../domain/games/slots777/memory');
            envRecord = isVip ? slots777Memory.vipRecord : slots777Memory.record;
            if(!envRecord[uid]){
                return next(null);
            }
            record = util.last(envRecord[uid].record);
            if(envRecord[uid] && (Date.now() - envRecord[uid].time) < 1000 * 3){
                sendMail({name: "slots777", bet: record.bet, win: record.win, isVip}, uid);
            }
            return next(null);
        case '2':
            const hamburgerMemory = require('../../../domain/games/hamburger/memory');
            envRecord = isVip ? hamburgerMemory.vipRecord : hamburgerMemory.record;
            if(!envRecord[uid]){
                return next(null);
            }
            record = util.last(envRecord[uid].record);
            if(envRecord[uid] && (Date.now() - envRecord[uid].time) < 1000 * 3 && envRecord[uid].state == 1){
                sendMail({name: "汉堡", bet: record.bet, win: record.win, isVip}, uid);
            }else if(envRecord[uid] && (Date.now() - envRecord[uid].time) < 1000 * 10 && envRecord[uid].state == 2){
                sendMail({name: "汉堡小游戏", bet: record.bet, win: record.win, isVip}, uid, true);
            }
            return next(null);
        case '7':
            const xiyoujiMemory = require('../../../domain/games/xiyouji/memory');
            envRecord = isVip ? xiyoujiMemory.vipRecord : xiyoujiMemory.record;
            const memoryEnv = isVip ? xiyoujiMemory.vip[viper] : xiyoujiMemory.system;
            if(!envRecord[uid]){
                return next(null);
            }
            record = util.last(envRecord[uid].record);
            if(envRecord[uid] && (Date.now() - envRecord[uid].time) < 1000 * 4 && envRecord[uid].state == 1){
                sendMail({name: "齐天大圣", bet: record.bet, win: record.win, isVip}, uid);
            }else if(envRecord[uid]  && envRecord[uid].state == 2){
                if(memoryEnv.littleGame[roomCode] &&  memoryEnv.littleGame[roomCode][uid]){
                    envRecord[uid].record.unshift({bet: 0, win: memoryEnv.littleGame[roomCode][uid]});
                    sendMail({name: "齐天大圣小游戏", bet: record.bet, win: memoryEnv.littleGame[roomCode][uid], isVip}, uid, true);
                }
            }
            return next(null);
    }
};

