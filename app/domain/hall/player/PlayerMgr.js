'use strict';

const db = require('../../../utils/db/mongodb');
const logger = require('pomelo-logger').getLogger('log', __filename);
const util = require('../../../utils');

const players = {};  // 当前所有在线玩家
exports.players = () => players;
// 添加一个玩家到内存
exports.addPlayer = function (player) {
	players[player.uid] = player;
};

// 获取内存中的玩家
exports.getPlayer = function (uid) {
	return players[uid];
};

exports.getPlayers=function(uids){
    let returnData=[];
    for(let i in uids){
        returnData.push(players[uids[i]]);
    }
    return returnData;
}

//根据邀请码是否能够查找到玩家
exports.getPlayerByCode = function(code){
	if(code == null){
		return false;
	}else{	
		const index = util.values(players).findIndex(player => player.inviteCode == code);
		if(index != -1){
			return true;
		}else{
			return false;
		}
	}
}

// 删除内存中的玩家
exports.removePlayer = function (uid) {
	delete players[uid];
};

// 定时更新数据库
exports.updateDB = function () {
	const dao = db.getDao('player_info');
	for (let key in players) {
		(function (player) {
			dao.update({uid: player.uid}, {$set: player.wrapDatebase()}, {new: true}, function(err, res) {
				if(err){
					console.error(player);
					console.error('玩家保存数据库失败',err);
					logger.error(player.uid, '保存数据库失败');
				}
			});
		})(players[key]);
	}
};

// 保存数据库
const updatePlayerToDB = exports.updatePlayerToDB = function (cond, fields) {
    const dao = db.getDao('player_info');
    dao.update(cond, {$set: fields}, (err, res) => {
        err && logger.error(player.uid, 'updatePlayerToDB 保存数据库失败', err);
    });
};


// 查找玩家 通过UID或者nickname
const search = exports.search = function (cond, cb) {
    const dao = db.getDao('player_info');
    dao.findOne(cond, (err, res) => {
        if(err || !res) {
            return cb('玩家不存在');
        }
        cb(null, res);
    });
};