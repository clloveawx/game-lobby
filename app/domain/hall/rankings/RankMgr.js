'use strict';

const db = require('../../../utils/db/mongodb');
const logger = require('pomelo-logger').getLogger('log', __filename);

let ranks = [];  // 当前所有在线的AI玩家
exports.ranks = () => ranks;


// 添加一个玩家到内存

exports.addRank = function (rank) {
	ranks.push(rank);
};

// 获取道具信息
exports.getRank= function () {
	return ranks;
};


// 获取内存中的玩家
exports.getRank = function (id) {
	// return ranks[uid];
	return ranks.find(ele =>ele.id == id);
};

// 根据名字来查找玩家是否存在
exports.getRankToName = function (nickname) {
	// return ranks[uid];
	return ranks.find(ele =>ele.nickname == nickname);
};

// 删除内存中的玩家
exports.removeRank = function (id) {
	const index =  ranks.findIndex(rank => rank.id == id);
	ranks.splice(index, 1);
};

// 删除内存所有的玩家
exports.removeAllRank = function () {
	ranks =[];
};