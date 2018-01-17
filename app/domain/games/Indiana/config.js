'use strict';

//元素类型
const type = {
    'A': {
        name: ['白玉', '绿祖母', '红宝石'],
        weight: 10000,
        clearAward: {
            '1': [2,4,5,8,10,20,30,50,100,200,400],
            '2': [2,4,5,8,10,20,30,50,100,200,450],
            '3': [2,4,5,8,10,20,30,50,100,200,500],
        },
    },
    'B': {
        name: ['碧玉', '猫眼石', '绿宝石'],
        weight: 8000,
        clearAward: {
            '1': [4,5,10,20,30,50,100,250,500,750,800],
            '2': [4,5,10,20,30,50,100,250,500,750,1000],
            '3': [4,5,10,20,30,50,100,250,500,750,1200],
        },
    },
    'C': {
        name: ['墨玉', '紫水晶', '黄宝石'],
        weight: 7000,
        clearAward: {
            '1': [5,10,20,40,80,160,500,1000,2000,5000,6000],
            '2': [5,10,20,40,80,160,500,1000,2000,5000,7000],
            '3': [5,10,20,40,80,160,500,1000,2000,5000,8000],
        },
    },
    'D': {
        name: ['玛瑙', '翡翠', '蓝宝石'],
        weight: 5000,
        clearAward: {
            '1': [10,30,50,60,100,750,1000,10000,20000,50000,60000],
            '2': [10,30,50,60,100,750,1000,10000,20000,50000,70000],
            '3': [10,30,50,60,100,750,1000,10000,20000,50000,80000],
        },
    },
    'E': {
        name: ['琥珀', '珍珠', '钻石'],
        weight: 2000,
        clearAward: {
            '1': [20,50,100,500,1000,2000,5000,20000,50000,60000,80000],
            '2': [20,50,100,500,1000,2000,5000,20000,50000,60000,100000],
            '3': [20,50,100,500,1000,2000,5000,20000,50000,100000,100000],
        },
    },
    'F': {
        max: 3,
        name: 'free',
        weight: {
            '1': 20,
            '2': 12,
            '3': 8,
        },
    },
    'S': {
        max: 4, 
        name: 'bonus',
        weight: {
            '1': 10,
            '2': 6,
            '3': 3,
        },
    },
    'H': {
        max: 1,
        name: '铲子',
        weight: {
            '1': 1000,
            '2': 625,
            '3': 430,
        },
    },
};

//押注
const stake = {
    num: [1, 2, 3, 4, 5],
    odd: [100, 200, 500, 1000, 2000],
};

// 关卡
const checkPoint = {
    '1': 4,
    '2': 5,
    '3': 6,
};

//过关条件
const pass = {
    shovelNum: 15,
};

//奖池大奖
const jackpotBigWin = {
    '4': {name: 'king', ratio: 0.0008},
    '3': {name: 'diamond', ratio: 0.00008},
    '2': {name: 'platinum', ratio: 0.00005},
    '1': {name: 'gold', ratio: 0.00001},
};

//freespin 奖励
const freespin = {
    '1': [5, 1],
    '2': [10, 3],
    '3': [20, 5],
};

//奖池
const jackpot = {
    proportion: 0.1,
};

//特殊元素
const [free, bonus, shovel] = ['F', 'S', 'H'];

// 不同赔率下中奖页面情况分布
const winning = {
    '0.15' : [
        {'1': 1},     // 一个或两个界面
        {'2': 0},     // 三个界面
        {'3': 0},     // 四个及以上
    ],
    '0.55' : [
        {'1': 0.9},     // 一个或两个界面
        {'2': 0.1},     // 三个界面
        {'3': 0},     // 四个及以上
    ],
    '0.95' : [
        {'1': 0.8},     // 一个或两个界面
        {'2': 0.15},     // 三个界面
        {'3': 0.05},     // 四个及以上
    ],
    '1.65' : [
        {'1': 0.7},     // 一个或两个界面
        {'2': 0.2},     // 三个界面
        {'3': 0.1},     // 四个及以上
    ],
    '3.55' : [
        {'1': 0.6},     // 一个或两个界面
        {'2': 0.3},     // 三个界面
        {'3': 0.1},     // 四个及以上
    ],
    '7.55' : [
        {'1': 0.4},     // 一个或两个界面
        {'2': 0.3},     // 三个界面
        {'3': 0.3},     // 四个及以上
    ],
    '55.05' : [
        {'1': 0.3},     // 一个或两个界面
        {'2': 0.3},     // 三个界面
        {'3': 0.4},     // 四个及以上
    ],
    '5050.05' : [
        {'1': 0.1},     // 一个或两个界面
        {'2': 0.2},     // 三个界面
        {'3': 0.7},     // 四个及以上
    ],
    '10000' : [
        {'1': 0.05},     // 一个或两个界面
        {'2': 0.1},     // 三个界面
        {'3': 0.85},     // 四个及以上
    ],
};

//不同调控方式下赔率分布
const oddSelect = {
    '1': [
        {'0.15': 0.536897},
        {'0.55': 0.1},
        {'0.95': 0.2},
        {'1.65': 0.14},
        {'3.55': 0.02},
        {'7.55': 0.003},
        {'55.05': 0.0001},
        {'5050.05': 0.000002},
        {'10000': 0.000001},
    ],
    '2': [
        {'0.15': 0.6364897},
        {'0.55': 0.22},
        {'0.95': 0.1},
        {'1.65': 0.04},
        {'3.55': 0.003},
        {'7.55': 0.0005},
        {'55.05': 0.0001},
        {'5050.05': 0.0000002},
        {'10000': 0.0000001},
    ],
    '3':[
        {'0.15': 0.838},
        {'0.55': 0.1},
        {'0.95': 0.05},
        {'1.65': 0.01},
        {'3.55': 0.002},
        {'7.55': 0},
        {'55.05': 0},
        {'5050.05': 0},
        {'10000': 0},
    ]
};

//bonus 控制
const bonusControl = {
    '1': [   // 1-10W
        {'1': 0.001},
        {'void': 0.999},
    ],
    '2': [    //10-100W
        {'1': 0.0005},
        {'2': 0.001},
        {'void': 0.9985}
    ],
    '3': [     //100-1000W
        {'1': 0.0003},
        {'2': 0.0005},
        {'3': 0.001},
        {'4': 0.0005},
        {'void': 0.9977} 
    ],
    '4': [     // 1000W以上
        {'1': 0.0001},
        {'2': 0.0003},
        {'3': 0.0005},
        {'4': 0.001},
        {'void': 0.9981} 
    ]
};

//小游戏配置
const acer = {
    '1': {    
        r1: {silver: 1, weight: 10},
        r2: {silver: 2, weight: 10},
        r3: {silver: 3, weight: 15},
        r4: {silver: 4, weight: 20},
        r5: {gold: 1, weight: 10},
        r6: {silver: 6, weight: 10},
        r7: {gold:1, silver: 2, weight: 9},
        r8: {gold:1, silver: 3, weight: 5},
        r9: {gold:1, silver: 4, weight: 4},
        r10: {gold:1, silver:5, weight: 3},
        r11: {gold:2, silver: 1, weight: 1},
        r12: {gold:2, silver: 2, weight: 1},
        r13: {gold:2, silver: 5, weight: 0.5},
        r14: {gold:3, silver: 1, weight: 0.5},
        r15: {gold:3, silver: 2, weight: 0.5},
        r16: {gold:4, weight: 0.3},
        r17: {gold:4, silver: 5, weight: 0.2},
    },
    '2': {    
        r1: {silver: 1, weight: 10},
        r2: {silver: 2, weight: 10},
        r3: {silver: 3, weight: 15},
        r4: {silver: 4, weight: 20},
        r5: {gold: 1, weight: 10},
        r6: {silver: 6, weight: 10},
        r7: {gold:1, silver: 2, weight: 9},
        r8: {gold:1, silver: 3, weight: 5},
        r9: {gold:1, silver: 4, weight: 4},
        r10: {gold:1, silver:5, weight: 3},
        r11: {gold:2, silver: 1, weight: 1},
        r12: {gold:2, silver: 2, weight: 1},
        r13: {gold:2, silver: 5, weight: 0.5},
        r14: {gold:3, silver: 1, weight: 0.5},
        r15: {gold:3, silver: 2, weight: 0.5},
        r16: {gold:4, weight: 0.3},
        r17: {gold:4, silver: 5, weight: 0.2},
    },
    '3': {    
        r1: {silver: 1, weight: 10},
        r2: {silver: 2, weight: 10},
        r3: {silver: 3, weight: 15},
        r4: {silver: 4, weight: 20},
        r5: {gold: 1, weight: 10},
        r6: {silver: 6, weight: 10},
        r7: {gold:1, silver: 2, weight: 9},
        r8: {gold:1, silver: 3, weight: 5},
        r9: {gold:1, silver: 4, weight: 4},
        r10: {gold:1, silver:5, weight: 3},
        r11: {gold:2, silver: 1, weight: 1},
        r12: {gold:2, silver: 2, weight: 1},
        r13: {gold:2, silver: 5, weight: 0.5},
        r14: {gold:3, silver: 1, weight: 0.5},
        r15: {gold:3, silver: 2, weight: 0.5},
        r16: {gold:4, weight: 0.3},
        r17: {gold:4, silver: 5, weight: 0.2},
    }
};
const acerDistribute = {};
for(let i in acer){
    const distribute = Object.keys(acer[i]).map(t => {
        return {key: t, value: acer[i][t].weight}
    })
    acerDistribute[i] = distribute;
}

const littleGame = {
    '1': {
        range: [5, 4],  // 规格
        acer: acerDistribute['1'],
        num: {gold: 4, silver: 12, boom: 4},
    },
    '2': {
        range: [6, 5],
        acer: acerDistribute['2'],
        num: {gold: 6, silver: 18, boom: 6},
    },
    '3': {
        range: [6, 6],
        acer: acerDistribute['3'],
        num: {gold: 8, silver: 20, boom: 8},
    },
};

// 小游戏元素
const acerType = {
    gold: 1,
    silver: 0.2,
    boom: 0,
};

//记录玩家的铲子数
const shovelNum = {
    'system':{
        // roomCode: {uid}
    },
    /*
        viper: {}  
    */
};

module.exports = {
    type,
    checkPoint,
    pass,
    jackpotBigWin,
    freespin,
    jackpot,
    free,
    bonus,
    shovel,
    stake,
    ordinaryEle: ['A', 'B', 'C', 'D', 'E'],
    specialEle: ['F', 'S', 'H'],
    winning,
    oddSelect,
    bonusControl,

    littleGame,
    acer,
    acerType,
    shovelNum,
};