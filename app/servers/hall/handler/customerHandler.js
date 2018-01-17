'use strict';

const Customer = require('../../../domain/hall/customer/customer');
const PlayerMgr = require('../../../utils/db/dbMgr/playerMgr');
const db = require('../../../utils/db/mongodb');
const JsonMgr = require('../../../../config/data/JsonMgr');

module.exports = function (app) {
	return new Handler(app);
};

function Handler(app) {
	this.app = app;
}

const proto = Handler.prototype;

/**
 * created by CL
 * 添加客服資料
 * @param msg name
 */
proto.addCustomer = function ({type, content, phone, name, qq, weixin}, session, next) {
	
	const uid = session.uid;
	
	PlayerMgr.getPlayerTotalInfo(uid).then(({player, user}) =>{

		if(type == 2 && player.vip){
			return next(null, {code: 500,error:'你已经是VIP,不能再进行申请！'})
		}
		const gameVersion = JsonMgr.get('gameBeat').getById(1).gameVersion;
		if(gameVersion == 1 && type == 2 ){
			return next(null, {code: 500,error:'该功能暂不可用'});
		}
		const customer = new Customer({
			uid,
			content,
			vip: player.vip,
			nickname: user.nickname,
			inviteCode: player.inviteCode,
			type,
			name,
			phone,
			qq,
			weixin,
		});
		
		db.getDao('customer_info').add(function(err){
			if(err){
				return next(null, {code: 500, error:'提交失败'})
			}
			return next(null, {code: 200, msg: '提交成功'})
		}, customer);
	});
};
