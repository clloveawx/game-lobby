'use strict';

/**
 * 系统游戏room类
 */
class Rooms {

	constructor(opts){

		this.nid = opts.nid;
		this.roomCode = opts.roomCode;
		this.jackpot = opts.jackpot || 0;
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

		this.users = opts.users || [];
		this.socialRound = null;     //社交比赛回合状态
		this.jackpotShow = opts.jackpotShow || {otime: 0, show: 0, rand: 0, ctime: 0};   //奖池显示配置
	}
}

module.exports = Rooms;