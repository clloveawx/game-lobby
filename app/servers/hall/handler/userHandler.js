'use strict';

const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');

const MailService = require('../../../services/MailService');

const sessionIds = {}; //验证码的标识
const cellPhones = {};

const RongcloudSmsService = require('../../../services/RongcloudSmsService');
const JsonMgr = require('../../../../config/data/JsonMgr');
const db = require('../../../utils/db/mongodb');
const util = require('../../../utils');
const gutil = require('../../../domain/games/util');

const {playerMgr, userMgr}= require('../../../utils/db/dbMgr');

module.exports = function (app) {
	return new Handler(app);
};

function Handler(app) {
	this.app = app;
}

const proto = Handler.prototype;

/**
 * created by CL
 * vip申请
 *
 */
proto.vipApply = function({}, session, next){
	const uid = session.uid;
	
	playerMgr.getPlayer({uid}, function(err, player) {
		if (err) {
			return next(null, err);
		}
		if (!player) {
			return next(null, {code: 500, error: `玩家不存在: ${uid}`});
		}
		player.needPlatform = true;
		player.vip = true;
		
		//保存玩家信息修改
		playerMgr.updatePlayer(player, function(err){
			if(err){
				console.error(`保存玩家${uid}的修改失败`, err);
			}
		});
		return next(null, {code: 200});
	})
};



/**
 * modified by CL
 * 修改名称
 * @route: hall.userHandler.changeName
 */
proto.changeName = function (msg, session, next) {
	
	const uid = session.uid;
	
	playerMgr.getPlayerTotalInfo(uid).then(({player, user}) =>{
		if(!player){
			return next(null, {code: 500, error: `玩家不存在: ${uid}`});
		}
		if(player.nameChanged && !player.vip){
			return next(null, {code: 500, error: '你已经免费修改过一次名称'});
		}
		if (user.nickname === msg.nickname || msg.nickname === ''){
			return next(null, {code: 500, error: '未输入修改后的名称 或 玩家已经为该名称'});
		}
		//处理有些瑕疵 没有考虑内存中已修改但未同步的玩家
		db.getDao('user_info').load_one(function(err, doc){
			if(doc){
				return next(null, {code: 500, error: `昵称${msg.nickname}已存在`});
			}
			user.nickname = msg.nickname;
			player.nameChanged = true;
			//保存修改
			playerMgr.updatePlayer(player, function(err){
				if(err){
					console.error(`保存玩家${uid}的修改失败`, err);
				}
				userMgr.updateUser(user, function(err){
					if(err){
						console.error(`保存user:${uid}的修改失败`, err);
					}
				});
			});
			return next(null, {code: 200, nameChanged: user.nameChanged});
		}, {nickname: msg.nickname});
	}).catch(err =>{
		console.error(`查找玩家{uid}完整信息失败`, err);
	});
};

/**
 * modified by CL
 * 用户绑定手机
 * @route: hall.userHandler.bindCellPhone
 */
proto.bindCellPhone = function ({code, cellPhone}, session, next) {
	
	const uid = session.uid;
	if(cellPhones[uid] != cellPhone){
		return next(null, {code: 500, error:'手机号与验证码不匹配！'});
	}
	
	
	const dao = db.getDao('user_info');
	let user = PlayerMgr.getPlayer(uid);

	dao.findOne({cellPhone:msg.cellPhone},function(err,data){
		dao.findOne({uid:uid},function(err,userInfo){
			if(userInfo.cellPhone){
				return next(null, {code: 500,error:'该帐号已经被绑定！'})
			}
			
			if(data){
				return next(null, {code: 500,error:'该手机已经被绑定'})
			}else{
				// let goldTable = JsonMgr.get('gold');
				// const bindPhone = goldTable.getById(200).num;
				// let opts = {};
				// opts.name = '绑定手机获得奖励';
				// opts.content = '尊敬的玩家,感谢您绑定手机,在此赠送你5000金币,祝您玩的愉快！';
				// opts.attachment = {gold:bindPhone};
				RongcloudSmsService.auth(sessionId,code,function(err,data){
					if(data.success === true){
						dao.update({uid: uid}, {$set: {cellPhone:msg.cellPhone, passWord:msg.passWord}}, function(err, res) {
							err && logger.error(uid, '保存数据库失败');
							if(err){
								return next(null, {code: 500,error:'绑定失败'})
							}
							let changeName = user.nickname.substring(0,1);
							if(changeName ==='游客'){
								user.nickname = '会员'+uid;
							}
							//绑定低保
							//user.allowances = {num: 7, today: false};
							
							// MailService.generatorMail(opts, uid, function(err, mailDocs){
							// 	if(err){
							// 		return next(null, {code: 500, error: '系统生成邮件'});
							// 	}
							// });
							return next(null, {code: 200,nickname:user.nickname, allowances: user.allowances})
						});
					}else{
						return next(null, {code: 500,error:'验证失败'})
					}
				});
			}
		})
	});
	
};
/*
 *  绑定支付宝帐号
 **/
proto.bindAlipay = function (msg, session, next) {
	let user = PlayerMgr.getPlayer(session.uid);
	user.alipay = msg.alipay;
	next(null, {code: 200})
};

/*
 *  找回密码
 **/
proto.getBackPassWord = function (msg, session, next) {
	const dao = db.getDao('user_info');
	let code = msg.code;
	RongcloudSmsService.auth(sessionId,code,function(err,data){
		if(data.success ===true){
			dao.update({cellPhone: msg.cellPhone}, {$set: {passWord:msg.passWord}}, function(err, res) {
				err && logger.error(uid, '保存数据库失败');
				if(err){
					return next(null, {code: 500,error:'验证失败'})
				}
				return next(null, {code: 200,id:res.id})
			});
		}else{
			return next(null, {code: 500,error:'验证失败'})
		}
	});
};

/*
 *  获取验证码
 **/
proto.getCellCode = function (msg, session, next) {
	cellPhone = msg.cellPhone;
	const dao = db.getDao('user_info');
	dao.findOne({cellPhone:cellPhone},function(err,data){
		if(data){
			return next(null, {code: 500,error:'该手机已经被绑定'})
		}else if(err){
			return next(null,{code:500,error:'获取验证码失败'});
		}else{
			RongcloudSmsService.getAuthcode(cellPhone,function(err,data){
				sessionId = data.sessionId;
				return next(null, {code: 200});
			});
		}
	});
};

/**
 * 用户更换头像
 * @param msg name
 */
proto.changeHeadurl = function(msg, session, next){
	let uid = session.uid;
	let user = PlayerMgr.getPlayer(uid);
	if(msg.headurl ==''){
		return  next(null, {code: 500});
	}
	user.headurl = msg.headurl;
	return next(null, {code: 200,headurl:user.headurl});
};

/*
 *	vip用户获取自己的邀请码
 */
proto.getSelfInviteCode = function (msg, session, next){
	let uid = session.uid;
	let user = PlayerMgr.getPlayer(uid);
	if(user.vip == false){
		return next(null, {code: 500, error:"你还不是vip玩家没有自己的邀请码"});
	}
	return next(null, {code: 200,InviteCode : user.inviteCode });
};

/*
 * vip申请记录
 */

proto.applyVipRecord  = function (msg, session, next){
	const applyVipRecord = db.getDao('apply_vip_record');
	let player = PlayerMgr.getPlayer(session.uid);
	const info = {
		id: util.id(),
		uid:session.uid,
		nickname : player.nickname,
		createTime : Date.now(),
		cellPhone : msg.cellPhone,
		status: 1, //1 为申请状态 2 为通过 3为拒绝
	};
	applyVipRecord.findOne({cellPhone:msg.cellPhone},function(err,result){
		if(result){
			if(result.status == 1){
				return next(null, {code: 500, error: '您已经申请过，请不要重复申请'});
			}else if(result.status == 2){
				return next(null, {code: 500, error: '您已经申请过，申请通过，请不要重复申请'});
			}else {
				return next(null, {code: 500, error: '您已经申请过，被拒绝，请不要重复申请'});
			}
		}else{
			applyVipRecord.create(info,function(err,res){
				if(!err){
					return next(null, {code: 200, msg: '申请提交成功'});
				}else{
					return next(null, {code: 500, msg: '申请提交失败'});
				}
			});
		}
	});
	
};

/*
 * 为机器人添加金币
 */
proto.addGoldForRobot = function (msg, session, next){
	let uid = session.uid;
	let user = PlayerMgr.getPlayer(msg.uid);
	user.gold = msg.gold;
	user.gold = 0;
	db.getDao('ai_add_money_recoed').create({
		uid: msg.uid,
		num: msg.gold
	}, function(err, datas){
		return next(null, {code: 200, gold: user.gold});
	});
};


/*
 * 获取自己的V点
 */
proto.getselfVdot = function (msg, session, next){
	let uid = session.uid;
	let user = PlayerMgr.getPlayer(msg.uid);
	return next(null, {code: 200, vdot: user.vdot});
};

/**
 * 领取低保
 * main.userHandler.receiveAllowances
 */
proto.receiveAllowances = function({}, session, next){
	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	const isVip = session.get('VIP_ENV');
	if(!player){
		return next(null, {code: 500, error:'未找到玩家 receiveAllowances'});
	}
	if(!player.allowances){
		return next(null, {code: 500, error:'该玩家没有领取权限'});
	}
	if(player.allowances.num <= 0){
		return next(null, {code: 500, error:' 该玩家低保次数已用尽'});
	}
	if(player.allowances.today){
		return next(null, {code: 500, error:'今日低保已领取'});
	}
	if(isVip){
		return next(null, {code:500, error:'请到休闲场游戏中领取'});
	}
	if(player.gold > 100){
		return next(null, {code: 500, error:'玩家金币充足,无需领取'});
	}
	player.allowances.num -= 1;
	player.allowances.today = true;
	player.gold += 1000;
	return next(null, {code: 200, gold: player.gold, allowances: player.allowances});
}

/**
 * 领取启动金
 * hall.userHandler.receiveStartingGold
 */
proto.receiveStartingGold = function({}, session, next){
	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	const isVip = session.get('VIP_ENV');
	if(!player){
		return next(null, {code: 500, error:'未找到玩家 receiveStartingGold'});
	}
	require('../../../utils/db/mongodb').getDao('starting_gold').findOne({}).exec(function(err, startingGoldDoc){
		if(err){
			return next({code: 500, error: '查找七日启动金活动失败'});
		}
		if(!startingGoldDoc || !startingGoldDoc.activation){
			return next(null, {code: 500, error: '未开启启动金活动'});
		}
		if(player.allowances.today){
			return next(null, {code: 500, error:'今日启动金已领取'});
		}
		if(player.gold > startingGoldDoc.limit){
			return next(null, {code: 500, error:'玩家金币充足,无需领取'});
		}
		const todayNum = 2000 + 500 * (startingGoldDoc.day - 1);
		let tomorrowNum = 0;
		if(startingGoldDoc.day + 1 <= 7){
			tomorrowNum = 2000 + 500 * startingGoldDoc.day;
		}
		player.allowances.today = true;
		player.allowances.tomNum = tomorrowNum;
		player.gold += todayNum;
		startingGoldDoc.save();
		return next(null, {code: 200, gold: player.gold, allowances: player.allowances});
	});
};

/**
 * 月卡 -领取
 * @route: hall.userHandler.monthlyCardReceive
 * @return {gold, monthlyCard}
 */
proto.monthlyCardReceive = ({}, session, next) =>{
	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	if(!player){
		return next(null, {code: 500, error: '玩家未找到'});
	}
	if(player.monthlyCard && player.monthlyCard.alert){
		player.monthlyCard.alert = false;
	}
	if(!player.monthlyCard || !player.monthlyCard.active){
		return next(null, {code: 500, error: '玩家未开通月卡'});
	}
	if(!player.monthlyCard.today){
		return next(null, {code: 500, error: '今日已领取'});
	}
	if(player.monthlyCard.receiveDates.length > 30){
		return next(nul, {code: 500, error: '玩家领取次数已达30次'});
	}
	const date = util.dateKey();
	
	player.gold += 1000;
	player.monthlyCard.today = false;
	player.monthlyCard.receiveDates.push(date);
	return next(null, {code: 200, gold: player.gold, monthlyCard: player.monthlyCard});
};

/**
 * 月卡 -信息
 * @route: hall.userHandler.monthlyCardInfo
 * @return {monthlyCard}
 */
proto.monthlyCardInfo = ({}, session, next) =>{
	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	if(!player){
		return next(null, {code: 500, error: '玩家未找到'});
	}
	if(player.monthlyCard && player.monthlyCard.alert){
		player.monthlyCard.alert = false;
	}
	return next(null, {code: 200, monthlyCard: player.monthlyCard});
};

proto.userInfo = ({date}, session, next) =>{
	const uid = session.uid;
	const player = PlayerMgr.getPlayer(uid);
	if(date){
		player.allowances.date = date;
	}
	return next(null, {player: player.strip()})
}

/**
 * 获取公告内容
 * @route: hall.userHandler.getUpdateAnnouncement
 * @return {monthlyCard}
 */
proto.getUpdateAnnouncement = ({}, session, next) =>{
	const updateAnnouncement = db.getDao('update_announcement');
	updateAnnouncement.find({}).sort('-createTime').limit(1).exec(function(err,result){
		if(result){
			return next(null, {code: 200, result: result});
		}else{
			return next(null, {code: 500, error:'系统繁忙'});
		}
	});
};