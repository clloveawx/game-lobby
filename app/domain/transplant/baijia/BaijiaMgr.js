'use strict';

const Room = require('./Room');
const pomelo = require('pomelo');
const util = require('../../../utils');
const game = require('../../../../config/data/games.json');
/**
 * 百人场 管理中心
 */

const stages = // 游戏场列表
[
	{
		id: "8",
		name: '欢乐百家',
		maxCount: 50,// 最大人数
		entryCond: 100,// 进入条件
		upZhuangCond: 100000,// 上庄条件
		singleBetLimit: 1000000,// 单人押注上限
		rooms:[],// 房间列表
		roomsVip:[]//vip房间

	}
];

let online = 0;// 当前在线人数
let bigwinId = 0;
const bigwins = [];// 最大赢钱

//初始化房间频道
exports.init = function (app) {
	let games = game.find(m=>m.nid == stages[0].id);
    if(!games){
        return;
    }
    stages.forEach(m=>{
        for(let i=0; i<games.minRoom; i++){
            let n = i+1;
            let roomCode = util.supplementZero(n,3);
            m.rooms.push(new Room({nid:stages[0].id,id:roomCode, channel: app.channelService.createChannel('baijia'+roomCode)}));
        }
	});

};

// 获取场
exports.getStage = function (id) {
	return stages.find(m => m.id === id);
};

// 通过玩家 搜索出一个场
exports.searchStage = function (player) {
	return stages.find(m => m.entryCond < player.gold);
};

// 根据房间ID 获取房间 - 因为房间ID是全局唯一的所以可以直接找到
exports.getRoom = function (id,isvip) {
	for (let i = stages.length - 1; i >= 0; i--) {
		if(isvip){
            const room = stages[i].roomsVip.find(m => m.id === id);
            if(room) return room;
		}else{
            const room = stages[i].rooms.find(m => m.id === id);
            if(room) return room;
		}

	}
	return null;
};

// 找出需要机器人的房间（只要人数少于3个 就算需要 并且只有一个的情况下不是机器人）
exports.needRobotRoom = function () {
	let ret = [], list = null, rooms = null;

	stages.forEach(stage => {
        rooms = stage.rooms.concat(stage.roomsVip).filter(x=>{
        	let roomId = Number(x.id);
        	let roomMaxRobot = x.roomRandomRobotNum;
        	if(roomId >= 3 && roomId <= 10){
                return roomId >= 3 && roomId <=10 && x.players.length <= roomMaxRobot;
			}else{
                let sum = 0, num = 0;
				x.players.forEach(m => {
					if(m) {
						++sum;
						m.isRobot && (++num);
					}
				});
				if(sum === num) {
					return false;
				}
				return sum < roomMaxRobot;
			}

		});
		ret = ret.concat(rooms.map(m => {
			return {
				instance: m,
				game: 'baijia',
				stageId: stage.id,
				entryCond: stage.entryCond,
				upZhuangCond: stage.upZhuangCond
			};
		}));
	});

	return ret;
};

// 统计bigwin
exports.updateBigwin = function () {
	let _online = 0, _bigwins = [];
	stages.forEach(stage => {
		stage.rooms.forEach(m => {
			_online += m.players.filter(m => !!m).length;// 在线人数
			_bigwins = _bigwins.concat(m.bigwins);
			m.bigwins.length = 0;
		});
	});
	online = _online;
	if(_bigwins.length > 0) {
		if(_bigwins.length > 20) {
			_bigwins.splice(0, _bigwins.length-20);
			bigwins.length = 0;
		}
		if(bigwins.length + _bigwins.length > 20) {
			bigwins.splice(0, bigwins.length + _bigwins.length - 20)
		}
		for (let i = 0; i < _bigwins.length; i++) {
			_bigwins[i].id = ++bigwinId;
			bigwins.push(_bigwins[i]);
		}
	}
};

// 返回当前场信息
exports.info = function () {
	return {
		online: online,
		bigwins: bigwins
	}
};

// 包装用于通信
exports.strip = function () {
	return stages.map(m => {
		return {
			id: m.id,
			entryCond: m.entryCond
		};
	});
};

//totalBet.押注金额，totalWin.总盈利，multiple.连线总赔率,moneyType.货币类型
exports.addGoldRecordBaijia = function ({isVip,totalBet,totalWin,multiple,player,uid,moneyType},session) {
	if(!isVip){
        const gameRecordModel = require('../../../../app/utils/db/mongodb').getDao('game_record');
        gameRecordModel.create({
			nid:stages[0].id,
            uid: uid,
            nickname: player.nickname,
            gname: '百家',
            createTime: Date.now(),
            input: totalBet,
            multiple: multiple,
            profit: totalWin - totalBet,
            selfGold:player.gold
        },function(err, data){
            if(err){
                console.error('创建游戏记录失败 games.slots777Handler.start');
            }
        });
    }else{
        pomelo.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: player[moneyType], gamesRecord: player.gamesRecord,selfBank:player.selfBank, roomProfit: isVip ? (player.roomProfit + totalWin - totalBet) : 0}, function(){});

    }
}