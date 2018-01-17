'use strict';

/**
 * 所有的游戏
 */
class Games {

	constructor (opts) {
		this.id = opts.id;
		this.nid = opts.nid;
        this.name = opts.name;
        this.zname = opts.zname;
        this.heatDegree = 0;
		this.minRoom = opts.minRoom;
		this.users = [];
		this.roomUserLimit = opts.roomUserLimit;
		this.price = opts.price;
		this.machinePrice = opts.machinePrice;
		this.maxMachine = opts.maxMachine;
		this.sname = opts.sname;
        this.topicon = opts.topicon;
        this.removalTime = opts.removalTime;
		this.pumpingRate = opts.pumpingRate;
		this.onlineAwards = opts.onlineAwards;   //联机大奖奖池
	}

	// addRoom (room){
	// 	this.rooms.push(room);
	// }
	// updateHeatDegree (degree) {
	// 	this.heatDegree = Number(degree);
	// }
	//
	// findRoom (roomCode){
	// 	return this.rooms.find(room => room.roomCode == roomCode);
	// }

	//保存到数据库
	// wrapDatebase () {
	// 	return {
	// 		nid: this.nid,
	// 		heatDegree: this.heatDegree,
	// 		rooms: this.rooms,
	// 		onlineAwards: this.onlineAwards,
	// 	}
	// }

	//更新指定房间
	// updateRoom ({changeMoney, roomCode}, roomInfo){
	// 	const room = this.rooms.find(room => room.roomCode == roomCode);
	// 	if(changeMoney){
	// 		room[roomInfo.channel] += roomInfo.count;
	// 	}else{
	// 		for(let k in roomInfo){
	// 			if(room.hasOwnProperty(k)){
	// 				room[k] = roomInfo[k];
	// 			}else if(k.indexOf('.')>=0) {
	// 				let keyArr = k.split('.');
     //                room[keyArr[0]][keyArr[1]] = roomInfo[k];
     //            }
	// 		}
	// 	}
	// 	//同时更新房间的出分率
	// 	if(room.consumeTotal != 0){
	// 		room.outRate = Number((room.winTotal / room.consumeTotal).toFixed(2));
	// 	}
	// 	return room;
	// }

	//更新游戏
	// updateGame(gInfos){
	// 	for(let i in gInfos){
	// 		if(this.hasOwnProperty(i)){
	// 			this[i] = gInfos[i];
	// 		}
	// 	}
	// 	return this;
	// }
}

module.exports = Games;