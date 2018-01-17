'use strict';
/**
 * 客服
 */
class Customer {

	constructor (opts) {
		this.uid = opts.uid;
		this.content = opts.content;
		this.nickname = opts.nickname;
		this.vip = opts.vip;
		this.inviteCode = opts.inviteCode;
		this.isSolve = opts.isSolve || 1;     //1为没处理,2为处理中3为已处理
		this.createTime = opts.createTime || Date.now(); // 创建时间
		this.type = opts.type;            // 1: 意见反馈   2: 代理申请
		this.name = opts.name || '';      //代理申请人 姓名
		this.phone = opts.phone || null;  //代理申请人 电话号码
		this.qq = opts.qq || null;        // 代理申请人 qq号
		this.weixin = opts.weixin || null;
		this.passStatus = opts.passStatus || 0;  // 0:未处理 1:通过 2:拒绝
	}

	
	// 包装游戏数据
	wrapGameData () {
		return {
			uid: this.uid,
			content: this.content,
			nickname: this.nickname,
			vip :this.vip,
			inviteCode: this.inviteCode,
			isSolve:this.isSolve,
			createTime:this.createTime,
			type: this.type,
			name: this.name,
			phone: this.phone,
			qq: this.qq,
			weixin: this.weixin,
			passStatus: this.passStatus,
		};
	}

	// 通信传输
	strip () {
		return {
			uid: this.uid,
			content: this.content,
			nickname: this.nickname,
			vip :this.vip,
			inviteCode: this.inviteCode,
			isSolve:this.isSolve,
			createTime:this.createTime,
			type: this.type,
			name: this.name,
			phone: this.phone,
			qq: this.qq,
			weixin: this.weixin,
			passStatus: this.passStatus,
		}
	}

	// 更新信息
	update(opts){
		for(let k in opts){
			if(this.hasOwnProperty(k)){
				this[k] = opts[k];
			}
		}
	}

}

module.exports = Customer;