'use strict';

const utils = require('../../../../utils');

const jettons = [10,100,1000,10000,100000];
const RobotMgr = require('../RobotMgr');
//金币转积分
function goldToIntegral(isvip,player){
    if(isvip){
        return player.integral;
    }else{
        return player.gold;
    }
}

//机器人下注规则
exports.RobotbetRegulationBairen = function(room) {
    room.players.forEach(m=>{
        if(m.isRobot){//是机器人
            let upStationResult = room.regions;//上一把的开奖结果
			let res = {};
            let upStationBet = m.lastBets;//机器人上一把的押注记录
            let robot = RobotMgr.getRobotByRoom(room.nid,room.id,m.uid);
            if(robot.error){
                console.error(robot.error);
                return;
            }
            upStationResult.forEach((m,i)=>{
                res[i] = m.historys[m.historys.length - 1];
			});


            // console.log('上局开奖结果：',upStationResult,'上局机器人下注结果：',upStationBet);
            //上局输赢
            switch (robot.AIgrade){
                case 'A'://高级AI
                    robot.areasBairen.forEach((m,i,arr)=>{
                        if(robot.upStation){
                            //赢
                            if(res[i]){
                                m.probability = utils.random(0,0);
                            }else{
                                m.probability = utils.random(0,100);
                            }

                        }else{
                            //输
                            if(upStationBet[i]){
                                m.probability = utils.random(100,100);
                            }else{
                                m.probability = utils.random(0,0);
                            }

                        }
                    });
                    break;
                case 'B'://中级AI
                    robot.areasBairen.forEach((m,i,arr)=>{
                        if(res[i]){
                            m.probability = utils.random(100,100);
                        }else{
                            m.probability = utils.random(0,0);
                        }
                    });
                    break;
                case 'C'://低级AI
                    let random = utils.random(0,100);
                    robot.areasBairen.forEach((m,i,arr)=>{
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
 * 机器人逻辑 - 欢乐牛牛
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
    if(goldToIntegral(room.isvip,robot)<=jettons[0]){//金币不足退出房间
        return true;
    }
};

// 机器人操作
exports.operate = function (room, robot) {
    // console.log('--------',room.status);
	if(room.zhuangInfo.uid === robot.uid)// 是庄直接返回
		return false;
	const player = room.getPlayer(robot.uid);
	// 根据房间状态进行操作
	switch(room.status) {
		case 'INBET':// 下注中
		{

			const time = room.getCountdownTime();
			if(time < 1500 || time >= 9500){
				return false;
			}

            //5%拥有金币的押注，取最接近的筹码进行押注
            let betNum = jettons[utils.random(0, jettons.length-1)];
            let betIndex = jettons.findIndex(m => m >= robot.inningBetMax);
            if(betIndex>0){
                betNum = jettons[betIndex - 1];
            }else{
                betNum = jettons[jettons.length - 1];
            }

            let isP = robot.areasBairen.find(m=>m.probability != 0);
            if(!isP){
                return false;
            }

            const area = utils.sortProbability(Math.random(),robot.areasBairen).name;

            // 是不是超出10倍了
            const sumCount = player.bets.reduce((sum, value) => sum + value, 0) + betNum;
            if (sumCount*10 > player.gold) {
                return false;
            }

            if(robot.inningBetMax > jettons[0]){
                while (betNum > robot.inningBetMax){
                    betNum = jettons[utils.random(0, jettons.length-1)];
                }
            }

            //下注最大下注金额范围内的筹码
            robot.inningBet += betNum;//机器人本局累计下注
            if(robot.inningBet >= robot.inningBetMax){//不能超过本局下注上限
                return false;
            }

            // 够不够庄家赔
            const bets = [0,0,0,0];
            bets[area] = betNum;
            if(room.isBeyondZhuangLimit(bets)) {
                return false;
            }
            // 投注
            room.onBeting(player, betNum, area);
            return true;
		}
		case 'INBIPAI':// 结算中
		{
			// 申请上庄
			if(room.zhuangInfo.uid !== player.uid && 
			room.applyZhuangs.indexOf(player.uid) === -1 &&
			player.gold >= room.upZhuangCond) {
				if(utils.random(0, 10000) < 2000){
					room.applyUpzhuang(player.uid);
					return true;
				}
			}
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