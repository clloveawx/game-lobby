'use strict';

const async = require('async');
const util = require('../../../utils');
const msgService = require('../../../services/MessageService');
const indiana = require('../../../domain/games/Indiana');
const config = indiana.config;
const logic = indiana.logic;
const memory = indiana.memory;
const pushGameRecord = require('../../../domain/games/util').gameRecord;

module.exports = function(app) {
	return new indianaHandler(app);
};

var indianaHandler = function(app) {
	this.app = app;
};

/**
 * 请求已获得的铲子数
 * @route: games.indianaHandler.initGame
 */
indianaHandler.prototype.initGame = function({}, session, next) {
	const isVip = session.get('VIP_ENV');
	const viper = session.get('viper');
	const roomCode = session.get('roomCode');
	const uid = session.uid;
	const env = isVip ? viper : 'system';
	if(roomCode == null){
		return next(null, {code: 500, error: '未在游戏房间中'});
	}
	if(isVip){
		if(config.shovelNum[env] == null){
			config.shovelNum[env] = {};
		}
		if(memory.viperMoneyChange[env] == null){
			memory.viperMoneyChange[env] = {};
		}
		if(memory.viperMoneyChange[env][roomCode] == null){
			memory.viperMoneyChange[env][roomCode] = {totalWin: 0, totalBet: 0, breakdown: {status: false, encourage: 0}};
		}
	}else{
		if(memory.moneyChange[roomCode] == null){
			memory.moneyChange[roomCode] = {totalBet: 0, totalWin: 0, breakdown: {status: false, encourage: 0}};
		}
	}
	if(config.shovelNum[env][roomCode] == null){
		config.shovelNum[env][roomCode] = {};
	}
	if(config.shovelNum[env][roomCode][uid] == null){
		config.shovelNum[env][roomCode][uid] = 0;
	}
	//从内存中读取玩家游戏信息
	if(isVip){
		if(memory.vipRecord[viper] == null){
			memory.vipRecord[viper] = {};
		}
	}
	const envRecord = isVip ? memory.vipRecord[viper] : memory.record;
	if(envRecord[roomCode] == null){
		envRecord[roomCode] = {};
	}
	if(util.isVoid(envRecord[roomCode][uid])){
		envRecord[roomCode][uid] = {
			shovelNum : 0, 
			profit : 0,
			totalWin: 0,
			totalBet: 0,
			record: [],
			littleGameJackpot: 0,
			lastUse: '1',
		};
	}
	const lv = logic.pass({shovelNum : config.shovelNum[env][roomCode][uid]}).toString();
	return next(null, {code: 200, shovelNum: config.shovelNum[env][roomCode][uid], profit: envRecord[roomCode][uid].profit, lv});
};

/**
 * 开始游戏
 * @route: games.indianaHandler.start
 */
indianaHandler.prototype.start = function({betNum, betOdd}, session, next) {
	if(betNum == null || betOdd == null){
		return next(null, {code: 500, error:'传入的参数有误'});
    }
    const stake = logic.isHaveBet({betNum, betOdd});
	if(stake !== true){
		return next(null, {code: 500, error: stake});
	}
	//获取游戏信息
	const nid = session.get('game');
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const viper = session.get('viper');
	const uid = session.uid;
    const _this = this;
    
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid}, function(err, game){
		if(!game){
			return next(null, {code: 500, error:'获取游戏信息失败 games.indianaHandler.start'});
		}
		// 获取房间
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'游戏房间未找到  games.indianaHandler.start'});
		}
		// 玩家的所有押注金额
		const totalBet = betNum * betOdd;
		if(totalBet <= 0){
			return next(null, {code: 500, error: '下注金额有误'});
		}
		//获取玩家信息
		_this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
			if(!player){
				return next(null, {code: 500, error: '获取玩家信息失败 games.indianaHandler.start'});	
			}
			const moneyType  = isVip ? 'integral' : 'gold';

			//从内存中读取玩家游戏信息
			const envRecord = isVip ? memory.vipRecord[session.get('viper')] : memory.record;
			const envMoneyChange = isVip ? memory.viperMoneyChange[session.get('viper')] : memory.moneyChange;

			//玩家自己的钱不够押注即从本场盈利中取
			let deductMoney, memoryMoney = envRecord[roomCode][uid].profit, overCapital = false;

			if(player[moneyType] - totalBet < 0){
				overCapital = true;
				if(player[moneyType] == 0){ //如果没钱了直接从盈利中取
					memoryMoney = envRecord[roomCode][uid].profit - totalBet;
				}else{
					memoryMoney = envRecord[roomCode][uid].profit - (totalBet - player[moneyType]);
				}
				deductMoney = 0;
			}else{
				deductMoney = player[moneyType] - totalBet;
			}

			if(memoryMoney < 0){
				return next(null, {code: 500, error: '玩家'+ (isVip ? '积分': '金币')+'不足'});
			}
			// 扣除vip房主的 点数
			if(isVip && session.get('model') == 'common'){
				const reduceNum = -(game.removalTime + game.pumpingRate * totalBet);
				_this.app.rpc.hall.playerRemote.updateUserEffectTime(session, session.get('viper'), {num: reduceNum}, function(){});
			}
			//小游戏奖池累积
			envRecord[roomCode][uid].littleGameJackpot += totalBet * 0.25;

			//扣钱处理
			_this.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: deductMoney}, function(err,player){
				if(err){
					return next(null,{code: 500, error:'扣钱失败 games.indianaHandler.start'});
				}
				//更新盈利中的钱(只有本金用完的情况下才会发生)
				if(overCapital){
					envRecord[roomCode][uid].profit = memoryMoney;
				}
				//向奖池添加钱
				const totalToJackpot = totalBet * config.jackpot.proportion;
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
                
				const pass = logic.pass({shovelNum : envRecord[roomCode][uid].shovelNum}).toString();

				let getWindow, finalResult, memoryWindow, curRouttle, realBreak;

				//游戏记录
				const gameRecord = player.gamesRecord[isVip ? 'platform' : 'system'];
				if(gameRecord['indiana'] == null){
					gameRecord['indiana'] = {
						record: [],
						winTotal: 0,
						betTotal: 0,
						newer: true,
						number: 0,     //玩家自上次充钱以来所玩的把数
					};
				}
				//console.log('现在的游戏场次...................',gameRecord['indiana'].number)
				if(gameRecord['indiana'].number >= 30){
					gameRecord['indiana'].newer = false;
				}

				// bonuse 调控
				const curJackpot = room.jackpot;
				let bonusLottery = false, bonusNum;
				if(curJackpot > 0 && curJackpot <= 100000){
					bonusNum = util.selectEle(config.bonusControl['1']);
				}else if(curJackpot > 100000 && curJackpot <= 1000000){
					bonusNum = util.selectEle(config.bonusControl['2']);
				}else if(curJackpot > 1000000 && curJackpot <= 10000000){
					bonusNum = util.selectEle(config.bonusControl['3']);
				}else if(curJackpot > 10000000){
					bonusNum = util.selectEle(config.bonusControl['4']);
				}else{
					bonusNum = 'void';
				}
				if(bonusNum != 'void'){
					bonusNum = Number(bonusNum);
					bonusLottery = true;
				}
				if(bonusLottery){   //bonus开奖
					getWindow = logic.noWinWindow(pass, bonusNum, 0);
					finalResult = logic.finalResult({winIds: getWindow.winIds, jackpotMoney: room.jackpot, pass, totalBet, only: 'S'});
				}else{

					//是否击穿奖池
					// if(room.jackpot > 10000000 && envMoneyChange[roomCode].breakdown.status == false){
					// 	envMoneyChange[roomCode].breakdown.status = true;
					// 	envMoneyChange[roomCode].breakdown.encourage = room.jackpot * 0.5;
					// }
					console.log('太空夺宝是否可以击穿奖池=========', envMoneyChange[roomCode].breakdown, totalBet * 7.5 + (room.jackpot - totalBet * 7.5) * 0.0008 * totalBet * 0.1)
					if(envMoneyChange[roomCode].breakdown.status && envMoneyChange[roomCode].breakdown.encourage > totalBet * 7.5 + (room.jackpot - totalBet * 7.5) * 0.0008 * totalBet * 0.1){
						realBreak = true;
						getWindow = logic.noWinWindow(pass, 4);
						finalResult = logic.finalResult({winIds : getWindow.winIds, jackpotMoney: room.jackpot, pass, totalBet, only: 'S'});
					}else{
						// 新玩家进行 新人调控
						if(gameRecord['indiana'].newer){
							curRouttle = envRecord[roomCode][uid].lastUse = '1';
							//根据新人调控规则 获取 赔率和窗口数
							const odd = util.selectEle(config.oddSelect[curRouttle]);
							const windowNum = util.selectEle(config.winning[odd]);
							memoryWindow = memory.windowRecord[pass][odd][windowNum];
							const memoryResult = util.clone(memoryWindow[Math.floor(Math.random() * memoryWindow.length)]);
							//console.log('新人有内存',memoryWindow, odd, windowNum)
							if(memoryResult != null){
								// console.log("新人有内存。。。。。。。。。",memoryResult)
								for(let i in memoryResult.awards){
									memoryResult.awards[i] *= totalBet;
								}
								for(let i in memoryResult.freeAwards){
									for(let j in memoryResult.freeAwards[i]){
										memoryResult.freeAwards[i][j] *= totalBet;
									}
								}
								for(let i in memoryResult.jackpotWin){
									memoryResult.jackpotWin[i] *= totalBet;
								}
								memoryResult.totalWin *= totalBet;
								finalResult = memoryResult;
							}else{
								// console.log('新人无内存')
								getWindow = logic.generatorWindow(pass, false);
								finalResult = logic.finalResult({winIds: getWindow.winIds, jackpotMoney: room.jackpot, pass, totalBet, only: getWindow.only});
							}
						}else{  //非新人
							curRouttle = envRecord[roomCode][uid].lastUse = logic.selectRoulette(envRecord[roomCode][uid].lastUse);
							
							const odd = util.selectEle(config.oddSelect[curRouttle]);
							const windowNum = util.selectEle(config.winning[odd]);
							memoryWindow = memory.windowRecord[pass][odd][windowNum];
							const memoryResult = util.clone(memoryWindow[Math.floor(Math.random() * memoryWindow.length)]);
							if(memoryResult != null){
								// console.log("新人有内存。。。。。。。。。",memoryResult)
								for(let i in memoryResult.awards){
									memoryResult.awards[i] *= totalBet;
								}
								for(let i in memoryResult.freeAwards){
									for(let j in memoryResult.freeAwards[i]){
										memoryResult.freeAwards[i][j] *= totalBet;
									}
								}
								for(let i in memoryResult.jackpotWin){
									memoryResult.jackpotWin[i] *= totalBet;
								}
								memoryResult.totalWin *= totalBet;
								finalResult = memoryResult;
							}else{
								// console.log('新人无内存')
								getWindow = logic.generatorWindow(pass, false);
								finalResult = logic.finalResult({winIds: getWindow.winIds, jackpotMoney: room.jackpot, pass, totalBet, only: getWindow.only});
							}
							//个体调控
							if(envRecord[roomCode][uid].record.length >= 10){
								const individualRewardRate = envRecord[roomCode][uid].totalBet == 0 ? 0 : Number((envRecord[roomCode][uid].totalWin / envRecord[roomCode][uid].totalBet).toFixed(5));						
								// console.log('个体返奖率=============',individualRewardRate)
								if(individualRewardRate > 0.6){
									envRecord[roomCode][uid].record = [];
									envRecord[roomCode][uid].totalBet = 0;
									envRecord[roomCode][uid].totalWin = 0;
								}
								if(individualRewardRate < 0.35 && individualRewardRate > 0.15){
									if(Math.random() < 0.5){
										getWindow = logic.noWinWindow(pass, 0, 1);
										finalResult = logic.finalResult({winIds: getWindow.winIds, jackpotMoney: room.jackpot, pass, totalBet, only: 'F'});
									}
								}else if(finalResult.totalWin == 0 && finalResult.shovelNum == 0){
									if(individualRewardRate < 0.15){
										getWindow = logic.noWinWindow(pass, 0, 1);
										finalResult = logic.finalResult({winIds: getWindow.winIds, jackpotMoney: room.jackpot, pass, totalBet, only: 'F'});
									}
								}	
							}
						}
					}
				}

				//判断能否中联机大奖
				let canOnlineAward = require('../../../domain/games/util').dealOnlineAward(totalBet, game.onlineAwards);
				let onlineAward = 0;
				if(canOnlineAward){
					onlineAward = game.onlineAwards;
					finalResult.totalWin += onlineAward;
					game.onlineAwards = 0;
					_this.app.rpc.hall.gameRemote.udtGame(null, {nid, viper}, {onlineAwards: game.onlineAwards}, function(){});
				}

				envMoneyChange[roomCode].totalBet += totalBet;
				envMoneyChange[roomCode].totalWin += finalResult.totalWin;

				envRecord[roomCode][uid].record.push({bet: totalBet, win: finalResult.totalWin});
				envRecord[roomCode][uid].totalBet += totalBet;
				envRecord[roomCode][uid].totalWin += finalResult.totalWin;
				gameRecord['indiana'].winTotal += finalResult.totalWin;
				gameRecord['indiana'].betTotal += totalBet;
				//winston.error(`${uid} `, (gameRecord['indiana'].winTotal / gameRecord['indiana'].betTotal).toFixed(3))
				gameRecord['indiana'].record.push({bet: totalBet, win: finalResult.totalWin});
				gameRecord['indiana'].number++;

				//奖池扣大奖
				const jWin = finalResult.jackpotWin.reduce((num, v)=> num + v, 0);
				room.jackpot -= jWin;
				if(jWin > 0){
					finalResult.awards[0] += jWin;
				}

				if(envMoneyChange[roomCode].breakdown.status){
					if(realBreak){
						envMoneyChange[roomCode].breakdown.encourage -= jWin;
					}else{
						if(jWin >= envMoneyChange[roomCode].breakdown.encourage || envMoneyChange[roomCode].breakdown.encourage < (7.5 * 100 + (room.jackpot - 7.5 * 100) * 0.0008 * 100 * 0.1) || room.jackpot <= envMoneyChange[roomCode].breakdown.encourage){
							room.profitPool += room.jackpot;
							room.jackpot = 0;
							envMoneyChange[roomCode].breakdown.status = false;
						}
					}
				}

				room.runningPool -= (finalResult.totalWin - jWin - onlineAward);
				
				if(finalResult.jackpotTypes.length > 0){
					finalResult.jackpotTypes.forEach((type, i) =>{
						const jackpotType = type == 'king' ? 'colossal' : (type == 'diamond' ? 'monster' : (type == 'platinum' ? 'mega' : 'mini'));
						msgService.notice({route: 'onJackpotWin',game: {
							nid:game.nid, nickname: player.nickname, name: game.zname, num: finalResult.jackpotWin[i], jackpotType, moneyType: moneyType == 'integral' ? '积分' : '金币'
						}, VIP_ENV: isVip, uid, session: session});
					});
				}

				let isBigWin = false;
				if(finalResult.totalWin >= totalBet * 20){
					isBigWin = true;
				}
				if(isBigWin){  // 大奖公告
					msgService.notice({route: 'onBigWin',game: {
						nid:game.nid, nickname: player.nickname, name: game.zname, num: finalResult.totalWin, moneyType: moneyType == 'integral' ? '积分' : '金币', odd: Math.fllor(finalResult.totalWin / totalBet)
					}, VIP_ENV: isVip, uid, session: session},function(){});
				}
				if(finalResult.jackpotTypes[0] == 'king'){  // 爆机
					room.boomNum++;
				}

				room.winTotal += finalResult.totalWin;
				//将玩家的盈利放入盈利累积
				envRecord[roomCode][uid].profit += finalResult.totalWin;
				envRecord[roomCode][uid].shovelNum += finalResult.shovelNum;
				config.shovelNum[isVip ? session.get('viper') : 'system'][roomCode][uid] += finalResult.shovelNum;
				if(config.shovelNum[isVip ? session.get('viper') : 'system'][roomCode][uid] == 45){
					config.shovelNum[isVip ? session.get('viper') : 'system'][roomCode][uid] = 0;
				}
				if(envRecord[roomCode][uid].shovelNum == 45){
					envRecord[roomCode][uid].shovelNum = 0;
				}
				const nextPass = logic.pass({shovelNum : envRecord[roomCode][uid].shovelNum}).toString();
				_this.app.rpc.hall.playerRemote.updateUser(session, uid, {gamesRecord: player.gamesRecord, roomProfit: isVip ? (player.roomProfit + finalResult.totalWin - totalBet) : 0}, function(){});
				//更新房间信息
				_this.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid}, {jackpot: room.jackpot, consumeTotal: room.consumeTotal, winTotal: room.winTotal, boomNum: room.boomNum, runningPool: room.runningPool, profitPool: room.profitPool},function(){});

				let isCanPass = false;
				const littleGame = {};
				let littleGameWin = 0;
				if(nextPass != pass){
					isCanPass = true;

					const winIds = logic.littlerGameWindow(pass);
					const littleResult = logic.littlerGameResult(pass);
					const num = util.clone(config.littleGame[pass].num);
					let supply = {};
					for(let i in num){
						supply[i] = num[i];
						if(littleResult[i] != null){
							supply[i] -= littleResult[i];
						}
					}
					memory.littleGame[uid] = {
						window: winIds,
						result: littleResult,
						supply,
						initMoney: envRecord[roomCode][uid].littleGameJackpot,
					};
					littleGame.initMoney = envRecord[roomCode][uid].littleGameJackpot;
					//重置小游戏奖池累积
					envRecord[roomCode][uid].littleGameJackpot = 0;

					littleGame.winIds = winIds;

					//此时将小游戏的盈利放入
					for(let i in littleResult){
						if(i == 'gold'){
							envRecord[roomCode][uid].profit += littleResult[i] * memory.littleGame[uid].initMoney;
							envMoneyChange[roomCode].totalWin += littleResult[i] * memory.littleGame[uid].initMoney;
							room.runningPool -= littleResult[i] * memory.littleGame[uid].initMoney;
							littleGameWin += littleResult[i] * memory.littleGame[uid].initMoney;
						}
						if(i == 'silver'){
							envRecord[roomCode][uid].profit += parseInt(littleResult[i] * memory.littleGame[uid].initMoney  * 0.2);
							envMoneyChange[roomCode].totalWin += parseInt(littleResult[i] * memory.littleGame[uid].initMoney  * 0.2);
							room.runningPool -= parseInt(littleResult[i] * memory.littleGame[uid].initMoney  * 0.2);
							littleGameWin += parseInt(littleResult[i] * memory.littleGame[uid].initMoney  * 0.2);
						}
					}
					room.winTotal += littleGameWin;
					gameRecord['indiana'].winTotal += littleGameWin;
					!isVip && pushGameRecord({uid,nickname: player.nickname, gname:'太空',nid:nid, createTime: Date.now(), input: 0, multiple: 10, profit: littleGameWin});
					
					//更新房间信息
					_this.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid}, {jackpot: room.jackpot, consumeTotal: room.consumeTotal, winTotal: room.winTotal, boomNum: room.boomNum, runningPool: room.runningPool, profitPool: room.profitPool},function(){});
				}

				//对于金币场,添加游戏记录
				if(!isVip){
					if(totalBet > finalResult.totalWin){
						player.selfBank += totalBet - finalResult.totalWin;
					}
					const gameRecordModel = require('../../../../app/utils/db/mongodb').getDao('game_record');
					gameRecordModel.create({
						uid: uid,
						nickname: player.nickname,
						nid:nid,
						createTime: Date.now(),
						gname:'太空',
						input: totalBet,
						multiple: ((finalResult.totalWin - jWin) / totalBet).toFixed(1),
						profit: finalResult.totalWin + littleGameWin - totalBet,
						selfGold:player.gold
					},function(err, data){
						if(err){
							console.error('创建游戏记录失败 games.indianaHandler.start');
						}
					});
				}

				if(pass == '3' && nextPass == '1'){
					player[moneyType] += envRecord[roomCode][uid].profit;
					envRecord[roomCode][uid].shovelNum = 0;
					config.shovelNum[isVip ? session.get('viper') : 'system'][roomCode][uid] = 0;
					envRecord[roomCode][uid].profit = 0;
					_this.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: player[moneyType],selfBank:player.selfBank}, function(){});
					return next(null, {code:200, shovelCounts: envRecord[roomCode][uid].shovelNum, result: finalResult, pass: nextPass, isCanPass, littleGame, [moneyType]: parseInt(deductMoney), canOnlineAward, onlineAward});
				}
				return next(null, {code:200, shovelCounts: envRecord[roomCode][uid].shovelNum, result: finalResult, pass: nextPass, isCanPass, littleGame, [moneyType]: parseInt(deductMoney), canOnlineAward, onlineAward});
			});
		})
	});
};

/**
 * 小游戏点击
 * @route: games.indianaHandler.click
 * @param {position}  eg: [2,1]
 */
indianaHandler.prototype.click = function({position}, session, next) {
	if(!position){
		return next(null, {code: 500, error: '请传入点击位置'});
	}
	const uid = session.uid;
	const isVip = session.get('VIP_ENV');
	const envRecord = isVip ? memory.vipRecord : memory.record;

	let useruserLittleGame = memory.littleGame[uid];
	if(util.isVoid(useruserLittleGame)){
		return next(null, {code: 500, error: '小游戏已结束！'})
	}
	const result = logic.click(position, useruserLittleGame);
	if(result.open == 'boom'){
		memory.littleGame[uid] = undefined;
	}
	//将赢的钱放入 盈利
	//envRecord[uid].profit += result.award;
	return next(null, {code:200, result});
};

/**
 * 申请奖池信息
 * @route: games.indianaHandler.jackpotFund
 */
indianaHandler.prototype.jackpotFund = function({}, session, next) {
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const nid = session.get('game');
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid: session.uid}, function(err, game){
		if(!game || err){
			return next(null, {code: 500, error:'获取游戏信息失败 games.indianaHandler.jackpotFund'});
		}
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'获取游戏房间信息失败 games.indianaHandler.jackpotFund'});
		}
		const jackpotFund = parseInt(room.jackpot);
		return next(null, {code:200, jackpotFund, runningPool: room.runningPool, profit: room.profitPool});
	});
};

indianaHandler.prototype.setJackpot = function({jackpotNum,runNum, profitNum}, session, next) {
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const nid = session.get('game');
	const uid = session.uid;
	const _this = this;
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid: session.uid}, function(err, game){
		if(!game || err){
			return next(null, {code: 500, error:'获取游戏信息失败 games.indianaHandler.setJackpot'});
		}
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'获取游戏信息失败 games.indianaHandler.setJackpot'});
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