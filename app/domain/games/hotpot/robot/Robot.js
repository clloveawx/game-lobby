'use strict';

const config = require('./config');
const util = require('../../../../utils');

/**
 * 机器人
 */
class Robot {

	constructor (opts) {
		this.uid = 'ai' + Math.random().toString().substr(2, 8);
		this.nickname = opts.nickname;
		this.headurl = opts.headurl;
		this.sex = opts.sex;

		this.gold = util.random(5000000, 10000000);    // 金币
        this.integral = util.random(5000000, 10000000);   // 积分
        this.isAI = true;

        this.game = null;// 当前所在游戏
        this.env = null;  //当前所在的环境 system or viperId
		this.roomCode = null;// 当前所在房间ID
        this.lastEntryGameTime = 0;// 上次进入游戏时间

        this.hotpotGameEarnings=opts.hotpotGameEarnings || 0;    //hotpot游戏比赛盈利
        
        this.sid = 'connector-server-1';
	}
}

const robots = {

};

exports.getRobot = (uid) =>{
	return robots[uid];
};

exports.getRobots = (uids) =>{
	uids = uids.filter(uid => uid != null && robots[uid]);
	return uids.map(uid =>{
		return robots[uid];
	});
};

exports.delRobot = (uid) =>{
	delete robots[uid];
}

const robot = (opts) =>{
	let robot = new Robot(config[Math.floor(Math.random() * config.length)]);
	while(robots[robot.uid]){
        console.log('while22');
		robot = new Robot(config[Math.floor(Math.random() * config.length)]);
	}

	for(let i in opts){
		robot[i] = opts[i];
	}
	robots[robot.uid] = robot;
    return robot;
};

exports.robot = robot;