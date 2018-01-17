'use strict';

/**
 * 回合工作
 */
const memory = require('./memory');
const logic = require('./logic');
const lottery = require('./lottery');
const messageService = require('../../../services/MessageService');
const util = require('../../../utils');
const notify = require('./notify');
const Logger = require('pomelo-logger').getLogger('log', __filename);
const Robot = require('./robot/Robot').getRobot;

/**
 * 普通场加游戏记录
 */
const gameRecord = ({user, totalBet, totalWin, multiple}) =>{
	const gameRecordModel = require('../../../utils/db/mongodb').getDao('game_record');
	gameRecordModel.create({
		uid: user.uid,
		nickname: user.nickname,
		gname: '火锅',
		createTime: Date.now(),
		input: totalBet,
		nid:'3',
		multiple: multiple,
		profit: totalWin - totalBet,
		selfGold:user.gold,
	},function(err, data){
		if(err){
			console.error('创建游戏记录失败 huoguo.roundWork');
		}
	});
};

module.exports = (roomCode, memory, env, app, roomChannel) => {
	
	const config = require('./config');
	const betAreas = config.betAreas;
	const robotDealer = memory.robotDealer;
	const Round = memory.Round;
	const lackTimerRound = logic.constructRound(config);     //没有timer的回合
	const dealerIsRobot = logic.isRobotDealer(robotDealer);  //没有传入dealer
	const moneyType = env == 'system' ? 'gold' : 'integral';
	const memoryEnv = env == 'system' ? memory.system : memory.vip[env];
	const isVip = env == 'system' ? false : true;

	const total = Round.interval.total;
	let now = 0, firstTimeBetting = true, firstTimeBlocking = true, firstTimeProcessing = true, betInterval;
    let hasExtended=false;
    let isCombined=false;
	//数值调控控制 (整体调控  返奖调控)
	let wholeRegulation, awardRegulation, roomJackpot = 0;
	const reset = () => {
		now = 0;
		firstTimeBetting = true;
		firstTimeBlocking = true;
		firstTimeProcessing = true;
		
		wholeRegulation = null;
		awardRegulation = null;
		roomJackpot = 0;

        hasExtended=false;
        isCombined=false;
	};
	
	return (timer) => {
		const round = memoryEnv.rounds[roomCode];
		round.timer = timer;
		//每两秒执行一次
		now += 2;
		
		//状态和倒计时
		const statusAndcountdown = logic.roundStatusAndCountdown(now),
			countdown = statusAndcountdown.countdown,
        status = statusAndcountdown.status;
        round.status = status;
        round.now = now;

        const betting = status == Round.status.betting,
            blocking = status == Round.status.blocking,
            processing = status == Round.status.processing;

		//console.error("###",roomCode,status,now);
        //下注阶段, 通知当前时间和状态, 同步前后端的时间
		roomChannel.pushMessage('huoguo.roundCd', {
			time: countdown,
			// 距离下次下注
			nextBetting: betting ? 0 : total - now + 1,
			betting: betting,
			blocking: blocking,
			processing: processing
		});

		let dealer = logic.findDealer(memoryEnv.dealers, roomCode);
		
		if (betting && firstTimeBetting) {
			//重置用户下注和回合赔率以及总下注以及掉线玩家列表
			memoryEnv.userBets[roomCode] = {};
			memoryEnv.rounds[roomCode].betAreas = lackTimerRound(timer).betAreas;//每种菜的id和赔率
			memoryEnv.roundOffline[roomCode] = new Set();
			// 重置离开队列记录
			memoryEnv.hasOffBankQueue = [];
			// 上回合吐槽数
			// for (const roomId in memory.shits) {
			// 	memory.shits[roomId].last = memory.shits[roomId].current;
			// 	memory.shits[roomId].current = 0
			// }
			
			const notifyDealer = () => notify.dealer(app, roomChannel, dealer, robotDealer);
			//庄家变更
			if (!dealerIsRobot(dealer)) {
				if (dealer.willOff || dealer.remainRound <= 0) {
					dealer = memoryEnv.dealers[roomCode] = logic.constructDealer(robotDealer.id, memory.dealerRound, dealer.queue);
				} else {
					notifyDealer();
				}
			}
			if (dealerIsRobot(dealer)) {
				// 检查金币是否足够上庄，否则离开队列通知
				const pickUserOnBank = () => {
					if (dealer.queue.length == 0) {
						dealer.remainRound++;
						notifyDealer();
						return;
					}
					const uid = dealer.queue.shift();

					app.rpc.hall.playerRemote.getUserInfo(null, uid, function(err, player){
						if(err){
							console.error(err, '待上庄玩家财产检查失败');
						}
						if(player[moneyType] >= config.onBankCondition){
							dealer = memoryEnv.dealers[roomCode] = logic.constructDealer(uid, memory.dealerRound, dealer.queue);
							//通知庄家
							notifyDealer();
							return;
						}
						app.channelService.pushMessageByUids('huoguo.queueKicked', {msg: '金钱不足'}, [roomChannel.getMember(uid)]);
						pickUserOnBank();
					});
				};
				pickUserOnBank();
			}
			
			// 通知玩家下注
			betInterval = setInterval(() => {
				const userBets = memoryEnv.userBets[roomCode];
				const round = memoryEnv.rounds[roomCode];
				const statusAndcountdown = logic.roundStatusAndCountdown(round.now),
					countdown = statusAndcountdown.countdown;
				const members = roomChannel.getMembers(), membersLen = members.length;
				// 分批通知
				const interval = 3,
					sectionIndex = countdown % interval,
					section = Math.ceil(membersLen / interval);
				const userIds = members.slice(section * (0 + sectionIndex), section * (1 + sectionIndex));
				userIds.forEach(userId =>
					app.channelService.pushMessageByUids('huoguo.bet', logic.userBetAreas(round.betAreas, config.betAreas, userBets[userId]), [roomChannel.getMember(userId)])
				)
			}, 1000);
			firstTimeBetting = false;
		}

		//在下注阶段离 开奖阶段2s时做数值调控处理
		// if(betting && countdown <= 2){
		// 	//整体调控
		// 	app.rpc.hall.gameRemote.gameFromHall(null, {nid: '3', viper: env == 'system' ? null : env}, function(err, game){
		// 		if(err){
		// 			Logger.error('火锅整体调控出错',err);
		// 		}
		// 		const room = game.rooms.find(room => room.roomCode == roomCode);
		// 		if(!room){
		// 			Logger.error('火锅整体调控未找到房间',game.rooms,roomCode);
		// 		}
		// 		roomJackpot = room.jackpot;
		// 		const initJackpotSum = memoryEnv.jackpotInit[roomCode].base + memoryEnv.jackpotInit[roomCode].running;
		// 		if(room.jackpot + room.runningPool - initJackpotSum < 0){
		// 			wholeRegulation = true;
		// 		}

		// 		//放奖调控
		// 		const awardEnv = () =>{
		// 			if(memoryEnv.awardRegulation[roomCode] == null){
		// 				memoryEnv.awardRegulation[roomCode] = {
		// 					lastTime: 0,          //上次放奖结束时间
		// 					awardState: false,    //是否处于放奖状态
		// 					readyAwardTime: 0,    //准备放奖时间
		// 					readyAward: false,    //准备放奖
		// 					jackpotBaseLine: null,  //停止放奖线
		// 					initJackpot: null,      //初始奖池
		// 				};
		// 			}
		// 			return memoryEnv.awardRegulation[roomCode];
		// 		};
		// 		let envAward = awardEnv();
		// 		let {lastTime, awardState, jackpotBaseLine, readyAwardTime, readyAward, initJackpot} = envAward;
		// 		if(jackpotBaseLine == null){
		// 			envAward.jackpotBaseLine = room.jackpot;
		// 			jackpotBaseLine = room.jackpot;
		// 		}
		// 		if(initJackpot == null){
		// 			envAward.initJackpot = jackpotBaseLine;
		// 		}
		// 		if(awardState){   //放奖阶段 直接放奖
		// 			awardRegulation = true;
		// 		}else{
		// 			if(Date.now() > readyAwardTime && readyAward){
		// 				awardRegulation = true;
		// 				envAward.awardState = true;
		// 			}else{
		// 				if((room.jackpot-jackpotBaseLine) > jackpotBaseLine*0.001 && (Date.now() - lastTime) > 60 * 1000){
		// 					envAward.readyAwardTime = Date.now() + util.random(5*1000, 300*1000);
		// 					envAward.readyAward = true;
		// 					envAward.jackpotBaseLine += (room.jackpot-jackpotBaseLine) * 0.1;
		// 				}else if((Date.now() - lastTime) > 5 * 60 * 1000 && (Date.now() - lastTime) < 15 * 60 * 1000 && (room.jackpot - envAward.initJackpot) > 100*room.users.length){
		// 					envAward.readyAwardTime = Date.now() + util.random(5*1000, 300*1000);
		// 					envAward.readyAward = true;
		// 					envAward.jackpotBaseLine += (room.jackpot-jackpotBaseLine) * 0.1;
		// 				}
		// 			}
		// 		}
		// 	});
		// }

		//封盘期
		if(blocking && firstTimeBlocking){

			clearInterval(betInterval);

			let lotteryResult = lottery.lottery({config, wholeRegulation, awardRegulation,dealerIsRobot:dealerIsRobot(dealer)});
            isCombined=lotteryResult.slots.combine;

			//如果开出人参或者帝王蟹 保存记录
			if(lotteryResult.areas && ['s1', 's2'].includes(lotteryResult.areas[0])){
				memoryEnv.lastBigLottery[roomCode] = {ele: lotteryResult.areas[0], time: Date.now()};
			}
			//notify result
			const _lotteryResult = util.clone(lotteryResult);
			delete _lotteryResult.slots.type;
			_lotteryResult.slots.isKillall = lotteryResult.slots.type == config.slots.types.killall;


			//根据开奖结果 更改roundBetArea 的赔率
			const group = config.betAreas.group.map(type =>type.id);
            const slotsUp=config.betAreas.up.map(type=>type.id);

			for(let i in round.betAreas){
				if(group.indexOf(i) == -1 && slotsUp.indexOf(i)==-1){
					round.betAreas[i].odds = round.betAreas[i].odds * lotteryResult.rate;
				}
			}
			//结算
			const settleResult = lottery.settle(config, lotteryResult, memoryEnv.userBets[roomCode], round.betAreas, roomCode);

            //增加玩家赢钱到社交点奖池 并更新
            app.rpc.hall.gameRemote.gameFromHall(null, {nid: '3', viper: env == 'system' ? null : env}, function(err, game){
                const room = game.rooms.find(room => room.roomCode == roomCode);
                if(!room){
                    Logger.error('火锅未找到房间',game.rooms,roomCode);
                }

                if(dealerIsRobot(dealer)){
                    room.socialDot += settleResult.othersWin * 0;
                    room.matchDot += settleResult.othersWin * 0;
                }else{
                    room.socialDot += (settleResult.othersWin+settleResult.dealerWin) * 0;
                    room.matchDot += (settleResult.othersWin+settleResult.dealerWin) * 0;
                }

                let uids=room.users.map(o=>{
                    return o.uid;
                });

                app.rpc.hall.gameRemote.udtGameRoom(null,{nid:"3",roomCode,viper: env == 'system' ? null : env,changeMoney: false},{socialDot:room.socialDot,matchDot:room.matchDot},function(err,udtRoom){
                    if(err){
                        console.error("更新hotpot房间社交点失败",err);
                    }
                })

                let hotpotGameEarningsRanking=[];

                let realUids=[],robotUids=[];
                for(let i in uids){
                    if(uids[i].startsWith("ai")){
                        robotUids.push(uids[i]);
                    }else{
                        realUids.push(uids[i]);
                    }
				}

                app.rpc.hall.playerRemote.getUsersInfo(null, realUids, function(err, players){

                    for(let i in robotUids){
                        players.push(Robot(robotUids[i]));
                    }

                    players.forEach((player,i)=>{
                        let temp=settleResult.others.find(e=>{return e.id===player.uid})
                        player.hotpotGameEarnings += temp ? temp.win:0;
                        hotpotGameEarningsRanking.push({uid:player.uid,nickname:player.nickname,hotpotGameEarnings:player.hotpotGameEarnings,headurl:player.headurl});

                        if(!player.uid.startsWith("ai")){
                            app.rpc.hall.playerRemote.updateUser(null,player.uid,{hotpotGameEarnings:player.hotpotGameEarnings},function(err,player){
                                if(err){
                                    console.log("更新玩家hotpotGameEarnings失败");
                                }
                            });
                        }else{
                            Robot(player.uid).hotpotGameEarnings=player.hotpotGameEarnings;
                        }
                    });

                    hotpotGameEarningsRanking.sort((u1,u2)=>{return u2.hotpotGameEarnings-u1.hotpotGameEarnings});
                    //推送开奖结果、开奖倍率和派奖榜
                    roomChannel.pushMessage('huoguo.result',{lotteryResult:_lotteryResult,hotpotGameEarningsRanking:hotpotGameEarningsRanking,socialDot:(room.socialDot).toFixed()});
                });
            });

			const dealerWin = settleResult.dealerWin;
			let dealerGain = dealerWin;
			// 庄家赢钱抽成
			let commission;
			if (dealerWin > 0) {
				commission = Math.floor(dealerWin * 0.05);
				dealerGain -= commission
			}

			//如果庄家是玩家并且赢钱,则需抽成到基础奖池
			if(!dealerIsRobot(dealer) && dealerWin > 0){
				app.rpc.hall.gameRemote.udtGameRoom(null, {nid: '3', roomCode, viper: env == 'system' ? null : env, changeMoney: true}, {count: commission, channel: 'jackpot'},function(err, uptRoom){
					console.error('现在改变后房间的奖池===========',uptRoom.jackpot);
				});
			}
			//如果庄家是系统但是输钱,则从流水池扣钱
			if(dealerIsRobot(dealer) && dealerWin < 0){
				app.rpc.hall.gameRemote.udtGameRoom(null, {nid: '3', roomCode, viper: env == 'system' ? null : env, changeMoney: true}, {count: dealerWin, channel: 'runningPool'},function(err, uptRoom){
					console.error('现在改变后房间的流水奖池===========',uptRoom.runningPool);
				});
			}
			//如果庄家是系统并且赢钱,加入流水池
			if(dealerIsRobot(dealer) && dealerWin > 0){
				app.rpc.hall.gameRemote.udtGameRoom(null, {nid: '3', roomCode, viper: env == 'system' ? null : env, changeMoney: true}, {count: dealerWin, channel: 'runningPool'},function(err, uptRoom){
					console.error('现在改变后房间的流水奖池2===========',uptRoom.runningPool);
				});
			}

			// 结果历史
			const areaOdds = {};
			for (const areaId in round.betAreas) {
				areaOdds[areaId] = round.betAreas[areaId].odds
			}
			const result = {
				time: new Date(),
				lottery: _lotteryResult,
				areaOdds: areaOdds,
				dealer: {id: dealer.uid, win: dealerGain, boom: false},
				others: settleResult.others
			};

			memoryEnv.resultHistory[roomCode].unshift(result);

			// 爆庄，结果历史，各自金币处理
			new Promise((resolve, reject) =>{
				if(!dealerIsRobot(dealer)){
					//Logger.error('请求非系统庄家的信息', dealer)
					return app.rpc.hall.playerRemote.getUserInfo(null, dealer.uid, function(err, player){
						//Logger.error('请求非系统庄家的信息成功', player)
						if(err){
							return reject('查询玩家金钱失败 huoguo.roundWork');
						}
						return resolve(player[moneyType]);
					})
				}else{
					return resolve(null);
				}
			}).then((dealerMoney) =>{
				if(dealerMoney != null && dealerMoney < -dealerGain){  //爆庄
					result.dealer.boom = true;
					result.dealer.win = dealerGain = -dealerMoney;
				}

				if(memoryEnv.roundOffline[roomCode].has(dealer.uid)){
					logic.sendMail({
						isVip,
						oddAll: settleResult.othersBet,
						payAll: settleResult.othersWin,
						realWin: dealerGain,
						commission,
					}, dealer.uid, true);
				}

				const setTodayWin = (uid, winNum) => {
					if (winNum <= 0) {
						return;
					}
					const userTodayWin = memoryEnv.todayWins[uid];
					userTodayWin.todayTotalWin += winNum;
					if (userTodayWin.todayRoundWin < winNum) {
						userTodayWin.todayRoundWin = winNum;
					}
				};

				// 改变用户金币
				if (!dealerIsRobot(dealer) && dealerGain != 0) {
					setTodayWin(dealer.uid, dealerGain);
                    let deductMoney;
					if(dealerMoney +dealerGain >= 0){
						deductMoney = dealerMoney + dealerGain;
					}else{
						deductMoney = 0;
					}
					app.rpc.hall.playerRemote.updateUser(null, dealer.uid, {[moneyType]: deductMoney, roomProfit: isVip ? (dealerMoney +dealerGain >= 0 ? (player.roomProfit + dealerGain) : dealerMoney) : 0}, function(err,player){
						if(err){
							console.error('庄家金币结算失败');
						}
					});
				}
				if(!isVip && !dealerIsRobot(dealer)){
					app.rpc.hall.playerRemote.getUserInfo(null, dealer.uid, function(err, player){
						gameRecord({user: player, totalBet: 0, totalWin: dealerGain, multiple: 0});
					});
				}

				settleResult.others.forEach(other => {
					if(!other.id.startsWith('ai')){
						//如果该玩家已离线就发邮件
						if(memoryEnv.roundOffline[roomCode].has(other.id)){
							logic.sendMail({
								isVip,
								win: other.win
							}, other.id);
						}
						app.rpc.hall.playerRemote.getUserInfo(null, other.id, function(err, player){
							if(err){
								console.error(err, '其他玩家金币结算查找金币失败', other.id);
							}
							if(other.win > 0){
								setTodayWin(other.id, other.win);
								app.rpc.hall.playerRemote.updateUser(null, other.id, {[moneyType]: player[moneyType] + other.win, roomProfit: isVip ? (player.roomProfit + other.win) : 0}, function(err,player){
									if(err){
										console.error(err, '其他玩家金币结算更新金币失败', other.id);
									}
								});
							}
							if(!isVip){
								gameRecord({
									user: player, 
									totalBet: logic.userTotalBet(memoryEnv.userBets[roomCode][player.uid]),
									totalWin: other.win,
									multiple: logic.userTotalMultiple(memoryEnv.userBets[roomCode][player.uid], lotteryResult, result.areaOdds)
								});
							}
						})
					}else{
						const ai = Robot(other.id);
						if(other.win > 0){
							setTodayWin(other.id, other.win);
							ai[moneyType] += other.win;
						}
						if(!isVip){
							gameRecord({
								user: ai, 
								totalBet: logic.userTotalBet(memoryEnv.userBets[roomCode][ai.uid]),
								totalWin: other.win,
								multiple: logic.userTotalMultiple(memoryEnv.userBets[roomCode][ai.uid], lotteryResult, result.areaOdds)
							});
						}
					}
				})
			}).catch(err =>{
				console.error('结算处理金钱出错',err)
			});		
			firstTimeBlocking = false;
		}

		// 收尾期
		if (processing && firstTimeProcessing) {

			dealer.remainRound--;
			//通知
			const result = memoryEnv.resultHistory[roomCode][0];
			const resultDealer = result.dealer;
			const others = result.others;
			const first = others[0];

			//遍历所有下注玩家 看是否中大奖 有则发通知
			const userBets = memoryEnv.userBets[roomCode];
			const lotteryResult = result.lottery;
			const areaOdds = result.areaOdds;

			const bigWinUsersBet = others.map(user => {
				return {
					uid: user.id,
					userBet: userBets[user.id],
					win: user.win
				}
			});
			let noticeUsers = [];
			if(lotteryResult.areas && lotteryResult.areas.includes('s1')){
				noticeUsers = others.filter(o => userBets[o.id]['s1'] > 0).map(u =>{
					return {
						uid: u.id,
						win: u.win,
						winType: '人参',
					}
				});
			}else if(lotteryResult.areas && lotteryResult.areas.includes('s2')){
				noticeUsers = others.filter(o => userBets[o.id]['s2'] > 0).map(u =>{
					return {
						uid: u.id,
						win: u.win,
						winType: '霸王蟹',
					}
				});
			}
			if(!util.isVoid(noticeUsers)){
				app.rpc.hall.gameRemote.gameFromHall(null, {nid: '3', viper: env == 'system' ? null : env}, function(err, game){
					if(err){
						Logger.error('火锅游戏公告出错',err);
					}
	
					setTimeout(function(){
						console.error('=======================',noticeUsers)
						noticeUsers.forEach(user => {
	
							if(user.uid.startsWith('ai')){
								//公告
								require('../../../services/MessageService').notice({route: 'contentWin',game: {
									nid:game.nid, nickname: Robot(user.uid).nickname, name: game.zname, num: user.win, moneyType: isVip ? '积分' : '金币'
										}, VIP_ENV: env == 'system' ? null : env, uid: user.uid, session: null,
											content: '恭喜<color=#FDD105>' + decodeURI(Robot(user.uid).nickname) + '</c>在<color=#4FFF01>' + '火锅天下' + '</c>中,成功吃到<color=#FDD105>' + user.winType + '</c>' + ',获得<color=#FDD105>' + util.moneyToString(user.win) + '</c>' + (isVip ? '积分' : '金币')
									},function(){});
							}else{
								app.rpc.hall.playerRemote.getUserInfo(null, user.uid, function(err, player){
									if (err) {
										console.error('用户信息获取失败 huoguo.roundWork');
									}
									//公告
									require('../../../services/MessageService').notice({route: 'contentWin',game: {
										nid:game.nid, nickname: player.nickname, name: game.zname, num: user.win, moneyType: isVip ? '积分' : '金币'
											}, VIP_ENV: isVip, uid: user.uid, session: null,
												content: '恭喜<color=#FDD105>' + player.nickname + '</c>在<color=#4FFF01>' + '火锅天下' + '</c>中,成功吃到<color=#FDD105>' + user.winType + '</c>' + ',获得<color=#FDD105>' + util.moneyToString(user.win) + '</c>' + (isVip ? '积分' : '金币')
									},function(){});
								})
							}
						});
					}, 12000);
				})	
			}
			/*
			app.rpc.hall.gameRemote.gameFromHall(null, {nid: '3', viper: env == 'system' ? null : env}, function(err, game){
				if(err){
					Logger.error('火锅大奖公告出错',err);
				}

				setTimeout(function(){
				
					bigWinUsersBet.forEach(user => {
						const totalOdd = logic.userTotalOdd(user.userBet, lotteryResult, areaOdds,user.win);
						if (totalOdd >= 40) {

							if(user.uid.startsWith('ai')){
								//大奖公告
								require('../../../services/MessageService').notice({route: 'onBigWin',game: {
									nid:game.nid, nickname: Robot(user.uid).nickname, name: game.zname, num: user.win, moneyType: isVip ? '积分' : '金币'
								}, VIP_ENV: env == 'system' ? null : env, uid: user.uid, session: null},function(){});
							}else{
								app.rpc.hall.playerRemote.getUserInfo(null, user.uid, function(err, player){
									if (err) {
										console.error('用户信息获取失败 huoguo.roundWork');
									}
									//大奖公告
									require('../../../services/MessageService').notice({route: 'onBigWin',game: {
										nid:game.nid, nickname: player.nickname, name: game.zname, num: user.win, moneyType: isVip ? '积分' : '金币'
									}, VIP_ENV: isVip, uid: user.uid, session: null},function(){});
								})
							}
						}
					});
				}, 12000);
			})	
			*/

			// 通知盈利
			const notifyWin = (dealerName, firstName) => {
				const winMsg = (winSet, isBeted) => {
					return {
						lottery: result.lottery,
						odds: result.areaOdds,
						dealer: {
							name: dealerName,
							win: resultDealer.win,
							boom: resultDealer.boom
						},
						isBeted,
						first: first != null ? {name: firstName, win: first.win} : null,
                        winSet:winSet
					}
				};
				const dishesWin = {};
				const cookStyleWin = {};
				const tasteWin = {};
				const doubleHitWin = {};
				const tripleHitWin = {};
				const realWin = {};
                const win={};

				others.forEach(other => {
                    dishesWin[other.id] = other.dishesWin;
                    cookStyleWin[other.id] = other.cookStyleWin;
                    tasteWin[other.id] = other.tasteWin;
                    doubleHitWin[other.id] = other.doubleHitWin;
                    tripleHitWin[other.id] = other.tripleHitWin;
					realWin[other.id] = other.realWin;
					win[other.id]=other.win;

				});
				roomChannel.getMembers().forEach(userId => {
					const dishesWinp = userId == resultDealer.id ? resultDealer.win :
                        dishesWin[userId];
                    const cookStyleWinp = userId == resultDealer.id ? resultDealer.win :
                        cookStyleWin[userId];
                    const tasteWinp = userId == resultDealer.id ? resultDealer.win :
                        tasteWin[userId];
                    const doubleHitWinp = userId == resultDealer.id ? resultDealer.win :
                        doubleHitWin[userId];
                    const tripleHitWinp = userId == resultDealer.id ? resultDealer.win :
                        tripleHitWin[userId];
                    const realWinp = userId == resultDealer.id ? resultDealer.win :
                        realWin[userId];
                    const winp = userId == resultDealer.id ? resultDealer.win :
                        win[userId];

					const isBeted = logic.doesUserBet(memoryEnv.userBets[roomCode][userId]);
					notify.win(userId, winMsg({dishesWinp,cookStyleWinp,tasteWinp,doubleHitWinp,tripleHitWinp,realWinp,winp}, isBeted), roomChannel, app.channelService)
				})
			};
			const promises = [
				// 庄家名称
				new Promise((resolve, reject) => {
					if(dealerIsRobot(dealer)){
						resolve(robotDealer.name);
					}else{
						return app.rpc.hall.playerRemote.getUserInfo(null, dealer.uid, function(err, player){
							resolve(player.nickname);
						})
					}
				}),
				// 第一名名称
				new Promise((resolve, reject) => {
					if(first == null) {
						resolve(null)
					}else {
						if(!first.id.startsWith('ai')){
							return app.rpc.hall.playerRemote.getUserInfo(null, first.id, function(err, player){
								resolve(player.nickname);
							})
						}else{
							resolve(Robot(first.id).nickname);
						}
					}
				}),
			];
			Promise.all(promises).then(arr => {
				notifyWin(arr[0], arr[1]);
			}).catch(err => {
				console.error('结算通知处理出错', err);
			});
			// 爆庄则下庄
			if (resultDealer.boom) {
				//下庄
				logic.offBank({app, memoryEnv, roomCode, uid: resultDealer.id, env, robotDealer: memory.robotDealer}, function(){});
			}
			firstTimeProcessing = false;			
		}
		//如果开出特效 延长播放时间
        if(now == 50 && isCombined && !hasExtended){
            now -= 10;
            hasExtended = true;
        }

		if (now >= total) {
			reset();
			if(roomChannel.getMembers().filter(uid => !uid.startsWith('ai')).length == 0){
				memoryEnv.rounds[roomCode].next = false;
			}
		}
	}
};