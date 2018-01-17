'use strict';

const config = require('./config');
const util = require('../../../utils');

/**
 * 判断选线是否合理
 */ 
const isHaveLine = exports.isHaveLine = (lineNum) => config.linesNum.includes(lineNum);
/**
 * 判断下注是否合理
 */
const isHaveBet = exports.isHaveBet = (bet) => config.bets.includes(bet);

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

// 判断一个指定长度的数组 中奖情况 (0:三连，1:四连. 2:五连)
const winningJudgment = (idArray) =>{
    // 取出数组的第一个元素 
    const first = idArray[0];
    const initArray = util.init(idArray);
    const doubleInitArray = util.init(initArray);
    let result = {boom: false, miniFiveLines: false, fiveLines: false};
    if(util.all((item) => item == first)(idArray)){  // 单元素5连
        result = {lottery: first, rewardType: 2, linkNum: 5};
        if(first == config.hamburger){  // 爆机
            result.boom = true;
        }else if(config.element.general.includes(first)){  // 迷你五连线
            result.miniFiveLines = true;
        }else if(config.element.common.filter(ele =>ele != config.hamburger).includes(first)){ // 五连线
            result.fiveLines = true;
        }
        return result;
    }else if(util.all((item) => item == first)(initArray)){  // 单元素4连
        return result = {lottery:first,rewardType: 1, linkNum: 4};
    }else if(util.all((item) => item == first)(doubleInitArray)){ // 单元素3连
        return result = {lottery:first,rewardType: 0, linkNum: 3};
    }
    return null;
};

/**
 * 按照游戏配置生成窗口
 */
exports.generatorWindow = ({newer, individualRegulation1, individualRegulation2, wholeRegulation, awardRegulation, jackpot, bet, down, curRouttle, maxAward, linePosition, filterEle}) =>{
    let winIds = [], wildNum = 0, bonusNum = 0;
    let eleWeight;
    if(newer){
        eleWeight = util.clone(config[down ? 'eleWeightDown' : 'eleWeightUp']['1']);
    }else {
        eleWeight = util.clone(config[down ? 'eleWeightDown' : 'eleWeightUp'][curRouttle]);

        // 个体调控
        if(individualRegulation1 || individualRegulation2){
            const change1Up = curRouttle == '1' ? 3.2 : curRouttle == '2' ? 4 : 0;
            const change2Up = curRouttle == '1' ? 6.2 : curRouttle == '2' ? 7.5 : 0;
            const change1Down = curRouttle == '1' ? 9.3 : curRouttle == '2' ? 11.1 : 0;
            const change2Down = curRouttle == '1' ? 17.8 : curRouttle == '2' ? 21.3 : 0;
            eleWeight[config.wild].forEach((e, index) =>{
                if(e > 0){  
                    if(down){
                        eleWeight[config.wild][index] += (individualRegulation1 ? change1Down : change2Down);
                    }else{
                        eleWeight[config.wild][index] += (individualRegulation1 ? change1Up : change2Up);
                    }
                }
            });
        }

        //整体调控
        if(wholeRegulation){
            const changeDown = curRouttle == '1' ? -17.5 : curRouttle == '2' ? -12.8 : -30.6;
            const changeUp = curRouttle == '1' ? -7.1 : curRouttle == '2' ? -3.1 : -11.3;
            eleWeight[config.wild].forEach((e, index) =>{
                if(e > 0){  
                    if(down){
                        eleWeight[config.wild][index] += changeDown;
                    }else{
                        eleWeight[config.wild][index] += changeUp;
                    }
                }
            });
        }

        //返奖调控
        if(awardRegulation){
            if(down){
                eleWeight[config.hamburger].forEach((e, index) =>{ 
                    eleWeight[config.hamburger][index] += (curRouttle == '1' ? 20 : curRouttle == '2' ? 25 : 0);
                });   
                eleWeight[config.wild].forEach((e, index) =>{
                    if(e > 0){
                        eleWeight[config.wild][index] += (curRouttle == '1' ? 0.6 : curRouttle == '2' ? 0 : 0);
                    }
                }); 
            }else{
                eleWeight[config.hamburger].forEach((e, index) =>{ 
                    eleWeight[config.hamburger][index] += (curRouttle == '1' ? 20 : curRouttle == '2' ? 25 : 0);
                });
                eleWeight[config.wild].forEach((e, index) =>{
                    if(e > 0){
                        eleWeight[config.wild][index] += (curRouttle == '1' ? 0.2 : curRouttle == '2' ? 0 : 0);
                    }
                }); 
            }
        }

        if(maxAward){
            eleWeight[config.hamburger] = [0, 0, 0, 0, 0];
        }
    }
    if(jackpot < 320 * bet * 3){
        eleWeight[config.hamburger][2] = 0;
        eleWeight[config.wild][2] = 0;
    }else if(jackpot < 10000 * bet * 2){
        eleWeight[config.hamburger][4] = 0;
    }
    
    if(filterEle){
        filterEle.forEach(fe =>{
            eleWeight[fe][0] = 0;
        });
    }
    // eleWeight[config.bonus].forEach((e, index) =>{
    //     if(e > 0){
    //         eleWeight[config.bonus][index] += 500;
    //     }
    // });

    for(let i = 0;i < config.column; i++){
        let colArray = [], colBonus = false;
        const colDistribute = Object.keys(eleWeight).map(id =>{
            if((id == config.wild && wildNum == config.specialMaxNum[id]) || (id == config.bonus && bonusNum == config.specialMaxNum[id])){
                return {[id]: 0}
            }
            return {[id]: eleWeight[id][i]}
        });
        for(let j = 0;j < config.row; j++){
            if(colBonus){  //如果某列存在bonus,则改列不出bonus
                colDistribute.forEach((e, i) =>{
                    if(Object.keys(e)[0] == config.bonus){
                        colDistribute[i] = {[config.bonus]: 0};
                    }
                });
            }
            let select = util.selectEle(colDistribute);
            if(select == config.wild){
                wildNum++;
                if(wildNum == config.specialMaxNum[select]){
                    const index = colDistribute.findIndex(col => Object.keys(col)[0] == select);
                    colDistribute[index] = {[select] :0};
                }
            }else if(select == config.bonus){
                bonusNum++;
                colBonus = true;
                if(bonusNum == config.specialMaxNum[select]){
                    const index = colDistribute.findIndex(col => Object.keys(col)[0] == select);
                    colDistribute[index] = {[select] :0};
                }
            }
            colArray.push(select);
        }
        winIds.push(colArray);
    }
    if(down == false){
        for(let i = 0; i< winIds.length; i++){
            let wildExist = false, bonusReduce = 0;
            for(let j = 0; j < winIds.length; j++){
                if(winIds[i][j] == config.wild){
                    wildExist = true;
                }
                if(winIds[i][j] == config.bonus){
                    bonusReduce++;
                }
            }
            if(wildExist){
                winIds[i] = new Array(3).fill(config.wild);
                bonusNum -= bonusReduce;
            }
        }
    }
    if(down && maxAward){
        const awardLine = config.winningLine[linePosition];
        awardLine.forEach((e, i) =>{
            winIds[i][e-1] = 'J';
        });
    }
    return {winIds, bonusNum};
};

/**
 * 根据生成的窗口判断赢钱情况
 */
exports.windowAward = ({winIds, bet, lineNum, roomJackpot, bonusNum}) =>{
    if(!isHaveLine(lineNum)){
        return '选线错误';
    }
    //取出可中奖的中奖线
    const curWinningLines = config.winningLine.slice(0, lineNum);
    //遍历所有的 当前中奖线
    let totalWin = 0, winLines = [], boom = false, miniFiveLines = false, fiveLines = false, bonusGame = false, jackpotWin = 0, multiple = 0, lotterys = new Set();
    curWinningLines.forEach((line, item) =>{
        // 这条线上的元素数组
        const lineIds = line.map((r, m) => {
            return winIds[m][r-1]
        });
        const cloneLineIds = util.clone(lineIds);

        //如果其中存在wild元素,将其转成其前一个元素 bonus除外
        lineIds.forEach((id, index) =>{
            if(id == config.wild){
                if(lineIds[index - 1] != config.bonus){
                    lineIds[index] = lineIds[index - 1];
                }
            }
        });
        //判断这条连线的中奖情况
        const lineResult = winningJudgment(lineIds);
        if(lineResult != null){
            lotterys.add(lineResult.lottery);
            const lineBet = config.awardSetting[lineResult.lottery][lineResult.rewardType];
            totalWin += lineBet * bet;
            multiple += lineBet;
            const linkIds = cloneLineIds.slice(0, lineResult.linkNum);
            // if(lineResult.boom && boom == false){
            //     boom = true;
            // }
            if(lineResult.miniFiveLines && miniFiveLines == false){
                miniFiveLines = true;
            }
            if(lineResult.fiveLines && fiveLines == false){
                fiveLines = true;
            }
            if(lineResult.lottery == config.hamburger){
                jackpotWin += lineBet * bet;
                roomJackpot -= jackpotWin;
            }
            winLines.push({index:item, linkNum:lineResult.linkNum, linkIds, money: lineBet * bet, type:lineResult.lottery});
        }
    });
    // if(boom && roomJackpot > 0){
    //     jackpotWin += Math.floor(roomJackpot);
    //     totalWin += Math.floor(roomJackpot);
    //     roomJackpot = 0;
    // }
    if(bonusNum == config.specialMaxNum[config.bonus]){
        bonusGame = true;
    }
    return {totalWin, winLines, boom, miniFiveLines, fiveLines, roomJackpot, bonusGame, jackpotWin, multiple, lotterys};
};