'use strict';

const pomelo = require('pomelo');
const Robot = require('./Robot').robot;
const getRobot = require('./Robot').getRobot;
const util = require('../../../../utils');
const logic = require('../logic');

const bets = [100];

const bet = (app, ai, env, rcode, memory) => {
    ai = getRobot(ai.uid);
    const moneyType = env == 'system' ? 'gold' : 'integral';
    const memoryEnv =  env == 'system' ? memory[env] : memory.vip[env];
    if(ai[moneyType] <= 0){
        return;
    }
    if (memoryEnv.userBets[rcode][ai.uid] == null) {
		memoryEnv.userBets[rcode][ai.uid] = {};
    }
	const userBet = memoryEnv.userBets[rcode][ai.uid];
    const betAreaIds = Object.keys(memoryEnv.rounds[rcode].betAreas);
    const betAreaNum = Math.floor(Math.random() * 2) + 1;

    const betAreas = {}; //区域下注情况

    outerloop:
    while (Object.keys(betAreas).length < betAreaNum) {
        const betAreaId = betAreaIds[Math.floor(Math.random() * betAreaIds.length)];

        //检查是否已经压过锅底或派系
        if(betAreaId.startsWith("e")){
            for(let key in userBet){
                if(key.startsWith("e") && key!=betAreaId){
                    continue outerloop;
                }
            }
            for(let key in betAreas){
                if(key.startsWith("e") && key!=betAreaId){
                    continue outerloop;
                }
            }
        }

        if(betAreaId==="l" || betAreaId==="r"){
            for(let key in userBet){
                if(key==="l"||key==="r"){
                    continue outerloop;
                }
            }
            for(let key in betAreas){
                if(key==="l"||key==="r"){
                    continue outerloop;
                }
            }
        }


        const betNum = bets[Math.floor(Math.random() * bets.length)];

        //最大的一次性押注
        if(userBet["maxBetATime"]){
            if(userBet["maxBetATime"]<betNum){
                userBet["maxBetATime"]=betNum;
            }
        }else{
            userBet["maxBetATime"]=betNum;
        }

        ai[moneyType] -= betNum;
        betAreas[betAreaId] = betNum;

    }

    for(let areaId in betAreas){
        const roundBetArea = logic.findRoundBetArea(memoryEnv.rounds[rcode].betAreas, areaId);
        roundBetArea.allBet += betAreas[areaId];
        userBet[areaId] == null ? userBet[areaId] = betAreas[areaId] : userBet[areaId] +=betAreas[areaId];
    }
};

let tickTimer = null;

// 每隔两秒多执行
const nextTick = (app, memory) => {
	tickTimer = setTimeout(() => {
		try {
            const channelService = app.channelService;
            const envs = ['system'].concat(Object.keys(memory.vip));  //所有的环境

            envs.forEach(env =>{
                const viperId = env == 'system' ? null : env;
                const memoryEnv =  env == 'system' ? memory[env] : memory.vip[env];

                const envRooms = Object.keys(memoryEnv.dealers);  //该环境下的所有房间
                envRooms.forEach(rcode =>{
                    //查看每个房间的信息
                    app.rpc.hall.aiRemote.gameAndRoomInfo(null, {nid: '3', roomCode: rcode, viperId}, function(err, doc){
                        const room = doc.room;
                        const round = logic.findRound(memoryEnv.rounds, rcode);
                        const channel = channelService.getChannel(env+ '_'+ rcode);
                        let aiNum;
                        const roomAIs = room.users.filter(user => user.isAI);
                        const realUserNum = room.users.length - roomAIs.length;
                        if(roomAIs.length >= 5 || realUserNum == 0 ){
                            aiNum = 0;
                        }else if(realUserNum >0 && roomAIs.length < 5){
                            aiNum = util.random(0, 6 - room.users.length - 1);
                        }else{
                            aiNum = 0;
                        }
                        // 补充机器人
                        while(aiNum > 0){
                            const robot = Robot({env});
                            roomAIs.push(robot);
                            //进入房间
                            app.rpc.hall.aiRemote.enterRoom(null, {viperId, nid: '3', rcode, robot}, function(){});
                            channel.add(String(robot.uid), robot.sid);
                            if(memoryEnv.todayWins[robot.uid] == null) {
                                memoryEnv.todayWins[robot.uid] = {todayTotalWin: 0, todayRoundWin: 0};
                            }
                            aiNum--;
                        }
                        //当前所处的回合阶段
                        const statusAndcountdown = logic.roundStatusAndCountdown(round.now),
                            countdown = statusAndcountdown.countdown,
                            status = statusAndcountdown.status;
                        if(status == memory.Round.status.betting && countdown > 4 && realUserNum > 0){
                            //机器人下注
                            roomAIs.forEach(ai =>{
                                bet(app, ai, env, rcode, memory);
                            });
                        }   
                    });
                });
            });
		} catch (err) {
			console.error('火锅ai运转异常', err);
		}
		nextTick(app, memory);
	}, Math.random() * 3000 + 3000)
};

module.exports = ({app, memory}) => {
	nextTick(app, memory);
};