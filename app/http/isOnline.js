'use strict';

const logger = require('pomelo-logger').getLogger('log', __filename);

const  leaveList = {}; // 强制掉线的玩家

exports.leaveList = () => leaveList;
// 添加一个玩家到内存
exports.addLeave = function (data) {
	leaveList[data.uid] = data;
};


// 删除内存中的玩家
exports.removeLeave = function (uid) {
	delete leaveList[uid];
};

// 获取内存中的玩家
exports.getLeave = function (uid) {
	return leaveList[uid];
};
