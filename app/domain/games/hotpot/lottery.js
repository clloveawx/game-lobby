'use strict';
/**
 * 开奖
 */
const util = require('../../../utils');

const oddsWeight = require("./config.js").oddsWeight;
const oddsRate = require("./config.js").betAreas.oddsRate;
const tasteOdds = require("./config.js").betAreas.taste;
const cookStyleOdds = require("./config.js").betAreas.cookStyle;
const configOriginal = require("./config.js");

const findEffect = util.curry((effects, id) => effects.find(effect => effect.id == id));

/**
 * 开奖
 * @return {{slots: {up: eleId, down: eleId, combine: boolean, type}, areas: [areaId], extraAreas: [areaId], prize: Number}}
 */

exports.lottery = ({ config, wholeRegulation, awardRegulation,dealerIsRobot }) => {
	const slotsUp = wholeRegulation ? config.slots.wholeUp : config.slots.up;
	const taste = config.slots.taste;
	if (awardRegulation) {
		wholeRegulation ? (slotsUp['e6'] += 25) : (slotsUp['e6'].weight += 25);
	}
	const slotsDown = config.slots.down;
	const matchType = config.slots.matchType;

	const OIA = config.betAreas.ordinary;
	const SIA = config.betAreas.special;

	const resultType = config.betAreas.single;

	//先开slotsUp
	const SUTable = Object.keys(slotsUp).map(eid => {
		if (wholeRegulation) {
			return { [eid]: slotsUp[eid] };
		} else {
			return { [eid]: slotsUp[eid].weight };
		}
	});

	const tasteTable = Object.keys(taste).map(tid => {
		return { [tid]: taste[tid] };
	});

	const eid = util.selectEle(SUTable);
	const tid = util.selectEle(tasteTable);
	const odds = config.slots.singOdd[eid];
	let rate = config.betAreas.oddsRate[eid];

	//从特殊赔率中开一个
	const specialType = resultType[eid].s;
	let downTable = [];

	if(!dealerIsRobot){
		for(let key in configOriginal.specialWeightWhenDealerIsReal){
			downTable.push({
				[key]:configOriginal.specialWeightWhenDealerIsReal[key]
			});
		}
		//console.error("downTable",downTable)
	}else{
		downTable = specialType.map(special => {
			return { [special.id]: special.weight }
		});
		
	}

	

	const downId = util.selectEle(downTable);
	// let downId = 'b6'
	//定义开奖结果
	const result = {
		slots: { up: eid, down: null, combine: false, type: null, effect: null, taste: tid },
		areas: null,
		prize: null,
		odds: odds,
		rate: rate
	};

	let slotsDownId, areas = [];
	// 开出'点菜', 不匹配的情况
	if (downId == matchType.order) {
		//开一个不匹配的down
		const downMismatch = slotsDown.filter(down => !down.startsWith(eid));
		slotsDownId = downMismatch[Math.floor(Math.random() * downMismatch.length)];
		//随机点菜

		let areaTable=[];
		if(!dealerIsRobot){
			for(let key in configOriginal.dishesWhenDealerIsReal){
				areaTable.push({
					[key]:configOriginal.dishesWhenDealerIsReal[key].weight
				});
			}
			//console.error("areaTable",areaTable)
		}else{
			areaTable = OIA.concat(SIA).map(area => {
				return { [area]: resultType[eid].o.find(ele => ele.id == area).weight };
			});
			
		}

		const orderArea = util.selectEle(areaTable);
		result.slots.combine = false;
		result.slots.type = config.slots.types.areas;
		result.areas = [];
		result.areas.push(orderArea);
		//开出霸王蟹要 随机礼金
		//if(orderArea == config.betAreas.kingCrab){
		//result.prize = util.random(6, 25);
		//}
		//开出 人参或者霸王蟹 再开一个菜
		//if(orderArea == config.betAreas.kingCrab || orderArea == config.betAreas.ginseng){
		//	areaTable.forEach((e, i) =>{
		//		if(Object.keys(e)[0] == config.betAreas.kingCrab || Object.keys(e)[0] == config.betAreas.ginseng){
		//			areaTable[i] = {[Object.keys(e)[0]]: 0};
		//		}
		//	});
		//	const newArea = util.selectEle(areaTable);
		//	result.areas.push(newArea);
		//}
	} else {   // 开出'特效', 即匹配的情况
		//开出一个匹配的down
		const downMatch = slotsDown.filter(down => down.startsWith(eid));
		slotsDownId = downMatch[Math.floor(Math.random() * downMatch.length)];
		const eleType = result.slots.type = specialType.find(spe => spe.id == downId).type;
		result.slots.combine = true;
		result.slots.effect = downId;
		if (eleType == config.slots.types.areas || eleType == config.slots.types.allAreas) {
			result.areas = specialType.find(spe => spe.id == downId).areas;
		}
	}
	result.slots.down = slotsDownId;
	return result;
};
//console.log(exports.lottery({config: require('./config'), wholeRegulation: true, awardRegulation: true}))

// :: odds -> betNum -> Number
const userWin = (odds, betNum) => typeof betNum == 'number' ? Math.round(odds * betNum) : 0;

/**
 * 玩家下注总额 
 * @param {*} userBet 
 */

const userBetNum = userBet => {
	return Object.keys(userBet).reduce((num, id) => {
		return num + userBet[id];
	}, 0) - userBet["maxBetATime"];
};

const roundAllBet = exports.roundAllBet = (roundBetAreas) => {
	let num = 0;
	for (const id in roundBetAreas) {
		num += roundBetAreas[id].allBet
	}
	return num;
};

const dealReward = (userRoundHistory, userReward, userBet, userId, win, isKillAll) => {
	//结算时将非ai 且该局下注了 且该玩家总共玩过十局以上 返奖信息保存
	const uesrBetNum = userBetNum(userBet);
	if (!userId.startsWith('ai') && uesrBetNum > 0) {
		const date = util.converseDate(new Date());
		if (userRoundHistory[userId] == null) {
			userRoundHistory[userId] = {};
		}
		if (userRoundHistory[userId][date] == null) {
			userRoundHistory[userId][date] = [];
		}
		if (userRoundHistory[userId].total == null) {
			userRoundHistory[userId].total = 0;
		}
		userRoundHistory[userId][date].unshift(isKillAll ? 0 : win / uesrBetNum);
		userRoundHistory[userId].total++;
		if (userReward[userId] == null) {
			userReward[userId] = {};
		}
		userReward[userId].day = userRoundHistory[userId][date].reduce((num, reward) => {
			return num + reward
		}, 0) / userRoundHistory[userId][date].length;
		userReward[userId].history = Object.keys(userRoundHistory[userId]).filter(ele => ele != 'total').reduce((num, date) => {
			const dateReward = userRoundHistory[userId][date].reduce((num, reward) => {
				return num + reward
			}, 0);
			return num + dateReward;
		}, 0) / userRoundHistory[userId].total;
	}
};
const computeUsersWin = (userBets, lotteryResult, roundBetAreas, config) => {

	const others = [];
	let othersWin = 0;

	let lotteryAreaIds = lotteryResult.areas;
	let cookStyle = lotteryResult.slots.up;
	let tasteResult = lotteryResult.slots.taste;

	if (lotteryResult.slots.type == config.slots.types.killall) {//如果开出通杀，则将所有开奖区域设为空
		lotteryAreaIds = [];
		cookStyle = "";
		tasteResult = "";
	}

	for (const uid in userBets) {
		const userBet = userBets[uid];
		let win = 0, prize = 0, userBetMoney = userBetNum(userBet);
		let doubleHit = 0;
		let tripleHit = 0;

		let cookStyleWin = 0;
		let dishesWin = 0;
		let tasteWin = 0;
		let doubleHitWin = 0;
		let tripleHitWin = 0;

		for (let i in lotteryAreaIds) {
			if (userBet[lotteryAreaIds[i]]) {
				if (userBet[cookStyle]) {
					if (userBet[tasteResult]) {//如果三个slot都中
						tripleHit = 10;
					}
					doubleHit = 2;
				}
			}
		}

		lotteryAreaIds.forEach(areaId => {
			let finalOdds = 0;
			finalOdds = configOriginal.dishes[areaId].odds;
			if(tripleHit!==0){
				finalOdds*=tripleHit;
			}else if(doubleHit!==0){
				finalOdds*=doubleHit;
			}
			win += userWin(finalOdds, userBet[areaId]);
			dishesWin += userWin(finalOdds, userBet[areaId]);
		});

		if (userBet[tasteResult]) {//押中锅底
			win += userBet[tasteResult] * tasteOdds[tasteResult].odds;
			tasteWin += userBet[tasteResult] * tasteOdds[tasteResult].odds;
		}
		if (userBet[cookStyle]) {//押中派系
			win += userBet[cookStyle] * cookStyleOdds[cookStyle].odds;
			cookStyleWin += userBet[cookStyle] * cookStyleOdds[cookStyle].odds;
		}

		let noDishes = true, noCookStyle = true, noTaste = true;
		for (let key in userBet) {
			if (key.startsWith("e")) {
				noCookStyle = false;
			} else if (key.length === 2) {
				noDishes = false;
			} else if (key != "maxBetATime") {
				noTaste = false;
			}
		}

		if (noDishes) dishesWin = undefined;
		if (noCookStyle) cookStyleWin = undefined;
		if (noTaste) tasteWin = undefined;

		//二连
		// win += (userBet["maxBetATime"] || 0) * doubleHit;
		// doubleHitWin = (userBet["maxBetATime"] || 0) * doubleHit;
		//三连
		// win += (userBet["maxBetATime"] || 0) * tripleHit;
		// tripleHitWin = (userBet["maxBetATime"] || 0) * tripleHit;

		others.push({ id: uid, win: win, realWin: win - userBetMoney, dishesWin, cookStyleWin, tasteWin, doubleHitWin, tripleHitWin });
		othersWin += win;

		//处理返奖率
		//dealReward(userRoundHistory, userReward, userBet, userId, win, false);
	}

	return {
		others: others,
		othersWin: othersWin
	};
};

/**
 * 结算
 * @param config
 * @param lotteryResult
 * @param userBets
 * @param roundBetAreas
 * @return {others: [{id, win}], dealerWin: number} others 是已经排序的，赢的多的在前
 */
exports.settle = (config, lotteryResult, userBets, roundBetAreas, roomCOde) => {
	const othersBet = roundAllBet(roundBetAreas);
	let usersWin;
	usersWin = computeUsersWin(userBets, lotteryResult, roundBetAreas, config);

	const dealerWin = othersBet - usersWin.othersWin;
	return {
		others: usersWin.others.sort((o1, o2) => o2.win - o1.win),
		dealerWin: dealerWin,
		othersBet,
		othersWin:usersWin.othersWin,
		othersWin: usersWin.othersWin
	}
};

