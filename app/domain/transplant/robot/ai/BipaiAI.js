'use strict';

const utils = require('../../../../utils');

/**
 * 机器人逻辑 - 比牌场
 */

// 弃牌
const canFold = function (room, player) {
	if(player.holdStatus !== 1)
		return false;
	if(player.cardType === 0)
		return true;
	if(player.cardType >= 5)
		return false;
	// 场上有人看牌了 并且全下了
	const other = room.players.find(m => m && m.status === 'GAME' && m.uid !== player.uid && m.holdStatus === 1);
	if(other && room.yetAllinNum)
		return utils.random(0, 10000) < 5000;
	if(player.cardType > 2)
		return utils.random(0, 10000) < 1000;
	if(room.yetAllinNum) // 如果全下了 慎重点
		return utils.random(0, 10000) < 5000;
	return utils.random(0, 10000) < 4000;
};

// 看牌  场上有人看牌了 可以几率高点
const canKanpai = function (room, player) {
	if(player.holdStatus === 1 || room.roundTimes < 3)
		return false;
	const other = room.players.find(m => m && m.status === 'GAME' && m.uid !== player.uid && m.holdStatus === 1);
	const kanpaiDot = other ? 6000 : 2000;
	return utils.random(0, 10000) < kanpaiDot;
};

// 全下
const canAllin = function (room, player) {
	if(!room.yetAllinNum && !room.canAllin())
		return false;
	// 看牌的情况下
	if(player.holdStatus === 1) {
		if(player.cardType >= 9)
			return utils.random(0, 10000) < 8000;
		if(player.cardType >= 5)
			return utils.random(0, 10000) < 3000;
	}
	return utils.random(0, 10000) < 1000;
};

// 比牌
const canBipai = function (room, player) {
	if(room.betNum <= room.lowBet)
		return false;
	// 看牌的情况下
	if(player.holdStatus === 1) {
		if(player.cardType >= 5){
			return false;
		}
	}
	return utils.random(0, 10000) < 500;
};

// 加注
const canFilling = function (room, player) {
	if(room.betNum >= room.capBet)
		return false;
	return utils.random(0, 10000) < 5000;
};

// 退出房间
exports.canExitRoom = function (room, robot) {
	const player = room.getPlayer(robot.uid);
	if(room.status === 'INGAME' && player.status === 'GAME')
		return false;
	if(player.status === 'READY')
		return false;
	let sum = 0, num = 0;
	room.players.forEach(m => {
		if(m) {
			++sum;
			m.isRobot && (++num);
		}
	});
	if(sum === num)
		return true;
	if(sum <= 3)
		return false;
	return utils.random(0, 10000) < 4000;
};

// 机器人操作
exports.operate = function (room, robot, minWaitTime, minFahuaTime) {

	const player = room.getPlayer(robot.uid);
	const waitTime = room.getWaitTime();
	// 根据房间状态进行操作
	switch(room.status) {
		case 'INWAIT':// 等待中
		{
			if(waitTime > minWaitTime || player.status === 'READY'){
				return false;
			}
			player.status = 'READY';
			// 通知
			room.channel.pushMessage('onReady', {uid: player.uid});
			// 检测全部准备好了 就开始发牌了
			room.checkCanDeal();
			return true;
		}
		return false;
		case 'INGAME':// 游戏中
		{
			if(waitTime > minFahuaTime || room.currFahuaIdx !== player.seat) {
				return false;
			}
			// 如果看牌了 先考虑要不要弃牌
			if(canFold(room, player)) {
				room.fold(player.seat);
				return true;
			}
			// 全下模式 就只能全下了
			if(room.yetAllinNum) {
				// 没看牌 先看牌
				if(player.holdStatus !== 1) {
					player.holdStatus = 1;// 设置状态
					room.kanpai(player);
				} else {
					const betNum = Math.min(room.yetAllinNum || room.canAllin(), player.gold);
					room.allin(player, betNum);
				}
				return true;
			}
			// 看牌
			if(canKanpai(room, player)) {
				player.holdStatus = 1;// 设置状态
				room.kanpai(player);
				return true;
			}
			// 全下
			if(canAllin(room, player)) {
				const betNum = Math.min(room.yetAllinNum || room.canAllin(), player.gold);
				room.allin(player, betNum);
				return true;
			}
			// 比牌
			if(canBipai(room, player)) {
				const num = (player.holdStatus === 1 ? room.betNum*2 : room.betNum) * 2;
				if(player.gold > num) {
					// 随机一个玩家
					const other = room.players.find(m => m && m.status === 'GAME' && m.uid !== player.uid);
					room.bipai(player, other, num);
					return true;
				}
			}
			// 加注
			if(canFilling(room, player)) {
				let num = Math.min(room.capBet-room.betNum, room.betNum);
				num = num < 0 ? 0 : num;
				num = Math.min(room.betNum+num, room.capBet);
				const betNum = player.holdStatus === 1 ? num*2 : num;
				if(player.gold > betNum) {
					room.filling(player, betNum, num);
					return true;
				}
			}
			// 跟注
			const betNum = player.holdStatus === 1 ? room.betNum*2 : room.betNum;
			room.cingl(player, betNum);
			return true;
		}
		return false;
	}
};

// 聊天
exports.chat = function (room, robot) {
	// const time = Date.now();
	// if(time - robot.lastTalkTime < 10000)// 5秒一次发话
	// 	return;
	// robot.lastTalkTime = time;
	// if(utils.random(0, 10000) > 500)
	// 	return;

	// const msgs = [
	// 	'一群穷逼', 
	// 	'在座的全是垃圾',
	// 	'111', 
	// 	'啊！' ,
	// 	'我其实是机器人',
	// 	'别装啦，一看就知道你偷鸡',
	//     '我要全下，你们小心',
	//     '有本事别弃牌，跟到底啊',
	//     '大家好，很高兴见到各位',
	//     '别老弃牌，运气都跑光啦',
	//     '敢不敢不看牌玩一局',
	//     '觉得我偷鸡的，跟我比牌啊',
	//     '不玩啦，大家好运'
	// ].concat(robot.statements);

	// room.channel.pushMessage('onChat', {
	// 	uid: robot.uid,
	// 	nickname: encodeURI(robot.nickname),
	// 	msg: encodeURI(msgs[utils.random(0, msgs.length-1)])
	// });
};