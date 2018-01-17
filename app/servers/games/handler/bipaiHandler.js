'use strict';

const BipaiMgr = require('../../../domain/transplant/bipai/BipaiMgr');
const GameUtil = require('../../../utils/GameUtil');
const HallService = require('../../../services/HallService');

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

function check (roomId, uid,isvip) {
	const room = BipaiMgr.getRoom(roomId,isvip);
	if(!room){
		return {err: '房间不存在'};
	}
	const player = room.getPlayer(uid);
	if(!player){
		return {err: '玩家不存在'};
	}
	return {room: room, player: player};
}

/**
 * 加载完成
 */
Handler.prototype.loaded = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
    if (err){
        return next(null, {code: 500, error: err});
    }
    if(player.status === 'NONE'){
        player.status = 'WAIT';
    }
    // 通知其他玩家有人加入房间
	room.channel.pushMessage('onEntry', {roomCode:room.id,player: player.strip(), status: room.status, waitTime: room.getWaitTime()});
    // 返回给客户端
	next(null, {code: 200, room: room.strip(), waitTime: room.getWaitTime(),lowBet:room.lowBet,capBet:room.capBet,seat:player.seat});

	// 检查之前是不是关闭了 如果人数2个以上就可以开始了
	if(room.status === 'NONE'){
		const list = room.players.filter(m => m && m.status !== 'NONE');
		(list.length >= 2) && room.wait();
	}
};

/**
 * 准备
 */
Handler.prototype.ready = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 正在游戏中 
	if(room.status === 'INGAME'){
		return next(null, {code: 500});
	}
	next(null, {code: 200});
	// 设置玩家为准备状态
	player.status = 'READY';
	// 通知
	room.channel.pushMessage('onReady', {roomCode:room.id,uid: player.uid});
	// 检测全部准备好了 就开始发牌了
	room.checkCanDeal();
};

/**
 * 跟注
 */
Handler.prototype.cingl = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	if(room.status !== 'INGAME'){
		return next(null, {code: 500});
	}
	if(room.yetAllinNum){
		return next(null, {code: 500, error: '全下模式'});
	}
	// 如果看牌了 就是两倍额度
	const betNum = player.holdStatus === 1 ? room.betNum*2 : room.betNum;
	//
	if(player.gold < betNum) {
		return next(null, {code: 500, error: '筹码不足'});
	}
	next(null, {code: 200});
	// 跟注
	room.cingl(player, betNum);
};

/**
 * 加注
 */
Handler.prototype.filling = function({roomId, multiple}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	if(room.status !== 'INGAME'){
		return next(null, {code: 500});
	}
	if(room.yetAllinNum){
		return next(null, {code: 500, error: '全下模式'});
	}

	let num = Math.min(room.capBet-room.betNum, multiple*room.betNum);
	num = num < 0 ? 0 : num;
	// 下注额度
	num = Math.min(room.betNum+num, room.capBet);
	// 如果看牌了 就是两倍额度
	const betNum = player.holdStatus === 1 ? num*2 : num;
	// 
	if(player.gold < betNum) {
		return next(null, {code: 500, error: '筹码不足'});
	}
    // 加注
    next(null, {code: 200, betNum: num});
	room.filling(player, betNum, num);
};

/**
 * 全下
 */
Handler.prototype.allin = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	if(room.status !== 'INGAME'){
		return next(null, {code: 500});
	}
	if(player.holdStatus === 2) {
		return next(null, {code: 500, error: '操作错误'});
	}
	let num = room.yetAllinNum || room.canAllin();
	if(num <= 0){
		return next(null, {code: 500, error: '现在还不能全下'});
	}
	//
	if(player.gold < num) {
		// return next(null, {code: 500, error: '筹码不足'});
		num = player.gold;
	}
	next(null, {code: 200});
	// 全下
	room.allin(player, num);
};

/**
 * 看牌
 */
Handler.prototype.kanpai = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	if(room.status !== 'INGAME'){
		return next(null, {code: 500});
	}
	if(player.holdStatus !== 0){
		return next(null, {code: 500, error: '操作错误'});
	}

	player.holdStatus = 1;// 设置状态
	next(null, {code: 200, holds: player.toHolds(), holdStatus: player.holdStatus});
	// 看牌
	room.kanpai(player);
};

/**
 * 申请比牌
 */
Handler.prototype.applyBipai = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	if(room.status !== 'INGAME'){
		return next(null, {code: 500});
	}
	if(room.yetAllinNum){
		return next(null, {code: 500, error: '全下模式'});
	}
	if(room.betNum === room.lowBet) {
		return next(null, {code: 500, error: '还不能比牌'});
	}
	// 如果看牌了 就是两倍额度 然后比牌再两倍
	const num = (player.holdStatus === 1 ? room.betNum*2 : room.betNum) * 2;
	if(player.gold < num) {
		return next(null, {code: 500, error: '筹码不足'});
	}
	// 获取可以比牌的玩家
	const list = room.players.filter(m => m && m.status === 'GAME' && m.uid !== player.uid);
	if(list.length === 0){
		return next(null, {code: 500});
	}
	// 如果只有一个人 那么直接参与比牌
	if(list.length === 1){
		room.bipai(player, list[0], num);
		return next(null, {code: 200});
	}
	next(null, {code: 200, list: list.map(m => m.seat)});
};

/**
 * 比牌
 */
Handler.prototype.bipai = function({roomId, seat}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	if(room.status !== 'INGAME'){
		return next(null, {code: 500});
	}
	if(room.yetAllinNum){
		return next(null, {code: 500, error: '全下模式'});
	}
	if(room.betNum === room.lowBet) {
		return next(null, {code: 500, error: '还不能比牌'});
	}
	const other = room.players[seat];
	if(!other) {
		return next(null, {code: 500, error: '玩家不存在'});
	}
	// 如果看牌了 就是两倍额度 然后比牌再两倍
	const num = (player.holdStatus === 1 ? room.betNum*2 : room.betNum) * 2;
	if(player.gold < num) {
		return next(null, {code: 500, error: '筹码不足'});
	}
	room.bipai(player, other, num);
	next(null, {code: 200});
};

/**
 * 弃牌
 */
Handler.prototype.fold = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	if(room.status !== 'INGAME'){
		return next(null, {code: 500});
	}
	next(null, {code: 200});
	room.fold(player.seat);
};