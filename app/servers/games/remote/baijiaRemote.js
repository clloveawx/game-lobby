'use strict';

const BaijiaMgr = require('../../../domain/transplant/baijia/BaijiaMgr');
const Room = require('../../../domain/transplant/baijia/Room');
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
    //判断房间里面是否已经存在真的玩家
    let playerIndex = room.players.find(m=> !m.isRobot);
    if(!playerIndex){
        console.log('第一个玩家进入，开启机器人');
        RobotMge.activationRobot(roomCode,stageId,true);//激活这个房间的机器人
    }
	RobotMge.RobotOut(stageId,roomCode);//玩家进入离开一个机器人
	// 将玩家添加到房间
	const seat = room.addPlayer(player);
	if(seat === -1){
		return cb('房间已满');
	}

	cb('玩家进入百家');
}

/**
 * 进入
 */
Remote.prototype.entry = function(player, stageId,roomCode,isvip,uid, cb) {
	const stage = BaijiaMgr.getStage(stageId);
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
	const stage = BaijiaMgr.getStage(stageId);
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
		console.log('最后一个玩家退出百家，关闭机器人');
        RobotMge.activationRobot(roomCode,stageId,false);//关闭房间机器人
	}

	cb(null);
};

/**
 * 离线 - 直接强行离开
 */
Remote.prototype.leave = function(uid, stageId,isvip,roomCode, cb) {
    const stage = BaijiaMgr.getStage(stageId);
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


	room && room.leave(uid);

    //玩家退出房间,判断是否完全全部退出了
    let playerIndex = room.players.find(m => !m.isRobot);
    if(!playerIndex){
        console.log('最后一个玩家退出百家，关闭机器人');
        RobotMge.activationRobot(roomCode,stageId,false);//关闭房间机器人
    }
	cb(null);
};