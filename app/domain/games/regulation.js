'use strict';

const util = require('../../utils');

module.exports = {
	
	/**
	 * 选择游戏轮盘
	 * @parama cur -上一局使用的轮盘
	 */
	selectRoulette(cur) {
		if(cur == '1'){
			return Math.random() < 0.0417 ? '2' : '1';
		}else if(cur == '2'){
			return Math.random() < 0.0667 ? '3' : '2';
		}else if(cur == '3'){
			return Math.random() < 0.0909 ? '1' : '3';
		}else{
			return '2';
		}
	},
	
	// 玩家押注进入奖池的比例
	intoJackpot: {
		'jackpot': 0,
		'runningPool': 0.95,
		'profitPool': 0.05,
	},
	
	//整体调控
	wholeRegulation(jackpot,runningPool){
		if(jackpot + runningPool < 0){
			return true;
		}
		return false;
	},
	
	//放奖调控
	awardRegulation({isVip, roomCode, viper, jackpot, roomUserLens}, envRoomAward){
		const awardEnv = (isVip) =>{
			if(!isVip){
				if(envRoomAward[roomCode] == null){
					envRoomAward[roomCode] = {
						lastTime: 0,         //上次放奖结束时间
						awardState: false,   //是否处于放奖状态
						readyAwardTime: 0,   //准备放奖时间
						readyAward: false,   //准备放奖
						jackpotBaseLine: null,  //停止放奖线
						initJackpot: null,      //初始奖池
					};
				}
				return envRoomAward[roomCode];
			}else{
				if(envRoomAward[viper] == null){
					envRoomAward[viper] = {};
				}
				if(envRoomAward[viper][roomCode] == null){
					envRoomAward[viper][roomCode] = {
						lastTime: 0,            //上次放奖结束时间
						awardState: false,      //是否处于放奖状态
						readyAwardTime: 0,      //准备放奖时间
						readyAward: false,      //准备放奖
						jackpotBaseLine: null,  //停止放奖线
						initJackpot: null,      //初始奖池
					};
				}
				return envRoomAward[viper][roomCode];
			}
		};
		
		const envAward = awardEnv(isVip);
		let {lastTime, awardState, jackpotBaseLine, readyAwardTime, readyAward, initJackpot} = envAward;
		if(jackpotBaseLine == null){
			envAward.jackpotBaseLine = jackpot;
			jackpotBaseLine = jackpot;
		}
		if(initJackpot == null){
			envAward.initJackpot = jackpotBaseLine;
		}
		if(awardState){   //放奖阶段 直接放奖
			return [envAward, true];
		}else{
			if(Date.now() > readyAwardTime && readyAward){
				envAward.awardState = true;
				return [envAward, true];
			}else{
				if((jackpot - jackpotBaseLine) > jackpotBaseLine * 0.001 && (Date.now() - lastTime) > 60 * 1000){
					envAward.readyAwardTime = Date.now() + util.random(5*1000, 300*1000);
					envAward.readyAward = true;
					envAward.jackpotBaseLine += (jackpot - jackpotBaseLine) * 0.1;
					console.log('*******准备放奖时间******', new Date(envAward.readyAwardTime));
				}else if((Date.now() - lastTime) > 5 * 60 * 1000
					&& (Date.now() - lastTime) < 15 * 60 * 1000
						&& (jackpot - envAward.initJackpot) > 100 * roomUserLens
				){
					envAward.readyAwardTime = Date.now() + util.random(5*1000, 300*1000);
					envAward.readyAward = true;
					envAward.jackpotBaseLine += (jackpot - jackpotBaseLine) * 0.1;
					console.log('*******准备放奖时间******', new Date(envAward.readyAwardTime));
				}
			}
		}
		return [envAward, false];
	},
	
	//个体调控
	individualRegulation({aR, curRoulette, userEnvRecord, totalBet}, gname){
		// 放奖期间和十局之前(可以重置)不触发个体调控
		if(!aR && userEnvRecord.record.length >= 10){
			switch(gname){
				case '777':
					if(curRoulette == '1'){   //777第一轮盘不做个体调控
						return [false, false];
					}
					break;
			}
			const indiRate = userEnvRecord.totalBet == 0 ? 0 : Number((userEnvRecord.totalWin / userEnvRecord.totalBet).toFixed(5));
			if(indiRate > 0.9 || userEnvRecord.bet != totalBet){
				userEnvRecord.record = [];
				userEnvRecord.totalBet = 0;
				userEnvRecord.totalWin = 0;
			}
			const gt = curRoulette == '1' ? 0.75 : curRoulette == '2' ? 0.45 : 0.25;
			const lt = curRoulette == '1' ? 0.55 : curRoulette == '2' ? 0.25: 0.05;
			if(indiRate < gt && indiRate > lt){
				return [true, false];
			}else if(indiRate <= lt){
				return [false, true];
			}
		}
		return [false, false];
	}

	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	







};