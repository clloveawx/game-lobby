/**
 * Created by 14060 on 2017/10/12.
 */
const type = {
    '0': {name:'J'},
    '1': {name:'Q'},
    '2': {name:'K'},
    '3': {name:'枪'},
    '4': {name:'酒'},
    '5': {name:'帽子'},
    '6': {name:'罗盘'},
    '7': {name:'地图'},
    '8': {name:'小美人'},
    '9': {name:'金币'},
    '10': {name:'大美人'}
};
//押注倍数
const betMultiple = {
    1:5,
    2:20,
    3:100,
    4:500,
    5:2000,
    6:10000
}
//押注倍数索引
const betIndex = {
    5:0,
    25:1,
    50:2,
    250:3
}
//中奖线
const winningLine = [
    [1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2],
    [3, 3, 3, 3, 3],
    [1, 2, 1, 2, 1],
    [2, 3, 2, 3, 2],
    [3, 4, 3, 4, 3],
    [1, 3, 1, 3, 1],
    [2, 4, 2, 4, 2],
    [3, 2, 3, 2, 3],
    [1, 4, 1, 4, 1],

    [2, 2, 1, 2, 2],
    [1, 2, 3, 2, 1],
    [1, 1, 2, 1, 1],
    [3, 1, 3, 1, 3],
    [1, 2, 2, 2, 1],
    [2, 3, 3, 3, 2],
    [3, 3, 2, 3, 3],
    [2, 1, 2, 1, 2],
    [1, 4, 3, 4, 1],
    [3, 3, 1, 3, 3],

    [2, 3, 1, 3, 2],
    [1, 3, 2, 3, 1],
    [2, 4, 3, 4, 2],
    [3, 2, 1, 2, 3],
    [3, 1, 2, 1, 3],
    [1, 3, 3, 3, 1],
    [3, 4, 1, 4, 3],
    [2, 2, 2, 2, 1],
    [2, 2, 2, 3, 3],
    [2, 1, 2, 4, 2],

    [1, 1, 2, 4, 3],
    [1, 2, 1, 1, 1],
    [1, 2, 1, 2, 2],
    [1, 3, 2, 3, 3],
    [1, 3, 2, 2, 3],
    [1, 4, 2, 1, 3],
    [1, 1, 1, 2, 2],
    [3, 4, 3, 3, 2],
    [3, 4, 2, 1, 1],
    [3, 3, 3, 4, 3],

    [3, 3, 2, 3, 2],
    [3, 2, 2, 3, 1],
    [2, 4, 1, 4, 2],
    [2, 1, 3, 1, 2],
    [3, 4, 2, 4, 3],
    [3, 3, 2, 2, 2],
    [2, 2, 1, 2, 1],
    [3, 3, 3, 3, 2],
    [1, 2, 2, 3, 3],
    [3, 3, 2, 2, 1],
];

//元素权重
const element = [
    {0:174, 1:161,  2:105,  3:105,   4:49,   5:37,   6:24,   7:6,   8:23.1,    9:1,   10:12},
    {0:150, 1:123,  2:116,  3:54,   4:82,   5:41,   6:54,   7:5,   8:25.1,    9:1,   10:0},
    {0:104, 1:80,  2:98,  3:98,   4:69,   5:127,   6:69,   7:3,   8:21.1,    9:1,   10:11},
    {0:130,  1:123,   2:101,   3:87,  4:79,  5:58,  6:43,   7:4,   8:27.1,    9:1,   10:0},
    {0:92,  1:92,   2:93,   3:82,  4:92,  5:92,  6:92,   7:5,   8:20.1,    9:1,   10:10}
];

//元素权重Freespin
const elementFreespin = [
    {0:174, 1:161,  2:105,  3:105,   4:49,   5:37,   6:24,   7:6,   8:23.1,    9:0,   10:12},
    {0:150, 1:123,  2:116,  3:54,   4:82,   5:41,   6:54,   7:5,   8:25.1,    9:0,   10:0},
    {0:104, 1:80,  2:98,  3:98,   4:69,   5:127,   6:69,   7:3,   8:21.1,    9:0,   10:11},
    {0:130,  1:123,   2:101,   3:87,  4:79,  5:58,  6:43,   7:4,   8:27.1,    9:0,   10:0},
    {0:92,  1:92,   2:93,   3:82,  4:92,  5:92,  6:92,   7:5,   8:20.1,    9:0,   10:10}
];

//元素倍数
const eleMu = {
    0: [4,  12,  48],
    1: [6,  18, 72],
    2: [8,  24, 96],
    3: [16, 48,192],
    4: [24, 72,288],
    5: [32, 96,384],
    6: [45, 135,540],
    7: [60,180,720],
    8: [0,  0,  1000],
    9: [0,  0,  0],
    10:[0,  0,  0]
}

//连线位置偏移量
const offset = {
    offset1:-40,
    offset2:40
}
//在-50和50之间随机
const offsetWeight=[
    {name: -40,probability: 0.5},
    {name: 40,probability: 0.5}
]
//按权重随机元素
const elementWeightSetting = function (element) {
    let aetherG = [
        {name: '0',probability: element[0]},
        {name: '1',probability: element[1]},
        {name: '2',probability: element[2]},
        {name: '3',probability: element[3]},
        {name: '4',probability: element[4]},
        {name: '5',probability: element[5]},
        {name: '6',probability: element[6]},
        {name: '7',probability: element[7]},
        {name: '8',probability: element[8]},
        {name: '9',probability: element[9]},
        {name: '10',probability: element[10]}
    ]
    return aetherG;
}

/*海盗船猜宝箱元素
1.mini-jackpot
2.mega-jackpot
3.monster-jackpot
4.clolssal-jackpot
5.freespin-5
6.freespin-10
7.freespin-15
8.gold-5
9.gold-10
10.gold-20
11.gold-50
12.gold-100
13.gold-1000
14.gold-10000
15.openBox-2
16.openBox-3
17.transparent
*/
const pirateBox ={
    gold:[//金币奖
        {name:8,probability:15.89},
        {name:9,probability:25},
        {name:10,probability:35},
        {name:11,probability:23},
        {name:12,probability:1},
        {name:13,probability:0.1},
        {name:14,probability:0.01}
    ],
    freespin:[//freespin奖
        {name:5,probability:70},
        {name:6,probability:20},
        {name:7,probability:10}
    ],
    special:[
        //特殊奖
        {name:1, probability:1},
        {name:2,probability:0.5},
        {name:3,probability:0.2},
        {name:4,probability:0.1},
        {name:15,probability:30},
        {name:16,probability:40},
        {name:17,probability:28.2}
    ]
}






//随机一个位置
const arrIndex = [
    {name:0,probability:1},
    {name:1,probability:1},
    {name:2,probability:1}
]

//jackpot倍数
const jackpotM={
    1:{m:800,p:10},
    2:{m:1200,p:20},
    3:{m:1600,p:40},
    4:{m:2400,p:80}
}

//金币倍数奖励
const goldM = {
    5:5,
    6:10,
    7:15,
    8:1,
    9:2,
    10:5,
    11:10,
    12:20,
    13:40,
    14:75,
    15:2,
    16:3
}
//jackpot奖池金额规则
const jackpotMoney = {
    'jackpotOdds': 0.17,
    'colossal': 0.0004,
    'monster': 0.0002,
    'mega': 0.0001,
    'mini': 0.00005,
};

//随机时间
const releaseTime = {
    startTime:5000,
    endTime:300000
}
const releaseTime2 = {
    startTime:5,
    endTime:15
}
module.exports = {
    betMultiple:betMultiple,//押注倍数
    element:element,//权重配置
    elementFreespin:elementFreespin,//Freespin模式下元素权重
    elementWeightSetting:elementWeightSetting,//元素概率
    winningLine:winningLine,//中奖线
    eleMu:eleMu,//元素倍数
    offset:offset,//连线位置便宜量
    offsetWeight:offsetWeight,
    pirateBox:pirateBox,//宝箱元素
    arrIndex:arrIndex,//随机一个数组索引
    betIndex:betIndex,//押注倍数数组索引
    jackpotM:jackpotM,//海盗船宝箱元素奖池倍数
    jackpotMoney:jackpotMoney,//jackpot奖池金额规则
    goldM:goldM,//宝箱金币倍数
    releaseTime:releaseTime,//随机时间
    releaseTime2:releaseTime2//随机时间


}