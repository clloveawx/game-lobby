'use strict';

const config = require('./config');
const util = require('../../../utils');
const memory = require('./memory');

/**
 * 判断该下注数和下注倍数是否合理
 */
exports.isHaveBet = (betNum, betOdd)=>{
    if(config.stake.num.includes(betNum)){
        return '下注数不合法';
    }
    if(config.stake.odd.includes(betOdd)){
        return '下注倍数不合法';
    }
    return true;
};

/**
 * 根据 铲子数判断关卡
 */
exports.pass = ({shovelNum}) =>{
    shovelNum = parseInt(shovelNum);
    if(shovelNum < 0){
        return null;
    }
    return parseInt(shovelNum / 15) % 3 + 1;
}

/**
 * 根据押注得到的大奖赔率
 */
const bigOdd = exports.bigOdd = (betAll) =>{
    return betAll / 10;
};

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
 * 生成一个不同的元素
 */
const getDifEle = (select, selectArray, opt) =>{
    let selectNew = util.selectElement(selectArray);
    while(select === selectNew || opt[selectNew] === false){
        selectNew = util.selectElement(selectArray);
    }
    return selectNew;
};

/**
 * 按照游戏配置生成窗口
 */
const generatorWindow = exports.generatorWindow = (pass, isFreespin = false) =>{
    let winIds = [], freespinNum = 0, bonusNum = 0, shovelNum = 0,only;
    const colDistribute = Object.keys(config.type).map(id =>{
        if(isFreespin && config.specialEle.includes(id)){
            return {key: id, value: 0};
        }else{
            if(config.specialEle.includes(id)){
                return {key: id, value: config.type[id].weight[pass]}
            }else{
                return {key: id, value: config.type[id].weight};
            }
        }
    });

    for(let i = 0;i < config.checkPoint[pass]; i++){
        let colArray = [];
        for(let j = 0;j < config.checkPoint[pass]; j++){
            let select = util.selectElement(colDistribute);
            
            // 控制每局游戏只出现一种特殊元素
            if(config.specialEle.includes(select) && only == null && !isFreespin){
                only = select;
            }
            if(only != null){
                config.specialEle.filter(e => e != only).forEach(e =>{
                    colDistribute.find(dis => dis.key == e).value = 0;
                });
            }

            if(select == config.free){
                if(freespinNum < config.type[select].max){
                    freespinNum++;
                    if(freespinNum >= config.type[select].max){
                        const index = colDistribute.findIndex(e =>e.key == select);
                        colDistribute[index] = {key: select, value: 0};
                    }
                }
            }
            if(select == config.bonus){
                if(bonusNum < config.type[select].max){
                    bonusNum++;
                    if(bonusNum >= config.type[select].max){
                        const index = colDistribute.findIndex(e =>e.key == select);
                        colDistribute[index] = {key: select, value: 0};
                    }
                }
            }
            if(select == config.shovel){
                if(shovelNum < config.type[select].max){
                    shovelNum++;
                    if(shovelNum >= config.type[select].max){
                        const index = colDistribute.findIndex(e =>e.key == select);
                        colDistribute[index] = {key: select, value: 0};
                    }
                }
            }

            colArray.push(select);
        }
        winIds.push(colArray);
    }
    return {winIds, only};
};

/**
 * 判断两个Set数据的结构是否完全相同
 */
let isEqualSet = (a, b) => {
    return new Set([...a].filter(x => !b.has(x))).size == 0 &&
    new Set([...b].filter(x => !a.has(x))).size == 0
};

/**
 * 判断两个位置是否相邻
 */
const isAdjoin = ([x1,y1], [x2,y2]) =>{
    const leg = Math.sqrt(Math.pow(x1-x2, 2) + Math.pow(y1- y2, 2));
    if(leg == 1){
        return true; 
    }
    return false;
}
/**
 * 根据坐标数组查找需要消除的位置
 */
const clear = (position, pass) =>{
    let mid = {};
    for(let i in position){
        let remain = util.difference(position, position[i]);
        for(let j in remain){
            if(isAdjoin(position[i], remain[j])){
                if(mid[position[i]]==null){
                    mid[position[i]] = new Set()
                }
                mid[position[i]].add(remain[j].join('-'));
            }
        }
    }
    for(let i in mid){
        mid[i].forEach((value, key)=>{
            mid[value.split('-')].forEach((v, k) =>{
                mid[i].add(v);
            })
        })
    }
    const vMid = util.values(mid);
    for(let i in vMid){
        i=Number(i)
        if(vMid[i] == null){
            continue;
        }
        for(let j = i+1; j< vMid.length; j++){
            if(vMid[j] == null){
                continue;
            }
            if(isEqualSet(vMid[i],vMid[j])){
                vMid[j] = null;
            }
        }
    }
    return vMid.filter(e => e!= null && e.size >= config.checkPoint[pass]);
};

/**
 * 根据生成的窗口判断消除情况
 */
const windowClear = exports.windowClear = (winIds, pass) =>{
    let censu = {};
    for(let i in winIds){  //将每种类型的元素归类
        for(let j in winIds[i]){
            if(Object.keys(config.type).includes(winIds[i][j])){
                if(censu[winIds[i][j]] == null){
                    censu[winIds[i][j]] = [];
                }
                censu[winIds[i][j]].push([Number(i), Number(j)])
            }
        }
    }
    const awardResult = {};
    for(let i in censu){
        const position = censu[i];
        if(config.ordinaryEle.includes(i)){
            awardResult[i] = clear(position, pass);
        }else{
            awardResult[i] = [position];
        }
    }
    const clearElement = util.filter(e => e.length > 0)(awardResult);
    for(let i in clearElement){
        if(config.ordinaryEle.includes(i)){
            clearElement[i] = clearElement[i].map(e => {
                return Array.from(e).map(k => k.split('-'));
            });
        }
    }

    for(let i in clearElement){
        for(let j in clearElement[i]){
            clearElement[i][j] = util.sortWith([
                (r1,r2) => r2[1] - r1[1],
                (r1,r2) => r1[0] -r2[0]
            ])(clearElement[i][j])
        }
        clearElement[i] = util.sortWith([
            (r1,r2)=> r2[0][1] - r1[0][1],
            (r1,r2) =>r1[0][0] - r2[0][0],
        ])(clearElement[i])
    }
    return clearElement;
};

/**
 * 根据消除将原窗口降落并补全
 */
const completeWindow = exports.completeWindow = (winIds, clearElement, isFreespin, only) =>{

    const pass = winIds.length == 4 ? '1': winIds.length == 5 ? '2' : '3';
    const allClear = [], position = [];
    for(let i in clearElement){
        clearElement[i].forEach(ele =>{
            ele.forEach(e => allClear.push(e));
        })
    }
    allClear.forEach(re =>{
        winIds[re[0]][re[1]] = 'del'; 
        position.push({x: Number(re[0]), y: Number(re[1])});
    });
    //降落
    for(let i in winIds){ //每列
        for(let j= winIds[i].length -1; j>0;j--){  //从每列底部开始
            if(winIds[i][j] == 'del'){
                const index = util.findLastIndex(v => v!='del')(winIds[i].slice(0,j))
                if(index != -1){
                    [winIds[i][j], winIds[i][index]] = [winIds[i][index], winIds[i][j]]
                }
            }
        }
    }
     //补全
    const colDistribute = Object.keys(config.type).map(id =>{
        if(config.specialEle.includes(id)){
            return {key: id, value: 0};
        }else{
            return {key: id, value: config.type[id].weight};
        }
    });
    const newly = [];
    let bonusNum = 0, freespinNum = 0;
    for(let i in winIds){
        const col = [];
        for(let j in winIds){
            if(winIds[i][j] == 'del'){              
                let select = util.selectElement(colDistribute);

                if(only == null && config.specialEle.includes(select) && !isFreespin){
                    only = select;
                    config.specialEle.filter(e => e != only).forEach(e =>{
                        colDistribute.find(dis => dis.key == e).value = 0;
                    });
                }

                if(select == config.free){
                    if(freespinNum < config.type[select].max){
                        freespinNum++;
                        if(freespinNum >= config.type[select].max){
                            const index = colDistribute.findIndex(e =>e.key == select);
                            colDistribute[index] = {key: select, value: 0};
                        }
                    }
                }
                if(select == config.bonus){
                    if(bonusNum < config.type[select].max){
                        bonusNum++;
                        if(bonusNum >= config.type[select].max){
                            const index = colDistribute.findIndex(e =>e.key == select);
                            colDistribute[index] = {key: select, value: 0};
                        }
                    }
                }
                winIds[i][j] = select;
                col.push({type: winIds[i][j]});
                //newly.push([i, j, winIds[i][j]]);
            }else{
                break;
            }
        }
        newly.push(col);
    }
    
    return {winIds, newly, position}
};

/**
 * 处理 freespin
 */
const dealFreeSpin = ({freespinNum, freespinOdd, pass}) =>{
    let freeSpinRemain = freespinNum, freeAward = 0;
    const freespinWindow = {}, freespins = [], freeAwards = [];
    let freeNum = 1;
    while(freeSpinRemain > 0){
        const winIds = generatorWindow(pass, true).winIds;
        const clearEle = windowClear(winIds, pass);
        const oneSpin = [changeWins(winIds)];
        const oneSpinAward = [];

        if(util.isVoid(clearEle)){
            freespinWindow[freeNum] = [{winIds: changeWins(winIds), clearEle, award: 0}];
            freespins.push(oneSpin);
            freeAwards.push(oneSpinAward);
            freeSpinRemain--;
            freeNum++;
            continue;
        }else{
            let oneFreeAward = 0;
            const freeWindowAward = (windowAward({clearElement: clearEle, pass}).windowAward) * freespinOdd;
            freeAward += freeWindowAward;
            oneFreeAward += freeWindowAward;
            let newWindow = completeWindow(util.clone(winIds), clearEle, true);
            oneSpin.push(newWindow.position);
            oneSpin.push(newWindow.newly);
            oneSpinAward.push(freeWindowAward);

            freespinWindow[freeNum] = [{winIds: changeWins(winIds), clearEle, award: oneFreeAward, clear: newWindow}];
            let newClearEle = windowClear(newWindow.winIds, pass);
            const clears = [];
            while(true){
                if(util.isVoid(newClearEle)){
                    clears.push({
                        winIds: changeWins(newWindow.winIds),
                        clearEle: newClearEle,
                        award: 0,
                    });
                    break;
                }else{
                    const newFreeWindowAward = (windowAward({clearElement: newClearEle, pass}).windowAward) * freespinOdd;
                    freeAward += newFreeWindowAward;
                    oneFreeAward += newFreeWindowAward;
                    clears.push({
                        winIds: changeWins(newWindow.winIds),
                        clearEle: newClearEle,
                        award: newFreeWindowAward,
                        clear: newWindow,
                    });
                    newWindow = completeWindow(util.clone(newWindow.winIds), newClearEle, true);
                    oneSpin.push(newWindow.position);
                    oneSpin.push(newWindow.newly);
                    oneSpinAward.push(newFreeWindowAward);

                    newClearEle = windowClear(newWindow.winIds, pass);
                }
            }
            
            freespinWindow[freeNum] = freespinWindow[freeNum].concat(clears);
            freespins.push(oneSpin);
            freeAwards.push(oneSpinAward);
            freeSpinRemain--;
            freeNum++;
        }
    }
    return {freespinWindow, freeAward, freespins, freeAwards};
};

/**
 * 根据窗口的消除情况计算中奖情况
 */
const windowAward = exports.windowAward = ({clearElement, jackpotMoney, jackpotOdd, pass}) =>{
    if(util.isVoid(clearElement)){
        return false;
    }
    const result = {windowAward: 0};

    //遍历所有消除的元素
    for(let i in clearElement){
        if(i == config.shovel){  //铲子
            result[i] = {shovelNum: clearElement[i][0].length};
        }else if(i == config.bonus){  //bonus
            const bonusNum = clearElement[i][0].length;
            const jackpotWin = config.jackpotBigWin[bonusNum];
            const award = Math.ceil(jackpotMoney * jackpotWin.ratio * jackpotOdd);
            jackpotMoney -= award;
            //窗口上的bonus奖金额外计算
            //result.windowAward += award;
            result[i] = {bonusNum, award, type: jackpotWin.name}
        } else if(i == config.free){   //处理该窗口上的freespin
            const freeNum = clearElement[i][0].length;
            const [freespinNum, freespinOdd] = config.freespin[freeNum];
            const freespinResult = dealFreeSpin({freespinNum, freespinOdd, pass});
            // 单个窗口的赢钱数不应该包括该窗口产生的freespin得到的钱
            // result.windowAward += freespinResult.freeAward;
            result[i] = freespinResult;
        }else if(config.ordinaryEle.includes(i)){   //普通元素
            const groupNum = clearElement[i].length;
            result[i] = {};
            const eleAward = config.type[i].clearAward[pass];
            for(let j in clearElement[i]){
                const len = clearElement[i][j].length;
                let award;
                if(eleAward[len-4] == undefined){
                    award = eleAward[eleAward.length - 1];
                }else{
                    award = eleAward[len-4];
                }
                result.windowAward += award;
                result[i]['group'+ j] = {
                    award,
                }
            }
        }
    }
    result.jackpotMoney = jackpotMoney;
    return result;
};

/**
 * 此局游戏最终后台结果
 */
const backResult = exports.backResult = ({winIds, jackpotMoney=10000, pass='1'}) =>{
    const result = {totalWin: 0, wins: []};

    //初始窗口的消除
    let oneWindow = {winIds: changeWins(winIds)};
    let clearEle = windowClear(winIds);
    
    while(true){
        if(!util.isVoid(clearEle)){
            let winAward = windowAward({clearElement: clearEle, jackpotMoney, jackpotOdd: 1, pass});
            jackpotMoney = winAward.jackpotMoney;
            if(winAward[config.shovel] != null){
                oneWindow.shovel = winAward[config.shovel].shovelNum;
            }
            if(winAward[config.bonus]){
                oneWindow.bonus = winAward[config.bonus];
            }
            if(winAward[config.free]){
                oneWindow.freespin = winAward[config.free];
            }
            config.ordinaryEle.forEach(ord =>{
                if(winAward[ord]){
                    oneWindow[ord] = winAward[ord];
                }
            });
            result.totalWin += winAward.windowAward;
            oneWindow.award = winAward.windowAward;
            //消除窗口的可消除的元素
            let newWindow = completeWindow(util.clone(winIds), clearEle, false);
            oneWindow.clear = newWindow;
            result.wins.push(oneWindow);
    
            oneWindow = {winIds: changeWins(newWindow.winIds)};
            clearEle = windowClear(newWindow.winIds);
        }else{
            result.wins.push(oneWindow);
            break;
        }
    }
    return result;
};
//finalResult({winIds:generatorWindow()})

//改变数据结构
const changeWins = (winArray) =>{
    const result = winArray.map(line =>{
        return line.map(e => {
            return {type: e}
        })
    });
    return result;
};

/**
 * 统计此局游戏最终结果
 */
const finalResult = exports.finalResult = ({winIds, jackpotMoney, pass, totalBet, only}) =>{
    const result = {totalWin: 0, wins: [], freespins: [], awards: [], freeAwards: [], shovelNum: 0, jackpotWin: [], jackpotTypes: []};
    //先加入初始窗口
    result.wins.push(changeWins(winIds));
    //初始窗口的消除
    let clearEle = windowClear(winIds, pass);
    const jackpotOdd = bigOdd(totalBet);
    
    while(true){
        //窗口可消除
        if(!util.isVoid(clearEle)){
            // 该可消除的窗口的盈利情况
            let winAward = windowAward({clearElement: clearEle, jackpotMoney, jackpotOdd, pass});
            jackpotMoney = winAward.jackpotMoney;

            if(winAward[config.shovel]){ // 统计铲子
                result.shovelNum += winAward[config.shovel].shovelNum;
            }
            if(winAward[config.bonus]){  //统计bonus产生的奖池
                result.jackpotWin.push(winAward[config.bonus].award);
                result.jackpotTypes.push(winAward[config.bonus].type);
            }

            if(winAward[config.free]){  //统计freespin
                result.freespins = result.freespins.concat(winAward[config.free].freespins);
                const freeAwards = winAward[config.free].freeAwards.map(awards => awards.map(e => e * totalBet / 10));
                result.freeAwards = result.freeAwards.concat(freeAwards);
                //累加freespin过程产生的收益
                result.totalWin += winAward[config.free].freeAwards.reduce((num, award) => {
                    return num + award.reduce((v, s) => v + s, 0);
                }, 0);
            }
            result.totalWin += winAward.windowAward;
            result.awards.push(winAward.windowAward * totalBet / 10);
            
            //消除窗口的可消除的元素 得到新窗口
            let newWindow = completeWindow(util.clone(winIds), clearEle, false, only);
            result.wins.push(newWindow.position);
            result.wins.push(newWindow.newly);
    
            winIds = newWindow.winIds;
            clearEle = windowClear(winIds, pass);
        }else{
            break;
        }
    }
    result.totalWin = result.totalWin * totalBet / 10 + result.jackpotWin.reduce((num, v)=> num + v, 0);
    return result;
};

/**
 * 生成小游戏的初始页面
 */
const littlerGameWindow = exports.littlerGameWindow = (pass) =>{
    const winIds = [];
    const range = config.littleGame[pass].range;

    for(let i = 0; i< range[0]; i++){
        const colIds = [];
        for(let j = 0; j< range[1]; j++){
            colIds.push(null);
        }
        winIds.push(colIds);
    }
    return winIds;
};

/**
 * 得到小游戏的结果
 */
const littlerGameResult = exports.littlerGameResult = (pass)=>{
    const distribute = config.littleGame[pass].acer;
    const select = util.selectElement(distribute);
    const result = util.clone(config.acer[pass][select]);
    delete result.weight;
    return result; 
};

/**
 * 玩家点击进行翻转
 */
const click = exports.click = (position, userLittleGame) =>{
    const [x, y] = position;
    const remain = userLittleGame.result;
    const window = userLittleGame.window;
    const initMoney = userLittleGame.initMoney;
    let result = {};
    if(Object.keys(remain).length > 1){
        const remainDistribute = Object.keys(remain).map(acer =>{
            return {key: acer, value: remain[acer]};
        });
        const select = util.selectElement(remainDistribute);
        remain[select]--;
        if(remain[select] == 0){
            delete remain[select];
        }
        result.open = select;
    }else if(Object.keys(remain).length == 1){
        const select = Object.keys(remain)[0];
        remain[select]--;
        if(remain[select] == 0){
            delete remain[select];
        }
        result.open = select;
    }else if(Object.keys(remain).length == 0){
        result.open = 'boom';
    }
    //计算该次翻出的元素的奖金
    result.award = parseInt(config.acerType[result.open] * initMoney);

    window[x][y] = result.open;
    if(result.open == 'boom'){
        const supply = userLittleGame.supply;
        supply[result.open]--;
        for(let i in window){
            for(let j in window[i]){
                if(window[i][j] == null){
                    const distribute = Object.keys(supply).map(e =>{
                        return {key: e, value: supply[e]};
                    });
                    const selectAdd = util.selectElement(distribute);
                    supply[selectAdd]--;
                    window[i][j] = selectAdd;                  
                    if(supply[selectAdd] == 0){
                        delete supply[selectAdd];
                    }
                }
            }
        }
        result.window = window;
        return result;
    }else{
        return result;
    }
};

const noWinWindow = exports.noWinWindow= (pass, bonusNum, freeNum) =>{
    let ele,num;
    if(bonusNum > 0){
        ele = 'S';
        num = bonusNum;
    }else if(freeNum > 0){
        ele = 'F';
        num = freeNum;
    }
    let window = generatorWindow(pass, true);
    let clearEle = windowClear(window.winIds, pass);
    let con = util.isVoid(clearEle);
    while(!con){
        window = generatorWindow(pass, true);
        clearEle = windowClear(window.winIds, pass);
        con = util.isVoid(clearEle);
    }
    while(num > 0){
        // console.log('while20');
        let col = Math.floor(Math.random() * window.winIds.length);
        let row = Math.floor(Math.random() * window.winIds[col].length);
        while(window.winIds[col][row] == ele){
            col = Math.floor(Math.random() * window.winIds.length);
            row = Math.floor(Math.random() * window.winIds[col].length);
        }
        window.winIds[col][row] = ele;
        num--;
    }
    return window;
}