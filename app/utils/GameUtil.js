'use strict';

// 0 - 12 // 黑桃 1 - 13
// 13 - 25 // 红桃 1 - 13
// 26 - 38 // 梅花 1 - 13
// 39 - 51 // 方块 1 - 13

// console.log(24%13, Math.floor(24/13), 24/13);

// 洗牌
exports.shuffle = function () {
    const cards = [];
    for (let i = 0; i < 52; i++) {// 52张牌
        cards.push(i);
    }
    // 打乱
    cards.sort(() => 0.5 - Math.random());
    // console.log(cards);
    return cards;
};

// 获取牌
exports.getPai = function (count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
        for (let p = 0; p < 52; p++) {
            cards.push(p);
        }
    }
    // 打乱
    cards.sort(() => 0.5 - Math.random());
    return cards;
};

/**
 * 获取牌型
 * 0 - 10 表示 没牛到牛牛
 * 11.银牛 12.金牛 13.炸弹
 */
const getCardType = exports.getCardType = function (cards) {
    //cow是牛 n是J,Q,K,10 的个数  total是总和
    let total = 0, cow = -1, num, value;
    const map = [];
    // 全部加1
    cards = cards.map(m => {
        num = m%13 + 1;
        value = map.find(m => m.id === num);
        value ? (value.count += 1) : map.push({id: num, count: 1});
        (num >= 10) && (num = 10);
        total += num;
        return num;
    });
    // console.log(cards);
    // console.log('total = ' + total);
    // console.log('map =', map);
    // 炸弹：4张相同点数的牌+1张散牌
    if(map.find(m => m.count === 4)){
        return 13;
    }
    // 五小：5张牌加起来小于等于10，且每张牌最大为4，比如【4、2、2、A、A】
    // if(total <= 10 && map.every(m => m.id <= 4)){
    // 	return 13;
    // }
    // 金牛：5张全是JQK
    if(map.every(m => m.id >= 11)){
        return 12;
    }
    // 银牛：五张牌都在10点以上，其中至少有一张10点
    const si = map.find(m => m.id === 10);
    if(si && si.count >= 1 && map.every(m => m.id >= 10)){
        return 11;
    }
    // 其他牛
    for (let i = 0; i < 4; i++) {
        for (let j = i+1; j < 5; j++) {
            if ((total - cards[i] - cards[j]) % 10 == 0) {
                cow = (cards[i] + cards[j]) % 10;
            }
        }
    }
    cow = cow === 0 ? 10 : cow;
    return cow = cow === -1 ? 0 : cow;
};

// 比牌
exports.bipai = function (players) {
    players.sort((a, b) => b.cardType - a.cardType);
    // 一样的话比 大小
    const list = players.filter(m => m.cardType === players[0].cardType);
    if(list.length > 0) {
        // 获取每个玩家最大的一张牌
        const max = list.map(m => {
            const arr = m.cards.slice();
            arr.sort((a, b) => b%13 - a%13);
            return {uid: m.uid, id: arr[0]%13, hua: Math.floor(arr[0]/13)};
        });
        // console.log(max);
        // 将牌 排序
        max.sort((a, b) => b.id - a.id);
        let uid = max[0].uid;
        // 是否有一样的 如果一样大 比花色
        const ls = max.filter(m => m.id === max[0].id);
        if(ls.length > 0) {
            // console.log(ls);
            ls.sort((a, b) => a.hua - b.hua);
            uid = ls[0].uid;
        }
        return players.find(m => m.uid === uid);
    }
    return players[0];
};

// 比牌 两个人比
exports.bipaiSole = function (fight1, fight2) {
    // 一样大 比点数
    if(fight1.cardType === fight2.cardType) {
        const arr1 = fight1.cards.slice().sort((a, b) => b%13 - a%13);
        const arr2 = fight2.cards.slice().sort((a, b) => b%13 - a%13);
        const max1 = arr1[0]%13, max2 = arr2[0]%13;
        // 点数一样 比花色
        if(max1 === max2) {
            return arr1[0]/13 < arr2[0]/13;
        }
        return max1 > max2;
    }
    return fight1.cardType > fight2.cardType;
};

// 获取牌型 - 百家乐
const getCardTypeTo9 = exports.getCardTypeTo9 = function (cards) {
    let ret = 0;
    cards.forEach(m => {
        let num = m%13+1;
        ret += (num >= 10 ? 0 : num);
    });
    ret = ret % 10;
    return ret;
};

// 检查 闲 是否需要补第三张牌 - 百家乐
exports.canBupaiByPlay = function (cardType0, cardType1) {
    // 只要是8点及以上，胜负已定
    if(cardType0 >= 8 || cardType1 >= 8) {
        return false;
    }
    // 点数是5点或以下必须要牌
    return cardType0 <= 5;
};

// 检查 庄 是否需要补第三张牌  - 百家乐
exports.canBupaiByBank = function (cardType0, cardType1, bupai = -1) {
    if(bupai !== -1) {
        bupai = bupai%13+1;
        bupai = bupai >= 10 ? 0 : bupai;
    }
    // 只要是8点及以上，胜负已定 或者 7点也不得补牌
    if(cardType0 >= 8 || cardType1 >= 8 || cardType1 === 7) {
        return false;
    }
    // 点数是2点或以下必须要牌 或者闲没有补牌
    if(cardType1 <= 2 || (bupai === -1 && cardType1 <= 5)) {
        return true;
    }
    // 点数3 若闲补的不是8点
    if(cardType1 === 3 && bupai !== 8) {
        return true;
    }
    // 点数4 若闲补的不是0，1，8，9点
    if(cardType1 === 4 && [0,1,8,9].indexOf(bupai) === -1) {
        return true;
    }
    // 点数5 若闲补的不是0，1，2，3，8，9点
    if(cardType1 === 5 && [0,1,2,3,8,9].indexOf(bupai) === -1) {
        return true;
    }
    // 点数6 若闲补的是6，7点
    if(cardType1 === 6 && [6,7].indexOf(bupai) !== -1) {
        return true;
    }
    return false;
};

// 是否对
const hasPair = function (cards) {
    return cards[0]%13 === cards[1]%13;
};

// 获取结果 - 百家乐
exports.getResultTo9 = function (cards0, cards1, cardType0, cardType1) {
    const ret = {};
    if(cardType0 > cardType1) {
        ret.play = true; // 闲赢
    } else if(cardType0 < cardType1) {
        ret.bank = true; // 庄赢
    } else {
        ret.draw = true; // 和局
    }
    if(cards0.length+cards1.length > 4) {
        ret.big = true; // 大
    } else {
        ret.small = true; // 小
    }
    if(hasPair(cards0)) {
        ret.pair0 = true;// 闲对
    }
    if(hasPair(cards1)) {
        ret.pair1 = true;// 庄对
    }
    return ret;
};


// 是否顺子
const checkShunzi = function (cards) {
    let i = 0;
    if (cards[0] === 0 && cards[4] === 12) {
        i = 1;
    }
    // console.log(cards);
    for (; i < cards.length-1; i++) {
        if (cards[i]+1 !== cards[i+1]) {
            return false;
        }
    }
    return true;
};

// 检查相同的
const checkAlike = function (cards) {
    const obj = {};
    for (let i = 0; i < cards.length; i++) {
        if(obj[cards[i]]) {
            obj[cards[i]] += 1;
        } else {
            obj[cards[i]] = 1;
        }
    }
    const ret = {};
    for (let key in obj) {
        if (ret[obj[key]]) {
            ret[obj[key]] += 1;
        } else {
            ret[obj[key]] = 1;
        }
    }
    return ret;
};

// 获取结果 - ATT
exports.getResultByAtt = function (cards) {
    const arr = cards.map(m => m%13);
    arr.sort((a, b) => a - b);
    // 是否顺子
    const isShunzi = checkShunzi(arr);
    // 是否同花
    const isTonghua = cards.every(m => Math.floor(cards[0]/13) === Math.floor(m/13));
    // 相同的个数
    const alikeCount = checkAlike(arr);
    // 如果是顺子又是同花而且第一个还是10  --- 皇家同花顺
    if (isShunzi && isTonghua && arr[0] === 0 && arr[4] === 12) {
        return {id: 0, mul: 10000};
    }
    // 如果是顺子又是同花 --- 同花顺
    if (isShunzi && isTonghua) {
        return {id: 1, mul: 200};
    }
    // --- 四条
    if (alikeCount[4] === 1) {
        return {id: 2, mul: 75};
    }
    // --- 葫芦
    if (alikeCount[3] === 1 && alikeCount[2] === 1) {
        return {id: 3, mul: 18};
    }
    // --- 同花
    if (isTonghua) {
        return {id: 4, mul: 12};
    }
    // --- 顺子
    if (isShunzi) {
        return {id: 5, mul: 21};
    }
    // --- 三条
    if (alikeCount[3] === 1) {
        return {id: 6, mul: 3};
    }
    // --- 两对
    if (alikeCount[2] === 2) {
        return {id: 7, mul: 2};
    }
    return null;
};

// console.log(getCardType([0,2,0,0,3]));
// const players = [
// 	{uid: 1, cards: [12,12,23,41,52], cardType: getCardType([12,12,23,41,52])},
// 	{uid: 2, cards: [0,2,0,0,3], cardType: getCardType([0,2,0,0,3])},
// 	{uid: 3, cards: [0,2,0,0,16], cardType: getCardType([0,2,0,0,16])},
// ];

// console.log(players);
// console.log(this.bipai(players));

// console.log(this.getCardTypeTo9([0,12,22]));
// console.log(this.getResultByAtt([13,1,2,3,4]));