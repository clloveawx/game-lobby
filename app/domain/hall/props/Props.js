'use strict';

/**
 * 玩家
 */
class Props {

	constructor (opts) {
		this.id = opts.id;
		this.name = opts.name;
		this.seller = opts.seller;
		this.sellerId = opts.sellerId;
		this.price = opts.price;
		this.isCell = opts.isCell;
		this.coinType = opts.coinType;//货币类型
		this.inviteCode = opts.inviteCode|| ''; //邀请码
		this.creatTime = opts.inviteCode || Date.now(); //创建时间
	}

	// 包装游戏数据
	wrapGameData () {
		return {
			id: this.id,
			name: this.name,
			seller: this.seller,
			sellerId :this.sellerId,
			price: this.price,
			isCell: this.isCell,
			inviteCode : this.inviteCode
		};
	}

	// 通信传输
	strip () {
		return {
			id: this.id,
			name: this.name,
			seller: this.seller,
			sellerId :this.sellerId,
			price: this.price,
			isCell: this.isCell,
			inviteCode : this.inviteCode
		
		}
	}

	// 包装数据库信息
	wrapDatebase () {
		return {
			id: this.id,
			name: this.name,
			seller: this.seller,
			sellerId :this.sellerId,
			price: this.price,
			isCell: this.isCell,
			inviteCode : this.inviteCode

		};
	}

	uids () {
		return {uid: this.uid, sid: this.sid};
	}
}

module.exports = Props;