'use strict';

const pomelo = require('pomelo');
const RobotMgr = require('../domain/transplant/robot/RobotMgr');
/**
 * 大厅服务 - 这个是游戏服务器专用
 */


/**
 * 改变玩家金币
 */
exports.changeGold = function (uid, value, cb) {
    // 检查是否机器人
    const robot = RobotMgr.search({uid: uid});
    if(robot) {
        robot.gold += value;
        cb(robot.gold);
    } else {
        pomelo.app.rpc.hall.playerRemote.changeGold(null, uid, value, cb);
    }
};
/*
* 改变玩家积分
* */
exports.changeIntegral = function (uid, value, cb) {
    const robot = RobotMgr.search({uid: uid});
    if(robot) {
        robot.integral += value;
        cb(robot.integral);
    } else {
        pomelo.app.rpc.hall.playerRemote.changeIntegral(null, uid, value, cb);
    }

};

/**
 * 改变玩家金币 - 多人
 */
exports.changeGoldMulti = function (uids, value, cb) {
    let ret = [];
    for (let i = uids.length - 1; i >= 0; i--) {
        const robot = RobotMgr.search({uid: uids[i]});
        if(robot) {
            robot.gold += value;
            ret.push({uid: robot.uid, gold: robot.gold, value: Math.abs(value)});
            uids.splice(i, 1);
        }
    }
    pomelo.app.rpc.hall.playerRemote.changeGoldMulti(null, uids, value, function (err, list) {
        if(err) {
            return cb(err);
        }
        ret = ret.concat(list);
        cb(null, ret);
    });
};

/**
 * 改变玩家金币 - 在线改变
 */
exports.changeGoldsByOnline = function (players, cb) {
    let ret = [];
    for (let i = players.length - 1; i >= 0; i--) {
        const robot = RobotMgr.search({uid: players[i].uid});
        // console.log('robot',robot);
        if(robot) {
            robot.gold += players[i].gain;
            ret.push({uid: robot.uid, gold: robot.gold});
            players.splice(i, 1);
        }
    }
	pomelo.app.rpc.hall.playerRemote.changeGoldsByOnline(null, players, function (err, list) {
		if(err) return cb(err);
        ret = ret.concat(list);
		cb(null, ret);
	});
};

/**
 * 改变玩家积分 - 在线改变
 */
exports.changesIntegralByOnline = function (players, cb) {
    let ret = [];
    for (let i = players.length - 1; i >= 0; i--) {
        const robot = RobotMgr.search({uid: players[i].uid});
        if(robot) {
            robot.integral += players[i].gain;
            ret.push({uid: robot.uid, integral: robot.integral});
            players.splice(i, 1);
        }
    }
    pomelo.app.rpc.hall.playerRemote.changesIntegralByOnline(null, players, function (err, list) {
        if(err) return cb(err);
        ret = ret.concat(list);
        cb(null, ret);
    });
};
/**
 * 改变玩家金币 - 邮件方式 - 欢乐牛牛
 */
exports.changeGoldsByMail = function (game, players) {
    pomelo.app.rpc.hall.mailRemote.changeGoldsByMail(null, game, players, function (err) {
        err && console.log(err);
    });
};

/**
 * 改变玩家金币 - 邮件方式 - 百家乐
 */
exports.changeGoldsByMail2 = function (game, players) {
    pomelo.app.rpc.hall.mailRemote.changeGoldsByMail2(null, game, players, function (err) {
        err && console.log(err);
    });
};

/**
 * 改变玩家金币 - 邮件方式 - ATT
 */
exports.changeGoldsByMail3 = function (game, player) {
    pomelo.app.rpc.hall.mailRemote.changeGoldsByMail3(null, game, player, function (err) {
        err && console.log(err);
    });
};

/**
 * 改变玩家金币 - 邮件方式 - 21点
 */
exports.changeGoldsByMail4 = function (game, player) {
    pomelo.app.rpc.hall.mailRemote.changeGoldsByMail4(null, game, player, function (err) {
        err && console.log(err);
    });
};