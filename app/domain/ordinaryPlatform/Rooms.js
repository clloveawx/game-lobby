'use strict';
const releaseAward = require('../games/pirate/memory').releaseAward;
const jackpot = {
    '8':1000000,
    '9':1000000,
    '11':10000,
    '17':100000
}
/**
 * room类
 */

class Rooms {

    constructor(opts){
        this.nid = opts.nid;
        this.id = opts.id;
        this.users = opts.users || [];
        this.roomCode = opts.roomCode;
        this.jackpot = opts.nid == '8' || opts.nid == '9' || opts.nid == '11' || opts.nid == '17' ? jackpot[opts.nid] : (opts.jackpot || 0);
        this.runningPool = opts.runningPool || 0;
        this.profitPool = opts.profitPool || 0;
        this.outRate = opts.outRate || 0;
        this.socialDot = Number(opts.socialDot) || 0;
        this.matchDot = Number(opts.matchDot) || 0;
        this.winTotal = opts.winTotal || 0;
        this.consumeTotal = opts.consumeTotal || 0;
        this.boomNum = opts.boomNum || 0;
        this.open = opts.open || true;
        this.disableTime = opts.disableTime || 0;  //停用时间
        //海盗船放奖调控
        if(opts.nid == '10'){
            this.startMinuteTime();
        };

        this.socialRound = null;     //社交比赛回合状态

        this.jackpotShow = opts.jackpotShow || {otime: 0, show: 0, rand: 0, ctime: 0};   //奖池显示配置

    }
    startMinuteTime(){
        this.releaseAward = new releaseAward({nid:this.nid,roomCode:this.roomCode});
        this.releaseAward.minuteTime(this);
    }
    addUser (user){
        this.users.push(user);
    }
}

module.exports = Rooms;