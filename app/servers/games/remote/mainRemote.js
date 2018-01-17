'use strict';

const RobotMgr = require('../../../domain/transplant/robot/RobotMgr');
// const JackpotMgr = require('../../../domain/game/JackpotMgr');

module.exports = function(app) {
    return new Remote(app);
};

var Remote = function(app) {
    this.app = app;
};

/**
 * 获取机器人
 */
Remote.prototype.searchRobot = function(conds, cb) {
    const robot = RobotMgr.search(conds);
    cb(robot && robot.strip());
};

/**
 * 添加机器人好友
 */
Remote.prototype.addRobotFriend = function(uid, other, cb) {
    const robot = RobotMgr.search({uid: uid});
    if(!robot) {
        return cb(null);
    }
    // 是否已经申请过了
    if(robot.applys.indexOf(other) !== -1){
        return cb({code: 500, error: '已经请求过了，请耐心等待对方同意！'});
    }
    robot.applys.push(other);
    return cb({code: 200});
};

/**
 * 获取奖池
 */
Remote.prototype.getJackpot = function(cb) {
    // cb(null, JackpotMgr.toList());
};

/**
 * 设置奖池
 */
Remote.prototype.setJackpot = function(id, value, cb) {
    // JackpotMgr.setJackpot(id, value);
    cb(null);
};