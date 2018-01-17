'use strict';

/**
 * 比牌场 管理中心
 */
const Room = require('./Room');
const game = require('../../../../config/data/games.json');
const util = require('../../../utils');
const stages = // 游戏场列表
[
	{
		id:'15',
		name: '普通房',
		entryCond: 600,// 进入条件
		lowBet: 1,// 底注
		capBet: 20,// 封顶
		allinMaxNum: 2000,// 可以全下最大额度
		rooms: [],// 房间列表
        roomsVip: [],// 房间列表
	}
];


let online = 0;// 当前在线人数
let bigwinId = 0;
const bigwins = [];// 最大赢钱

//初始化房间频道
exports.init = function (app) {
    let games = game.find(m=>m.nid == "15");
    if(!games){
    	console.log('没找到比牌游戏哦');
    	return;
	}
    stages.forEach(m=>{
        for(let i=0; i<games.minRoom; i++){
            let n = i+1;
            let roomCode = util.supplementZero(n,3);
            m.rooms.push(
				new Room({
					nid:"15",
                    maxCount: 5,
					id:roomCode,
					channel: app.channelService.createChannel('bipai'+roomCode),
                    entryCond: stages.entryCond,// 进入条件
                    lowBet: stages.lowBet,// 底注
                    capBet: stages.capBet,// 封顶
                    allinMaxNum: stages.allinMaxNum,// 可以全下最大额度
				})
			);
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
		rooms = stage.rooms.filter(x => {
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
			return sum < 3;
		});
		ret = ret.concat(rooms.map(m => {
			return {
				instance: m,
				game: 'bipai',
				stageId: stage.id,
				entryCond: stage.entryCond
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
			entryCond: m.entryCond,
			lowBet: m.lowBet,// 底注
		};
	});
};

