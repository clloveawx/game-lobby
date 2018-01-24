'use strict';

// 平台游戏
class BaseGame {

	constructor (opts) {

		this.viper = opts.viper;
		this.nid = opts.nid;
		this.name = opts.name;
		this.zname = opts.zname;
		this.sname = opts.sname;
		this.roomUserLimit = opts.roomUserLimit;
		this.users = opts.users || [];
		this.createTime = opts.createTime || Date.now();

		this.gameStartTime = opts.gameStartTime;    //购买游戏时间
		this.gameHaveTime = opts.gameHaveTime;      //游戏拥有的时间
		this.onlineAwards = opts.onlineAwards || 0;
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

module.exports = BaseGame;