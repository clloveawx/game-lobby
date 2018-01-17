'use strict';

const util = require('../../../utils');

const types = {  //开奖类型
    areas: 'areas',
    killall: 'killall',
    allAreas: 'allAreas'
};
const upWeight = {  //派系权重
    e1: 1,
    e2: 1,
    e3: 1,
    e4: 1,
    e5: 1,
    e6: 1
};

const wholeRegulationUpWeight = {  //整体调控派系权重
    e1: 320,
    e2: 43,
    e3: 60,
    e4: 12,
    e5: 15,
    e6: 5
};

const specialWeight = {   //特殊事件权重
    b1: 20,
    b2: 20,
    b3: 28,
    b4: 18,
    b5: 60,
    b6: 14,
    order: 9840
};
const slotsUp = {   //  派系
    e1: { name: '北派', weight: upWeight.e1, odds: 6 },
    e2: { name: '粤系', weight: upWeight.e2, odds: 6 },
    e3: { name: '川系', weight: upWeight.e3, odds: 6 },
    e4: { name: '江浙系', weight: upWeight.e4, odds: 6 },
    e5: { name: '云贵系', weight: upWeight.e5, odds: 6 },
    e6: { name: '湘系', weight: upWeight.e6, odds: 6 }
};
// [e{1, 2, 3, 4, 5, 6}_{1, 2, 3}]
const slotsDown = Object.keys(slotsUp).reduce((arr, eId) => arr.concat([eId + '_1', eId + '_2', eId + '_3']), []);

const matchType = {
    s: 'b',
    order: 'order'
};
const base = [
    { id: 'l1', name: '耗儿鱼' },
    { id: 'l2', name: '鸡爪' },
    { id: 'l3', name: '牛肉' },
    { id: 'l4', name: '香菜丸子' },
    { id: 'r1', name: '白菜' },
    { id: 'r2', name: '莲藕' },
    { id: 'r3', name: '黄瓜' },
    { id: 'r4', name: '香菇' },
    { id: 's1', name: '人参' },
    { id: 's2', name: '霸王蟹' },
];
const special = [
    { id: 'b1', name: '纵横', type: 'areas', areas: ['l1', 'l2', 'l3', 'l4'], weight: specialWeight.b1 },
    { id: 'b2', name: '四海', type: 'areas', areas: ['r1', 'r2', 'r3', 'r4'], weight: specialWeight.b2 },
    { id: 'b3', name: '天元', type: 'areas', areas: ['l3', 'l4', 'r3', 'r4'], weight: specialWeight.b3 },
    { id: 'b4', name: '地和', type: 'areas', areas: ['l1', 'l2', 'r1', 'r2'], weight: specialWeight.b4 },
    { id: 'b5', name: '通杀', type: 'killall', weight: specialWeight.b5 },
    {
        id: 'b6',
        name: '大满贯',
        type: 'allAreas',
        areas: ['l1', 'l2', 'l3', 'l4', 'r1', 'r2', 'r3', 'r4'],
        weight: specialWeight.b6
    },
    { id: 'order', name: '随机点菜', weight: specialWeight.order },
];
const oddsWeight = {
    e1: {
        l1: { bonusOdds: 2, odds: 2, weight: 0.2403644112 },//0.238064411
        l2: { bonusOdds: 4, odds: 4, weight: 0.117584154 },
        l3: { bonusOdds: 6, odds: 6,  weight:0.0756538104 },
        l4: { bonusOdds: 12,odds: 12,weight: 0.0347286244  },
        r1: { bonusOdds: 2, odds: 2, weight: 0.2403644112 },
        r2: { bonusOdds: 4, odds: 4, weight: 0.117584154 },
        r3: { bonusOdds: 6, odds: 6,  weight:0.0756538104 },
        r4: { bonusOdds: 12,odds: 12,weight: 0.0347286244  },
        s1: { bonusOdds: 14,odds: 18,weight: 0.0271273484  },
        s2: { bonusOdds: 16,odds: 24,weight: 0.0202106516, range: [6, 25] },
    },
    e2: {
        l1: { bonusOdds: 10, odds: 2, weight: 0.2403644112 },
        l2: { bonusOdds: 20, odds: 4, weight: 0.117584154 },
        l3: { bonusOdds: 30, odds: 6,  weight:0.0756538104 },
        l4: { bonusOdds: 60, odds: 12, weight: 0.0347286244  },
        r1: { bonusOdds: 10, odds: 2, weight: 0.2403644112 },
        r2: { bonusOdds: 20, odds: 4, weight: 0.117584154 },
        r3: { bonusOdds: 30, odds: 6,  weight:0.0756538104 },
        r4: { bonusOdds: 60, odds: 12, weight: 0.0347286244  },
        s1: { bonusOdds: 70, odds: 18, weight: 0.0271273484  },
        s2: { bonusOdds: 80, odds: 24, weight: 0.0202106516, range: [6, 25] },
    },
    e3: {
        l1: { bonusOdds: 14, odds: 2, weight: 0.2403644112 },
        l2: { bonusOdds: 28, odds: 4, weight: 0.117584154 },
        l3: { bonusOdds: 42, odds: 6,  weight:0.0756538104 },
        l4: { bonusOdds: 84, odds: 12, weight: 0.0347286244  },
        r1: { bonusOdds: 14, odds: 2, weight: 0.2403644112 },
        r2: { bonusOdds: 28, odds: 4, weight: 0.117584154 },
        r3: { bonusOdds: 42, odds: 6,  weight:0.0756538104 },
        r4: { bonusOdds: 84, odds: 12, weight: 0.0347286244  },
        s1: { bonusOdds: 98, odds: 18, weight: 0.0271273484  },
        s2: { bonusOdds: 112,odds: 24,weight: 0.0202106516, range: [6, 25] },
    },
    e4: {
        l1: { bonusOdds: 6, odds: 2,  weight: 0.2403644112 },
        l2: { bonusOdds: 12,odds: 4, weight: 0.117584154 },
        l3: { bonusOdds: 18,odds: 6, weight: 0.0756538104 },
        l4: { bonusOdds: 36,odds: 12,weight:  0.0347286244 },
        r1: { bonusOdds: 6, odds: 2,  weight: 0.2403644112 },
        r2: { bonusOdds: 12,odds: 4, weight: 0.117584154 },
        r3: { bonusOdds: 18,odds: 6,  weight:0.0756538104 },
        r4: { bonusOdds: 36,odds: 12, weight: 0.0347286244  },
        s1: { bonusOdds: 42,odds: 18, weight: 0.0271273484  },
        s2: { bonusOdds: 48,odds: 24, weight: 0.0202106516, range: [6, 25] },
    },
    e5: {
        l1: { bonusOdds: 18, odds: 2, weight: 0.2403644112 },
        l2: { bonusOdds: 36, odds: 4, weight: 0.117584154 },
        l3: { bonusOdds: 54, odds: 6,  weight: 0.0756538104 },
        l4: { bonusOdds: 108,odds: 12, weight: 0.0347286244 },
        r1: { bonusOdds: 18, odds: 2, weight: 0.2403644112 },
        r2: { bonusOdds: 36, odds: 4, weight: 0.117584154 },
        r3: { bonusOdds: 54, odds: 6,  weight: 0.0756538104 },
        r4: { bonusOdds: 108,odds: 12, weight: 0.0347286244 },
        s1: { bonusOdds: 126,odds: 18, weight: 0.0271273484 },
        s2: { bonusOdds: 144,odds: 24, weight: 0.0202106516, range: [6, 25] },
    },
    e6: {
        l1: { bonusOdds: 22, odds: 2, weight: 0.2403644112 },
        l2: { bonusOdds: 44, odds: 4, weight: 0.117584154 },
        l3: { bonusOdds: 66, odds: 6,  weight: 0.0756538104 },
        l4: { bonusOdds: 132,odds: 12, weight: 0.0347286244 },
        r1: { bonusOdds: 22, odds: 2, weight: 0.2403644112 },
        r2: { bonusOdds: 44, odds: 4, weight: 0.117584154 },
        r3: { bonusOdds: 66, odds: 6,  weight: 0.0756538104 },
        r4: { bonusOdds: 132,odds: 12, weight: 0.0347286244 },
        s1: { bonusOdds: 154,odds: 18, weight: 0.0271273484 },
        s2: { bonusOdds: 176,odds: 24, weight: 0.0202106516, range: [6, 25] },
    },
};
const singOdd = {};
for (let i in oddsWeight) {
    singOdd[i] = {};
    for (let j in oddsWeight[i]) {
        singOdd[i][j] = oddsWeight[i][j].odds;
    }
}

const oddsRate = { e1: 1, e2: 5, e3: 7, e4: 3, e5: 9, e6: 11 };
const kingCrab = 's2';
const ginseng = 's1';
const factionForRound = 'e1';
const construction = {};
Object.keys(oddsWeight).forEach(faction => {
    construction[faction] = {
        o: base.map(o => {
            if (o.id == kingCrab) {
                o.range = oddsWeight[faction][o.id].range;
            }
            o.odds = oddsWeight[faction][o.id].odds;
            o.weight = oddsWeight[faction][o.id].weight;
            o.bonusOdds = oddsWeight[faction][o.id].bonusOdds;
            return o;
        }),
        s: util.clone(special)
    };
})

// const configConstructor = {};
// for(let i = 1;i <= 3; i++){
//     for(let j = 1;j <= 66; j++){
//         configConstructor[i.toString()+j.toString()] = util.clone(construction);
//     }
// }
const specialWeightMod = {
    b1: 15,
    b2: 15,
    b3: 9,
    b4: 42,
    b5: 36,
    b6: 3,
    order: 880
};

let slotsUpProcessed = [];
for (let key in slotsUp) {
    slotsUpProcessed.push({ id: key, name: slotsUp[key].name, odds: slotsUp[key].odds });
}

//=====================

const dishes = {
    l1: { odds: 2, weight: 0.2403644112 },
    l2: { odds: 4, weight: 0.117584154 },
    l3: { odds: 6, weight: 0.0756538104 },
    l4: { odds: 12, weight: 0.0347286244 },
    r1: { odds: 2, weight: 0.2403644112 },
    r2: { odds: 4, weight: 0.117584154 },
    r3: { odds: 6, weight: 0.0756538104 },
    r4: { odds: 12, weight: 0.0347286244 },
    s1: { odds: 18, weight: 0.0271273484 },
    s2: { odds: 24, weight: 0.0202106516 }
};

const dishesWhenDealerIsReal = {
    l1: { odds: 2, weight: 0.2403644112 },
    l2: { odds: 4, weight: 0.117584154 },
    l3: { odds: 6, weight: 0.0756538104 },
    l4: { odds: 12, weight: 0.0347286244 },
    r1: { odds: 2, weight: 0.2403644112 },
    r2: { odds: 4, weight: 0.117584154 },
    r3: { odds: 6, weight: 0.0756538104 },
    r4: { odds: 12, weight: 0.0347286244 },
    s1: { odds: 18, weight: 0.0271273484 },
    s2: { odds: 24, weight: 0.0202106516 }
};


const specialWeightWhenDealerIsReal = {
    b1: 20,
    b2: 20,
    b3: 28,
    b4: 18,
    b5: 60,
    b6: 14,
    order: 9840
};


module.exports = {
    slots: {
        types: types,
        up: slotsUp,
        wholeUp: wholeRegulationUpWeight,
        down: slotsDown,
        matchType: matchType,
        specialWeightMod: specialWeightMod,
        singOdd: singOdd,
        taste: { "l": 2, "r": 2 }
    },
    betAreas: {
        group: [
            { id: 'l', name: '清汤', odds: 2 },
            { id: 'r', name: '红汤', odds: 2 },
        ],
        taste: {
            "l": { odds: 2 },
            "r": { odds: 2 }
        },
        cookStyle: {
            "e1": { odds: 6 },
            "e2": { odds: 6 },
            "e3": { odds: 6 },
            "e4": { odds: 6 },
            "e5": { odds: 6 },
            "e6": { odds: 6 }
        },
        single: construction,
        kingCrab: kingCrab,
        ginseng,
        ordinary: base.filter(base => !base.id.startsWith('s')).map(area => area.id),
        special: base.filter(base => base.id.startsWith('s')).map(area => area.id),
        singleForRound: base.map(o => {
            o.odds = oddsWeight[factionForRound][o.id].odds;
            o.weight = oddsWeight[factionForRound][o.id].weight;
            return o;
        }),
        oddsRate: oddsRate,
        up: slotsUpProcessed
    },
    onBankCondition: 2000000,
    oddsWeight: oddsWeight,
    //======
    dishes,
    dishesWhenDealerIsReal,
    specialWeight,
    specialWeightWhenDealerIsReal
};

