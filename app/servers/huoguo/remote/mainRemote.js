'use strict';

const huoguo = require('../../../domain/games/hotpot');
const util = require('../../../utils');
const socialRound = require('../../../domain/games/hotpot/socialRound.js');
const logic = huoguo.logic;
const memory = huoguo.memory;
const runRound = huoguo.runRound;
const Robot = huoguo.Robot;

module.exports = function(app) {
	return new Remote(app);
};

var Remote = function(app) {
	this.app = app;
};

/**
 * 查找某个房间是否存在 回合
 */
Remote.prototype.findRound = function(isVip, viper, roomCode, frontendId, uid, room, cb){
	// 获取该环境的所有回合
	if(isVip){
		//初始化vip回合的内存数据格式
		if(memory.vip[viper] == null){
			memory.vip[viper] = {
				dealers: {},
				hasOffBankQueue: [],
				rounds: {},
				userBets: {},
				resultHistory: {},
				todayWins: {},
				shits: {},
				userRoundHistory: {},
				userReward: {},
				lastBigLottery: {},
				jackpotInit: {},
				awardRegulation: {},
				roundOffline: {},
			};
		}
	}
	//根据环境获取相应的内存
	const memoryEnv = isVip ? memory.vip[viper] : memory.system;
	const env = isVip ? viper : 'system';
	const rounds = memoryEnv.rounds;    //所有的游戏回合
  //如果该玩家在当前房间回合的掉线列表中,则应该从中删除(因为该玩家已重新进入游戏回合)
	if(memoryEnv.roundOffline[roomCode] && memoryEnv.roundOffline[roomCode].has(uid)){
		memoryEnv.roundOffline[roomCode].delete(uid);
	}
	const isExist = !util.isVoid(logic.findRound(rounds, roomCode));
	if(!isExist){  //该房间不存在回合 则需新建
		runRound(roomCode, memory, isVip, viper, this.app, room);
	}
	//把玩家放入该房间的channel中
	const channel = this.app.channelService.getChannel(env+ '_'+ roomCode);
	channel.add(uid, frontendId);
	
	//初始化今日总赢和 今日最大回合盈利
	if(memoryEnv.todayWins[uid] == null) {
		memoryEnv.todayWins[uid] = {todayTotalWin: 0, todayRoundWin: 0};
	}
	//如果房间里有机器人,则离开一个
	const channelusers = channel.getMembers();
	const kickAI = channelusers.find(u => u.startsWith('ai'));
	if(kickAI){
		channel.leave(kickAI, Robot.getRobot(kickAI).sid);
		//从内存中删除
		return cb({aiLeave: true, uid: kickAI})
	}
	return cb();
};

/**
 * 移除某个channel中的指定玩家
 * 如果玩家为庄家(回合结束后下庄) 在上庄队列中(移除)
 */
Remote.prototype.kickUserFromChannel = function({isVip, roomCode, uid, viper}, cb){
	
	const env = isVip ? viper : 'system';
	const channel = this.app.channelService.getChannel(env+ '_'+ roomCode);
	channel.leave(uid, channel.getMember(uid).sid);
	
	const memoryEnv = isVip ? memory.vip[viper] : memory.system;
	if(memoryEnv.roundOffline[roomCode] == null){
		memoryEnv.roundOffline[roomCode] = new Set();
	}
	//下注玩家或者庄家需要进入离线列表
	if(logic.doesUserBet(memoryEnv.userBets[roomCode][uid]) || logic.isDealer(logic.findDealer(memoryEnv.dealers, roomCode), uid)){
		memoryEnv.roundOffline[roomCode].add(uid);
	}
	logic.offBank({app: this.app, memoryEnv, roomCode, uid, env, robotDealer: memory.robotDealer, canNotOnBank: true}, function(err){
		if(err){
			console.error('退出房间时下庄失败', err);
		}
		return cb(channel.getMembers());
	})
};

/**
 * 开启hotpotsocialround
 * */
Remote.prototype.startSocialRound=function(room,cb){
	socialRound(room,null,this.app);
	cb({code:200});
};

Remote.prototype.getRobotById=function(id,cb){
	if(!Robot.getRobot(id)){
		return cb({code:500,msg:"未找到机器人"});
	}
	return cb({code:200,result:Robot.getRobot(id)});
}

Remote.prototype.getRobotsByIds=function(ids,cb){
	let returnData=[];
	for(let i in ids){
		if(!Robot.getRobot(ids[i])){
			return cb({code:500,msg:"未找到机器人"});
		}
		returnData.push(Robot.getRobot(ids[i]));
	}
	
	return cb({code:200,result:returnData});
}