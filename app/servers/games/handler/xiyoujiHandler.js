'use strict';

const util = require('../../../utils');
const msgService = require('../../../services/MessageService');
const xiyouji = require('../../../domain/games/xiyouji');
const config = xiyouji.config;
const logic = xiyouji.logic;
const memory = xiyouji.memory;
const pushGameRecord = require('../../../domain/games/util').gameRecord;

module.exports = function(app) {
	return new xiyoujiHandler(app);
};

var xiyoujiHandler = function(app) {
	this.app = app;
};

/**
 * 获取已获得的图标
 * @return {gainedScatter}
 * @route: games.xiyoujiHandler.gainedScatter
 */
xiyoujiHandler.prototype.gainedScatter = function({}, session, next){
	//获取游戏信息
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const viper = session.get('viper');
	if(isVip){
		if(memory.vip[viper] == null){
			memory.vip[viper] = {
				countQ: {},
				scatter: {},
				littleGame: {},
			};
		}
	}
	const memoryEnv = isVip ? memory.vip[viper] : memory.system;
	const uid = session.uid;
	if(memoryEnv.scatter[roomCode] == null){
		memoryEnv.scatter[roomCode] = {};
	}
	const userScatter = {};
	['5', '50', '250', '1000', '4000', '10000'].forEach(bet =>{
		if(memoryEnv.scatter[roomCode][bet] == null){
			memoryEnv.scatter[roomCode][bet] = {};
		}
		if(memoryEnv.scatter[roomCode][bet][uid] == null){
			memoryEnv.scatter[roomCode][bet][uid] = [];
		}
		userScatter[bet]= memoryEnv.scatter[roomCode][bet][uid]
	});
	return next(null, {code: 200, gainedScatter: userScatter});
};

/**
 *  开始游戏
 * @param {lineNum, bet} 线数、 押注倍数
 * @return {}
 * @route：games.xiyoujiHandler.start
 */
xiyoujiHandler.prototype.start = function ({lineNum, bet}, session, next) {
	if(lineNum == null || bet == null){
		return next(null, {code: 500, error:'传入的参数有误'});
	}
	if(!logic.isHaveLine(lineNum)){
		return next(null, {code: 500, error: '选线出错'});
	}
	//获取游戏信息
	const nid = session.get('game');
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const viper = session.get('viper');
	const memoryEnv = isVip ? memory.vip[viper] : memory.system;
	const uid = session.uid;
	const _this = this;
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid}, function(err, game){
		if(!game){
			return next(null, {code: 500, error:'获取游戏信息失败 games.xiyoujiHandler.start'});
		}
		// 获取房间
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'游戏房间未找到  games.xiyoujiHandler.start'});
		}
		// 玩家的所有押注金额
		const totalBet = bet * lineNum;
		if(totalBet <= 0){
			return next(null, {code: 500, error: '下注金额有误'});
		}
		//获取玩家信息
		_this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
			if(!player){
				return next(null, {code: 500, error: '获取玩家信息失败 games.xiyoujiHandler.start'});	
			}
			const moneyType  = isVip ? 'integral' : 'gold';
			const deductMoney = isVip ? player.integral - totalBet : player.gold - totalBet;
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
					return next(null,{code: 500, error:'扣钱失败 games.xiyoujiHandler.start'});
				}

				_this.app.rpc.hall.playerRemote.recordCoin(session, {uid,nickname:player.nickname,coinType:moneyType,integral:player.integral,gold:player.gold,changeNum:'-'+totalBet,changeType:1},function(){});

				//向奖池添加钱
				//const totalToJackpot = totalBet * 0.1;
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
				if(gameRecord['xiyouji'] == null){
					gameRecord['xiyouji'] = {
						record: [],
						winTotal: 0,
						betTotal: 0,
						newer: true,
						number: 0,     //玩家自上次充钱以来所玩的把数
					};
				}
				//从内存中读取玩家游戏信息
				const envRecord = isVip ? memory.vipRecord : memory.record;
				if(util.isVoid(envRecord[uid])){
					envRecord[uid] = {
						bet: null,
						totalWin: 0,
						totalBet: 0,
						record: [],
						lastUse: '1',
						time: 0,
						state: 1,  // 1：spin  2: 小游戏
					};
				}
				envRecord[uid].state = 1;
				//计算图标的生成概率
				if(memoryEnv.countQ[roomCode] == null){
					memoryEnv.countQ[roomCode] = {};
				}
				if(memoryEnv.countQ[roomCode][uid] == null){
					memoryEnv.countQ[roomCode][uid] = 0;
				}
				const scatterProbility = logic.scatterProbility(envRecord[uid].record, memoryEnv.countQ[roomCode][uid]);

				let curRoulette = require('../../../domain/games/util').selectRoulette(envRecord[uid].lastUse || '1');
				envRecord[uid].lastUse = curRoulette;


				//个体调控
				let individualRegulation1,individualRegulation2;
				if(envRecord[uid].record.length >= 10 && curRoulette != '1'){
					const individualRewardRate = envRecord[uid].totalBet == 0 ? 0 : Number((envRecord[uid].totalWin / envRecord[uid].totalBet).toFixed(5));						
					if(individualRewardRate > 0.85 || envRecord[uid].bet != totalBet){
						envRecord[uid].record = [];
						envRecord[uid].totalBet = 0;
						envRecord[uid].totalWin = 0;
					}
					const lt = curRoulette == '1' ? 0.75 : curRoulette == '2' ? 0.55 : 0.25;
					const gt = curRoulette == '1' ? 0.55 : curRoulette == '2' ? 0.35 : 0.05;
					if(individualRewardRate < lt && individualRewardRate > gt){
						individualRegulation1 = true;
					}
					if(individualRewardRate < gt){
						individualRegulation2 = true;
					}
				}

				// 整体调控
				let wholeRegulation;
				const allRewardRate = memory.moneyChange.totalBet == 0 ? 0 : Number((memory.moneyChange.totalWin / memory.moneyChange.totalBet).toFixed(5));
				if(allRewardRate > 0.95){
					wholeRegulation = true;
				}

				// 放奖调控
				let awardRegulation;
				const env = isVip ? 'vip': 'system';
				let envAward;
				const awardEnv = (isVip) =>{
					if(!isVip){
						if(config.awardRegulation[env][roomCode] == null){
							config.awardRegulation[env][roomCode] = {
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
						return config.awardRegulation[env][roomCode];
					}else{
						const viper = session.get('viper');
						if(config.awardRegulation[env][viper] == null){
							config.awardRegulation[env][viper] = {};
						}
						if(config.awardRegulation[env][viper][roomCode] == null){
							config.awardRegulation[env][viper][roomCode] = {
								lastTime: 0,          //上次放奖结束时间
								awardState: false,    //是否处于放奖状态
								readyAwardTime: 0,    //准备放奖时间
								readyAward: false,    //准备放奖
								jackpotBaseLine: null,  //停止放奖线
								initJackpot: null,      //初始奖池
								breakdown: {            //击穿
									status: false,   
									encourage: 0,      
								},
							};
						}
						return config.awardRegulation[env][viper][roomCode];
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
				// if(curRoulette == '3'){
				// 	wholeRegulation = false;
				// 	awardRegulation = false;
				// }
				if(awardRegulation){
					individualRegulation1 = false;
					individualRegulation2 = false;
				}

				let initWindow, realBreak;
				// console.log('=========================奖池', room.jackpot)
				//按照游戏配置生成窗口
				let gainedScatter = memoryEnv.scatter[roomCode][bet][uid];  //玩家已获得的图标
				//const initWindow = logic.generatorWindow({isFreespin:false, gainedScatter, scatterPro: scatterProbility, individualRegulation, wholeRegulation1, wholeRegulation2, awardRegulation, jackpot: room.jackpot, bet});  //第一轮的窗口信息
				
				//奖池击穿
				// if(room.jackpot > 10000000 && !awardRegulation && envAward.breakdown.status == false){
				// 	envAward.breakdown.status = true;
				// 	envAward.breakdown.encourage = room.jackpot * 0.5;
				// }
				console.error('==============',envAward.breakdown)
				let maxWin;
				if(envAward.breakdown.status && envAward.breakdown.encourage > 300 * bet){
					//选择一根中奖线
					const linePosition = util.random(0, lineNum - 1);
					realBreak = true;
					maxWin = true;
					initWindow = logic.generatorWindow({isFreespin:false, gainedScatter, scatterPro: scatterProbility, individualRegulation1, individualRegulation2, wholeRegulation, awardRegulation, jackpot: room.jackpot, bet, maxWin: true, linePosition, curRoulette});
				}else{
					initWindow = logic.generatorWindow({isFreespin:false, gainedScatter, scatterPro: scatterProbility, individualRegulation1, individualRegulation2, wholeRegulation, awardRegulation, jackpot: room.jackpot, bet, curRoulette});  //第一轮的窗口信息
				}

				// 从新计算Q的计数
				memoryEnv.countQ[roomCode][uid]++;
				if(initWindow.hasScatter){
					memoryEnv.countQ[roomCode][uid] = memoryEnv.countQ[roomCode][uid] <= 5 ? 0 : memoryEnv.countQ[roomCode][uid] - 5;   
				}
				
				//第一轮窗口导致的最终结果
				let multiple = 0;
				const finalResult = logic.finalResult({winIds: initWindow.winIds, bet, lineNum, bonusNum: initWindow.bonusNum, jackpot: room.jackpot, curRoulette, maxWin});
				const jackpotWin = finalResult.jackpotWin;
				room.jackpot -= jackpotWin;
				multiple += finalResult.multiple;
				const result =　{firstRound: initWindow.winEles, rounds: finalResult.rounds, luckyFiveLines: finalResult.luckyFiveLines, fiveLines: finalResult.fiveLines, roundsAward: finalResult.roundsAward, allTotalWin: finalResult.allTotalWin, canFreespin:initWindow.canFreespin, gainedScatter: initWindow.gainedScatter};
				memoryEnv.scatter[roomCode][bet][uid] = initWindow.gainedScatter;
				
				if(finalResult.luckyFiveLines){
					room.boomNum++;
				}

				if(initWindow.canFreespin){
					const freespinAwards = logic.dealFreespin(bet, lineNum, individualRegulation1, individualRegulation2, wholeRegulation, room.jackpot, curRoulette);
					if(freespinAwards.boom){
						room.boomNum++;
					}
					multiple += freespinAwards.multiple;
					result.freespins = freespinAwards.freespins;
					result.freespinAllTotalWin = freespinAwards.allTotalWin;
					result.freespinAllJackpotWin = freespinAwards.allJackpotWin;
				}
				//此局游戏总赢(包括freespin)
				let totalWin = result.allTotalWin + (result.freespinAllTotalWin || 0);

				//判断能否中联机大奖
				let canOnlineAward = require('../../../domain/games/util').dealOnlineAward(totalBet, game.onlineAwards);
				let onlineAward = 0;
				if(canOnlineAward){
					onlineAward = game.onlineAwards;
					totalWin += onlineAward;
					game.onlineAwards = 0;
					_this.app.rpc.hall.gameRemote.udtGame(null, {nid, viper}, {onlineAwards: game.onlineAwards}, function(){});
				}
				result.canOnlineAward = canOnlineAward;
				result.onlineAward = onlineAward;

				// 大奖要从奖池扣钱
				room.jackpot -= (result.freespinAllJackpotWin || 0);
				if(room.jackpot < 0){
					room.jackpot = 0;
				}

				//击穿判断
				if(envAward && envAward.breakdown.status){
					if(realBreak){
						envAward.breakdown.encourage -= ((result.freespinAllJackpotWin || 0) + jackpotWin);
					}else{
						console.log({1: (result.freespinAllJackpotWin || 0) + jackpotWin, 2: envAward.breakdown.encourage, 3: room.jackpot})
						if((result.freespinAllJackpotWin || 0) + jackpotWin >= envAward.breakdown.encourage || envAward.breakdown.encourage < (300 * 20) || room.jackpot <= envAward.breakdown.encourage){
							room.profitPool += room.jackpot;
							room.jackpot = 0;
							envAward.breakdown.status = false;
						}
					}
				}

				//是否可以停止放奖
				if(envAward && room.jackpot < envAward.jackpotBaseLine  && envAward.awardState){
					envAward.lastTime = Date.now();
					envAward.awardState = false;
					envAward.readyAward = false;
				}
				let isBigWin = false;
				if(result.allTotalWin + onlineAward >= totalBet * 20){
					isBigWin = true;
				}
				result.isBigWin = isBigWin;

				if((result.freespinAllTotalWin || 0) >= totalBet * 20){
					msgService.notice({route: 'onBigWin',game: {
						nid:game.nid, nickname: player.nickname, name: game.zname, num: totalWin, moneyType: moneyType == 'integral' ? '积分' : '金币', odd: Math.floor(result.freespinAllTotalWin / totalBet),
					}, VIP_ENV: isVip, uid, session: session, des: 'freespin'},function(){});
				}

				if(isBigWin){  // 大奖公告
					msgService.notice({route: 'onBigWin',game: {
						nid:game.nid, nickname: player.nickname, name: game.zname, num: totalWin, moneyType: moneyType == 'integral' ? '积分' : '金币', odd: Math.floor(result.allTotalWin / totalBet),
					}, VIP_ENV: isVip, uid, session: session},function(){});
				}
				room.winTotal += totalWin;

				//除jackpot奖之外的钱走 流水池
				room.runningPool -= (totalWin - (jackpotWin + (result.freespinAllJackpotWin || 0) + onlineAward));

				player[moneyType] += totalWin;
				//记录中奖记录
				_this.app.rpc.hall.playerRemote.recordCoin(session, {uid,nickname:player.nickname,coinType:moneyType,integral:player.integral,gold:player.gold,changeNum:'+'+totalWin,changeType:2},function(){});

				if(gameRecord['xiyouji'].number > 30){
					gameRecord['xiyouji'].newer = false;
				}

				memory.moneyChange.totalBet += totalBet;
				memory.moneyChange.totalWin += totalWin;

				envRecord[uid].record.unshift({bet: totalBet, win: totalWin});
				envRecord[uid].totalBet += totalBet;
				envRecord[uid].totalWin += totalWin;
				gameRecord['xiyouji'].winTotal += totalWin;
				gameRecord['xiyouji'].betTotal += totalBet;
				gameRecord['xiyouji'].record.push({bet: totalBet, win: totalWin});
				gameRecord['xiyouji'].number++;

				//对于金币场,添加游戏记录
				if(!isVip){
					if(totalBet > totalWin){
						player.selfBank = totalBet - totalWin;
					}
					const gameRecordModel = require('../../../../app/utils/db/mongodb').getDao('game_record');
					gameRecordModel.create({
						uid: uid,
						nickname: player.nickname,
						nid:nid,
						gname: '齐天大圣',
						createTime: Date.now(),
						input: totalBet,
						multiple,
						profit: totalWin - totalBet,
						selfGold:player.gold,
						playStatus: finalResult.bonusGame ? 0 : 1,
					},function(err, data){
						if(err){
							console.error('创建游戏记录失败 games.xiyoujiHandler.start');
						}
					});
				}
				//更新玩家以及房间信息
				_this.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: player[moneyType], gamesRecord: player.gamesRecord,selfBank:player.selfBank, roomProfit: isVip ? (player.roomProfit + totalWin - totalBet) : 0}, function(){});
				_this.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid}, {jackpot: room.jackpot, consumeTotal: room.consumeTotal, winTotal: room.winTotal, boomNum: room.boomNum, runningPool: room.runningPool, profitPool: room.profitPool},function(){});
				
				envRecord[uid].time = Date.now();
				return next(null, {code:200, result});
			});
		})
	});
};

/**
 * 小游戏
 * @param {totalBet, over: true}
 * @route: games.xiyoujiHandler.littleGame
 */
xiyoujiHandler.prototype.littleGame = function({totalBet, over}, session, next) {
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const viper = session.get('viper');
	const nid = session.get('game');
	const memoryEnv = isVip ? memory.vip[viper] : memory.system;
	const envRecord = isVip ? memory.vipRecord : memory.record;
	if(memoryEnv.littleGame[roomCode] == null){
		memoryEnv.littleGame[roomCode] = {};
	}
	if(memoryEnv.littleGame[roomCode][session.uid] == null){
		memoryEnv.littleGame[roomCode][session.uid] = totalBet * 5;
	}
	envRecord[session.uid].state = 2; 
	envRecord[session.uid].time = Date.now();
	//开始小游戏
	if(!over){
		if(Math.random() < 0.5){
			memoryEnv.littleGame[roomCode][session.uid] *= 2;
			return next(null, {code: 200, continue: true, award: memoryEnv.littleGame[roomCode][session.uid]});
		}else{
			memoryEnv.littleGame[roomCode][session.uid] = null;
			return next(null, {code: 200, continue: false, award: 0});
		}
	}else{  //放弃小游戏
		const _this = this;
		const moneyType = isVip ? 'integral' : 'gold';
		this.app.rpc.hall.playerRemote.getUserInfo(session, session.uid, function(err, player){
			if(err){
				return next(null, {code: 500, error:'获取玩家信息失败 games.xiyoujiHandler.littleGame'});
			}
			const gainMoney = memoryEnv.littleGame[roomCode][session.uid];

			envRecord[session.uid].record.unshift({bet: 0, win: gainMoney});
			envRecord[session.uid].totalWin += gainMoney;

			player[moneyType] += gainMoney;
			//对于金币场,添加小游戏记录
			if(!isVip){
				pushGameRecord({
					uid: session.uid,
					nickname: player.nickname,
					gname: '齐天大圣',
					createTime: Date.now(),
					input: 0,
					multiple: 10,
					profit: gainMoney
				}, true);
			}
			//结算后清空
			memoryEnv.littleGame[roomCode][session.uid] = null;
			_this.app.rpc.hall.playerRemote.updateUser(session, session.uid, {[moneyType]: player[moneyType]}, function(err,player){});
			return next(null, {code: 200, continue: false, award: gainMoney});
		});
	}
};

/**
 * 申请奖池信息
 * @route: games.xiyoujiHandler.jackpotFund
 */
xiyoujiHandler.prototype.jackpotFund = function({}, session, next) {
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const nid = session.get('game');
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid: session.uid}, function(err, game){
		if(!game || err){
			console.log({err})
			return next(null, {code: 500, error:'获取游戏信息失败 games.xiyoujiHandler.jackpotFund'});
		}
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'获取游戏房间信息失败 games.xiyoujiHandler.jackpotFund'});
		}
		const jackpotFund = room.jackpot;
		return next(null, {code:200, jackpotFund, runningPool: room.runningPool, profit: room.profitPool});
	});
};

xiyoujiHandler.prototype.setJackpot = function({jackpotNum,runNum, profitNum}, session, next) {
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const nid = session.get('game');
	const uid = session.uid;
	const _this = this;
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid: session.uid}, function(err, game){
		if(!game || err){
			return next(null, {code: 500, error:'获取游戏信息失败 games.xiyoujiHandler.jackpotFund'});
		}
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'获取游戏信息失败 games.xiyoujiHandler.jackpotFund'});
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