'use strict';

const util = require('../../../utils');
const Round = require('./memory').Round;
const notify = require('./notify');

// 构造一个庄家
exports.constructDealer = util.curry((uid, dealerRound, queue) => {
	return {
		uid: uid,
		remainRound: dealerRound,
		willOff: false,
		queue: queue || []
	}
});

// 查找庄家
const findDealer = exports.findDealer = util.curry((dealers, roomCode) => dealers[roomCode]);

// 判断是否是机器人庄家
exports.isRobotDealer = util.curry((robotDealer, dealer) => dealer.uid == robotDealer.id);

// 判断是否为庄家
const isDealer = exports.isDealer = util.curry((dealer, uid) => dealer.uid == uid);

// 判断是否在上庄列表
const inDealerQueue = exports.inDealerQueue = util.curry((queue, uid) => queue.indexOf(uid) != -1);

// 构造回合
exports.constructRound = util.curry((config, timer) => {
	const _betAreas = config.betAreas.group.concat(config.betAreas.singleForRound,config.betAreas.up)
		.reduce((_betAreas, betArea) => {
				_betAreas[betArea.id] = {
					odds: betArea.odds,
					allBet: 0
				};
				return _betAreas;
			}, {});
	return {
		timer: timer,
		now: 0,
		status: Round.status.betting,
		betAreas: _betAreas,
    //{"l1":{"odds":2,"allBet":0 }...}
		next: true,
	}
});

// 回合所处的状态 以及距离下一回合的倒计时
exports.roundStatusAndCountdown = time => {
	let interval = Round.interval;
	let currentStatus, countdown;
	Round.order.reduce((time, status) => {
        const b = time > interval[status];
        if (!b && currentStatus == null) {
            currentStatus = status;
            //greater than 0
            countdown = interval[status] - time + 1;
        }
        if (b) {
            return -interval[status] + time
        } else {
            return time
        }
    }, time);
	return {
		status: currentStatus,
		countdown: countdown,
		isFinalCd: countdown <= 1
	};
};

// 查找回合
exports.findRound = util.curry((rounds, roomCode) => rounds[roomCode]);

// 判断是否是押注期
exports.roundCanBet = round => round.status == Round.status.betting;

// 查找下注区
const findBetArea = exports.findBetArea = util.curry((betAreas, areaId) => betAreas.group.concat(betAreas.singleForRound,betAreas.up).find(betArea => betArea.id == areaId));

// 查找某回合的下注情况
const findRoundBetArea = exports.findRoundBetArea = util.curry((roundBetAreas, areaId) => roundBetAreas[areaId]);

// 查找某个玩家在某个回合的下注情况
exports.userBetAreas = (roundBetAreas, betAreas, userBet) => {
	const userBetAreas = [];
	for (const areaId in roundBetAreas) {
        //if(areaId.startsWith("e")){
        //    continue;
        //}
		const roundBetArea = roundBetAreas[areaId];
		const betArea = findBetArea(betAreas, areaId);
		userBetAreas.push({
			id: areaId,
			name: betArea.name,
			odds: roundBetArea.odds,
			selfBet: doesUserBet(userBet) ? (userBet[areaId] == null ? 0 : userBet[areaId]) : 0,
			allBet: roundBetArea.allBet
		})
	}
	return userBetAreas;
};

// 判断玩家是否下注
const doesUserBet = exports.doesUserBet = userBet => {
	if (userBet == null) {
		return false
	}
    for (const areaId in userBet) {
        if (userBet[areaId] != null && userBet[areaId] > 0) {
			return true
		}
	}
	return false
};

// 玩家总下注
exports.userTotalBet = (userBet) =>{
	let totalBet = 0;
	for(const areaId in userBet){
		if(userBet[areaId] != null && userBet[areaId] > 0){
			totalBet += userBet[areaId];
		}
	}
	totalBet-=userBet["maxBetATime"] || 0;
	return totalBet;
}

const userTotalMultiple = exports.userTotalMultiple = (userBet, lotteryResult, areaOdds) => {
	if (userBet == null) {
		return 0
	}
	const userRealBet = Object.keys(userBet).filter(areaId => userBet[areaId] > 0).map(aid => {
		return {
			areaId: aid,
			bet: userBet[aid]
		}
	})
	let allLotteryAreas = lotteryResult.areas || [];

	const totalOdd = userRealBet.reduce((sum, userBet) => {
        if (allLotteryAreas.indexOf(userBet.areaId) != -1) {
            return sum + areaOdds[userBet.areaId];
        } else {
            return sum;
        }
    }, 0);
	return totalOdd;
};
// 玩家总赢赔率
const userTotalOdd = exports.userTotalOdd = (userBet, lotteryResult, areaOdds,win) => {
	if (userBet == null) {
		return 0;
	}

	let totalBet=0;
	for(let i in userBet){
		totalBet+=userBet[i];
	}

	if(userBet["maxBetATime"]){
		totalBet-=userBet["maxBetATime"];
	}

	if(totalBet==0){
		return 0;
	}

	if(win==undefined){
		win=0;
	}

	return win/totalBet;
};

exports.offBank = function({app, memoryEnv, roomCode, uid, env, robotDealer, canNotOnBank}, callback){
	const dealer = findDealer(memoryEnv.dealers, roomCode);
	if (isDealer(dealer, uid)) {
		if (dealer.willOff) {
			return callback(null);
		}
		//庄家下庄
		dealer.willOff = true;
	} else {
		// 是否在队列
		const queue = dealer.queue;
		if (!inDealerQueue(queue, uid)) {
			if(canNotOnBank){
				return callback(null);
			}
			return callback({error:'不在上庄队列里'});
		}
		queue.splice(queue.indexOf(uid), 1);
		memoryEnv.hasOffBankQueue.push(uid);
	}
	const roomChannel = app.channelService.getChannel(env+ '_'+ roomCode);
	notify.dealer(app, roomChannel, dealer, robotDealer);
	return callback(null);
}; 

exports.sendMail = (opts, uid, isDealer) =>{
    const moneyType = opts.isVip ? "积分" : "金币";
    require('../../../services/MailService').generatorMail({
        name: '游戏中断',
		content: isDealer ? '由于断线/退出游戏, 您在火锅天下游戏中坐庄已自动结算' + `\n获得押注`+opts.oddAll+`${moneyType}`+`\n赔付${opts.payAll}${moneyType}`+ (opts.realWin > 0 ? `系统提成${opts.commission}${moneyType}`: '')+`\n净收益${opts.realWin}${moneyType}`
			:'由于断线/退出游戏, 您在火锅天下游戏中的押注已自动结算' + '\n赢得'+opts.win+`${moneyType}。`,
    }, uid, function(err, mailDocs){});
}