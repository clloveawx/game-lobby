'use strict';

const BairenMgr = require('../../../domain/transplant/bairen/BairenMgr');
const Room = {
	0: require('../../../domain/transplant/bairen/Room0')
}
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
function createRoom (app, stage,roomCode,isvip,uid) {
	const id = roomCode;

	const room = new Room[0]({nid:"9",id:roomCode, channel: app.channelService.createChannel('bairen'+roomCode),isvip:isvip,vipRoomoWnerId:uid});
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
	if(room == undefined) { // 如果没有找到 就创建一个出来
        room = createRoom(app, stage, roomCode,isvip,uid);
    }

    //判断房间里面是否已经存在真是房间
    let playerIndex = room.players.find(m=> !m.isRobot);
    if(!playerIndex){
        console.log('房间不存在其它玩家，开启机器人百人牛牛');
        RobotMge.activationRobot(roomCode,stageId,true);//激活这个房间的机器人
    }
    RobotMge.RobotOut(stageId,roomCode);//玩家进入离开一个机器人
	const seat = room.addPlayer(player);

	if(seat === -1){
		return cb('房间已满');
	}
	cb('玩家进入百人');

}

/**
 * 进入
 */
Remote.prototype.entry = function(player, stageId,roomCode,isvip,uid, cb) {
	const stage = BairenMgr.getStage(stageId);
	if(!stage){
		return cb('找不到游戏场');
	}
	searchRoom(this.app, stage, player,roomCode,isvip,uid,stageId, cb);
};

/**
 * 退出
 */
Remote.prototype.exit = function(uid, stageId,isvip,roomCode,cb) {

	const stage = BairenMgr.getStage(stageId);
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


	if(room){
		// 是否庄家
		if(room.zhuangInfo && room.zhuangInfo.uid === uid) {
			return cb('您是庄，请先下庄');
		}
		// 是否有下注
		const player = room.getPlayer(uid);
		if(!player) return cb(null);
		if(player.hasBet() && room.status === 'INBET') {
			return cb('您有下注，请等待这局游戏结束');
		}
		room.leave(uid);
	}

    //玩家退出房间,判断是否完全全部退出了
    let playerIndex = room.players.find(m => !m.isRobot);
    if(!playerIndex){
        console.log('玩家退出百人牛牛，关闭机器人');
        RobotMge.activationRobot(roomCode,stageId,false);//关闭房间机器人
    }
	cb(null);
};

/**
 * 离线 - 直接强行离开
 */
Remote.prototype.leave = function(uid, stageId,isvip,roomCode, cb) {
    const stage = BairenMgr.getStage(stageId);
    if(!stage){
        return cb({code:500,err:'找不到游戏场'});
    }

    // 在所有房间里面找出玩家然后退出
    let room;
    if(isvip){
        room = stage.roomsVip.find(m => m.hasPlayer(uid));
    }else{
        room = stage.rooms.find(m => m.hasPlayer(uid));
    }


	room && room.leave(uid);

    //玩家退出房间,判断是否完全全部退出了
    let playerIndex = room.players.find(m => !m.isRobot);
    if(!playerIndex){
        console.log('玩家退出百人牛牛，关闭机器人');
        RobotMge.activationRobot(roomCode,stageId,false);//关闭房间机器人
    }
	cb(null);
};