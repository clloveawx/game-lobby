'use strict';

const nicknameConfig = require('../../config/data/randomNickname.json');
const Util = require('../../app/utils');

/**
 * 获取一个随机的昵称
 * */
exports.getRandomNickname = function () {
    const prop = [
        {key: 2, value: 0.2},
        {key: 3, value: 0.35},
        {key: 4, value: 0.2},
        {key: 5, value: 0.1},
        {key: 6, value: 0.15},
    ];
    let index = 0;
    let nickname = "";
    const num = +Util.selectElement(prop);
    switch (num) {
        case 2:
            index = Util.random(0,  nicknameConfig.twoChar.length - 1);
            nickname = nicknameConfig.twoChar[index];
            break;
        case 3:
            index = Util.random(0,  nicknameConfig.threeCharOnly.length - 1);
            nickname = nicknameConfig.threeCharOnly[index];
            break;
        case 4:
            index = Util.random(0,  nicknameConfig.twoChar.length - 1);
            nickname = nicknameConfig.twoChar[index];
            index = Util.random(0,  nicknameConfig.twoCharBack.length - 1);
            nickname += nicknameConfig.twoCharBack[index];
            break;
        case 5:
            index = Util.random(0,  nicknameConfig.threeCharFront.length - 1);
            nickname = nicknameConfig.threeCharFront[index];
            index = Util.random(0,  nicknameConfig.twoChar.length - 1);
            nickname += nicknameConfig.twoChar[index];
            break;
        case 6:
            index = Util.random(0,  nicknameConfig.englishName.length - 1);
            nickname = nicknameConfig.englishName[index];
            break;
        default:
            Logger.error("随机的昵称长度有误:" + num);
    }
    return nickname;
};