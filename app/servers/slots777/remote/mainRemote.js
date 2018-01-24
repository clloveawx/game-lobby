'use strict';

const db = require('../../../utils/db/mongodb');
const logger = require('pomelo-logger').getLogger('log', __filename);
const utils = require('../../../utils');
const gutil = require('../../../domain/games/util');

//记录
const rounds = {};

const playerMgr = require('../../../utils/db/dbMgr/playerMgr');
const messageService = require('../../../services/MessageService');

const BonusQuota = [0.4, 0.25, 0.15, 0.1, 0.07, 0.03];

//两种回合状态
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

module.exports = function (app) {
	return new Remote(app);
};

function Remote(app) {
	this.app = app;
}

Remote.prototype.socialRound = ({viper, roomCode}, next) =>{
	
	const env = viper == null ? 'system' : viper;
	const _roundWork = roundWork({viper, roomCode, env});
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
				if(rounds[env][roomCode].next){
					_roundWork();
				}else{
					clearTimeout(timer);
					rounds[env][roomCode] = null;
					return;
				}
			} catch (err) {
				console.error('比赛回合处理出错',err);
			}
		};
		nextTick(baseDelay);
	};
	//构造回合
	if(rounds[env] == null){
		rounds[env] = {};
	}
	if(rounds[env][roomCode] == null){
		rounds[env][roomCode] = {
			now: 0,
			status: Round.status.processing,
			next: true,     //表明回合会不会继续
		};
		next();
	}
	startRound();
};

const roundWork = ({viper, roomCode, env}) =>{
	let now = 0, firstTimeSettling = true;
	
	const reset = () =>{
		now = 0;
		firstTimeSettling = true;
	};
	return () =>{
		
		now += 2;
		rounds[env][roomCode].now = now;
		const {status, countdown} = roundStatusAndCountdown(rounds[env][roomCode].now);
		console.error(roomCode,'===========当前状态和倒计时',status, countdown);
		rounds[env][roomCode].status = status;
		rounds[env][roomCode].countdown = countdown;
		
		const settling = status == Round.status.settling;
		
		//结算阶段
		if(settling && firstTimeSettling){
			//记录参与分奖的玩家
			gutil.getRoomByEnv({viper, nid: '1', roomCode}).then(room =>{
				//找出当前处在房间中的玩家信息
				playerMgr.getPlayers(room.users.map(user => user.uid)).then(userEarning =>{
					userEarning.sort((u1, u2) => u2.slotsGameEarnings - u1.slotsGameEarnings);
					const settleUser = userEarning.filter(u => u.slotsGameEarnings > 0);
					console.log('参与结算的============',settleUser.map(u =>u.uid))
					let bonusSum = 0;   //计算发奖总计
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
						//某个玩家结算完成(加钱  清空参与结算的游戏盈利累积)
						if(viper){
							p['integral'] += bonusAward;
						}else{
							p['gold'][1] += bonusAward;
						}
						p.slotsGameEarnings = 0;
						bonusSum += bonusAward;
						//保存玩家
						playerMgr.updatePlayer(p, function(){});
						//保存一条社交记录
						db.getDao('social_record').add(function(){},{
							viper,
							nid: '1',
							roomCode,
							uid: p.uid,
							win: bonusAward,
							type: viper ? 'integral' : 'gold',   //货币类型
						});
					});
					//修改房间信息  每一回合结束后将剩余的社交点加入盈利池
					room.socialDot -= bonusSum;
					room.matchDot = 0;
					room.profitPool += room.socialDot;
					room.socialDot = 0;
					gutil.udtRoomByEnv(room).then(() =>{
						console.log('777社交比赛成功');
					});
					
					firstTimeSettling = false;
					
					messageService.pushMessageByUids('slots777.matchResult', {settleResult}, settleUser.map(u =>{
						return {uid: u.uid, sid: u.sid};
					}))
				});
			});
		}
		if (now >= Round.interval.total) {
			reset();
			//console.log('玩家离开了===============', room.users.length)
			gutil.getRoomByEnv({viper, nid: '1', roomCode}).then(room =>{
				if(room.users.length == 0){
					rounds[env][roomCode].next = false;
				}
			});
		}
	};
};
