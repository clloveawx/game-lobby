'use strict';

const config = require('../../../domain/hall/timerReceive/config');
const userRecord = require('../../../domain/hall/timerReceive/userRecord');
const playerMgr = require('../../../domain/hall/player/PlayerMgr');

module.exports = function (app) {
	return new Handler(app);
};

function Handler(app) {
	this.app = app;
}

const proto = Handler.prototype;

/**
 * 申请限时领取信息
 */
proto.timereceiveInfo = function (msg, session, next) {
	let info = userRecord.timereceive[session.uid];
	if (!info) {
		info = userRecord.timereceive[session.uid] = {times: 0, receiveTime: Date.now()};
	}
	// 这里检查是不是还有
	if (info.times >= config.maxGetCount) {
		next(null, {code: 200, remainTime: -1});
	} else {
		let remainTime = config.getInterval - (Date.now() - info.receiveTime);
		next(null, {code: 200, remainTime: Math.max(remainTime, 0)});
	}
};

/**
 * 领取限时奖励
 */
proto.timereceiveGet = function (msg, session, next) {
	let info = userRecord.timereceive[session.uid];
	if (!info) {
		return next(null, {code: 500, error: '未找到玩家限时领取记录'});
	}
	if (info.times >= config.maxGetCount) {
		return next(null, {code: 500, error: '今日不能再领取了'});
	}
	if (Date.now() - info.receiveTime < config.getInterval) { // 15分钟
		return next(null, {code: 500, error: '时间还没到'});
	}
	// 添加金币
	const user = playerMgr.getPlayer(session.uid);
	user.gold += config.getGold;
	info.times += 1;
	info.receiveTime = Date.now();
	
	// 如果没有次数了
	if (info.times >= config.maxGetCount) {
		next(null, {code: 200, remainTime: -1, gold: user.gold});
	} else {
		next(null, {code: 200, remainTime: config.getInterval, gold: user.gold});
	}
};