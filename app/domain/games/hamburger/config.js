'use strict';

//行列数
const row = 3;
const column = 5;
const wild = 'W';
const bonus = 'S';
const hamburger = 'J';


const type = {
    'A': {name:'A'},
    'B': {name:'K'},
    'C': {name:'Q'},
    'D': {name:'J'},
    'E': {name:'10'},
    'F': {name:'薯条'},
    'G': {name:'鸡腿'},
    'H': {name:'鸡翅'},
    'I': {name:'可乐'},
    'J': {name: '汉堡'},
    'W': {name:'WILD'},
    'S': {name: 'BONUS'}
};

const element = {
    general: ['A', 'B', 'C', 'D', 'E'],
    common: ['F', 'G', 'H', 'I', 'J'],
    special: ['W', 'S'],
};

//下层元素权重
const eleWeightDown = {
    '1':{
        'A': [90, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [60, 65, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 15, 25, 45, 100],
        'G': [40, 30, 20, 30, 80],
        'H': [50, 35, 30, 95, 85],
        'I': [20, 25, 25, 75, 70],
        'J': [12, 12, 5, 12, 10],
        'W': [0, 60.9, 60.9, 60.9, 0],
        'S': [50, 0, 50, 0, 50],
    },
    '2': {
        'A': [90, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [60, 65, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 15, 25, 45, 100],
        'G': [40, 30, 20, 30, 80],
        'H': [50, 35, 30, 95, 85],
        'I': [20, 25, 25, 75, 70],
        'J': [12, 12, 5, 12, 10],
        'W': [0, 43.4, 43.4, 43.4, 0],
        'S': [50, 0, 50, 0, 50],
    },
    '3': {
        'A': [90, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [60, 65, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 15, 25, 45, 100],
        'G': [40, 30, 20, 30, 80],
        'H': [50, 35, 30, 95, 85],
        'I': [20, 25, 25, 75, 70],
        'J': [12, 12, 5, 12, 10],
        'W': [0, 30.6, 30.6, 30.6, 0],
        'S': [50, 0, 50, 0, 50],
    }
};

//上层元素权重
const eleWeightUp = {
    '1':{
        'A': [99, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [65, 70, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 35, 25, 45, 100],
        'G': [30, 60, 60, 30, 80],
        'H': [25, 35, 25, 95, 85],
        'I': [35, 25, 30, 75, 70],
        'J': [6, 11, 5, 12, 10],
        'W': [0, 22.5, 22.5, 22.5, 0],
        'S': [50, 0, 50, 0, 50],
    },
    '2': {
        'A': [99, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [65, 70, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 35, 25, 45, 100],
        'G': [30, 60, 60, 30, 80],
        'H': [25, 35, 25, 95, 85],
        'I': [35, 25, 30, 75, 70],
        'J': [6, 11, 5, 12, 10],
        'W': [0, 15.4, 15.4, 15.4, 0],
        'S': [50, 0, 50, 0, 50],
    },
    '3': {
        'A': [99, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [65, 70, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 35, 25, 45, 100],
        'G': [30, 60, 60, 30, 80],
        'H': [25, 35, 25, 95, 85],
        'I': [35, 25, 30, 75, 70],
        'J': [6, 11, 5, 12, 10],
        'W': [0, 11.3, 11.3, 11.3, 0],
        'S': [50, 0, 50, 0, 50],
    }
};

//新人调控权重
const newerRegulationEleWeight = {
    down: {
        'A': [90, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [60, 65, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 15, 25, 45, 100],
        'G': [40, 30, 20, 30, 80],
        'H': [50, 35, 30, 95, 85],
        'I': [20, 25, 25, 75, 70],
        'J': [12, 12, 5, 12, 10],
        'W': [0, 56.4, 56.4, 56.4, 0],
        'S': [50, 0, 50, 0, 50],
    },
    up: {
        'A': [99, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [65, 70, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 35, 25, 45, 100],
        'G': [30, 60, 60, 30, 80],
        'H': [25, 35, 25, 95, 85],
        'I': [35, 25, 30, 75, 70],
        'J': [6, 11, 5, 12, 10],
        'W': [0, 20.6, 20.6, 20.6, 0],
        'S': [50, 0, 50, 0, 50],
    }
};

//整体返奖率大于0.85的元素权重
const wholeRegulationEleWeight1 = {
    down: {
        'A': [90, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [60, 65, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 15, 25, 45, 100],
        'G': [40, 30, 20, 30, 80],
        'H': [50, 35, 30, 95, 85],
        'I': [20, 25, 25, 75, 70],
        'J': [12, 12, 5, 12, 10],
        'W': [0, 39.4, 39.4, 39.4, 0],
        'S': [50, 0, 50, 0, 50],
    },
    up: {
        'A': [99, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [65, 70, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 35, 25, 45, 100],
        'G': [30, 60, 60, 30, 80],
        'H': [25, 35, 25, 95, 85],
        'I': [35, 25, 30, 75, 70],
        'J': [6, 11, 5, 12, 10],
        'W': [0, 12.6, 12.6, 12.6, 0],
        'S': [50, 0, 50, 0, 50],
    },
};
//整体返奖率小于0.6的元素权重
const wholeRegulationEleWeight2 = {
    down: {
        'A': [90, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [60, 65, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 15, 25, 45, 100],
        'G': [40, 30, 20, 30, 80],
        'H': [50, 35, 30, 95, 85],
        'I': [20, 25, 25, 75, 70],
        'J': [12, 12, 5, 12, 10],
        'W': [0, 58.4, 58.4, 58.4, 0],
        'S': [50, 0, 50, 0, 50],
    },
    up: {
        'A': [99, 100, 80, 85, 15],
        'B': [80, 85, 70, 60, 45],
        'C': [75, 70, 65, 70, 40],
        'D': [65, 70, 85, 15, 35],
        'E': [55, 60, 60, 20, 30],
        'F': [45, 35, 25, 45, 100],
        'G': [30, 60, 60, 30, 80],
        'H': [25, 35, 25, 95, 85],
        'I': [35, 25, 30, 75, 70],
        'J': [6, 11, 5, 12, 10],
        'W': [0, 20.6, 20.6, 20.6, 0],
        'S': [50, 0, 50, 0, 50],
    },
};

//中奖线
const winningLine = [
    [2, 2, 2, 2, 2],
    [1, 1, 1, 1, 1],
    [3, 3, 3, 3, 3],
    [1, 2, 3, 2, 1],
    [3, 2, 1, 2, 3],
    [2, 1, 1, 1, 2],
    [2, 3, 3, 3, 2],
    [1, 1, 2, 3, 3],
    [3, 3, 2, 1, 1],
    [2, 1, 2, 3, 2],
    [2, 3, 2, 1, 2],
    [1, 2, 2, 2, 1],
    [3, 2, 2, 2, 3],
    [1, 2, 1, 2, 1],
    [3, 2, 3, 2, 3],
    [2, 2, 1, 2, 2],
    [2, 2, 3, 2, 2],
    [1, 1, 3, 1, 1],
    [3, 3, 1, 3, 3],
    [1, 3, 3, 3, 1],
    [3, 1, 1, 1, 3],
    [2, 1, 3, 1, 2],
    [2, 3, 1, 3, 2],
    [1, 3, 1, 3, 1],
    [3, 1, 3, 1, 3],
];

//奖励设定
const awardSetting = {
    'A': [4, 16, 80],    
    'B': [6, 24, 120],   
    'C': [8, 32, 160], 
    'D': [10, 40, 200],    
    'E': [12, 48, 240],     
    'F': [24, 96, 480],     
    'G': [28, 112, 560],  
    'H': [40, 160, 800], 
    'I': [60, 240, 1200],
    'J': [80, 320, 10000], 
};
//特殊元素数量控制
const specialMaxNum = {
    'W': 4,
    'S': 3,
};

//放奖控制
const awardRegulation = {
    'system':{},
    'vip':{}
};

module.exports = {
    element,
    eleWeightDown,
    eleWeightUp,
    wholeRegulationEleWeight1,
    wholeRegulationEleWeight2,
    newerRegulationEleWeight,
    row,
    column,
    winningLine,
    awardSetting,
    specialMaxNum,
    linesNum: [9, 16, 25],
    bets: [10, 30, 100, 300, 1000, 3000, 10000],
    wild,
    bonus,
    hamburger,
    awardRegulation,
};