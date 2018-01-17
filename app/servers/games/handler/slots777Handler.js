'use strict';

const util = require('../../../utils');
const msgService = require('../../../services/MessageService');
const slots777 = require('../../../domain/games/slots777');
const config = slots777.config;
const logic = slots777.logic;
const memory = slots777.memory;

module.exports = function(app) {
	return new slots777Handler(app);
};

var slots777Handler = function(app) {
	this.app = app;
};

/**
 * 初始化窗口元素
 * @return {initWinIds}
 * @route: games.slots777Handler.initWindow
 */
slots777Handler.prototype.initWindow = function(msg, session, next){
	const initWinIds = logic.initWindow(config.row, config.column, config.type);
	return next(null, {code: 200, initWinIds});
};

/**
 *  开始游戏
 * @param {lineNum, bet} 线数、 押注倍数
 * @return {getWindow, totalWin, jackpotType, winLines}
 * @route：games.slots777Handler.start
 */
slots777Handler.prototype.start = function ({lineNum, bet}, session, next) {
	if(lineNum == null || bet == null){
		return next(null, {code: 500, error:'传入的参数有误'});
	}
	if(!logic.isHaveLine(lineNum)){
		return next(null, {code: 500, error: '选线出错'});
	}
	//获取游戏信息
	const {uid, nid, roomCode, isVip, viper} = require('../../../domain/games/util').sessionInfo(session);
	const env = viper == null ? 'system' : viper;
	const _this = this;

	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid}, function(err, game){
		if(!game){
			return next(null, {code: 500, error:'获取游戏信息失败 games.slots777Handler.start'});
		}
		// 获取房间
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'游戏房间未找到  games.slots777Handler.start'});
		}
		// 玩家的所有押注金额
		const totalBet = bet * lineNum;
		if(totalBet <= 0){
			return next(null, {code: 500, error: '下注金额有误'});
		}
		//获取玩家信息
		_this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
			if(!player){
				return next(null, {code: 500, error: '获取玩家信息失败 games.slots777Handler.start'});	
			}
			const moneyType  = isVip ? 'integral' : 'gold';
			const deductMoney = isVip ? player.integral - totalBet : player.gold - totalBet;
			if(bet > player.unlock[nid][env]){
				return next(null, {code: 500, error: '该押注倍数尚未解锁'});
			}
			if(deductMoney < 0){
				return next(null, {code: 500, error: '玩家'+ (isVip ? '积分': '金币')+'不足'});
			}
			// 扣除vip房主的 点数
			if(isVip && session.get('model') == 'common'){
				const reduceNum = -(game.removalTime + game.pumpingRate * totalBet);
				_this.app.rpc.hall.playerRemote.updateUserEffectTime(session, session.get('viper'), {num: reduceNum}, function(){});
			}
			//扣钱处理
			_this.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: deductMoney}, function(err,player){
				if(err){
					return next(null,{code: 500, error:'扣钱失败 games.slots777Handler.start'});
				}

				_this.app.rpc.hall.playerRemote.recordCoin(session, {uid,nickname:player.nickname,coinType:moneyType,integral:player.integral,gold:player.gold,changeNum:'-'+totalBet,changeType:1},function(){});

				//向奖池添加钱
				//const totalToJackpot = totalBet * config.jackpotMoney.jackpotOdds;
				//奖池分配
				// if(game.rooms.length == 1){
				// 	room.jackpot += totalToJackpot;
				// }else{
				// 	const distributeRooms = game.rooms.filter(room => room.roomCode != roomCode && room.open).sort((r1,r2) => r1.jackpot - r2.jackpot);
				// 	distributeRooms.unshift(room);
				// 	const allots = require('../../../domain/games/util').jackpotAllot(totalToJackpot, distributeRooms.length, room.jackpot)
				// 	distributeRooms.forEach((r, i) =>{
				// 		if(i == 0){
				// 			room.jackpot += allots[i];
				// 		}else{
				// 			_this.app.rpc.hall.gameRemote.udtGameRoom(null, {nid, roomCode: r.roomCode, viper: session.get('viper'), changeMoney: true}, {count: allots[i] || 0, channel: 'jackpot'},function(){});
				// 		}
				// 	});
				// }
				room.runningPool += totalBet * 0.95;
				room.profitPool += totalBet * 0.05;
				room.consumeTotal += totalBet;

				//游戏记录
				const gameRecord = player.gamesRecord[isVip ? 'platform' : 'system'];
				if(gameRecord['slots777'] == null){
					gameRecord['slots777'] = {
						record: [],
						winTotal: 0,
						betTotal: 0,
						newer: true,
						number: 0,     //玩家自上次充钱以来所玩的把数
						maxWin: 0,
						winNum: 0,
						profitWinNum: 0,
						rebate:{
							'0.15': 0,
							'0.55': 0,
							'0.95': 0,
							'2.1': 0,
							'4': 0,
							'7.5': 0,
							'10': 0,
						},
					};
				}
				if(gameRecord['slots777'].rebate == null){
					gameRecord['slots777'].maxWin = 0;
					gameRecord['slots777'].winNum = 0;
					gameRecord['slots777'].profitWinNum = 0;
					gameRecord['slots777'].rebate = {
						'0.15': 0,
						'0.55': 0,
						'0.95': 0,
						'2.1': 0,
						'4': 0,
						'7.5': 0,
						'10': 0,
					}
				}
				//从内存中读取玩家游戏信息
				const envRecord = isVip ? memory.vipRecord : memory.record;
				if(util.isVoid(envRecord[uid])){
					envRecord[uid] = {
						bet: null,
						totalWin: 0,
						totalBet: 0,
						record: [],
						nextUse: '1',
						time: 0,
					};
				}

				//按照游戏配置生成窗口
				let getWindow, canjackpot = false, envAward, realBreak;
				if(room.jackpot > 750 * bet * 3){
					canjackpot = true;
				}
				if(gameRecord['slots777'].newer){  //新人调控
					envRecord[uid].nextUse = '1';
					getWindow = logic.generatorWindow({newer: gameRecord['slots777'].newer, jackpot: room.jackpot, canjackpot});
				}else{
					const curRoulette = logic.selectRoulette(envRecord[uid].nextUse);
					envRecord[uid].nextUse = curRoulette;

					// 整体调控
					let wholeRegulation;
					//if(['1', '2'].includes(curRoulette)){
						const allRewardRate = memory.moneyChange.totalBet == 0 ? 0 : Number((memory.moneyChange.totalWin / memory.moneyChange.totalBet).toFixed(5));
						//console.log('整体返奖率.................',allRewardRate)
						if(allRewardRate > 0.95){
							wholeRegulation = true;
						}
					//}

					// 放奖调控
					let awardRegulation;
					const ENV = isVip ? 'vip': 'system';
					const awardEnv = (isVip) =>{
						if(!isVip){
							if(config.awardRegulation[ENV][roomCode] == null){
								config.awardRegulation[ENV][roomCode] = {
									lastTime: 0,  //上次放奖结束时间
									awardState: false,  //是否处于放奖状态
									readyAwardTime: 0,  //准备放奖时间
									readyAward: false, //准备放奖
									jackpotBaseLine: null,  //停止放奖线
									initJackpot: null,   //初始奖池
									breakdown: {            //击穿
										status: false,   
										encourage: 0,      
									},
								};
							}
							return config.awardRegulation[ENV][roomCode];
						}else{
							const viper = session.get('viper');
							if(config.awardRegulation[ENV][viper] == null){
								config.awardRegulation[ENV][viper] = {};
							}
							if(config.awardRegulation[ENV][viper][roomCode] == null){
								config.awardRegulation[ENV][viper][roomCode] = {
									lastTime: 0,            //上次放奖结束时间
									awardState: false,      //是否处于放奖状态
									readyAwardTime: 0,      //准备放奖时间
									readyAward: false,      //准备放奖
									jackpotBaseLine: null,  //停止放奖线
									initJackpot: null,      //初始奖池
									breakdown: {            //击穿
										status: false,   
										encourage: 0,      
									},
								};
							}
							return config.awardRegulation[ENV][viper][roomCode];
						}
					};
					envAward = awardEnv(isVip);
					let {lastTime, awardState, jackpotBaseLine, readyAwardTime, readyAward, initJackpot} = envAward;
					if(jackpotBaseLine == null){
						envAward.jackpotBaseLine = room.jackpot;
						jackpotBaseLine = room.jackpot;
					}
					if(initJackpot == null){
						envAward.initJackpot = jackpotBaseLine;
					}
					if(awardState){   //放奖阶段 直接放奖
						awardRegulation = true;
					}else{
						if(Date.now() > readyAwardTime && readyAward){
							awardRegulation = true;
							envAward.awardState = true;
						}else{
							if((room.jackpot-jackpotBaseLine)>jackpotBaseLine*0.001 && (Date.now() - lastTime) > 60 * 1000){
								envAward.readyAwardTime = Date.now() + util.random(5*1000, 300*1000);
								envAward.readyAward = true;
								envAward.jackpotBaseLine += (room.jackpot-jackpotBaseLine) * 0.1;
							}else if((Date.now() - lastTime) > 5 * 60 * 1000 && (Date.now() - lastTime) < 15 * 60 * 1000 && (room.jackpot - envAward.initJackpot) > 100*room.users.length){
								envAward.readyAwardTime = Date.now() + util.random(5*1000, 300*1000);
								envAward.readyAward = true;
								envAward.jackpotBaseLine += (room.jackpot-jackpotBaseLine) * 0.1;
							}
						}
					}
					// if(!['1', '2'].includes(curRoulette)){
					// 	awardRegulation = false;
					// }

					//个体调控  返奖期不触发
					let individualRegulation1, individualRegulation2;
					if(!awardRegulation && curRoulette != '1'){
						if(envRecord[uid].record.length >= 10){
							const individualRewardRate = envRecord[uid].totalBet == 0 ? 0 : Number((envRecord[uid].totalWin / envRecord[uid].totalBet).toFixed(5));						
							if(individualRewardRate > 0.9 || envRecord[uid].bet != totalBet){
								envRecord[uid].record = [];
								envRecord[uid].totalBet = 0;
								envRecord[uid].totalWin = 0;
							}
							const gt = curRoulette == '1' ? 0.75 : curRoulette == '2' ? 0.45 : 0.25;
							const lt = curRoulette == '1' ? 0.55 : curRoulette == '2' ? 0.25: 0.05;
							if(individualRewardRate < gt && individualRewardRate > lt){
								individualRegulation1 = true;
							}else if(individualRewardRate <= lt){
								individualRegulation2 = true;
							}
						}
					}

					//奖池击穿
					// if(room.jackpot > 10000000 && !awardRegulation && envAward.breakdown.status == false){
					// 	envAward.breakdown.status = true;
					// 	envAward.breakdown.encourage = room.jackpot * 0.5;
					// }
					console.error('==============',envAward.breakdown)
					if(envAward.breakdown.status && envAward.breakdown.encourage > (750 * bet + (room.jackpot - 750 * bet) * 0.00025 * bet / 5)){
						//选择一根中奖线
						const linePosition = util.random(0, lineNum - 1);
						realBreak = true;
						getWindow = logic.generatorWindow({maxAward: true, linePosition, curRoulette});
					}else{
						getWindow = logic.generatorWindow({curRoulette, wholeRegulation, individualRegulation1, individualRegulation2, jackpot: room.jackpot, canjackpot, awardRegulation});
					}
				}

				//计算该窗口的赢钱情况
				let totalWin, jackpotWin, jackpotType, winLines, isBigWin;
				const windowResult = logic.windowAward({winIds : getWindow, bet, lineNum, roomJackpot: room.jackpot});
				totalWin = windowResult.totalWin;
				jackpotType = windowResult._jackpotType;
				winLines = windowResult.winLines;
				jackpotWin = windowResult.jackpotWin;
				
				//判断能否中联机大奖
				let canOnlineAward = require('../../../domain/games/util').dealOnlineAward(totalBet, game.onlineAwards);
				let onlineAward = 0;
				if(canOnlineAward){
					onlineAward = game.onlineAwards;
					totalWin += onlineAward;
					game.onlineAwards = 0;
					_this.app.rpc.hall.gameRemote.udtGame(null, {nid, viper}, {onlineAwards: game.onlineAwards}, function(){});
				}
				// 大奖要从奖池扣钱
				room.jackpot -= jackpotWin;
				//击穿判断
				if(envAward && envAward.breakdown.status){
					if(realBreak){
						envAward.breakdown.encourage -= jackpotWin;
					}else{
						if(jackpotWin >= envAward.breakdown.encourage || envAward.breakdown.encourage < (750 * 5 + (room.jackpot - 750 * 5) * 0.00025 * 5 / 5) || room.jackpot <= envAward.breakdown.encourage){
							room.profitPool += room.jackpot;
							room.jackpot = 0;
							envAward.breakdown.status = false;
						}
					}
				}

				if(totalWin >= totalBet * 20){
					isBigWin = true;
				}
				if(jackpotType == 'colossal'){  // 爆机
					room.boomNum++;
				}
				if(isBigWin){  // 大奖公告
					msgService.notice({route: 'onBigWin',game: {
						nid:game.nid, nickname: player.nickname, name: game.zname, num: totalWin, moneyType: moneyType == 'integral' ? '积分' : '金币', odd: Math.floor(totalWin / totalBet)
					}, VIP_ENV: isVip, uid, session: session},function(){});
				}
				room.winTotal += totalWin;
				//除jackpot奖之外的钱走 流水池
				room.runningPool -= (totalWin - jackpotWin - onlineAward);

				player[moneyType] += totalWin;
				//记录中奖记录
				_this.app.rpc.hall.playerRemote.recordCoin(session, {uid,nickname:player.nickname,coinType:moneyType,integral:player.integral,gold:player.gold,changeNum:'+'+totalWin,changeType:2},function(){});

				if(gameRecord['slots777'].number > 30){
					gameRecord['slots777'].newer = false;
				}
				memory.moneyChange.totalBet += totalBet;
				memory.moneyChange.totalWin += totalWin;

				envRecord[uid].record.push({bet: totalBet, win: totalWin});
				envRecord[uid].totalBet += totalBet;
				envRecord[uid].totalWin += totalWin;
				gameRecord['slots777'].winTotal += totalWin;
				gameRecord['slots777'].betTotal += totalBet;
				gameRecord['slots777'].record.push({bet: totalBet, win: totalWin});
				gameRecord['slots777'].number++;
				if(totalWin > gameRecord['slots777'].maxWin){
					gameRecord['slots777'].maxWin = totalWin;
				}
				if(totalWin > 0){
					gameRecord['slots777'].winNum++;
				}
				if(totalWin > totalBet){
					gameRecord['slots777'].profitWinNum++;
				}

				//对于金币场,添加游戏记录
				if(!isVip){
					if(totalBet > totalWin){
						player.selfBank += totalBet - totalWin;
					}
					const gameRecordModel = require('../../../../app/utils/db/mongodb').getDao('game_record');
					gameRecordModel.create({
						uid: uid,
						nickname: player.nickname,
						nid:nid,
						gname: '777',
						createTime: Date.now(),
						input: totalBet,
						multiple: windowResult.multiple,
						profit: totalWin - totalBet,
						selfGold:player.gold,
					},function(err, data){
						if(err){
							console.error('创建游戏记录失败 games.slots777Handler.start');
						}
					});
				}
				//增加玩家赢钱到社交点奖池
				room.socialDot += totalWin * 0.1;
				room.matchDot += totalWin * 0.1;
				player.slotsGameEarnings += totalWin * 0.1;
				room.runningPool -= totalWin * 0.1;
				if(totalWin > 0){
					//给房间内的玩家推送赢钱信息
					msgService.pushMessageByUids('slots777.userGain', {
						uid,
						win: totalWin,
						count: player.slotsGameEarnings,
						socialDot: room.socialDot,
						gteTen: totalWin >= totalBet * 10,
					}, room.users.map(u =>{
						return {uid: u.uid, sid: u.sid};
					}));
				}
				//最大押注倍数解锁
				if(player[moneyType] * 0.1 >= player.unlock[nid][env] * 25){
					player.unlock[nid][env] = Math.floor(player[moneyType] * 0.1 * 0.04);
					if(player.unlock[nid][env] > 10000){
						player.unlock[nid][env] = 10000;
					}
					msgService.pushMessageByUids('onUnlockMaxBet', {
						maxBet: player.unlock[nid][env],
					}, [{uid, sid: player.sid}]);
				}
				//const rate = gameRecord['slots777'].winTotal / gameRecord['slots777'].betTotal;
				const rate = totalWin / totalBet;
	
				if(rate < 0.3){
					gameRecord['slots777'].rebate['0.15']++;
				}else if(rate >= 0.3 && rate < 0.7){
					gameRecord['slots777'].rebate['0.55']++;
				}else if(rate >= 0.7 && rate < 1.2){
					gameRecord['slots777'].rebate['0.95']++;
				}else if(rate >= 1.2 && rate < 3){
					gameRecord['slots777'].rebate['2.1']++;
				}else if(rate >= 3 && rate < 5){
					gameRecord['slots777'].rebate['4']++;
				}else if(rate >= 5 && rate < 10){
					gameRecord['slots777'].rebate['7.5']++;
				}else if(rate >= 10){
					gameRecord['slots777'].rebate['10']++;
				}
				const test = {
					'1': gameRecord['slots777'].winTotal,
					'2': gameRecord['slots777'].winTotal / gameRecord['slots777'].betTotal,
					'3': gameRecord['slots777'].maxWin,
					'4': gameRecord['slots777'].winNum,
					'5': room.jackpot,
					'6': room.runningPool,
					'7': room.profitPool,
					'8': gameRecord['slots777'].profitWinNum,
					'9': gameRecord['slots777'].rebate
				}
				//更新玩家以及房间信息
				_this.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: player[moneyType], gamesRecord: player.gamesRecord,selfBank:player.selfBank, roomProfit: isVip ? (player.roomProfit + totalWin - totalBet) : 0, slotsGameEarnings: player.slotsGameEarnings, unlock:player.unlock}, function(){});
				_this.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid}, {jackpot: room.jackpot, consumeTotal: room.consumeTotal, winTotal: room.winTotal, boomNum: room.boomNum, runningPool: room.runningPool, profitPool: room.profitPool, socialDot: room.socialDot, matchDot: room.matchDot},function(){});
				
				envRecord[uid].time = Date.now(); 
				return next(null, {code:200, getWindow, totalWin, jackpotType, winLines, jackpotWin, isBigWin, test, canOnlineAward, onlineAward});
			});
		})
	});
};

/**
 * 申请奖池信息
 * @route: games.slots777Handler.jackpotFund
 */
slots777Handler.prototype.jackpotFund = function({}, session, next) {
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const nid = session.get('game');
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid: session.uid}, function(err, game){
		if(!game || err){
			return next(null, {code: 500, error:'获取游戏信息失败 games.slots777Handler.jackpotFund'});
		}
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'获取游戏房间信息失败 games.slots777Handler.jackpotFund'});
		}
		const jackpotFund = parseInt(room.jackpot);
		return next(null, {code:200, jackpotFund, runningPool: room.runningPool, profit: room.profitPool});
	});
};


slots777Handler.prototype.setJackpot = function({jackpotNum,runNum, profitNum}, session, next) {
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const nid = session.get('game');
	const uid = session.uid;
	const _this = this;
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid: session.uid}, function(err, game){
		if(!game || err){
			return next(null, {code: 500, error:'获取游戏信息失败 games.slots777Handler.jackpotFund'});
		}
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'获取游戏信息失败 games.slots777Handler.jackpotFund'});
		}
		if(jackpotNum >= 0){
			room.jackpot = jackpotNum;
		}
		if(runNum >= 0){
			room.runningPool = runNum;
		}
		if(profitNum >= 0){
			room.profitPool = profitNum;
		}
		_this.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid}, {jackpot: room.jackpot, runningPool: room.runningPool, profitPool: room.profitPool},function(){});
		return next(null, {code:200, jackpot: room.jackpot, runningPool: room.runningPool, profitPool: room.profitPool});
	});
};