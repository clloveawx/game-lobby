'use strict';

/**
 * 玩家
 */
class Rank {

	constructor (opts) {
		this.id = opts.id;
		this.nickname = opts.nickname;
		this.gold = opts.gold;
		this.creatTime = opts.creatTime || Date.now(); //创建时间
	}
	
}

module.exports = Rank;