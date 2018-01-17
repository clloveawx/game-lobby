'use strict';

class InviteCode {
    constructor(opts) {
        this.inviteCode = opts.inviteCode || ''; //邀请码
        this.uid = opts.uid || ''; //邀请码创建者的uid
        this.viper = opts.viper || '';   //房主的uid
        this.superior = opts.superior || '';  //上级的uid
        this.secondViper = opts.secondViper ||'';//二级的uid
        this.createTime = opts.createTime || Date.now(); //邀请码生成时间
        this.boundUid = opts.boundUid || ''; //绑定的uid
        this.integral = (opts.integral !== undefined ? opts.integral : 0); //积分
        this.rebate = (opts.rebate !== undefined ? opts.rebate : 0); //返利率

        this.effectiveTimes = opts.effectiveTimes || 0;   //邀请码的有效次数
        //{uid, boundTime}
        this.inviteRecords = opts.inviteRecords || []; //通过该邀请码进入私人大厅的玩家信息
    }

    //数据库插入包装
    wrapForDatabase() {
        return {
            inviteCode: this.inviteCode,
            uid: this.uid,
            superior: this.superior,
            createTime: this.createTime,
            boundUid: this.boundUid,
            integral: this.integral,
            rebate: this.rebate,
            secondViper:this.secondViper,
            inviteRecords: this.inviteRecords,
            effectiveTimes: this.effectiveTimes,
            viper: this.viper,
        };
    }
}

module.exports = InviteCode;