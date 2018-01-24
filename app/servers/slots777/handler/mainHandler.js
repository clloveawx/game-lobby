'use strict';

const Logger = require('pomelo-logger').getLogger('log', __filename);
const async = require('async');
const util = require('../../../utils');
const gutil = require('../../../domain/games/util');
const regulation = require('../../../domain/games/regulation');
const msgService = require('../../../services/MessageService');
const slots777 = require('../../../domain/games/slots777');
const config = slots777.config;
const logic = slots777.logic;
const memory = slots777.memory;
const playerMgr = require('../../../utils/db/dbMgr/playerMgr');
const Promise = require('bluebird');

module.exports = function(app) {
	return new slots777Handler(app);
};

var slots777Handler = function(app) {
	this.app = app;
};

/**
 *  开始游戏
 * @param {lineNum, bet} 线数、 押注倍数
 * @return {getWindow, totalWin, jackpotType, winLines}
 * @route：slots777.mainHandler.start
 */
slots777Handler.prototype.start = function ({lineNum, bet}, session, next) {
	if(lineNum == null || bet == null){
		return next(null, {code: 500, error:'传入的参数有误'});
	}
	if(!logic.isHaveLine(lineNum)){
		return next(null, {code: 500, error: '选线出错'});
	}
	
	//获取游戏信息
	const {uid, nid, roomCode, isVip, viper} = gutil.sessionInfo(session);
	const env = viper == null ? 'system' : viper;
	const moneyType  = isVip ? 'integral' : 'gold';
	const _this = this;
	// 玩家的所有押注金额
	const totalBet = bet * lineNum;
	if(totalBet <= 0){
		return next(null, {code: 500, error: '下注金额有误'});
	}
	
	async.waterfall([
		cb =>{
			//获取 游戏 房间 玩家 信息
			gutil.basicInfo({viper, nid, roomCode, uid})
			.then(({game, room, player}) =>{
				if(!game || !room || !player){
					next(null, {code: 500, error: '获取游戏基础信息失败'});
				}
				if(bet > player.unlock[nid][env]){
					next(null, {code: 500, error: '该押注倍数尚未解锁'});
				}
				//玩家扣钱  intoJackpot-是否将押注放入奖池
				const [remainder, intoJackpot] = gutil.deductMoney(totalBet, {integral: player.integral, gold: player.gold, isVip}, next);
				player[moneyType] = remainder;
				playerMgr.updatePlayer(player, function(err){
					if(err){
						next(null, {code: 500, error: '扣钱失败 games.slots777Handler.start'});
					}
					
					//押注金额流向
					if(intoJackpot){
						room.runningPool += totalBet * regulation.intoJackpot['runningPool'];
						room.profitPool += totalBet * regulation.intoJackpot['profitPool'];
					}
					room.consumeTotal += totalBet;
					
					return cb(null, game, room, player, intoJackpot);
				});
			})
		},
		(game, room, player, intoJackpot, cb) =>{
			//游戏记录
			const gameRecord = player.gamesRecord[isVip ? 'platform' : 'system'];
			if(gameRecord['slots777'] == null){
				gameRecord['slots777'] = {newer: true, number: 0};    //number - 玩家自上次充钱以来所玩的把数
			}
			//从内存中读取玩家游戏记录
			const envRecord = isVip ? memory.vipRecord : memory.record;
			if(util.isVoid(envRecord[uid])){
				// time: spin时间 用做掉线邮件 nextUse: 玩家上一局spin使用的轮盘 bet: 个体调控使用
				envRecord[uid] = {totalWin: 0, totalBet: 0, record: [], nextUse: '1', time: 0, bet: 0};
			}
			//按照游戏配置生成窗口   是否可以开奖池奖励   放奖调控数据
			let getWindow, canjackpot = false;
			//TODO 没想到好办法，(这里当奖池不够赔付一次最大奖励连线时,就不开最大奖,但实际上一次spin可能出现多个最大奖连线而击穿奖池)
			if(room.jackpot > config.maxAward * bet){
				canjackpot = true;
			}
			
			//先判断是否能够爆机
			if(gutil.boomJudge(room.jackpot, player.addRmb || 0, bet, 5000)){
				//选择一根中奖线
				const linePosition = util.random(0, lineNum - 1);
				getWindow = logic.generatorWindow({jackpot: room.jackpot, maxAward: true, linePosition, curRoulette: envRecord[uid].nextUse});
			}else{
				//新人调控
				if(gameRecord['slots777'].newer){
					//新人使用第一轮盘
					envRecord[uid].nextUse = '1';
					getWindow = logic.generatorWindow({newer: true, canjackpot});
				}else{
					//选择此局使用的轮盘
					const curRoulette = regulation.selectRoulette(envRecord[uid].nextUse);
					envRecord[uid].nextUse = curRoulette;
					
					//整体调控
					const wR = regulation.wholeRegulation(room.jackpot, room.runningPool);
					
					//放奖调控
					const ENV = isVip ? 'vip': 'system';
					let [envAward, aR] = regulation.awardRegulation({
						isVip, roomCode, viper, jackpot: room.jackpot, roomUserLens: room.users.length
					}, memory.awardRegulation[ENV]);
					
					//个体调控
					const [iR1, iR2] = regulation.individualRegulation({aR, curRoulette, userEnvRecord: envRecord[uid], totalBet}, '777');
					
					getWindow = logic.generatorWindow({curRoulette, wR, iR1, iR2, jackpot: room.jackpot, canjackpot, aR});
				}
			}
			
			//计算该窗口的赢钱情况
			
			let [totalWin, jackpotType, winLines, jackpotWin, multiple]
				= logic.windowAward({winIds : getWindow, bet, lineNum, roomJackpot: room.jackpot});
			
			//判断能否中联机大奖
			let canOnlineAward = gutil.dealOnlineAward(totalBet, game.onlineAwards);
			let onlineAward = 0;
			if(canOnlineAward){
				onlineAward = game.onlineAwards;
				totalWin += onlineAward;
				game.onlineAwards = 0;
				//保存游戏的修改
				gutil.udtGameByEnv(game).then(() =>{});
			}
			
			// 大奖公告
			let isBigWin;
			if(totalWin >= totalBet * 20){
				isBigWin = true;
				msgService.notice({
					route: 'onBigWin',
					game: {
						nid,
						nickname: player.nickname,
						name: game.zname,
						num: totalWin,
						moneyType: isVip ? '积分' : '金币',
						odd: Math.floor(totalWin / totalBet),
					},
					VIP_ENV: isVip,
					uid,
					session,
				},function(){});
			}
			
			// 房间信息处理
			if(jackpotType === 'colossal'){   //爆机
				room.boomNum++;
				gutil.boomNotice({   //发送爆机公告
					nickname: player.nickname,
					gname: game.gname,
					roomCode,
					num: totalWin,
					moneyType,
				});
			}
			room.winTotal += totalWin;
			if(intoJackpot){
				room.jackpot -= jackpotWin;
				room.runningPool -= (totalWin - jackpotWin - onlineAward);
			}
			
			//增加玩家赢钱到社交点奖池
			room.socialDot += totalWin * 0.1;
			room.matchDot += totalWin * 0.1;
			if(intoJackpot){
				room.runningPool -= totalWin * 0.1;
			}
			player.slotsGameEarnings += totalWin * 0.1;
			if(totalWin > 0){
				//给房间内的玩家推送赢钱信息
				msgService.pushMessageByUids('slots777.userGain', {
					uid,
					win: totalWin,
					count: player.slotsGameEarnings,
					socialDot: room.socialDot,
					gteTen: totalWin >= totalBet * 10,
				}, room.users);
			}
			
			//游戏记录的处理
			if(gameRecord['slots777'].number > 50){
				gameRecord['slots777'].newer = false;
			}
			gameRecord['slots777'].number++;
			envRecord[uid].record.push({bet: totalBet, win: totalWin});
			envRecord[uid].totalBet += totalBet;
			envRecord[uid].totalWin += totalWin;
			
			//对于金币场,添加游戏记录
			if(!isVip){
				gutil.gameRecord({
					uid,
					nickname: player.nickname,
					nid,
					gname: '777',
					createTime: Date.now(),
					input: totalBet,
					multiple: multiple,
					profit: totalWin - totalBet,
					gold: player.gold,
					playStatus: 1,
				});
			}else{
				//VIP場增加玩家盈利累積(生成積分記錄使用)
				player.roomProfit += (totalWin - totalBet);
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
			
			//玩家赢钱处理
			if(isVip){
				player[moneyType] += totalWin;
			}else{
				if(intoJackpot){
					player.gold['2'] += totalWin;
				}else{
					player.gold['1'] += totalWin;
				}
			}
			
			//此轮spin结束时间
			envRecord[uid].time = Date.now();
			
			//处理房间和玩家的数据修改
			gutil.udtRoomByEnv(room).then(() =>{
				playerMgr.updatePlayer(player, function(){
					return cb(null, {getWindow, totalWin, jackpotType, winLines, jackpotWin, isBigWin, canOnlineAward, onlineAward});
				});
			});
		}
	], function(err, result){
		if(err){
			Logger.error(`玩家${uid}的游戏spin出错:777-start:`,err);
		}
		result.code = 200;
		return next(null, result);
	})
};

/**
 * 申请奖池信息
 * @route: slots777.mainHandler.jackpotFund
 */
slots777Handler.prototype.jackpotFund = function({}, session, next) {
	
	const {viper, nid, roomCode} = gutil.sessionInfo(session);
	
	gutil.getRoomByEnv({viper, nid, roomCode}).then(room =>{
		if(!room){
			return next(null, {code: 500, error: '获取游戏房间信息失败 slots777.mainHandler.jackpotFund'});
		}
		const jackpotFund = parseInt(room.jackpot);
		return next(null, {
			code:200,
			jackpotFund,
			runningPool: room.runningPool,
			profit: room.profitPool
		});
	});
};

/**
 * 设置游戏房间奖池 (测试用)
 * @route: slots777.mainHandler.setJackpot
 */
slots777Handler.prototype.setJackpot = function({jackpotNum, runNum, profitNum}, session, next) {
	
	const {viper, nid, roomCode} = gutil.sessionInfo(session);
	
	gutil.getRoomByEnv({viper, nid, roomCode}).then(room =>{
		if(!room){
			return next(null, {code: 500, error: '获取游戏房间信息失败 slots777.mainHandler.jackpotFund'});
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
		gutil.udtRoomByEnv(room).then(() =>{
			return next(null, {
				code:200,
				jackpot: room.jackpot,
				runningPool: room.runningPool,
				profit: room.profitPool
			});
		});
	});
};