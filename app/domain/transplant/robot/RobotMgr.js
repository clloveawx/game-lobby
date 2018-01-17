'use strict';

const utils = require('../../../utils');
const conf = require('./conf');
const Robot = require('./Robot');
// const BipaiMgr = require('../bipai/BipaiMgr');
const BairenMgr = require('../bairen/BairenMgr');
const BaijiaMgr = require('../baijia/BaijiaMgr');
const BipaiAI = require('./ai/BipaiAI');
const Bairen0AI = require('./ai/Bairen0AI');
const baijiaAI = require('./ai/baijiaAI');
const getRandomNickname = require('../../../services/nicknameService');
/**
 * 机器人管理中心
 */

let allrobots = [];// 所有可用机器人
let robotName = [],arr = [];//机器人名字
const hasRobotRooms = {// 有机器人的房间
	baijia: [],
    bairen0: []
};
const nidConfig = {
    '8':'baijia',
    '9':'bairen0'
}

// 初始化
exports.init = function () {
	//初始化100个机器人
    robotInit(16);

	// go go go 机器人 开始疯狂起来吧 ！！！
    setInterval(update, 2000);
    // 欢乐牛牛
    // setInterval(bairen0Update, 300);
};

// 搜索机器人
exports.search = function (obj) {
	const key = Object.keys(obj)[0];
	return allrobots.find(m => m[key] === obj[key]);
};

//机器人加钱金币
exports.robotAddGold = function (nid,roomId,robotId) {
    if(!nid || !roomId ){
        return;
    }
    let robots = getRobotByRoom(nid,roomId,robotId);
    if(robots.error){
        return;
    }

	if(robots.gold <= conf.AIGold[robots.AIgrade]){
        robots.gold += conf.AIGold[robots.AIgrade];
        // console.log('机器人加钱',robots.nickname,'金币',robots.gold,'积分',robots.integral,'增加量',conf.AIGold[robots.AIgrade]);
    }
    if(robots.integral <= conf.AIGold[robots.AIgrade]){
        robots.integral += conf.AIGold[robots.AIgrade];
        // console.log('机器人加钱',robots.nickname,'金币',robots.gold,'积分',robots.integral,'增加量',conf.AIGold[robots.AIgrade]);
    }
}

// 欢乐百家
exports.baijiaUpdate = function(roomIndex,_robot) {
    if(!hasRobotRooms.baijia.length){
        return;
    }
    let uid = _robot.uid;
    let {room, robots} = hasRobotRooms.baijia[roomIndex];
    let robot = robots.find(m=>m.uid == uid);
    let robotIndex = robots.findIndex(m=>m.uid == uid);
    if(!robot){
        console.log('没有在房间里面找到机器人百家');
        return;
    }
    // 自己是否被踢了
    if(!room.hasPlayer(uid)){
        exitGame({room, robots,uid}, robotIndex);
        return;
    }
    // console.log(robot.nickname,'机器人下剩余金币',robot.gold);
    if(baijiaAI.canExitRoom(room, robot)){
        room.leave(uid);
        exitGame({room, robots,uid}, robotIndex);
        return;
    }
    //机器人操作
    // console.log('room.isviproom.isvip',room.isvip);
    baijiaAI.operate(room, robot);
}

// 百人牛牛
exports.bairenUpdate = function(roomIndex,_robot) {
    if(!hasRobotRooms.bairen0.length){
        return;
    }
    let uid = _robot.uid;
    let {room, robots} = hasRobotRooms.bairen0[roomIndex];
    let robot = robots.find(m=>m.uid == uid);
    let robotIndex = robots.findIndex(m=>m.uid == uid);
    if(!robot){
        console.log('没有在房间里面找到机器人牛牛');
        return;
    }
    // 自己是否被踢了
    if(!room.hasPlayer(uid)){
        exitGame({room, robots,uid}, robotIndex);
        return;
    }
    // console.log(robot.nickname,'机器人下剩余金币',robot.gold);
    if(Bairen0AI.canExitRoom(room, robot)){
        room.leave(uid);
        exitGame({room, robots,uid}, robotIndex);
        return;
    }
    //机器人操作
    // console.log('room.isviproom.isvip',room.isvip);
    Bairen0AI.operate(room, robot);
}

//激活房间机器人状态(下注)
exports.activationRobot = function (roomCode,nid,isStatus) {
    //找到玩家进入的游戏和房间
    let roomIndex = hasRobotRooms[nidConfig[nid]].findIndex(m=>m.room.id == roomCode && m.room.nid == nid);
    if(roomIndex>=0){
        let room = hasRobotRooms[nidConfig[nid]][roomIndex].room;
        hasRobotRooms[nidConfig[nid]][roomIndex].robots.forEach(n=>{
            if(isStatus){
                n.openRobotStatus(roomIndex,room);//激活房间里面的机器人
                n.inningBetMax = (room.isvip ? n.integral : n.gold) * 0.05;//一局下注金额，自生金币的百分之五
                n.inningBet = 0;
            }else{
                n.closeRobotStatus(nid);//关闭房间里面的机器人
            }

        });
    }else{
        console.error('没有找到房间');
    }
}

//设置机器人本局最大下注金额
exports.setMaxBet = function (nid,roomCode) {
    let roomIndex = hasRobotRooms[nidConfig[nid]].findIndex(m=>m.room.id == roomCode && m.room.nid == nid);
    if(roomIndex>=0){
        let room = hasRobotRooms[nidConfig[nid]][roomIndex].room;
        hasRobotRooms[nidConfig[nid]][roomIndex].robots.forEach(n=>{
            n.inningBetMax = (room.isvip ? n.integral : n.gold) * 0.05;//一局下注金额，自生金币的百分之五
            n.inningBet = 0;
            console.log(n.nickname,'inningBetMax',n.inningBetMax,'gold',n.gold);
        })
    }else{
        console.error('没有找到房间设置机器人最大押注');
    }

}

//根据机器人id找到机器人
const getRobotByRoom = exports.getRobotByRoom = function (nid,roomCode,uid) {
    // console.log('*****',nid,roomCode,uid);
    let roomIndex = hasRobotRooms[nidConfig[nid]].findIndex(m=>m.room.id == roomCode && m.room.nid == nid);
    if(roomIndex>=0){
        let robot = hasRobotRooms[nidConfig[nid]][roomIndex].robots.find(m=>m.uid == uid);
        if(robot) {
            return robot;
        }else{
            return {code:500,error:'没有找到机器人'};
        };
    }else{
        return {code:500,error:'没有找到房间'};
    }
}

//玩家进入,离开一个金币最少的机器人
exports.RobotOut = function (nid,roomCode) {
    let roomIndex = hasRobotRooms[nidConfig[nid]].findIndex(m=>m.room.id == roomCode && m.room.nid == nid);
    if(roomIndex>=0){
        let {room, robots} = hasRobotRooms[nidConfig[nid]][roomIndex];
        if(!robots.length){
            console.log('房间暂时没有机器人');
            return;
        }
        hasRobotRooms[nidConfig[nid]][roomIndex].robots.sort((a,b)=>{
            return room.isvip ? a.integral - b.integral : a.gold - b.gold;
        });
        let uid = hasRobotRooms[nidConfig[nid]][roomIndex].robots[0].uid;
        room.leave(uid);
        exitGame({room, robots,uid}, 0);
    }else{
        console.error('没有找到房间');
    }
}
//初始化100个机器人
const robotInit = function (num) {
    robotName = [];
    for(let i=0; i<num; i++){
        let AIClass = utils.sortProbability(Math.random(),conf.AI).name;
        let nickName = getRandomNickname.getRandomNickname();
        let nameExit = arr.find(m=>m == nickName);
        while (nameExit){
            nickName = getRandomNickname.getRandomNickname();
            nameExit = arr.find(m=>m == nickName);
        }
        arr.push(nickName);
        let ob = {
            AIgrade: AIClass,//AI等级
            id: utils.id(),//id
            nickname: nickName,//AI昵称
            headurl: 'head'+utils.random(1,6),
            sex: 0,
            signature: '',
            statements: [],
            gold:conf.AIGold[AIClass],
            integral:conf.AIGold[AIClass],
            game:null
        }
        robotName.push(ob);
    }
    robotName.forEach(m =>{
        let robot = new Robot(m);
        robot.setTimeGold();//开机机器人监控金币
        allrobots.push(robot)
    });
}

// 进入游戏
const entry = {

	// 欢乐百家
	baijia (robot,room) {
	    //获取机器人加入房间的时间
		if(room.addPlayer(robot.wrapGameData()) === -1) {
			return;
		}
		robot.entryGame('baijia', room.id,room.nid);
        robot.inningBetMax = room.isvip ? robot.integral : robot.gold;//机器人今进入游戏的时候设置最大押注
		// 延迟一下
		setTimeout(() => {
			const player = room.getPlayer(robot.uid);
			// 通知其他玩家有人加入房间

			room.channel.pushMessage('onEntry', {roomCode:room.id,player: player.strip()});
			// 检查之前是不是关闭了 如果人数2个以上就可以开始了
			if(room.status === 'NONE'){
				room.run();
			}
			// 记录
			const roomInfo = hasRobotRooms.baijia.find(m => m.room.id === room.id);

			if(roomInfo) {
				roomInfo.robots.push(robot);
			} else {
				hasRobotRooms.baijia.push({room: room, robots: [robot]});
			}

			//判断房间里面是否存在玩家,如果有玩家自动激活
            let isPlayer = room.players.find(m=>!m.isRobot);
            let roomIndex = hasRobotRooms.baijia.findIndex(m => m.room.id === room.id);
			if(isPlayer){
                robot.openRobotStatus(roomIndex,room);
            }
		}, 500);
	},
    // 欢乐牛牛
    bairen (robot,room) {
        if(room.addPlayer(robot.wrapGameData()) === -1) {
            return;
        }
        robot.entryGame('bairen0', room.id,room.nid);
        robot.inningBetMax = room.isvip ? robot.integral : robot.gold;//机器人今进入游戏的时候设置最大押注
        // 延迟一下
        setTimeout(() => {
            const player = room.getPlayer(robot.uid);
            // 通知其他玩家有人加入房间
            room.channel.pushMessage('onEntry', {roomCode:room.id,player: player.strip()});
            // 检查之前是不是关闭了 如果人数2个以上就可以开始了
            if(room.status === 'NONE'){
                room.run();
            }
            const roomInfo = hasRobotRooms.bairen0.find(m => m.room.id === room.id);
            if(roomInfo) {
                roomInfo.robots.push(robot);
            } else {
                hasRobotRooms.bairen0.push({room: room, robots: [robot]});
            }

            //判断房间里面是否存在玩家,如果有玩家自动激活
            let isPlayer = room.players.find(m=>!m.isRobot);
            let roomIndex = hasRobotRooms.bairen0.findIndex(m => m.room.id === room.id);
            if(isPlayer){
                robot.openRobotStatus(roomIndex,room);
            }
        }, 500);
    },
};

//机器人退出房间
const exitGame = function(roomInfo, i) {
    if(roomInfo.uid){

        let robot = roomInfo.robots.find(m=>m.uid == roomInfo.uid);
        robot.closeRobotStatus(roomInfo.room.nid);
    }
	roomInfo.robots[i].entryGame();
	console.log(roomInfo.robots[i].nickname,roomInfo.robots[i].uid, 'exit ' + roomInfo.room.id);
	roomInfo.robots.splice(i, 1);
}

// 机器人寻找房间
const update = function() {
	// 需要机器人的房间
	const rooms = BaijiaMgr.needRobotRoom().concat(BairenMgr.needRobotRoom());
	// 还没有进入游戏的机器人
    const robots = allrobots.filter(m => !m.isInGame());
    robots.sort((a, b) => a.lastEntryGameTime - b.lastEntryGameTime);
	rooms.forEach(m => {
		const {instance, game, stageId, entryCond} = m;

        if(((Number(instance.id) >=1 &&  Number(instance.id)<3) || Number(instance.id)>10) && (new Date().getTime() - instance.robotAddRoomTime) < utils.random(5000,30000)){//机器人加入房间时间间隔5-30s
            return;
        }
        const robot = robots.shift();
        instance.robotAddRoomTime = new Date().getTime();
		// 根据游戏进入房间
		entry[game](robot,instance);
	});
	// console.log('剩余机器人',allrobots.length,'工作机器人');
	if(robots.length<=20){
        robotInit(20);
	}
}


