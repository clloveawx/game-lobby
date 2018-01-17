'use strict';

const config = require('./config');
const util = require('../../../utils');

//根据押注计算奖池赔率
const jackpotOdds = (bet) =>{
    if(!config.betMultiple.includes(bet)){
        return '下注倍数有误';
    }
    return bet / 5;
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

// 判断一个指定长度的数组 中奖情况 (0:三连，1:四连. 2:五连)
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
        return result = {lottery:first,rewardType: 1, linkNum: 4};
    }else if(belongGroup && util.all((item) => specialGroup[s].includes(item))(initArray)){ // 类元素4连
        return result = {lottery: group,rewardType: 1, linkNum: 4};
    }else if(util.all((item) => item == first)(doubleInitArray)){ // 单元素3连
        return result = {lottery:first,rewardType: 0, linkNum: 3};
    }else if(belongGroup && util.all((item) => specialGroup[s].includes(item))(doubleInitArray)){ // 类元素3连
        return result = {lottery: group,rewardType: 0, linkNum: 3};
    }
    return null;
};

/**
 * 判断选线是否合理
 */ 
const isHaveLine = exports.isHaveLine = (lineNum) => lineNum >= 1 && lineNum <= config.winningLine.length;

/**
 * 选择游戏轮盘
 */
exports.selectRoulette = (cur) =>{
    if(cur == '1'){
        return Math.random() < 0.0417 ? '2' : '1';
    }else if(cur == '2'){
        return Math.random() < 0.0667 ? '3' : '2';
    }else if(cur == '3'){
        return Math.random() < 0.0909 ? '1' : '3';
    }else{
        return '2';
    }
};

/**
 * 初始化窗口元素
 */
exports.initWindow = (rowNum, colNum, eles) =>{
    const eleIds = Object.keys(eles);
    let ordEleIds = eleIds.filter(id => id != config.wild);
    const splitIndex = Math.floor(ordEleIds.length / 2);
    let twoEles = [ordEleIds.slice(0, splitIndex), ordEleIds.slice(splitIndex)];
    let windowIds = [];
    for(let i = 0; i < colNum; i++){
        let colIds = [], srcIds = twoEles[i % 2];
        windowIds.push(colIds);
        for(let j = 0; j < rowNum; j++){
            colIds.push(srcIds[Math.floor(Math.random() * srcIds.length)]);
        }
    }
    return windowIds;
};

/**
 * 按照游戏配置生成窗口
 */
exports.generatorWindow = ({newer, curRoulette, wholeRegulation, individualRegulation1, individualRegulation2, jackpot, canjackpot, awardRegulation, maxAward, linePosition}) =>{
    let winIds = [], wSet;
    const relation7 = ['G', 'H', 'I'];
    if(newer){
        wSet = util.clone(config.weightSetting['1']);
    }else{
        wSet = util.clone(config.weightSetting[curRoulette]);
 
        if(wholeRegulation){
            for(let i = 1; i < 3; i++){
                wSet['W'][i] -= (curRoulette == '1' ? 7.5 : curRoulette == '2' ? 7.5 : 5.7);
            }
        }
        if(individualRegulation1){
            for(let i = 1; i < 3; i++){
                wSet['W'][i] += (curRoulette == '2' ? 8.8 : 9.4);
            }
        }
        if(individualRegulation2){
            for(let i = 1; i < 3; i++){
                wSet['W'][i] += (curRoulette == '2' ? 16.6 : 18.2);
            }
        }
        if(awardRegulation){
            for(let i = 1; i < 3; i++){
                wSet['W'][i] -= (curRoulette == '1' ? 0.9 : curRoulette == '2' ? 3 : 3.6);
            }
            relation7.forEach(i =>{
                wSet[i].forEach(j => wSet[i][j] += (curRoulette == '1' ? 10 : curRoulette == '2' ? 15 : 14));
            });
        }
        if(maxAward){
            relation7.forEach(e =>{
                wSet[e] = [0, 0, 0, 0, 0];
            });
            canjackpot = true;
        }
    }
    // const relation7 = ['G', 'H', 'I'];
    // let weight7 = 0, wildReduce = 0;
    // if(7500000 < jackpot && jackpot < 15000000){
    //     weight7 = 15;
    //     wildReduce = 4;
    // }else if(15000000 < jackpot && jackpot < 45000000){
    //     weight7 = 18;
    //     wildReduce = 5.4;
    // }else if(45000000 < jackpot && jackpot < 450000000){
    //     weight7 = 21;
    //     wildReduce = 7;
    // }else if(jackpot >= 450000000){
    //     weight7 = 24;
    //     wildReduce = 8.6;
    // }
    // relation7.forEach(e =>{
    //     wSet[e][4] +=weight7;
    // });
    // wSet[config.wild][4] -= wildReduce;
    if(canjackpot === false){ //不从奖池开奖
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
        const awardLine = config.winningLine[linePosition];
        awardLine.forEach((e, i) =>{
            winIds[i][e-1] = 'I';
        });
    }
    return winIds;
};
// console.log(exports.generatorWindow({maxAward: true, linePosition: 3, curRoulette: '1'}))

/**
 * 根据生成的窗口判断赢钱情况
 */
exports.windowAward = ({winIds, bet, lineNum, roomJackpot}) =>{
    if(!isHaveLine(lineNum)){
        return;
    }
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
            const lineBet = config.awardSetting[lineResult.lottery][lineResult.rewardType];
            totalWin += lineBet * bet;
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
    //减少奖池
    roomJackpot -= jackpotWin;

    const _jackpotType = jackpotType(jackpots);
    if(_jackpotType != null){
        //计算jackpot奖金
        const jackpotMoney = config.jackpotMoney;
        let jackpotAward;
        jackpotAward = Math.round(roomJackpot * jackpotMoney[_jackpotType] * jackpotOdds(bet));
        totalWin += jackpotAward;
        jackpotWin += jackpotAward;
    }
    return {totalWin, _jackpotType, winLines, jackpotWin, multiple};
};