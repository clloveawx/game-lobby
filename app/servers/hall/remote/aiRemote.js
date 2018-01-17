'use strict';

const ordinaryPlatformMgr = require('../../../domain/ordinaryPlatform/ordinaryPlatformMgr');
const vipPlatformMgr = require('../../../domain/vipPlatform/PlatformMgr');
const GamesMgr = require('../../../domain/ordinaryPlatform/GamesMgr');
const msgService = require('../../../services/MessageService');

module.exports = function(app) {
	return new Remote(app);
};

var Remote = function(app) {
	this.app = app;
};


Object.assign(Remote.prototype, {

    //获取游戏房间信息
    gameAndRoomInfo ({nid, roomCode, viperId}, cb){
        if(!nid || !roomCode){
            return cb({error: '参数错误'});
        }
        const game = viperId ? vipPlatformMgr.getGameByUid(viperId, nid) : GamesMgr.getGame(nid);
        return cb(null, {room: game.rooms.find(room =>room.roomCode === roomCode)});
    },

    //进入房间
    enterRoom({nid, rcode, viperId, robot}, cb){
        if(!nid || !rcode){
            return cb({error: '参数错误'});
        }
        const game = viperId ? vipPlatformMgr.getGameByUid(viperId, nid) : GamesMgr.getGame(nid);
        if(!game){
            return cb({error:'获取游戏信息失败'})
        }
        // 获取游戏中的房间
        const room = game.rooms.find(room => room.roomCode == rcode);
        if(!room){
            return cb({error:'机器未找到'});
        }
        if(room.users.find(user => user.uid == robot.uid)){
            return cb({error:'玩家已在游戏中'});
        }
        if(room.users.length == game.roomUserLimit){
            return cb({error:'该机器无法容纳更多玩家'});
        }
        room.users.push(robot);
    
        const roomUids = [];
        game.rooms.forEach(room => roomUids.concat(room.users.map(user =>user.uid)));
        
        const msgUserIds = game.users.map(user => {
           return {uid:user.uid,sid:user.sid}
        }).filter(obj => !roomUids.includes(obj.uid));
        msgService.pushMessageByUids('changeRoomInfo', { //通知前端有人进入机器
            users: room.users,
            nid,
            roomCode: rcode,
        }, msgUserIds);
        cb(null);
    },


});