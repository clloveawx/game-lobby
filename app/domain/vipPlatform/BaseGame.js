'use strict';

class BaseGame {

	constructor (opts) {
		this.id = opts.id;
		this.nid = opts.nid;
		this.name = opts.name;
		this.zname = opts.zname;
		this.rooms = [];
		this.roomUserLimit = opts.roomUserLimit;
		this.users = opts.users || [];
		this.heatDegree = opts.heatDegree || 0;
		this.createTime = opts.createTime || Date.now(); //购买游戏时间
		this.removalTime = opts.removalTime;
        this.pumpingRate = opts.pumpingRate;
        this.gameStartTime = opts.gameStartTime ;
		this.gameHaveTime = opts.gameHaveTime;
		this.onlineAwards = opts.onlineAwards;
	}

	addRoom (room) {
		this.rooms.push(room);
	}

	findRoom (roomCode){
		return this.rooms.find(room => room.roomCode == roomCode);
	}

	updateHeatDegree (degree) {
		this.heatDegree = Number(degree);
	}

	//更新指定房间
	updateRoom ({changeMoney, roomCode}, roomInfo){
		const room = this.rooms.find(room => room.roomCode == roomCode);
		if(changeMoney){
			room[roomInfo.channel] += roomInfo.count;
		}else{
			for(let k in roomInfo){
				if(room.hasOwnProperty(k)){
					room[k] = roomInfo[k];
				}
			}
		}
		//同时更新房间的出分率
		if(room.consumeTotal != 0){
			room.outRate = Number((room.winTotal / room.consumeTotal).toFixed(2));
		}
		return room;	
	}

	//更新游戏
	updateGame(gInfos){
		for(let i in gInfos){
			if(this.hasOwnProperty(i)){
				this[i] = gInfos[i];
			}
		}
		return this;
	}
}

module.exports = BaseGame;