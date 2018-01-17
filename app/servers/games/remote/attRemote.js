'use strict';

const AttMgr = require('../../../domain/transplant/att/AttMgr');
const Room = require('../../../domain/transplant/att/Room');
const utils = require('../../../utils');
const MessageService = require('../../../services/MessageService');

module.exports = function(app) {
	return new Remote(app);
};

var Remote = function(app) {
	this.app = app;
};

// 创建房间
function createRoom (app, stage,roomCode,isvip,uid) {
    const channel = app.channelService.createChannel('att'+roomCode);
    const room = new Room({nid:'11',id:roomCode, channel: channel,isvip:isvip,vipRoomoWnerId:uid});
    if(isvip){
        stage.roomsVip.push(room);
    }else{
        stage.rooms.push(room);
    }
    return room;
}

// 寻找房间
function searchRoom (app, stage, player,roomCode,isvip,uid, cb) {
	// 寻找一个空闲的房间
    let room;
    if(isvip){
        room = stage.roomsVip.find(m => m.id === roomCode);
    }else{
        room = stage.rooms.find(m => m.id === roomCode);
    }
    if(!room){ // 如果没有找到 就创建一个出来
        room = createRoom(app, stage,roomCode,isvip,uid);
    }
    // 将玩家添加到房间
    room.addPlayer(player,(error,seat)=>{
        if(error){
            return cb(error);
        }
        if(seat === -1){
            return cb('房间已满');
        }
        return cb('玩家进入ATT');
    });

}

/**
 * 进入
 */
Remote.prototype.entry = function(player, stageId,roomCode,isvip,uid,oneselfUid, cb) {
	const stage = AttMgr.getStage(stageId);
	if(!stage){
		return cb('找不到游戏场');
	}
    let room;
    if(isvip){
        room = stage.roomsVip.find(m => m.hasPlayer(oneselfUid));
    }else{
        room = stage.rooms.find(m => m.hasPlayer(oneselfUid));
    }
    if(room){
        //如果room存在,表示玩家之前异常关闭游戏
        const players = room.getPlayer(oneselfUid);
        //进入房间初始化玩家状态
        players.initGame();
    }

    // 找一个房间
    searchRoom(this.app, stage, player,roomCode,isvip,uid, cb);
};

/**
 * 快速进入
 */
Remote.prototype.quickPlay = function(player, cb) {
	// 寻找一个满足的场
	const stage = AttMgr.searchStage(player);
	if(!stage) {
		return cb('筹码不足');
	}
	// 找一个房间
	searchRoom(this.app, stage, player, cb);
};

/**
 * 退出
 */
Remote.prototype.exit = function(uid, stageId,isvip,cb) {
	const stage = AttMgr.getStage(stageId);
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
		// 是否有下注
		const player = room.getPlayer(uid);
		if(!player) return cb(null);
		if(player.isReady()) {
			return cb('您有下注，请等待这局游戏结束ATT');
		}
        this.app.rpc.hall.gameRemote.getGameFromHallniuniu(null,{nid:room.nid,isVip:room.isvip,uid:room.vipRoomoWnerId},(err,data) => {
            if(!data){
                console.error('获取游戏信息失败getGameFromHallniuniu',data)
                return;
            }
            const rooms = data.rooms.find(room1 => room1.roomCode == room.id);
            room.leave(uid,rooms);
            player.onLeaveeupdateSlipper();//跟新返奖率
        });

	}
	cb(null);
};

/**
 * 离线 - 直接强行离开
 */
Remote.prototype.leave = function(uid, stageId,isvip, cb) {
    const stage = AttMgr.getStage(stageId);
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
    this.app.rpc.hall.gameRemote.getGameFromHallniuniu(null,{nid:room.nid,isVip:room.isvip,uid:room.vipRoomoWnerId},(err,data) => {
        if(!data){
            console.error('获取游戏信息失败getGameFromHallniuniu',data)
            return;
        }
        const rooms = data.rooms.find(room1 => room1.roomCode == room.id);
        if(room){
            const player = room.getPlayer(uid);
            room.leave(uid,rooms);
            AttMgr.addGoldRecordAttMgr({isAdd:'leave',uid},null);//离线更新上一条游戏数据
            player.onLeaveeupdateSlipper();//跟新返奖率
        }
        cb(null);
    });


};