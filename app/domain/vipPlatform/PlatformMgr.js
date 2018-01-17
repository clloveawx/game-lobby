'use strict';
const R = require('ramda');
const Platform = require('./Platform');
const util = require('../../utils');
const db = require('../../utils/db/mongodb');

const platforms = {};// 所有平台列表

//返回所有的平台
exports.platforms = () => platforms;

// 创建一个平台
exports.createPlatform = function (creator) {
	let platform = new Platform({
		id: util.id(),
		creator: {uid: creator.uid},
	});
	return platform;
};

//同步数据库平台信息时用于创建
exports.createPlatformByDB = (opts) =>{
	let platform = new Platform(opts);
	platforms[opts.creator.uid] = platform;
	return platform;
};

// 根据uid获取指定的平台
exports.getPlatform = (uid) => platforms[uid];

//删除平台
exports.removePlatform = function (uid) {
	delete platforms[uid];
};

//删除平台环境里的某个玩家
exports.removeUserFromPlatform = (uid, viper) =>{
	const platform = platforms[viper];
	platform.removeMember(uid);
	platform.removeEnvMember(uid);
};

// 根据邀请码获取指定平台
const getPlatformByCode = exports.getPlatformByCode = (code) => {
	const platform = R.filter((value) => value.invitationCode == code)(platforms);
	if(util.isVoid(platform)){
		return null
	}
	return util.values(platform)[0];
}

// 根据uid和nid获取平台上的指定游戏
exports.getGameByUid = (uid, nid) => platforms[uid].games.find(game =>game.nid == nid);

//根据邀请码和nid获取平台上的指定游戏
exports.getGameByCode = (code, nid) =>{
	const platform = getPlatformByCode(code);
	return platform.games.find(game => game.nid == nid);
}; 

// 定时更新数据库
exports.updateDB = function () {
	const dao = db.getDao('platform');
	for (let key in platforms) {
		(function (platform) {
			const clonePlatform = util.clone(platform);
			clonePlatform.games.forEach(game =>{
				game.users = [];
				game.rooms.forEach(room =>{
					room.users = [];
				})
			});
			dao.update({id: platform.id}, {$set: clonePlatform}, {upsert: true}, function(err, res) {
				if(err){
					console.error('更新平台数据到数据库失败')
				}
				// console.log('更新平台数据库集合成功');
			});
		})(platforms[key]);
	}
};
