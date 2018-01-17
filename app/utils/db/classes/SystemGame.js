'use strict';

/**
 * 系统游戏
 */
class Games {

	constructor (opts) {

		this.nid = opts.nid;
		this.name = opts.name;
		this.zname = opts.zname;
		this.sname = opts.sname;
		this.topicon = opts.topicon;
		this.enterGold = opts.enterGold;

		this.minRoom = opts.minRoom;
		this.roomUserLimit = opts.roomUserLimit;

		this.price = opts.price;
		this.machinePrice = opts.machinePrice;

		this.users = [];
		this.heatDegree = opts.heatDegree;
		this.onlineAwards = opts.onlineAwards || 0;   //联机大奖奖池
	}
}

module.exports = Games;