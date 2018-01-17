'use strict';

const BipaiMgr = require('../../../domain/transplant/bipai/BipaiMgr');
const Room = require('../../../domain/transplant/bipai/Room');
const utils = require('../../../utils');
const MessageService = require('../../../services/MessageService');

module.exports = function (app) {
    return new Remote(app);
};

var Remote = function (app) {
    this.app = app;
};

// 创建房间
function createRoom(app, stage, roomCode, isvip, uid, stageId) {
    const channel = app.channelService.createChannel('bipai' + roomCode);
    const room = new Room({
        nid: stageId,
        id: roomCode,
        channel: channel,
        isvip: isvip,
        vipRoomoWnerId: uid,
        maxCount: 5,
        entryCond: stage.entryCond,// 进入条件
        lowBet: stage.lowBet,// 底注
        capBet: stage.capBet,// 封顶
        allinMaxNum: stage.allinMaxNum,// 可以全下最大额度
    });
    if (isvip) {
        stage.roomsVip.push(room);
    } else {
        stage.rooms.push(room);
    }

    return room;
}

// 寻找房间
function searchRoom(app, stage, player, roomCode, isvip, uid, stageId, cb) {
    // 寻找一个空闲的房间
    let room;
    if (isvip) {
        room = stage.roomsVip.find(m => m.id === roomCode);
    } else {
        room = stage.rooms.find(m => m.id === roomCode);
    }

    if (!room) { // 如果没有找到 就创建一个出来
        room = createRoom(app, stage, roomCode, isvip, uid, stageId);
    }


    // 将玩家添加到房间
    const seat = room.addPlayer(player);
    if (seat === -1) {
        return cb('房间已满bipai');
    }

    cb('玩家进入比牌');
}

/**
 * 进入
 */
Remote.prototype.entry = function (player, stageId, roomCode, isvip, uid, cb) {
    const stage = BipaiMgr.getStage(stageId);
    if (!stage) {
        return cb('找不到游戏场');
    }

    // 找一个房间
    searchRoom(this.app, stage, player, roomCode, isvip, uid, stageId, cb);
};


/**
 * 退出
 */
Remote.prototype.exit = function (uid, stageId, isvip, roomCode, cb) {
    const stage = BipaiMgr.getStage(stageId);
    if (!stage) {
        return cb('找不到游戏场');
    }

    // 在所有房间里面找出玩家然后退出
    let room;
    if (isvip) {
        room = stage.roomsVip.find(m => m.hasPlayer(uid));
    } else {
        room = stage.rooms.find(m => m.hasPlayer(uid));
    }
    if (room) {
        // 游戏是否开始
        const player = room.getPlayer(uid);
        if (room.status === 'INGAME') {

            if (!player) return cb(null);
            // 是否弃牌 如果没有弃牌不能退出游戏
            if (player.status === 'GAME') {
                return cb('您有下注，游戏已经开始请耐心等待结束');
            }
        }
        console.log(uid + '玩家退出游戏');
        room.leave(player);
    }
    cb(null);
};

/**
 * 离线 - 直接强行离开
 */
Remote.prototype.leave = function (uid, stageId, isvip, cb) {
    const stage = BipaiMgr.getStage(stageId);
    if (!stage) {
        return cb({code: 500, err: '找不到游戏场'});
    }

    // 在所有房间里面找出玩家然后退出
    let room;
    if (isvip) {
        room = stage.roomsVip.find(m => m.hasPlayer(uid));
    } else {
        room = stage.rooms.find(m => m.hasPlayer(uid));
    }

    if (room) {
        const player = room.getPlayer(uid);
        if (!player) return cb(null);
        const seat = player.seat;
        // 先离线玩家
        room.leave(uid);
        // 检查 是不是还剩最后一个人了 就直接获胜
        (room.status === 'INGAME') && room.checkHasNextPlayer(seat);

    }
    cb(null);
};