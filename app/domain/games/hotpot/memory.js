'use strict';

const status = {
	betting: 'betting',
	blocking: 'blocking',
	processing: 'processing'
};

const Round = {
	status: status,
	interval: {
		betting: 30,               // 下注阶段
		blocking: 4,               //封盘期
        processing: 24,            // 开奖结算阶段
	},
	order: [status.betting, status.blocking, status.processing],
};
Round.interval.total = Round.interval.betting + Round.interval.blocking + Round.interval.processing;

module.exports = {

	dealerRound: 8,

	robotDealer: {
		id: 'ai小武',
		name: '系统'
	},

	betLimit: 200000,

	vip: {
		/*
		viper:{
			//庄家
			dealers: {
				// roomCode: {uid, remainRound, willOff, queue: [uid]}
			},
			//下庄列表
			hasOffBankQueue: [],
			//当前的回合
			rounds: {
				// roomCode: {timer, now, status, betAreas: {id: {odds, allBet}}}
			},
			// 玩家下注
			userBets: {
				// roomCode: {uid: {betAreaId: betNum}}
			},
			// 历史记录 
			resultHistory: {
				// roomCode: [{time: Date, lottery, areaOdds, dealer: {uid, win, boom}, others: [{uid, win, realWin}]}]
			},
			//	今日盈利
			todayWins: {
				// uid: {todayTotalWin, todayRoundWin}
			},
			// 吐槽
			shits: {
				// roomCode: {last: number, current: number}
			},
			// 玩家历史回合记录
			userRoundHistory:{
				// uid: {day:[reward], total: number}
			},
			// 玩家返奖
			userReward: {
				// userId: {day, history, individual}
			},
			// 上次大奖
			lastBigLottery: {
				//roomCode: {ele: String, time: Date}
			},
			// 初始奖池
			jackpotInit: {
				//roomCode:{base: Number, running: Number}
			},
			// 放奖调控
			awardRegulation: {
				//roomCode: {lastTime, awardState, readyAwardTime, readyAward, jackpotBaseLine, initJackpot}
			}
		},
		*/
	},

	system: {
		dealers: {
			// roomCode: {uid, remainRound, willOff, queue: [uid]}
		},
		hasOffBankQueue: [],
		rounds: {
			// roomCode: {timer, now, status, betAreas: {id: {odds, allBet}}}
		},
		userBets: {
			// roomCode: {uid: {betAreaId: betNum}}
		},
		resultHistory: {
			// roomCode: [{time: Date, lottery, areaOdds, dealer: {uid, win, boom}, others: [{uid, win, realWin}]}]
		},
		todayWins: {
			// uid: {todayTotalWin, todayRoundWin}
		},
		shits: {
			// roomCode: {last: number, current: number}
		},
		userRoundHistory:{
			// uid: {day:[reward], total: number}
		},
		userReward: {
			// userId: {day, history, individual}
		},
		lastBigLottery: {
			//roomCode: {ele: String, time: Date}
		},
		jackpotInit: {
			//roomCode:{base: Number, running: Number}
		},
		awardRegulation: {
			//roomCode: {lastTime, awardState, readyAwardTime, readyAward, jackpotBaseLine, initJackpot}
		},
		roundOffline: {  //回合中掉线玩家
			//roomCode: new Set(uid)
		}
	},
	// 一个回合的配置
	Round,
};