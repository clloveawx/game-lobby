'use strict';

const config = require('./config');
const util = require('../../../utils');

/**
 * 判断选线是否合理
 */
exports.isHaveLine = (lineNum) => lineNum >= 1 && lineNum <= config.winningLine.length;

/**
 * 按照游戏配置生成窗口
 * wR:整体调控 iR:个体调控 aR:放奖调控
 */
exports.generatorWindow = ({newer, curRoulette, wR, iR1, iR2, canjackpot, aR, maxAward, linePosition}) =>{
	let winIds = [], wSet;
	const relation7 = ['G', 'H', 'I'];
	if(newer){
	    //新人用第一轮盘
		wSet = util.clone(config.weightSetting['1']);
	}else{
		wSet = util.clone(config.weightSetting[curRoulette]);
		
		if(wR){
			for(let i = 1; i < 3; i++){
				wSet['W'][i] += config.wholeRegu[curRoulette];
			}
		}
		if(iR1){
			for(let i = 1; i < 3; i++){
				wSet['W'][i] += config.indiRegu1[curRoulette];
			}
		}
		if(iR2){
			for(let i = 1; i < 3; i++){
				wSet['W'][i] += config.indiRegu2[curRoulette];
			}
		}
		if(aR){
			for(let i = 1; i < 3; i++){
				wSet['W'][i] += config.awardRegu[curRoulette][0];
			}
			relation7.forEach(i =>{
				wSet[i].forEach(j => wSet[i][j] += config.awardRegu[curRoulette][1]);
			});
		}
	}
	//开最大奖调控(爆机触发)
	if(maxAward){
    //不出任何7相关元素
		relation7.forEach(e =>{
			wSet[e] = [0, 0, 0, 0, 0];
		});
		canjackpot = true;
	}
	
	//不从奖池开奖(第四列或者第五列不开wild和7)
	if(canjackpot === false){
		const index = Math.random() < 0.5 ? 3 : 4;
		if(index == 3){
			wSet['W'][index] = 0;
		}
		relation7.forEach(i =>{
			wSet[i][index] = 0;
		});
	}
	
	for(let i = 0;i < config.column; i++){
		const colDistribute = Object.keys(wSet).map(id =>{
			return {key: id, value: wSet[id][i]};
		});
		let colArray = [];
		for(let j = 0;j < config.row; j++){
			colArray.push(util.selectElement(colDistribute));
		}
		winIds.push(colArray);
	}
	if(maxAward){
    //用选定的中奖线开出最大奖
		const awardLine = config.winningLine[linePosition];
		awardLine.forEach((e, i) =>{
			winIds[i][e-1] = 'I';
		});
	}
	return winIds;
};

/**
 * 判断一个指定长度的数组 中奖情况 (0:三连，1:四连. 2:五连)
 * @returns lottery: 中奖元素 rewardType: (0:三连，1:四连. 2:五连)  linkNum: 连数 jackpot: 大奖类型
 */
const winningJudgment = (idArray) =>{
	// 取出数组的第一个元素
	const first = idArray[0];
	const initArray = util.init(idArray);
	const doubleInitArray = util.init(initArray);
	const specialGroup = config.specialGroup;
	const belongGroup = specialGroup.s1.includes(first) || specialGroup.s2.includes(first); // bar类 和 7类
	let group,s;
	if(belongGroup){
		group = specialGroup.s1.includes(first) ? 'anyBar' : 'any7';
		s = group == 'anyBar' ? 's1' : 's2';
	}
	
	let result;
	if(util.all((item) => item == first)(idArray)){  // 单元素5连
		result = {lottery: first,rewardType: 2, linkNum: 5};
		if(specialGroup.s2.includes(first)){
			const jackpotType = first == 'G' ? 'mega' : (first == 'H' ? 'monster' : 'colossal');
			result.jackpot = jackpotType;
		}
		return result;
	}else if(belongGroup && util.all((item) => specialGroup[s].includes(item))(idArray)){  // 类元素5连
		result = {lottery: group,rewardType: 2, linkNum: 5};
		if(s == 's2'){
			result.jackpot = 'mini';
		}
		return result;
	}else if(util.all((item) => item == first)(initArray)){  // 单元素4连
		return {lottery:first,rewardType: 1, linkNum: 4};
	}else if(belongGroup && util.all((item) => specialGroup[s].includes(item))(initArray)){ // 类元素4连
		return {lottery: group,rewardType: 1, linkNum: 4};
	}else if(util.all((item) => item == first)(doubleInitArray)){ // 单元素3连
		return {lottery:first,rewardType: 0, linkNum: 3};
	}else if(belongGroup && util.all((item) => specialGroup[s].includes(item))(doubleInitArray)){ // 类元素3连
		return {lottery: group,rewardType: 0, linkNum: 3};
	}
	return null;
};

//根据jackpots数组给出jackpotType
const jackpotType = (jackpots) =>{
	if(jackpots.length == 0){
		return null;
	}
	if(jackpots.includes('colossal')){
		return 'colossal';
	}else if(jackpots.includes('monster')){
		return 'monster';
	}else if(jackpots.includes('mega')){
		return 'mega';
	}else{
		return 'mini';
	}
};

//根据押注计算奖池赔率  配置表按照最小押注5倍设置
const jackpotOdds = (bet) =>{
	if(!config.betMultiple.includes(bet)){
		return '下注倍数有误';
	}
	return bet / 5;
};

/**
 * 根据生成的窗口判断赢钱情况
 */
exports.windowAward = ({winIds, bet, lineNum, roomJackpot}) =>{

  //玩家选定的中奖线
	const curWinningLines = config.winningLine.slice(0, lineNum);
	//遍历所有的 当前中奖线
	let totalWin = 0, jackpots = [], winLines = [], multiple = 0, jackpotWin = 0;;
	curWinningLines.forEach((line, item) =>{
		// 这条线上的元素数组
		const lineIds = line.map((r, m) => {
			return winIds[m][r-1]
		});
		const cloneLineIds = util.clone(lineIds);
		
		//如果其中存在wild元素,将其转成其前一个元素
		lineIds.forEach((id, index) =>{
			if(id == config.wild){
				lineIds[index] = lineIds[index - 1];
			}
		});
		
		//判断这条连线的中奖情况
		const lineResult = winningJudgment(lineIds);
		if(lineResult != null){
      //中奖赔率
			const lineBet = config.awardSetting[lineResult.lottery][lineResult.rewardType];
			totalWin += lineBet * bet;
			//和7相关的五连走奖池
			if(['G', 'H', 'I', 'any7'].includes(lineResult.lottery) && lineResult.rewardType == 2){
				jackpotWin += lineBet * bet;
			}
			multiple += lineBet;
			const linkIds = cloneLineIds.slice(0, lineResult.linkNum);
			winLines.push({index:item, linkNum:lineResult.linkNum, linkIds, money: lineBet * bet, type:lineResult.lottery});
			if(lineResult.jackpot != null){
				jackpots.push(lineResult.jackpot);
			}
		}
	});
	//减少奖池  先赔付基础奖励
	roomJackpot -= jackpotWin;
	
	//判断是否有jackpot大奖
	const _jackpotType = jackpotType(jackpots);
	if(_jackpotType != null){
		//计算jackpot奖金
		const jackpotMoney = config.jackpotMoney;
		let jackpotAward;
		jackpotAward = Math.round(roomJackpot * jackpotMoney[_jackpotType] * jackpotOdds(bet));
		totalWin += jackpotAward;
		jackpotWin += jackpotAward;
	}
	return [totalWin, _jackpotType, winLines, jackpotWin, multiple];
};