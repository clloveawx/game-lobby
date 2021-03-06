'use strict';

// 平台房间
class BaseRoom {

	constructor(opts){

		this.nid = opts.nid;
		this.roomCode = opts.roomCode;
		this.viper = opts.viper;
		this.open = opts.open || true;
		this.disableTime = opts.disableTime || 0;  //停用时间

		this.jackpot = opts.jackpot || 0;
		this.runningPool = opts.runningPool || 0;
		this.profitPool = opts.profitPool || 0;

		this.outRate = opts.outRate || 0;
		this.winTotal = opts.winTotal || 0;
		this.consumeTotal = opts.consumeTotal || 0;
		this.boomNum = opts.boomNum || 0;

		this.socialDot = Number(opts.socialDot) || 0;
		this.matchDot = Number(opts.matchDot) || 0;
		//this.socialRound = opts.socialRound || null;     //社交比赛回合状态

		this.jackpotShow = opts.jackpotShow || {otime: 0, show: 0, rand: 0, ctime: 0};   //奖池显示配置
		this.users = opts.users || [];
	}

	addUser ({uid, sid}){
		this.users.push({uid, sid});
	}
	
	leaveUser(uid){
		const userIndex = this.users.findIndex(user => user.uid == uid);
		if(userIndex != -1){
			this.users.splice(userIndex, 1);
		}
	}
}

module.exports = BaseRoom;