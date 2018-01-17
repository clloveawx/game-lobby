'use strict';

/**
 * 玩家
 */
class RecordCoin {

	constructor (opts) {
		this.uid = opts.uid;
		this.nickname = opts.nickname;
		this.createTime = opts.createTime||Date.now(); // 创建时间
		this.coinType = opts.coinType;//金币类型 1为砖石 2为金币 3为人名币
		this.changeNum = opts.changeNum;//改变的数量
		this.changeType = opts.changeType;//改变的类型 1为押注 2为中奖 3为挂售
		this.gold = opts.gold;//当前的金币
		this.integral = opts.integral;//当前的积分
	}

	// 包装数据库信息
	wrapDatebase () {
		return {
			uid: this.uid,
			nickname: this.nickname,
			coinType: this.coinType,
			gold: this.gold,
			changeNum:this.changeNum,
		    integral:this.integral,
		    changeType:this.changeType,
		    createTime:this.createTime,
		};
	}
}

module.exports = RecordCoin;