'use strict';

/**
 * 玩家
 */
class Player {

	constructor (opts) {
		
		this.uid = opts.uid;
		this.sex = opts.sex||0;
		this.nameChanged = opts.nameChanged ||false;
		this.addRmb = opts.addRmb || 0;
		this.vip = opts.vip || false;
		this.gold = opts.gold;              //金币分成普通金币 和充值金币  1-普通金币 2-充值金币
		this.nickname = opts.nickname;      //昵称
		this.headurl = opts.headurl;        //头像
		this.props = opts.props || 0;       //奖券
		this.isPrompting = opts.isPrompting || false;
		this.vipStartTime = opts.vipStartTime||0;              // vip开始时间
		this.vipEffectiveTime = opts.vipEffectiveTime||0;   	 // vip有效时间
		this.vdot = opts.vdot || 0;                            //房主的 v点
		this.inviteCode = opts.inviteCode || '';     // 邀请码
		this.loginTime = opts.loginTime;             //登录时间
		this.lastLogoutTime = opts.lastLogoutTime || 0;  // 最后离线时间
		this.createTime = opts.createTime || Date.now(); // 创建时间
		this.gamesRecord = opts.gamesRecord || {};       //游戏记录
		this.enterRoomTime = opts.enterRoomTime;  //进入房间时的时间戳
		this.leaveRoomTime = opts.leaveRoomTime;  //离开房间时的时间戳
		this.integral = opts.integral || 0;       //积分
		this.roomProfit = opts.roomProfit || 0;  //玩家在某个房间的净收益(vip场)
		this.alipay = opts.alipay|| '';//支付宝帐号
		this.inviteCodeBindTime = opts.inviteCodeBindTime||0;   //玩家建立vip平台的时间
		this.selfBank = opts.selfBank || 0;    //自己的存钱罐
		this.isRobot = opts.isRobot|| 0;    //0为真实玩家 1 为测试玩家 2 为机器人
		this.viperId = opts.viperId || null;   // 非vip玩家进入的平台的创建者的uid
		this.needPlatform = opts.needPlatform || false;   //该玩家是否需要创建平台, 通过审核后会改为true
		this.renewalReminder = opts.renewalReminder || false;  //续约提醒
		this.rechargeReminder = opts.rechargeReminder || false;  //充值提醒
		this.protocolAgree = opts.protocolAgree || false;  //是否同意运营协议

		this.allowances = opts.allowances || null;   //低保  -num:今日可领取金额  -today:今日是否领取 -tomNum: 明日可领取数量
		this.roulette = opts.roulette || 0;    //轮盘信息
		this.dailyIndianaSign = opts.dailyIndianaSign || {'alert': true, 'sign': true};  //每日夺宝  -alert:是否提示 -sign:是否可签到 
		this.monthlyCard = opts.monthlyCard || {'active':false, 'alert': true, 'receiveDates': [], 'today': true, 'award': 1000, 'joined': false};  //月卡  -active:是否激活 -receiveDates: 领取日期 -today: 今日是否可领取 -joined: 是否参加过

		this.sid = ''; // 所在服务器ID
		this.ip = ''; // 登陆IP

		this.slotsGameEarnings = opts.slotsGameEarnings || 0;    //slots游戏比赛盈利
		this.hotpotGameEarnings=opts.hotpotGameEarnings || 0;    //hotpot游戏比赛盈利

		this.pirateMiniGames = opts.pirateMiniGames || {};//海盗船小游戏金币收集进度,数组为空默认0,金币场
        this.pirateMiniGamesIntegral = opts.pirateMiniGamesIntegral || {};//海盗船小游戏金币收集进度,数组为空默认0,积分场

		this.pirateBox = opts.pirateBox || [];//海盗船宝箱,金币场
        this.pirateBoxIntegral = opts.pirateBoxIntegral || [];//海盗船宝箱,积分场

		this.freespinNum = opts.freespinNum || 0;//freespin次数,金币场
        this.freespinNumIntegral = opts.freespinNumIntegral || 0;//freespin次数,积分场

		this.loginCount = opts.loginCount || 0;  //登录次数累计
		this.unlock = opts.unlock || {};    //玩家房间解锁情况
		this.lastGameContents = opts.lastGameContents || {};   //前一次所玩的游戏及进入的房间
		this.address = opts.address||'';
		this.addExchange = opts.addExchange || 0;//玩家累计兑换话费卡总额
	}

	init (sid, ip) {
		this.sid = sid;
		this.ip = ip;
	}

	// 初始化邀请码 
	initInviteCode (code) {
		this.inviteCode = code;
	}

	// 取消vip
	cancelVip () {
		this.vip = false;
	}

	// 是否在线
	isOnline () {
		return !!this.sid;
	}

	// 包装游戏数据
	wrapGameData () {
		return {
			uid: this.uid,
			sid: this.sid,
			ip: this.ip,
			nickname: this.nickname,
			vip :this.vip,
			headurl: this.headurl,
			sex: this.sex,
			props:this.props,
			gold: this.gold,
			loginTime : this.loginTime,
            loginCount:this.loginCount,
			addRmb:this.addRmb,
			inviteCode:this.inviteCode,
			isPrompting :this.isPrompting ,
			nameChanged : this.nameChanged,
			vipStartTime:this.vipStartTime,
			vipEffectiveTime:this.vipEffectiveTime,
			vdot: this.vdot,
			alipay:this.alipay,
			integral:this.integral,
			selfBank:this.selfBank,
			isRobot:this.isRobot,
			viperId:this.viperId,
			needPlatform: this.needPlatform,
            pirateMiniGames:this.pirateMiniGames,
            pirateBox:this.pirateBox,
            freespinNum:this.freespinNum,
            pirateMiniGamesIntegral:this.pirateMiniGamesIntegral,
            pirateBoxIntegral:this.pirateBoxIntegral,
            freespinNumIntegral:this.freespinNumIntegral,
			address:this.address,
			allowances:this.allowances,
			roulette: this.roulette,
			dailyIndianaSign: this.dailyIndianaSign,
			addExchange:this.addExchange,
			monthlyCard: this.monthlyCard,
		};
	}

	// 通信传输
	strip () {
		return {
			uid: this.uid,
			ip: this.ip,
			nickname: this.nickname,
			headurl: this.headurl,
			sex: this.sex,
			vip :this.vip,
			props:this.props,
			isPrompting :this.isPrompting ,
			gold: this.gold,
			addRmb:this.addRmb,
			inviteCode:this.inviteCode,
			nameChanged : this.nameChanged,
			vipStartTime:this.vipStartTime,
			vipEffectiveTime:this.vipEffectiveTime,
			vdot: this.vdot,
			alipay:this.alipay,
			integral:this.integral,
			selfBank:this.selfBank,
			isRobot:this.isRobot,
			viperId:this.viperId,
			needPlatform: this.needPlatform,
			renewalReminder: this.renewalReminder,
			rechargeReminder: this.rechargeReminder,
			protocolAgree: this.protocolAgree,
			lastGameContents: this.lastGameContents,
			address:this.address,
			allowances: this.allowances,
			roulette: this.roulette,
			dailyIndianaSign: this.dailyIndianaSign,
			addExchange: this.addExchange,
			monthlyCard: this.monthlyCard,
		}
	}

	// 包装数据库信息
	wrapDatebase () {
		return {
			uid: this.uid,
			nickname: this.nickname,
			headurl: this.headurl,
			sex: this.sex,
			gold: this.gold,
			vip :this.vip,
			props:this.props,
		    addRmb:this.addRmb,
			isPrompting :this.isPrompting,
			loginTime : this.loginTime,
            loginCount:this.loginCount,
			lastLogoutTime: this.lastLogoutTime,
			createTime: this.createTime,
			inviteCode:this.inviteCode,
			nameChanged : this.nameChanged,
			gamesRecord : this.gamesRecord,
			vipStartTime:this.vipStartTime,
			vipEffectiveTime:this.vipEffectiveTime,
			vdot: this.vdot,
			alipay:this.alipay,
			inviteCodeBindTime: this.inviteCodeBindTime,
			integral:this.integral,
			selfBank:this.selfBank,
			isRobot:this.isRobot,
			viperId:this.viperId,
			needPlatform: this.needPlatform,
            pirateMiniGames:this.pirateMiniGames,
            pirateBox:this.pirateBox,
            freespinNum:this.freespinNum,
			renewalReminder: this.renewalReminder,
			rechargeReminder: this.rechargeReminder,
			protocolAgree: this.protocolAgree,
            pirateMiniGamesIntegral:this.pirateMiniGamesIntegral,
            pirateBoxIntegral:this.pirateBoxIntegral,
			freespinNumIntegral:this.freespinNumIntegral,
			lastGameContents: this.lastGameContents,
			address:this.address,
			allowances:this.allowances,
			roulette: this.roulette,
			dailyIndianaSign: this.dailyIndianaSign,
			addExchange:this.addExchange,
			unlock: this.unlock,
			monthlyCard: this.monthlyCard,
		};
	}

	uids () {
		return {uid: this.uid, sid: this.sid};
	}

	bindToPlatform() {
		return {
			uid: this.uid,
		}
	}

	roomuser() {
		return {
			uid : this.uid,
			nickname : this.nickname,
			vip : this.vip,
			headurl: this.headurl,
			isRobot: this.isRobot,
			inviteCode : this.inviteCode,   // 邀请码
			viperId : this.viperId,         // 非vip玩家进入的平台的创建者的uid
			sid : this.sid,                 // 所在服务器ID
			ip : this.ip,                   // 登陆IP
		}
	}

	// 更新玩家信息
	update(opts){
		for(let k in opts){
			if(this.hasOwnProperty(k)){
				this[k] = opts[k];
			}
		}
	}

	// 更新玩家月卡信息
	updateMonthlyCard(opts){
		for(let i in opts){
			this.monthlyCard[i] = opts[i];
		}
	}
}

module.exports = Player;