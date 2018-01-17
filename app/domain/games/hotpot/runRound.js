'use strict';
/**
 * 回合周期循环
 */
const logic = require('./logic');
const config = require('./config');
const roundWork = require('./roundWork');
const util = require('../../../utils');

module.exports = (roomCode, memory, VIP_ENV, viper, app, room) => {
	const env = VIP_ENV ? viper : `system`;
	const memoryEnv = VIP_ENV ? memory.vip[viper] : memory.system;
	const roomChannel = app.channelService.createChannel(env+ '_'+ roomCode);
	//记录该房间的初始奖池
	if(memoryEnv.jackpotInit[roomCode] == null){
		memoryEnv.jackpotInit[roomCode] = {base: room.jackpot, running: room.runningPool};
	}
	//构造该回合的庄家
	memoryEnv.dealers[roomCode] = logic.constructDealer(memory.robotDealer.id, memory.dealerRound, []);
	memoryEnv.resultHistory[roomCode] = [];

	//启动该回合
	const _roundWork = roundWork(roomCode, memory, env, app, roomChannel);
	const startRound = () => {
		//每两秒进行一次回合处理
		const baseDelay = 2000;
		const nextTick = (baseDelay, previous) => {
			const now = Date.now();
			//为了防止由于程序执行所需时间导致的误差
			const delay = previous == null ? baseDelay : baseDelay - (now - previous - baseDelay);
			const timer = setTimeout(() => nextTick(baseDelay, now), delay);
			try {
				if(memoryEnv.rounds[roomCode].next){
					_roundWork(timer)
				}else{
					console.log('清除定时器=========================')
					clearTimeout(timer);
					//清除回合
					memoryEnv.rounds[roomCode] = {};
					//移除机器人玩家
					app.rpc.hall.gameRemote.udtGameRoom(null, {nid: '3', roomCode, viper}, {users: []},function(err, uptRoom){
						//通知离开房间
						roomChannel.destroy(); 
					});
				}		
			} catch (err) {
				console.error('游戏回合处理出错',err);
			}
		};
		nextTick(baseDelay);
	};
	//构造回合
	memoryEnv.rounds[roomCode] = logic.constructRound(config, null);
	startRound();
};