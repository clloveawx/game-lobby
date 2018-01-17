'use strict';

/**
 * ATT 管理中心
 */
const Room = require('./Room');
const pomelo = require('pomelo');
const game = require('../../../../config/data/games.json');
const util = require('../../../utils');
const stages = // 游戏场列表
[
	{
		id: '11',
		name: 'ATT连环炮',
		maxCount: 1000,// 最大人数
		entryCond: 0,// 进入条件
		rooms: [],// 房间列表
        roomsVip:[]//vip房间列表
	}
];

let online = 0;// 当前在线人数
let bigwinId = 0;
const bigwins = [];// 最大赢钱

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
exports.addGoldRecordAttMgr = function ({isAdd,isTry,nid,isVip,totalBet,totalWin,multiple,player,uid,moneyType},session) {
	if(!isVip){
		const gameRecordModel = require('../../../../app/utils/db/mongodb').getDao('game_record');
		switch (isAdd){
			case 'add'://添加一条记录
				//更新上一条记录状态
				util.queryRecently(gameRecordModel,{uid:uid,playStatus:0,'createTime':{$lte:Date.now()}},'createTime',(data)=>{
					if(data){
						let ob = {
							uid:data.uid,
							createTime:data.createTime
						}
						gameRecordModel.update(ob,{playStatus:1},()=>{});
					}

					gameRecordModel.create({
						nid:stages[0].id,
						uid: uid,
						nickname: player.nickname,
						gname: 'ATT',
						createTime: Date.now(),
						input: totalBet,
						multiple: multiple,
						profit: totalWin - totalBet,
						selfGold:player.gold,
						playStatus:0
					},function(err, data){
						if(err){
							console.error('创建游戏记录失败 games.slots777Handler.start');
						}
					});
				});
				break;
			case 'update'://更新一条记录
				util.queryRecently(gameRecordModel,{uid:uid,playStatus:0,'createTime':{$lte:Date.now()}},'createTime',(data)=>{
					if(data){
                        let ob = {
                            uid:data.uid,
                            createTime:data.createTime
                        }
                        let profit = data.profit+(totalWin - totalBet);
                        //跟新这条记录和状态
                        gameRecordModel.update(ob,{profit:profit,createTime: Date.now(),playStatus:isTry?0:profit==0 ? 0 : 1},()=>{});
                    }
				});
				break;
			case 'leave'://玩家离线
                util.queryRecently(gameRecordModel,{uid:uid,playStatus:0,'createTime':{$lte:Date.now()}},'createTime',(data)=> {
                    if (data) {
                        let ob = {
                            uid: data.uid,
                            createTime: data.createTime
                        }
                        gameRecordModel.update(ob, {playStatus: 1}, () => {});
                    }
                });
				break;
		}
    }else{
        pomelo.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: player[moneyType], gamesRecord: player.gamesRecord,selfBank:player.selfBank, roomProfit: isVip ? (player.roomProfit + totalWin - totalBet) : 0}, function(){});

    }
}