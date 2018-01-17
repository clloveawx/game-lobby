'use strict';

const utils = require('../../../../utils');
const RobotMgr = require('../RobotMgr');
const jettons = [100, 1000, 1000, 10000,100000];
const areas = [// 33.95
	{name: 'play', probability: 32}, 	//2.94  - 32
	{name: 'draw', probability: 10}, 	//23.56 - 10
	{name: 'bank', probability: 28}, 	//2.79 	- 28
	{name: 'small', probability: 11},	//4.41 	- 20
	{name: 'pair0', probability: 4},	//32.4 	- 2
	{name: 'pair1', probability: 4},	//32.4	- 2
	{name: 'big', probability: 6},	//1.47 	- 6
];

// 随机一个区域出来
function randomArea(nid,roomcode,uid) {
    let robot = RobotMgr.getRobotByRoom(nid,roomcode,uid);
    if(robot.error){
        console.error(robot.error);
        return;
    }
    // console.log('----',robot.res.areas);
    // console.log('当前机器人下注概率',robot);
    let isTrue = robot.areas.find(m=>m.probability!=0);
    let areasName = '';
    if(isTrue){
        areasName = utils.sortProbability(Math.random(),robot.areas).name;
	}
	return areasName;
}

//金币转积分
function goldToIntegral(isvip,player){
    if(isvip){
        return player.integral;
    }else{
        return player.gold;
    }
}

//机器人下注规则
exports.RobotbetRegulation = function(room) {
    room.players.forEach(m=>{
		if(m.isRobot){//是机器人
            let upStationResult;
            let upStationBet = m.lastBets;
			let robot = RobotMgr.getRobotByRoom(room.nid,room.id,m.uid);
			if(robot.error){
				console.error(robot.error);
				return;
			}
            if(!room.historys2.length){
            	return;
            }
            upStationResult = room.historys2[0].result;
            // console.log('上局开奖结果：',upStationResult,'上局机器人下注结果：',upStationBet);
            //上局输赢
            switch (robot.AIgrade){
                case 'A'://高级AI
					robot.areas.forEach((m,i,arr)=>{
						if(robot.upStation){
							//赢
							if(upStationResult[m.name]){
								m.probability = utils.random(0,0);
							}else{
                                m.probability = utils.random(0,100);
							}

						}else{
							//输
							if(upStationBet[m.name]){
                                m.probability = utils.random(100,100);
							}else{
                                m.probability = utils.random(0,0);
							}

						}
					});
                    break;
                case 'B'://中级AI
					robot.areas.forEach((m,i,arr)=>{
						if(upStationResult[m.name]){
							m.probability = utils.random(100,100);
						}else{
							m.probability = utils.random(0,0);
						}
					});
                    break;
                case 'C'://低级AI
                    let random = utils.random(0,100);
					robot.areas.forEach((m,i,arr)=>{
                        if(robot.upStation) {
                            //赢
                            m.probability = utils.random(0,100);
                        }else{
                        	//输
							if(random <= 20){
                                m.probability = utils.random(0,0);
							}else{
                                m.probability = utils.random(0,100);
							}
						}

					});
                    break;
            }
		}
	});
}

/**
 * 机器人逻辑 - 欢乐百家
 */

// 退出房间
exports.canExitRoom = function (room, robot) {
	const player = room.getPlayer(robot.uid);
	if(player.hasBet() && room.status === 'INBET'){
        return false;
	}

	if(room.status === 'INSETTLE'){
        return false;
	}
	if(robot.inningBetMax <= jettons[0]){//金币不足退出房间
		return true;
	}
};

// 机器人操作
exports.operate = function (room, robot) {

	const player = room.getPlayer(robot.uid);
	// console.log('room.statusroom.status',room.nid,room.id,room.status);
	// 根据房间状态进行操作
	switch(room.status) {
		case 'INBET':// 下注中
		{
			const time = room.getCountdownTime();
			if(time < 1500 || time >= 28500){
				return false;
			}
            let betNum = jettons[utils.random(0, jettons.length-1)];

            //5%拥有金币的押注，取最接近的筹码进行押注
			let betIndex = jettons.findIndex(m => m >= robot.inningBetMax);
			if(betIndex>0){
                betNum = jettons[betIndex - 1];
			}else{
                betNum = jettons[jettons.length - 1];
			}

			// console.log('betNumbetNum',betNum,betIndex,robot.inningBetMax);
			const area = randomArea(room.nid,room.id,robot.uid);

			// 是不是超出10倍了
			if (betNum > goldToIntegral(room.isvip,player)) {
				return false;
			}

			//下注最大下注金额范围内的筹码
			if(robot.inningBetMax > jettons[0]){
				while (betNum > robot.inningBetMax){
                    betNum = jettons[utils.random(0, jettons.length-1)];
				}
			}

			// console.log(robot.nickname,'下注了',robot.inningBet,betNum,robot.inningBetMax,robot.gold,'AI等级',robot.AIgrade);
			robot.inningBet += betNum;//机器人本局累计下注
			if(robot.inningBet >= robot.inningBetMax){//不能超过本局下注上限
				return false;
			}

			// console.log('----------');
			if(area) room.onBeting(player, betNum, area);
			return true;
		}
		case 'INBIPAI':// 结算中
		{
			return false;
		}
	}
};

// 聊天
exports.chat = function (room, robot) {
	const time = Date.now();
	if(time - robot.lastTalkTime < 10000)// 5秒一次发话
		return;
	robot.lastTalkTime = time;
	if(utils.random(0, 10000) > 500)
		return;

	const msgs = [
		'一群穷逼', 
		'在座的全是垃圾',
		'111', 
		'啊！' ,
		'我其实是机器人',
		'别装啦，一看就知道你偷鸡',
	    '我要全下，你们小心',
	    '有本事别弃牌，跟到底啊',
	    '大家好，很高兴见到各位',
	    '别老弃牌，运气都跑光啦',
	    '敢不敢不看牌玩一局',
	    '觉得我偷鸡的，跟我比牌啊',
	    '不玩啦，大家好运'
	].concat(robot.statements);

	room.channel.pushMessage('onChat', {
		uid: robot.uid,
		nickname: encodeURI(robot.nickname),
		msg: encodeURI(msgs[utils.random(0, msgs.length-1)])
	});
};

