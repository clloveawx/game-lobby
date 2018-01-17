'use strict';

//关卡
const pass = ['1', '2', '3'];
//赔率
const odds = ['0.15', '0.55', '0.95', '1.65', '3.55', '7.55', '10'];
//窗口记录
const windowRecord = {};
pass.forEach(i =>{
    windowRecord[i] = {};
    odds.forEach(j =>{
        windowRecord[i][j] = {
            '1': [],     // 一个或两个界面
            '2': [],     // 三个界面
            '3': [],     // 四个及以上
        }
    })
})

module.exports = {
    record: {
        //roomCode: {uid: {shovelNum, profit, record:[], littleGameJackpot, littleGame: {activation, diceResult, initMoney}, lastUse}}
    },
    vipRecord: {
        /*
            viper: {roomCode: {uid: {shovelNum, profit, record:[], littleGameJackpot, littleGame: {activation, diceResult, initMoney}, lastUse}}
        */
    },

    windowRecord,

    moneyChange: {
        //roomCode {totalWin: 0, totalBet: 0, breakdown: {status: false, encourage: 0}} 
    },
    viperMoneyChange: {
        /*
            viper: {roomCode {totalWin: 0, totalBet: 0,}}
        */
    },

};