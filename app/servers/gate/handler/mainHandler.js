'use strict';

const phoneSessionIds = {};    // (电话号码做键)
const utils = require('../../../utils');
const dispatcher = require('../../../utils/dispatcher');
const TokenService = require('../../../services/TokenService');
const RongcloudSmsService = require('../../../services/RongcloudSmsService');
const db = require('../../../utils/db/mongodb');
const MailServices = require('../../../services/MailServices');

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

// 登陆 account_uid
const _login = function({id, uid, cellPhone}, next) {
	// 分发服务器地址
	let server = dispatcher.dispatch(uid);
	if (!server) {
		return next(null, {
			code: 500,
			error: '服务器已关闭'
		});
	}
	// 生成token
	let token = TokenService.create(uid);
	
	next(null, {code: 200, id, uid, token, cellPhone,
		server: {
			host: server.clientHost,
			port: server.clientPort
		},
	});
};

// 创建用户
function newUser(next, {id, cellPhone, passWord, userName, userWord, email}) {
	const dao = db.getDao('user_info');
	// 在数据库创建
	const create = function(uid) {
		dao.save(function(err){
			if(err){
				return next(null, err);
			}
			_login({id, uid}, next);
		}, {uid, guestid: id, cellPhone, passWord, userName, userWord, email});
	};
	// 生成uid
	const generateUID = function() {
		const uid = '2' + utils.randomId(5);
		dao.load_by_uid(function(err, user){
			if(err){
				next(null, err);
			}
			if(user){
				generateUID();
			}else{
				create(uid);
			}
		}, {uid});
	};
	generateUID();
}

/**
 * 游客登陆
 * @route: gate.mainHandler.guest
 */
Handler.prototype.guest = function({}, session, next) {
	newUser(next, {id: utils.id()});
};

/**
 * 手机注册获取验证码
 * @route: gate.mainHandler.getzhuCeCellCode
 */
Handler.prototype.getzhuCeCellCode = function ({cellPhone}, session, next) {

	const dao = db.getDao('user_info');
	dao.load_one(function(err, user){
		if(err){
			return next(null, err);
		}
		if(user){
			return next(null, {code:500, error: '该手机号已经被注册'});
		}
		RongcloudSmsService.getAuthcode(cellPhone, function(err, data){
			console.error('获取到的验证码是:', data.sessionId);
			phoneSessionIds[cellPhone] = data.sessionId;
			return next(null, {code: 200});
		});
	}, {cellPhone});
};

/**
 * 手机注册
 * @route: gate.mainHandler.cellPhoneGuest
 */
Handler.prototype.cellPhoneGuest = function({code, cellPhone, passWord}, session, next) {

	RongcloudSmsService.auth(phoneSessionIds[cellPhone], code, function(err, data){
		if(data.success === true){
			newUser(next, {id: utils.id(), cellPhone, passWord});
		}else{
			return next(null, {code: 500, error:'验证失败'});
		}
	});
};

/**
 * 手机注册找回密码获取验证码
 * @route: gate.mainHandler.getCellCode
 */
Handler.prototype.getCellCode = function ({cellPhone}, session, next) {

	const dao = db.getDao('user_info');
	
	dao.load_one(function(err, user){
		if(err){
			return next(null, {code: 500, error: '查找该号码所属玩家失败'});
		}
		if(!user){
			return next(null, {code: 500, error: '未找到该号码所属玩家'});
		}
		RongcloudSmsService.getAuthcode(cellPhone, function(err, data){
			phoneSessionIds[cellPhone] = data.sessionId;
			return next(null, {code: 200});
		});
	}, {cellPhone});
};

/**
 * 手机注册  找回密码
 * @route: gate.mainHandler.getBackPassWord
 */
Handler.prototype.getBackPassWord = function ({code, cellPhone, passWord}, session, next) {
	
	const dao = db.getDao('user_info');

	RongcloudSmsService.auth(phoneSessionIds[cellPhone], code, function(err, data){
		if(data.success ===true){
			
			dao.find_one_and_update(function(err, user){
				if(err){
					return next(null, {code: 500, error: '验证失败'});
				}
				return next(null, {code: 200, id: user.guestid});
			}, {
				conds: {cellPhone},
				$set: {passWord},
				config: {new: true},
			});
		}else{
			return next(null, {code: 500, error: '验证失败'});
		}
	});
};

/**
 * 帐号注册
 * @route: gate.mainHandler.zhanghaoGuest
 */
Handler.prototype.zhanghaoGuest = function ({userName, userWord, email}, session, next) {

	if(!userName || !userWord ){
		return next(null, {code: 500, error:'请输入帐号密码'});
	}
	if(!email){
		return next(null, {code: 500, error:'请输入邮箱以便更好地找回您的密码'});
	}
	const userModel = db.getDao('user_info');
	userModel.load_one(function(err, user){
		if(err){
			return next(null, err);
		}
		if(!user){
			userModel.load_one(function(err, userInfo) {
				if (err) {
					return next(null, err);
				}
				if(userInfo){
					return next(null, {code: 500, error: '该帐号已经被注册'});
				}else{
					newUser(next, {id: utils.id(), userName, userWord, email});
				}
			}, {userName});
		}else{
			return next(null, {code: 500, error: '该邮箱已经被注册'});
		}
	}, {email});
};

/**
 * 邮箱验证
 * @param {cellPhone, passWord}
 * @route gate.mainHandler.postMailCode
 */
Handler.prototype.postMailCode = function({email}, session, next) {
	
	const userModel = db.getDao('user_info');
	
	userModel.load_one(function(err, user){
		if(err){
			return next(null, err);
		}
		if(!user){
			return next(null, {code: 500, error:'该邮箱没有绑定账号'});
		}
		const emailCode = utils.random(4);
		emailCodes[email] = {emailCode};
		
		const subject ='找回密码';
		const html = '<h2>尊敬的玩家，您在欢乐娱乐城修改密码所需要的验证码为' + emailCode + '</h2>';
		MailServices.sendMail(email, subject, html);
		setTimeout(function(){
			delete emailCodes[email];
		}, 1000 * 60 * 10);
		
		return next(null, {code: 200, emailCode});
	}, {email});
};

/**
 * 帐号找回密码
 * @route gate.mainHandler.zhanghaoBackWord
 */
Handler.prototype.zhanghaoBackWord = function({email, mailCode, newWord}, session, next) {
	
	const dao = db.getDao('user_info');
	if(!emailCodes[email]){
		return next(null, {code: 500, error: '请验证邮箱验证码'});
	}
	let emailCode = emailCodes[email].emailCode;
	if(emailCode != mailCode){
		return next(null, {code: 500, error:'邮箱验证码不正确'});
	}else if(emailCode === mailCode){
		
		dao.find_one_and_update(function(err, user){
			if(err){
				return next(null, {code: 500, error: '验证失败'});
			}
			delete emailCodes[email];
			return next(null, {code: 200, id: user.guestid});
		}, {
			conds: {email},
			$set: {userWord: newWord},
			config: {new: true},
		});
	}else{
		return next(null, {code: 500, error: '系统繁忙，请稍后再试'});
	}
};

/**
 * 通过id直接登陆
 * 获取服务器地址 和 token
 */
Handler.prototype.login = function({id}, session, next) {
	const dao = db.getDao('user_info');
	dao.load_one(function(err, user){
		if(err){
			return next(null, err);
		}
		if(!user){
			newUser(next, id);
		}else{
			_login({id: user.guestid, uid: user.uid, cellPhone: user.cellPhone}, next);
		}
	}, {guestid: id});
};

/**
 * 用户切换帐号  对应两种登录方式  ☹*✧⁺˚⁺ପ(๑･ω･)੭ु⁾⁾ 好好学习天天向上
 * @param {cellPhone, passWord}
 * @route gate.mainHandler.changeLogin
 */
Handler.prototype.changeLogin = function({cellPhone, passWord}, session, next) {

	if (!cellPhone) {
		return next(null, {code: 500, error: '请输入账号'});
	}
	if (!passWord) {
		return next(null, {code: 500, error: '请输入密码'});
	}
	const dao = db.getDao('user_info');
	dao.load_one(function(err, user){
		if(err){
			return next(null, err);
		}
		if(!user){
			//判断是不是邮箱账号登录
			dao.load_one(function(err, uInfo){
				if(err) {
					return next(null, {code: 500, error: '查找用户失败'});
				}
				if(!uInfo){
					return next(null, {code: 500, error: '帐号不存在'});
				}
				if(uInfo.userWord != passWord) {
					return next(null, {code: 500, error: '密码错误'});
				}
				return next(null, {code: 200, id: uInfo.guestid});
			}, {userName: cellPhone});
		}else{
			if(user.passWord != passWord) {
				return next(null, {code: 500, error: '密码错误'});
			}
			return next(null, {code: 200, id: user.guestid});
		}
	}, {cellPhone});
};