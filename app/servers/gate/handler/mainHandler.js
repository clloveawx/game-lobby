'use strict';

const sessionIds = {} ; //验证码的标识
const utils = require('../../../utils');
const dispatcher = require('../../../utils/dispatcher');
const TokenService = require('../../../services/TokenService');
const RongcloudSmsService = require('../../../services/RongcloudSmsService');
const db = require('../../../utils/db/mongodb');

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

// 登陆 account_uid
const _login = function(id, uid, cellPhone, next) {
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
function newUser(next, id) {
	const dao = db.getDao('user_info');
	// 在数据库创建
	const create = function(uid) {
		dao.save(function(err){
			if(err){
				return next(null, err);
			}
			_login(id, uid, null, next);
		}, {uid, guestid: id, gold: {'1': 2000}, nickname: '游客' + uid, headurl: utils.getHead()});
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
};

/**
 * 游客登陆
 * @route: gate.mainHandler.guest
 */
Handler.prototype.guest = function(msg, session, next) {
	newUser(next, utils.id());
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
			_login(user.guestid, user.uid, user.cellPhone, next);
		}
	}, {guestid: id});
};

/*
*  获取验证码
**/
Handler.prototype.getCellCode = function (msg, session, next) {
	let cellPhone = msg.cellPhone;
	const dao = db.getDao('user_info');
	dao.load_one(function(err, user){
		if(err){
			return next(null, err);
		}
		RongcloudSmsService.getAuthcode(cellPhone, function(err, data){
			sessionIds[session.uid] = data.sessionId;
			return next(null, {code: 200});
		});
	}, {cellPhone});
};

/*
*  找回密码
**/
Handler.prototype.getBackPassWord = function ({cellPhone, code}, session, next) {
	const dao = db.getDao('user_info');
	RongcloudSmsService.auth(sessionIds[session.uid], code, function(err, data){
		if(data.success ===true){
			dao.find_one_and_update(function(err, user){
				if(err){
					return next(null, err);
				}
				return next(null, {code: 200, id: user.id});
			}, {
				conds: {cellPhone},
				$set: {passWord},
				config: {new: true},
			});
		}else{
			return next(null, {code: 500, error:'验证失败'})
		}
	});
};

/**
 * 用户切换帐号
 * @param {cellPhone, passWord}
 * @route gate.mainHandler.changeLogin
 */
Handler.prototype.changeLogin = function({cellPhone, passWord}, session, next) {
	const uid = session.uid;
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
			return next(null, {code: 500, error: '帐号不存在'});
		}
		if (uid != null && user.uid === uid) {
			return next(null, {code: 500, error: '已是当前账号'});
		}
		if (user.passWord != passWord) {
			return next(null, {code: 500, error: '密码错误'});
		}

		const playerModel = db.getDao('player_info');
		playerModel.findOne({
			uid: user.uid
		}, function(err, player) {
			if (err) {
				return next(null, {
					code: 500,
					error: '查找玩家失败'
				});
			}
			if (!player) {
				return next(null, {code: 500, error: '未找到玩家'});
			}
			return next(null, {code: 200, id: user.id, nickname: player.nickname
			});
		});

	}, {cellPhone});
};