'use strict';
const conf = require('./conf');
const RobotMgr = require('./RobotMgr');
const utils = require('../../../utils');
/**
 * 机器人
 */
class Robot {

	constructor (opts) {
		this.nid = null;
		this.AIgrade = opts.AIgrade;
		this.uid = opts.id;
		this.nickname = opts.nickname;
		this.headurl = opts.headurl;
		this.sex = opts.sex;
		this.signature = opts.signature;// 签名
		this.statements = opts.statements;
		this.gold = opts.gold;// 金币
        this.integral = opts.integral;
		this.applys = [];// 好友申请列表
		this.game = null;// 当前所在游戏
		this.roomId = null;// 当前所在房间ID
		this.lastEntryGameTime = 0;// 上次进入游戏时间
		this.lastTalkTime = 0;// 上次发话时间
		this.robotStatus = '';//机器人下注频率开关百家
        this.robotStatusNiuniu = '';//机器人下注频率开关牛牛
		this.timeInt = '';//机器人定时随机下注频率开关
		this.inningBet = 0;//机器人本局下注总额
		this.inningBetMax = 0;//机器人本局下注最大上限
		this.upStation = false;//上局押注结果
		this.areas = [//机器人下注区域百家
            {name: 'play', probability: 32}, 	//2.94  - 32
            {name: 'draw', probability: 10}, 	//23.56 - 10
            {name: 'bank', probability: 28}, 	//2.79 	- 28
            {name: 'small', probability: 11},	//4.41 	- 20
            {name: 'pair0', probability: 4},	//32.4 	- 2
            {name: 'pair1', probability: 4},	//32.4	- 2
            {name: 'big', probability: 6},	//1.47 	- 6
        ];
		this.areasBairen = [//机器人下注区域百人
			{name: 0, probability: 1},
			{name: 1, probability: 1},
			{name: 2, probability: 1},
			{name: 3, probability: 1}
		];
	}

	isInGame () {
		return !!this.game;
	}

	// 设置游戏
	entryGame (game = null, roomId = null,nid) {
		this.nid = nid;
		this.game = game;
		this.roomId = roomId;
		if(game && roomId) {
			this.lastEntryGameTime = Date.now();
			// console.log(this.nickname, 'entry ' + this.game + ' ' + roomId,this.uid,'AI等级',this.AIgrade,this.gold);
		}
	}

	// 包装游戏数据
	wrapGameData () {
		return {
			uid: this.uid,
			nickname: this.nickname,
			headurl: this.headurl,
			sex: this.sex,
			gold: this.gold
		};
	}

	// 通信传输
	strip () {
		return {
			uid: this.uid,
			ip: '1.1.1.1',
			nickname: encodeURI(this.nickname),
			headurl: this.headurl,
			sex: this.sex,
			gold: this.gold,
			signature: this.signature,
			applys: this.applys
		}
	}

	//定时判断自己gold是否够
	setTimeGold(){
		let time = conf.robotTime[this.AIgrade];
		setInterval(()=>{
			RobotMgr.robotAddGold(this.nid,this.roomId,this.uid);
		},time);
	}
	//激活机器人
    openRobotStatus(roomIndex,room){
		console.log('激活机器人',room.nid,this.nickname,this.uid,roomIndex);
		//根据房间人数设置下注频率
		let num = room.players.length * 100;
        let time = utils.random(room.players.length <= 10 ? num-100:num-500,num);
        this.timeInt = setInterval(()=>{
            time = utils.random(room.players.length <= 10 ? num-100:num-500,num);
		},10000);
        if(room.nid == '8') {
            this.robotStatus = setInterval(()=>{
                RobotMgr.baijiaUpdate(roomIndex,this);
            },time);
        }else if(room.nid == '9'){
            this.robotStatusNiuniu = setInterval(()=>{
                RobotMgr.bairenUpdate(roomIndex,this);
            },time);
        }

	}
	//关闭机器人
	closeRobotStatus(nid){
    	console.log('关闭机器人',this.nickname,this.uid,'所在房间',this.game);
        if(nid == '8') {
            clearInterval(this.robotStatus);
        }else{
            clearInterval(this.robotStatusNiuniu);
		}
        clearInterval(this.timeInt);
	}

}

module.exports = Robot;