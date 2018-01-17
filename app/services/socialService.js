'use strict';

const PlayerMgr = require('../domain/hall/player/PlayerMgr');
const messageService = require('../services/MessageService');

const BonusQuota = [0.4, 0.25, 0.15, 0.1, 0.07, 0.03];

const status = {
    processing: 'processing',
    settling: 'settling',
};
const Round = {
	status,
	interval: {
        processing: 600,
        settling: 5,
	},
	order: [status.processing, status.settling],
};
Round.interval.total = Round.interval.processing + Round.interval.settling;

// 回合所处的状态 以及距离下一回合的倒计时
const roundStatusAndCountdown = time => {
	let interval = Round.interval;
	let currentStatus, countdown;
	Round.order.reduce((time, status) => {
        const b = time > interval[status];
        if (!b && currentStatus == null) {
            currentStatus = status;
            countdown = interval[status] - time;
        }
        if (b) {
            return -interval[status] + time
        } else {
            return time;
        }
    }, time);
	return {
		status: currentStatus,
		countdown: countdown,
		isFinalCd: countdown <= 1
	};
};

const roundWork = (room, moneyType) =>{
	let now = 0, firstTimeSettling = true;
	const reset = () =>{
		now = 0;
		firstTimeSettling = true;
	};
	return () =>{
		//console.log('========',room instanceof Room)

		now += 2;
		room.socialRound.now = now;
		const {status, countdown} = roundStatusAndCountdown(room.socialRound.now);
		//console.error(room.roomCode,'===========当前状态和倒计时',status, countdown);
		room.socialRound.status = status;
		room.socialRound.countdown = countdown;
		const settling = status == Round.status.settling;
	
		if(settling && firstTimeSettling){
			const userEarning = [];
			room.users.forEach(u =>{
				const player = PlayerMgr.getPlayer(u.uid);
				userEarning.push(player);
			});
			userEarning.sort((u1, u2) => u2.slotsGameEarnings - u1.slotsGameEarnings);
			const settleUser = userEarning.filter(u => u.slotsGameEarnings > 0);
			//console.log('参与结算的============',settleUser.map(u =>u.uid))
			let bonusSum = 0;
			const settleResult = [];
			settleUser.forEach((p, i) => {
				const bonusAward = Math.floor(BonusQuota[i] * room.socialDot);
				settleResult.push({
					rank: i + 1,
					uid: p.uid,
					nickname: p.nickname,
					socialDot: p.slotsGameEarnings,
					award: bonusAward,
				});
				p[moneyType] += bonusAward;
				p.slotsGameEarnings = 0;
				bonusSum += bonusAward;
			});
			//console.log('结算总额',bonusSum)
			room.socialDot -= bonusSum;
			room.matchDot = 0;
			room.profitPool += room.socialDot;
			room.socialDot = 0;
			firstTimeSettling = false;

			//推送比赛结果
			//console.log('收到坚挺的玩家=======',settleUser.map(u =>{
			// 	return {uid: u.uid, sid: u.sid};
			// }))
			messageService.pushMessageByUids('slots777.matchResult', {settleResult}, settleUser.map(u =>{
				return {uid: u.uid, sid: u.sid};
			}))
		}
		if (now >= Round.interval.total) {
			reset();
			//console.log('玩家离开了===============', room.users.length)
			if(room.users.length == 0){
				room.socialRound.next = false;
			}
		}
	};
};

module.exports = (room, viper) => {

	const moneyType = viper ? 'integral' : 'gold';
	
	const _roundWork = roundWork(room, moneyType);
	//启动该回合
	const startRound = () => {
		//每两秒进行一次回合处理
		const baseDelay = 2000;
		const nextTick = (baseDelay, previous) => {
			const now = Date.now();
			//为了防止由于程序执行所需时间导致的误差
			const delay = previous == null ? baseDelay : baseDelay - (now - previous - baseDelay);
			const timer = setTimeout(() => nextTick(baseDelay, now), delay);
			try {
				//console.log('能否进行下个回合======',room.socialRound.next)
				if(room.socialRound.next){
					_roundWork();
				}else{
					clearTimeout(timer);
					room.socialRound = null;
					return;
				}
			} catch (err) {
				console.error('比赛回合处理出错',err);
			}
		};
		nextTick(baseDelay);
	};
	//构造回合
	room.socialRound = {
        now: 0,
		status: Round.status.processing,
		next: true,
    };
	startRound();
};
