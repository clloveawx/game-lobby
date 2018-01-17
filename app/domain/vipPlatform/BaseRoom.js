'use strict';

// 平台
class BaseRoom {

    constructor(opts){
        this.id = opts.id;
        this.users = opts.users || [];
        this.roomCode = opts.roomCode;
        this.jackpot = opts.jackpot || 0;
        this.runningPool = opts.runningPool || 0;
        this.profitPool = opts.profitPool || 0;
        this.socialDot = Number(opts.socialDot) || 0;
        this.matchDot = Number(opts.matchDot) || 0;
        this.outRate = opts.outRate || 0;
        this.winTotal = opts.winTotal || 0;
        this.consumeTotal = opts.consumeTotal || 0;
        this.boomNum = opts.boomNum || 0;
        this.createTime = opts.createTime ||Date.now(); //购买机器时间
        this.open = opts.open || true;
        this.disableTime = opts.disableTime || 0;  //停用时间

        this.jackpotShow = {otime: 0, show: 0, rand: 0};   //奖池显示配置
    }

    addUser (user){
        this.users.push(user);
    }
}

module.exports = BaseRoom;