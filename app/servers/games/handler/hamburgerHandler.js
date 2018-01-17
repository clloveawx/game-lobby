'use strict';

const async = require('async');
const util = require('../../../utils');
const msgService = require('../../../services/MessageService');
const hamburger = require('../../../domain/games/hamburger');
const config = hamburger.config;
const logic = hamburger.logic;
const memory = hamburger.memory;
const pushGameRecord = require('../../../domain/games/util').gameRecord;

module.exports = function(app) {
	return new hamburgerHandler(app);
};

var hamburgerHandler = function(app) {
	this.app = app;
};

/**
 * 初始化窗口元素
 * @return {initWinIds}
 * @route: games.hamburgerHandler.initWindow
 */
hamburgerHandler.prototype.initWindow = function(msg, session, next){
	const initWinIds = logic.initWindow(config.row, config.column, config.type);
	return next(null, {code: 200, initWinIds});
};

/**
 *  开始游戏
 * @param {lineNum, bet} 线数、 押注倍数
 * @route：games.hamburgerHandler.start
 */
hamburgerHandler.prototype.start = function ({bet, lineNum}, session, next) {
	
	const uid = session.uid;
	if(!logic.isHaveBet(bet) || !logic.isHaveLine(lineNum)){
		return next(null, {code: 500, error: '传入的参数有误'});
	}
	//获取游戏信息
	const nid = session.get('game');
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const _this = this;
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid}, function(err, game){
		if(!game){
			return next(null, {code: 500, error:'获取游戏信息失败 games.hamburgerHandler.start'});
		}
		// 获取房间
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'游戏房间未找到  games.hamburgerHandler.start'});
		}
		// 玩家的所有押注金额
		const totalBet = bet * lineNum * 2;
		if(totalBet <= 0){
			return next(null, {code: 500, error: '下注金额有误'});
		}
		//获取玩家信息
		_this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
			if(!player){
				return next(null, {code: 500, error: '获取玩家信息失败 games.hamburgerHandler.start'});	
			}
			const moneyType  = isVip ? 'integral' : 'gold';
			
			let deductMoney = isVip ? player.integral - totalBet : player.gold - totalBet;
			if(deductMoney < 0){
				return next(null, {code: 500, error: '玩家'+ uid + (isVip ? '积分': '金币')+'不足'})
			}
			// 扣除vip房主的 点数
			if(isVip && session.get('model') == 'common'){
				const reduceNum = -(game.removalTime + game.pumpingRate * totalBet);
				_this.app.rpc.hall.playerRemote.updateUserEffectTime(session, session.get('viper'), {num: reduceNum}, function(){});
			}

			const updateUserInfo = {};
			updateUserInfo[moneyType] = deductMoney;
			_this.app.rpc.hall.playerRemote.updateUser(session, uid, updateUserInfo, function(err,player){
				if(err){
					return next(null,{code: 500, error:'扣钱失败 games.hamburgerHandler.start'});
				}
				_this.app.rpc.hall.playerRemote.recordCoin(session, {uid,nickname:player.nickname,coinType:moneyType,integral:player.integral,gold:player.gold,changeNum:'-'+totalBet,changeType:1},function(){});

				//向奖池添加钱
				//const totalToJackpot = totalBet * 0.05;
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

				//向奖池添加钱
				//room.jackpot += totalBet * 0.1;
				room.runningPool += totalBet * 0.95;
				room.profitPool += totalBet * 0.05;
				room.consumeTotal += totalBet;

				//游戏记录
				const gameRecord = player.gamesRecord[isVip ? 'platform' : 'system'];
				if(gameRecord['hamburger'] == null){
					gameRecord['hamburger'] = {
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

				//按照游戏配置生成窗口
				let getWindowDown,getWindowUp, envAward, curRouttle, realBreak;

				if(false){  //新人调控
					curRouttle = envRecord[uid].lastUse = '1';
					getWindowDown = logic.generatorWindow({newer: true, jackpot: room.jackpot, bet, down: true});
					getWindowUp = logic.generatorWindow({newer: true, jackpot: room.jackpot, bet, down: false});
				}else{
					curRouttle = envRecord[uid].lastUse = logic.selectRoulette(envRecord[uid].lastUse);

					// 整体调控
					let wholeRegulation;
					const allRewardRate = memory.moneyChange.totalBet == 0 ? 0 : Number((memory.moneyChange.totalWin / memory.moneyChange.totalBet).toFixed(5));
					//console.log('整体返奖率.................',allRewardRate)
					if(allRewardRate > 0.95){
						wholeRegulation = true;
					}

					// 放奖调控
					let awardRegulation;
					const env = isVip ? 'vip': 'system';
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
					if(!['1', '2'].includes(curRouttle)){
						awardRegulation = false;
					}

					//个体调控
					let individualRegulation1, individualRegulation2;
					if(!awardRegulation && !['3'].includes(curRouttle)){
						if(envRecord[uid].record.length >= 10){
							const individualRewardRate = envRecord[uid].totalBet == 0 ? 0 : Number((envRecord[uid].totalWin / envRecord[uid].totalBet).toFixed(5));						
							if(individualRewardRate > 0.85 || envRecord[uid].bet != totalBet){
								envRecord[uid].record = [];
								envRecord[uid].totalBet = 0;
								envRecord[uid].totalWin = 0;
							}

							const lt = curRouttle == '1' ? 0.85 : curRouttle == '2' ? 0.65 : 0.25;
							const gt = curRouttle == '1' ? 0.65 : curRouttle == '2' ? 0.45: 0.05;
							if(individualRewardRate < lt && individualRewardRate > gt){
								individualRegulation1 = true;
							}else if(individualRewardRate <= gt){
								individualRegulation2 = true;
							}
						}
					}

					//奖池击穿
					// if(room.jackpot > 10000000 && !awardRegulation && envAward.breakdown.status == false){
					// 	envAward.breakdown.status = true;
					// 	envAward.breakdown.encourage = room.jackpot * 0.5;
					// }
					
					if(envAward.breakdown.status && envAward.breakdown.encourage > 1600 * bet){
						//选择一根中奖线
						const linePosition = util.random(0, lineNum - 1);
						realBreak = true;
						//上下层随机选这一个
						let filterEle;   //第一列需要过滤掉的元素
						getWindowDown = logic.generatorWindow({newer: false, individualRegulation1,individualRegulation2, wholeRegulation, awardRegulation, jackpot: room.jackpot, bet, down: true, curRouttle, maxAward: true, linePosition});
						filterEle = getWindowDown.winIds[0];
						getWindowUp = logic.generatorWindow({newer: false, individualRegulation1,individualRegulation2, wholeRegulation, awardRegulation, jackpot: room.jackpot, bet, down: false, curRouttle, filterEle});
					}else{
						getWindowDown = logic.generatorWindow({newer: false, individualRegulation1,individualRegulation2, wholeRegulation, awardRegulation, jackpot: room.jackpot, bet, down: true, curRouttle});
						getWindowUp = logic.generatorWindow({newer: false, individualRegulation1,individualRegulation2, wholeRegulation, awardRegulation, jackpot: room.jackpot, bet, down: false, curRouttle});
					}
				}
				let willLittleGame = false;
				//计分别算该窗口的赢钱情况
				let results = {}, totalWinDownAndUp = 0, rate = 1, multipleAll = 0, lotterysDown, lotterysUp, totalJackpot = 0;
				let bigWin = false, superWin = false, megaWin = false, ultraWin = false, isBigWin, superLittleGame = false, roomBoom = false;
				[getWindowDown, getWindowUp].forEach((window, i) =>{
					
					const windowResult = logic.windowAward({winIds : window.winIds, bet, lineNum, roomJackpot: room.jackpot, bonusNum: window.bonusNum});
					let {totalWin, winLines, boom, miniFiveLines, fiveLines, roomJackpot, bonusGame, jackpotWin, lotterys} = windowResult;
					totalWinDownAndUp += totalWin;
					multipleAll += windowResult.multiple;
					totalJackpot += jackpotWin;
					if(boom){
						roomBoom = true;
					}
					const result = {winIds: window.winIds, totalWin, winLines, jackpotWin, boom, miniFiveLines, fiveLines, bonusGame};
					if(i == 0){
						lotterysDown = Array.from(lotterys);
						results.down = result;
					}else{
						lotterysUp = Array.from(lotterys);
						results.up = result;
					}
				});
				if(roomBoom){  // 爆机
					room.boomNum++;
				}
				if(results.down.bonusGame && results.up.bonusGame){
					superLittleGame = true;
				}
				if(results.down.bonusGame || results.up.bonusGame){
					willLittleGame = true;
				}
				//计算奖励翻倍倍数
				const equalNum = lotterysDown.filter(d =>lotterysUp.includes(d)).length;
				if(equalNum === 1){
					rate = 2;
				}else if(equalNum === 2){
					rate = 3;
				}else if(equalNum === 3){
					rate = 5;
				}else if(equalNum > 3){
					return next(null, {code: 500, error: `计算奖励倍数出错 ${lotterysDow} ${lotterysUp}`});
				}
				totalWinDownAndUp *= rate;
				totalJackpot *= rate;

				//判断能否中联机大奖
				let canOnlineAward = require('../../../domain/games/util').dealOnlineAward(totalBet, game.onlineAwards);
				let onlineAward = 0;
				if(canOnlineAward){
					onlineAward = game.onlineAwards;
					totalWinDownAndUp += onlineAward;
					game.onlineAwards = 0;
					_this.app.rpc.hall.gameRemote.udtGame(null, {nid, viper: session.get('viper')}, {onlineAwards: game.onlineAwards}, function(){});
				}

				// 大奖要从奖池扣钱
				room.jackpot -= totalJackpot;

				//击穿判断
				if(envAward && envAward.breakdown.status){
					if(realBreak){
						envAward.breakdown.encourage -= totalJackpot;
					}else{
						if(totalJackpot >= envAward.breakdown.encourage || envAward.breakdown.encourage < 1600 * bet || room.jackpot <= envAward.breakdown.encourage){
							room.profitPool += room.jackpot;
							room.jackpot = 0;
							envAward.breakdown.status = false;
						}
					}
				}

				//除jackpot奖之外的钱走 流水池
				room.runningPool -= (totalWinDownAndUp - totalJackpot - onlineAward);
				if(room.jackpot < 0){
					room.jackpot = 0;
				}
				room.winTotal += totalWinDownAndUp;

				//是否可以停止放奖
				if(envAward && room.jackpot < envAward.jackpotBaseLine  && envAward.awardState){
					envAward.lastTime = Date.now();
					envAward.awardState = false;
					envAward.readyAward = false;
				}	
					
				if(totalWinDownAndUp >= totalBet * 5 && totalWinDownAndUp < totalBet * 10){
					bigWin = true;
				}
				if(totalWinDownAndUp >= totalBet * 10 && totalWinDownAndUp < totalBet * 20){
					superWin = true;
				}
				if(totalWinDownAndUp >= totalBet * 20 && totalWinDownAndUp < totalBet * 50){
					megaWin = true;
				}
				if(totalWinDownAndUp >= totalBet * 50){
					ultraWin = true;
				}

				if(totalWinDownAndUp >= totalBet * 20){
					isBigWin = true;
				}
	
				if(isBigWin){  // 大奖公告
					msgService.notice({route: 'onBigWin',game: {
						nickname: player.nickname, name: game.zname, num: totalWinDownAndUp, moneyType: moneyType == 'integral' ? '积分' : '金币', odd: Math.floor(totalWinDownAndUp / totalBet)
					}, VIP_ENV: isVip, uid, session: session},function(){});
				}

				player[moneyType] += totalWinDownAndUp;

				//记录中奖记录
				_this.app.rpc.hall.playerRemote.recordCoin(session, {uid,nickname:player.nickname,coinType:moneyType,integral:player.integral,gold:player.gold,changeNum:'+'+totalWinDownAndUp,changeType:2},function(){});

				if(gameRecord['hamburger'].number > 30){
					gameRecord['hamburger'].newer = false;
				}

				memory.moneyChange.totalBet += totalBet;
				memory.moneyChange.totalWin += totalWinDownAndUp;

				envRecord[uid].record.push({bet: totalBet, win: totalWinDownAndUp});
				envRecord[uid].totalBet += totalBet;
				envRecord[uid].totalWin += totalWinDownAndUp;
				gameRecord['hamburger'].winTotal += totalWinDownAndUp;
				gameRecord['hamburger'].betTotal += totalBet;
				gameRecord['hamburger'].record.push({bet: totalBet, win: totalWinDownAndUp});
				gameRecord['hamburger'].number++;

				//对于金币场,添加游戏记录
				if(!isVip){
					if(totalBet > totalWinDownAndUp){
						player.selfBank += totalBet - totalWinDownAndUp;
					}
					const gameRecordModel = require('../../../../app/utils/db/mongodb').getDao('game_record');
					gameRecordModel.create({
						uid: uid,
						nickname: player.nickname,
						nid:nid,
						gname: '汉堡',
						createTime: Date.now(),
						input: totalBet,
						multiple: multipleAll,
						profit: totalWinDownAndUp - totalBet,
						selfGold : player.gold,
						playStatus: willLittleGame ? 0 : 1,
					},function(err, data){
						if(err){
							console.error('创建游戏记录失败 games.hamburgerHandler.start');
						}
					});
				}

				//更新玩家以及房间信息
				_this.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: player[moneyType], gamesRecord: player.gamesRecord,selfBank:player.selfBank, roomProfit: isVip ? (player.roomProfit + totalWinDownAndUp - totalBet) : 0}, function(){});
				_this.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid}, {jackpot: room.jackpot, consumeTotal: room.consumeTotal, winTotal: room.winTotal, boomNum: room.boomNum, runningPool: room.runningPool, profitPool: room.profitPool},function(){});
				
				envRecord[uid].time = Date.now();
				return next(null, {code:200, results, isBigWin, bigWin, superWin, megaWin, ultraWin, superLittleGame, totalWinDownAndUp, rate, curmoney: player[moneyType], canOnlineAward, onlineAward});
			});
		})
	});
};

/**
 * 小游戏点击
 */
hamburgerHandler.prototype.click  = function ({totalBet, rate, superLittleGame = false},session, next){
    if(!totalBet || totalBet <= 0 || !rate){
        return next(null, {code: 500, error: '参数有误 hamburgerHandler.prototype.click'});
	}
	if(![1, 2, 3, 5].includes(rate)){
		return next(null, {code: 500, error: '参数有误 hamburgerHandler.prototype.click'+rate});
	}
	const uid = session.uid;
    const isVip = session.get('VIP_ENV');
	const moneyType = isVip ? 'integral' : 'gold';
	const envRecord = isVip ? memory.vipRecord : memory.record;
	envRecord[uid].state = 2;
    const _this = this;

    this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
        if(err){
            console.error('查找玩家信息失败', err);
            return next(null, {code: 500, error:'查找玩家信息失败 games.hamburgerHandler.jackpotFund'});
        }
        let result = [], winAll = 0;
        const con = (resultLength) =>{
        	return resultLength == 0 ? 1 : (resultLength == 1 ? 0.75 : resultLength == 2 ? 0.5 : ( resultLength < 9 ? 0.25 : 0));
		};
		const supercon = (resultLength) =>{
			return [0, 2, 4, 6].includes(resultLength) ? 1 : (resultLength == 1 ? 0.75 : [3, 5, 7, 8].includes(resultLength) ? 0.25 : 0);
		};
        while(Math.random() < (superLittleGame ? supercon(result.length) : con(result.length))){
			const award = totalBet * Math.pow(2, result.length) * rate * (superLittleGame ? 2 : 1);
            result.push({lottery: true, award: award});
            winAll += award;
        }
		result.push({lottery: false, award: 0});
        let bigWin = false;
        if(winAll >= totalBet * 20){
        	bigWin = true;
        }
		player[moneyType] += winAll;
		envRecord[uid].record.push({bet: 0, win: winAll});
		envRecord[uid].totalWin += winAll;
		envRecord[uid].time = Date.now();
		if(winAll > 0){  //小游戏走基础奖池
			const nid = session.get('game');
			const roomCode = session.get('roomCode');
			//增加小游戏赢钱记录
			if(!isVip){
				pushGameRecord({
					uid,
					nickname: player.nickname,
					nid:nid,
					gname: '汉堡',
					createTime: Date.now(),
					input: 0,
					multiple: 10,
					profit: winAll,
					selfGold : player.gold,
				}, true);
			}

			_this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid}, function(err, game){
				if(!game || err){
					return next(null, {code: 500, error:'获取游戏信息失败 games.hamburgerHandler.click'});
				}
				const room = game.rooms.find(room => room.roomCode == roomCode);
				if(!room){
					return next(null, {code: 500, error:'获取游戏信息失败 games.hamburgerHandler.click'});
				}
				room.runningPool -= winAll;
				room.winTotal += winAll;
				_this.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid}, {runningPool: room.runningPool, winTotal: room.winTotal},function(){});
			});
		}
        _this.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: player[moneyType], roomProfit: isVip ? (player.roomProfit + winAll) : 0}, function(err,player){});
		return next(null, {code: 200, result, winAll, bigWin});
    })
};

/**
 * 申请奖池信息
 * @route: games.hamburgerHandler.jackpotFund
 */
hamburgerHandler.prototype.jackpotFund = function({}, session, next) {
	const roomCode = session.get('roomCode');
	const isVip = session.get('VIP_ENV');
	const nid = session.get('game');
	this.app.rpc.hall.gameRemote.getGameFromHall(session, {nid, isVip, uid: session.uid}, function(err, game){
		if(!game || err){
			return next(null, {code: 500, error:'获取游戏信息失败 games.hamburgerHandler.jackpotFund'});
		}
		const room = game.rooms.find(room => room.roomCode == roomCode);
		if(!room){
			return next(null, {code: 500, error:'获取游戏房间信息失败 games.hamburgerHandler.jackpotFund'});
		}
		const jackpotFund = parseInt(room.jackpot);
		return next(null, {code:200, jackpotFund, runningPool: room.runningPool, profit: room.profitPool});
	});
};

hamburgerHandler.prototype.setJackpot = function({jackpotNum,runNum, profitNum}, session, next) {
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