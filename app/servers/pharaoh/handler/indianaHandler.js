'use strict';

const util = require('../../../utils');
const msgService = require('../../../services/MessageService');
const indiana = require('../../../domain/games/egypt');
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
 * @route: pharaoh.indianaHandler.initGame
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
			littleGame: {},
			lastUse: '1',
		};
	}
	let littleGame = null;
	if(!util.isVoid(envRecord[roomCode][uid].littleGame)){
		littleGame = envRecord[roomCode][uid].littleGame;
	}
	const lv = logic.pass({shovelNum : config.shovelNum[env][roomCode][uid]}).toString();
	return next(null, {code: 200, shovelNum: config.shovelNum[env][roomCode][uid], profit: envRecord[roomCode][uid].profit, lv, littleGame});
};

/**
 * 开始游戏
 * @route: pharaoh.indianaHandler.start
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
	
	//从内存中读取玩家游戏信息
	const envRecord = isVip ? memory.vipRecord[session.get('viper')] : memory.record;
	const envMoneyChange = isVip ? memory.viperMoneyChange[session.get('viper')] : memory.moneyChange;
	if(!util.isVoid(envRecord[roomCode][uid].littleGame)){
		return next(null, {code: 500, error: '玩家存在未进行的小游戏'});
	}
	//let realShovelNum = 0;
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid}, function(err, game){
		if(!game){
			return next(null, {code: 500, error:'获取游戏信息失败 egypt.indianaHandler.start'});
		}
		// 获取房间
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'游戏房间未找到  egypt.indianaHandler.start'});
		}
		// 玩家的所有押注金额
		const totalBet = betNum * betOdd;
		if(totalBet <= 0){
			return next(null, {code: 500, error: '下注金额有误'});
		}
		//获取玩家信息
		_this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
			if(!player){
				return next(null, {code: 500, error: '获取玩家信息失败 egypt.indianaHandler.start'});	
			}
			const moneyType  = isVip ? 'integral' : 'gold';

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
			//扣钱处理
			_this.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: deductMoney}, function(err,player){
				if(err){
					return next(null,{code: 500, error:'扣钱失败 egypt.indianaHandler.start'});
				}
				//更新盈利中的钱(只有本金用完的情况下才会发生)
				if(overCapital){
					envRecord[roomCode][uid].profit = memoryMoney;
				}
				//填充小游戏奖池
				envRecord[roomCode][uid].littleGameJackpot += totalBet * 0.16;
				//向奖池添加钱
				//const totalToJackpot = totalBet * config.jackpot.proportion;
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
				if(gameRecord['egypt'] == null){
					gameRecord['egypt'] = {
						record: [],
						winTotal: 0,
						betTotal: 0,
						newer: true,
						number: 0,     //玩家自上次充钱以来所玩的把数
					};
				}
				if(gameRecord['egypt'].number > 3){
					gameRecord['egypt'].newer = false;
				}

				// bonuse 调控
				const curJackpot = room.jackpot;
				let bonusLottery = false, bonusNum;
				if(curJackpot < totalBet * 7.5){
					bonusNum = 'void';
				}else if(curJackpot > 0 && curJackpot <= 100000){
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
					getWindow = logic.noWinWindow(pass, bonusNum);
					//realShovelNum = 0;
					finalResult = logic.finalResult({winIds: getWindow.winIds, jackpotMoney: room.jackpot, pass, totalBet, only: 'S'});
				}else{
					//是否击穿奖池
					// if(room.jackpot > 10000000 && envMoneyChange[roomCode].breakdown.status == false){
					// 	envMoneyChange[roomCode].breakdown.status = true;
					// 	envMoneyChange[roomCode].breakdown.encourage = room.jackpot * 0.5;
					// }
					console.log('埃及是否可以击穿奖池=========', envMoneyChange[roomCode].breakdown, totalBet * 7.5 + (room.jackpot - totalBet * 7.5) * 0.0008 * totalBet * 0.1)
					if(envMoneyChange[roomCode].breakdown.status && envMoneyChange[roomCode].breakdown.encourage > totalBet * 7.5 + (room.jackpot - totalBet * 7.5) * 0.0008 * totalBet * 0.1){
						realBreak = true;
						getWindow = logic.noWinWindow(pass, 4);
						finalResult = logic.finalResult({winIds : getWindow.winIds, jackpotMoney: room.jackpot, pass, totalBet, only: 'S'});
					}else{
						// 新玩家进行 新人调控
						if(gameRecord['egypt'].newer){
							//根据新人调控规则 获取 赔率和窗口数
							curRouttle = envRecord[roomCode][uid].lastUse = '1';
						}else{  //非新人
							//整体调控
							const allRewardRate = envMoneyChange[roomCode].totalBet == 0 ? 0 : Number((envMoneyChange[roomCode].totalWin / envMoneyChange[roomCode].totalBet).toFixed(5));
							console.log('整体返奖率.................',allRewardRate, envMoneyChange[roomCode].totalBet, envMoneyChange[roomCode].totalWin)
							if(allRewardRate > 0.85){
								curRouttle = envRecord[roomCode][uid].lastUse = '3';
							}else{
								curRouttle = envRecord[roomCode][uid].lastUse = logic.selectRoulette(envRecord[roomCode][uid].lastUse);
							}
						}
						const odd = util.selectEle(config.oddSelect[curRouttle][pass]);
						const windowNum = util.selectEle(config.winning[odd]);
						memoryWindow = memory.windowRecord[pass][odd][windowNum];
						const memoryResult = util.clone(memoryWindow[Math.floor(Math.random() * memoryWindow.length)]);
						if(memoryResult != null){
							console.log("有内存。。。。。。。。。")
							for(let i in memoryResult.awards){
								memoryResult.awards[i] *= totalBet;
							}
							let addJackpot = 0;
							for(let i in memoryResult.jackpotWin){
								addJackpot += memoryResult.jackpotWin[i] * totalBet * (room.jackpot / 1000 - 1);
								memoryResult.jackpotWin[i] += addJackpot; 

							}
							memoryResult.totalWin *= totalBet;
							memoryResult.totalWin += addJackpot;
							finalResult = memoryResult;
						}else{
							console.log('无内存.......................................')
							getWindow = logic.generatorWindow(pass);
							finalResult = logic.finalResult({winIds: getWindow.winIds, jackpotMoney: room.jackpot, pass, totalBet, only: getWindow.only});
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
				gameRecord['egypt'].winTotal += finalResult.totalWin;
				gameRecord['egypt'].betTotal += totalBet;
				gameRecord['egypt'].record.push({bet: totalBet, win: finalResult.totalWin});
				gameRecord['egypt'].number++;
				//奖池扣大奖
				let jWin = finalResult.jackpotWin.reduce((num, v)=> num + v, 0);
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
						nid:game.nid, nickname: player.nickname, name: game.zname, num: finalResult.totalWin, moneyType: moneyType == 'integral' ? '积分' : '金币', odd: Math.floor(finalResult.totalWin / totalBet),
					}, VIP_ENV: isVip, uid, session: session},function(){});
				}
				if(finalResult.jackpotTypes[0] == 'king'){  // 爆机
					room.boomNum++;
				}

				room.winTotal += finalResult.totalWin;
				//将玩家的盈利放入盈利累积
				envRecord[roomCode][uid].profit += util.Int(finalResult.totalWin);
				envRecord[roomCode][uid].shovelNum += finalResult.shovelNum;
				config.shovelNum[isVip ? session.get('viper') : 'system'][roomCode][uid] += finalResult.shovelNum;
				if(config.shovelNum[isVip ? session.get('viper') : 'system'][roomCode][uid] >= 45){
					config.shovelNum[isVip ? session.get('viper') : 'system'][roomCode][uid] = 0;
				}
				if(envRecord[roomCode][uid].shovelNum >= 45){
					envRecord[roomCode][uid].shovelNum = 0;
				}
				const nextPass = logic.pass({shovelNum : envRecord[roomCode][uid].shovelNum}).toString();
				_this.app.rpc.hall.playerRemote.updateUser(session, uid, {gamesRecord: player.gamesRecord, roomProfit: isVip ? (player.roomProfit + finalResult.totalWin - totalBet) : 0}, function(){});
				//更新房间信息
				_this.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid}, {jackpot: room.jackpot, consumeTotal: room.consumeTotal, winTotal: room.winTotal, boomNum: room.boomNum, runningPool: room.runningPool, profitPool: room.profitPool},function(){});
				
				let isCanPass = false;
				if(nextPass != pass){
					isCanPass = true;
					envRecord[roomCode][uid].littleGame = {
						activation: true,
						pass,
						curPosition: 0,  //当前步数
						historyPosition: [],  //历史位置
						gains: {gold: 0, silver: 0, copper: 0},
						restDice: 5,
						totalWin: 0,
						initMoney: envRecord[roomCode][uid].littleGameJackpot,
						bonusMoney: totalBet,
					};
					envRecord[roomCode][uid].littleGameJackpot = 0;
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
						gname:'埃及',
						input: totalBet,
						multiple: ((finalResult.totalWin - jWin) / totalBet).toFixed(1),
						profit: finalResult.totalWin - totalBet,
						selfGold:player.gold,
						playStatus: isCanPass ? 0 : 1,
					},function(err, data){
						if(err){
							console.error('创建游戏记录失败 egypt.indianaHandler.start');
						}
					});
				}

				return next(null, {code:200, curProfit:envRecord[roomCode][uid].profit, result: finalResult, pass: nextPass, isCanPass, littleGame: envRecord[roomCode][uid].littleGame, [moneyType]: parseInt(deductMoney), shovelNum: envRecord[roomCode][uid].shovelNum, canOnlineAward, onlineAward});
			});
		})
	});
};

/**
 * 小游戏点击
 * @route: pharaoh.indianaHandler.cast
 */
indianaHandler.prototype.cast = function({}, session, next) {

	const uid = session.uid;
	const isVip = session.get('VIP_ENV');
	const nid = session.get('game');
	const roomCode = session.get('roomCode');
	const moneyType  = isVip ? 'integral' : 'gold';
	const envRecord = isVip ? memory.vipRecord : memory.record;
	let userLittleGame = envRecord[roomCode][uid].littleGame;
	const envMoneyChange = isVip ? memory.viperMoneyChange[session.get('viper')] : memory.moneyChange;
	if(!userLittleGame || !userLittleGame.activation){   
		return next(null, {code: 500, error: '未激活小游戏'});
	}
	if(userLittleGame.restDice <= 0){
		return next(null, {code: 500, error: '投掷次数已用完'});
	}
	const littleGamePass = userLittleGame.pass;   //第几关的小游戏
	const _this = this;
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid}, function(err, game){
		if(!game){
			return next(null, {code: 500, error:'获取游戏信息失败 egypt.indianaHandler.cast'});
		}
		// 获取房间
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'游戏房间未找到  egypt.indianaHandler.cast'});
		}
		//获取玩家信息
		_this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
			if(!player){
				return next(null, {code: 500, error: '获取玩家信息失败 egypt.indianaHandler.cast'});	
			}
			const {result, jackpotWin, bigWinRoulette} = logic.cast(userLittleGame, room.jackpot);
			
			//更新房间信息
			room.winTotal += (result.award + jackpotWin);
			room.runningPool -= result.award;
			room.jackpot -= jackpotWin;
			_this.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid}, {jackpot: room.jackpot, winTotal: room.winTotal, runningPool: room.runningPool},function(){});
			//更新内存信息
			envRecord[roomCode][uid].totalWin += (result.award + jackpotWin);
			envMoneyChange[roomCode].totalWin += (result.award + jackpotWin);
			envRecord[roomCode][uid].profit += util.Int(result.award + jackpotWin);
			
			if(bigWinRoulette){   //轮盘大奖公告
				const type = bigWinRoulette == 'king' ? 'colossal' : (bigWinRoulette == 'diamond' ? 'monster' : (bigWinRoulette == 'platinum' ? 'mega' : 'mini'));
				msgService.notice({route: 'onJackpotWin',game: {
					nid:game.nid, nickname: player.nickname, name: game.zname, num: Math.floor(jackpotWin), jackpotType: type, moneyType: moneyType == 'integral' ? '积分' : '金币'
				}, VIP_ENV: isVip, uid, session: session});
			}
			if(userLittleGame.restDice == 0 || result.awardType == 'bonus'){
				!isVip && pushGameRecord({uid, nickname: player.nickname, gname: '埃及', nid, createTime: Date.now(), input: 0, multiple: 10, profit: userLittleGame.totalWin}, true);
				envRecord[roomCode][uid].littleGame = {};
				if(littleGamePass == '3'){    //说明通关
					const curProfit = envRecord[roomCode][uid].profit;
					player[moneyType] += envRecord[roomCode][uid].profit;
					envRecord[roomCode][uid].profit = 0;
					_this.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: player[moneyType], selfBank:player.selfBank}, function(){});
					return next(null, {code:200, result, [moneyType]: player[moneyType], curProfit, collect: true});
				}
			}
			return next(null, {code: 200, result, curProfit: envRecord[roomCode][uid].profit});
		});
	})
};

/**
 * 申请奖池信息
 * @route: pharaoh.indianaHandler.jackpotFund
 */
indianaHandler.prototype.jackpotFund = function({}, session, next) {
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const nid = session.get('game');
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid: session.uid}, function(err, game){
		if(!game || err){
			return next(null, {code: 500, error:'获取游戏信息失败 egypt.indianaHandler.jackpotFund'});
		}
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'获取游戏房间信息失败 egypt.indianaHandler.jackpotFund'});
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