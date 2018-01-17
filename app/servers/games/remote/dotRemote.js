'use strict';

const DotMgr = require('../../../domain/transplant/Dot/DotMgr');
const Room = require('../../../domain/transplant/Dot/Room');
const utils = require('../../../utils');
const MessageService = require('../../../services/MessageService');
const RobotMge = require('../../../domain/transplant/robot/RobotMgr');
module.exports = function(app) {
    return new Remote(app);
};

var Remote = function(app) {
    this.app = app;
};

// 创建房间
function createRoom (app, stage,roomCode,isvip,uid,stageId) {
    const channel = app.channelService.createChannel('21dot'+roomCode);
    const room = new Room({nid:stageId,id:roomCode, channel: channel,isvip:isvip,vipRoomoWnerId:uid});
    if(isvip){
        stage.roomsVip.push(room);
    }else{
        stage.rooms.push(room);
    }
    return room;
}

// 寻找房间
function searchRoom (app, stage, player,roomCode,isvip,uid,stageId, cb) {
    // 寻找一个空闲的房间
    let room;
    if(isvip){
        room = stage.roomsVip.find(m => m.id === roomCode);
    }else{
        room = stage.rooms.find(m => m.id === roomCode);
    }

    if(!room){ // 如果没有找到 就创建一个出来
        room = createRoom(app, stage,roomCode,isvip,uid,stageId);
    }
    // 将玩家添加到房间
    const seat = room.addPlayer(player);
    if(seat === -1){
        return cb('房间已满');
    }
    cb('玩家进入21点');
}

function colseRoom(room) {
    let exitPlayer = room.players.find(m=> m && m.isPlay == 'PLAY');
    if(room.players.length<=6 && !exitPlayer){
        room.colseRoom();
        console.log('最后一个玩家退出21，关闭房间');
    }
}

/**
 * 进入
 */
Remote.prototype.entry = function(player, stageId,roomCode,isvip,uid, cb) {
    const stage = DotMgr.getStage(stageId);
    if(!stage){
        return cb('找不到游戏场');
    }
    // 找一个房间
    searchRoom(this.app, stage, player,roomCode,isvip,uid,stageId, cb);
};

/**
 * 退出
 */
Remote.prototype.exit = function(uid, stageId,isvip,roomCode,cb) {
    const stage = DotMgr.getStage(stageId);
    if(!stage){
        return cb('找不到游戏场');
    }

    // 在所有房间里面找出玩家然后退出
    let room;
    if(isvip){
        room = stage.roomsVip.find(m => m.hasPlayer(uid));
    }else{
        room = stage.rooms.find(m => m.hasPlayer(uid));
    }
    if(!room){
        return cb('玩家不在这个房间');
    }
    const player = room.getPlayer(uid);
    if(player.bet){
        return cb('你有下注不能离开这个房间');
    }
    room.leave(uid,false);
    colseRoom(room);
    return cb(null);
};

/**
 * 离线 - 直接强行离开
 */
Remote.prototype.leave = function(uid, stageId,isvip, cb) {
    const stage = DotMgr.getStage(stageId);
    if(!stage){
        return cb('找不到游戏场');
    }

    // 在所有房间里面找出玩家然后退出
    let room;
    if(isvip){
        room = stage.roomsVip.find(m => m.hasPlayer(uid));
    }else{
        room = stage.rooms.find(m => m.hasPlayer(uid));
    }
    if(!room){
        return cb('玩家不在这个房间');
    }
    room.leave(uid,true);
    colseRoom(room);

    cb(null);
};