'use strict';

const MessageService = require('../../../services/MessageService');
const HallService = require('../../../services/HallService');
const GameUtil = require('../../../utils/GameUtil');
const pomelo = require('pomelo');
const BET_COUNTDOWN = 12; // 下注倒计时（发牌，下注）
const BIPAI_COUNTDOWN = 14; // 比牌倒计时 （比牌动画，展示结果，等待）
const RobotMgr = require('../robot/RobotMgr');
const util = require('../../../utils');
const bairenAI = require('../robot/ai/Bairen0AI');
// 一个玩家
class Player {
    constructor (opts) {
        this.uid = opts.uid;
        this.headurl = opts.headurl;
        this.nickname = opts.nickname;
        this.sex = opts.sex;
        this.gold = opts.gold || 0;
        this.integral = opts.integral || 0;
        this.isRobot = !opts.sid;// 是否机器人

        this.bets = [0,0,0,0];// 天地玄黄 对应下注
        this.lastBets = [0,0,0,0];// 最后一次的押注
        this.isBet = false;// 是否下过注

        this.sumBet = 0;// 总下注 结算时候使用
        this.gain = 0;// 当前收益
        this.bet = 0;//当前押注
        this.lastGain = 0;// 最后一次的收益
        this.onGoonBetNum = 0;//续押次数
    }

    // 初始游戏信息
    initGame () {
        for (let i =  0; i < this.bets.length; i++) {
            // if(this.onGoonBetNum && this.isBet){
            //     this.lastBets[i] = this.bets[i] + this.lastBets[i];
            // }else if(this.isBet && !this.onGoonBetNum){
            //     this.lastBets[i] = Math.max(this.bets[i] - this.lastBets[i], 0);
            // }else{
            //     this.lastBets[i] = this.lastBets[i];
            // }
            if(this.isBet){
                this.lastBets[i] = this.bets[i];
            }else{
                this.lastBets[i] = this.lastBets[i];
            }

            this.bets[i] = 0;
        }
        this.sumBet = 0;// 总下注
        this.lastGain = this.gain;
        this.gain = 0;// 当前收益
        this.bet = 0;//当前押注
        this.isBet = false;
        this.onGoonBetNum = 0;
    }

    // 结算
    settlement (regions) {
        for (let i = this.bets.length - 1; i >= 0; i--) {
            const num = this.bets[i];
            if(num > 0) {
                this.sumBet += num;
                this.gain += (regions[i].isWin ? 1 : -1) * (regions[i].multiple * num);
            }
        }
        this.lastGain = this.gain;
    }

    // 是否有下注
    hasBet () {
        return this.bets.some(m => m > 0);
    }

    // 结算信息 - 参与扣除金币
    toSettlementInfo () {
        return {
            uid: this.uid,
            gain: this.gain,
            sumBet: this.sumBet
        }
    }

    // 结算信息 - 参与发送邮件
    toSettlementInfoByMail () {
        return {
            uid: this.uid,
            gain: this.gain,
            sumBet: this.sumBet,
            bets: this.bets
        }
    }

    // 返回给前端
    result () {
        return {
            uid: this.uid,
            gold: this.gold,
            gain: this.gain,
            bet:this.bet,
            integral:this.integral
        };
    }

    strip (hasRound) {
        return {
            uid: this.uid,
            headurl: this.headurl,
            nickname: encodeURI(this.nickname),
            sex: this.sex,
            gold: this.gold,
            gain: this.lastGain,
            hasRound: hasRound,
            integral:this.integral
        };
    }
}

/**
 * 欢乐牛牛 - 游戏房间
 */
class Room {

    constructor (opts) {
        this.nid = opts.nid;//游戏id
        this.id = opts.id;
        this.maxCount = opts.maxCount || 20;// 最大人数
        this.channel = opts.channel;
        this.entryCond = opts.entryCond || 0;// 进入条件
        this.upZhuangCond = opts.upZhuangCond || 2000000;// 上庄条件
        this.singleBetLimit = opts.singleBetLimit || 0;// 单人押注上限

        this.status = 'NONE';// 状态 INBET.下注阶段 INBIPAI.比牌结算阶段 INSETTLE.结算中
        this.players = [];// 玩家列表
        this.leaves = [];// 记录强退玩家信息 方便本局游戏结束发放邮件
        this.applyZhuangs = [];// 申请庄列表

        this.zhuangInfo = {// 庄家信息
            uid: null,
            hasRound: -1, // -1表示无限
        };
        this.zhuangResult = {// 当前庄家结果
            cards: null, // 牌
            cardType: 0, // 牌型
            gain: 0,
        };
        this.regions = [// 区域
            {sumBet: 0, cards: null, cardType: 0, multiple: 1, isWin: false, historys: []},// 天
            {sumBet: 0, cards: null, cardType: 0, multiple: 1, isWin: false, historys: []},// 地
            {sumBet: 0, cards: null, cardType: 0, multiple: 1, isWin: false, historys: []},// 玄
            {sumBet: 0, cards: null, cardType: 0, multiple: 1, isWin: false, historys: []} // 黄
        ];

        this.lastCountdownTime = 0;// 记录最后一次的倒计时 时间

        this.bigwins = [];// 最大赢钱
        this.isvip = opts.isvip || false;
        this.vipRoomoWnerId = opts.vipRoomoWnerId || '';//vip房间房主uid
        this.roomRandomRobotNum = util.random(10,15);//房间拥有最大机器人数量
        this.robotAddRoomTime = 0;//机器人进入房间时间
    }

    // 是否满
    isFull () {
        return this.players.length >= this.maxCount;
    }

    // 添加一个玩家
    addPlayer (player) {
        if(this.isFull())
            return -1;
        const i = this.players.length;
        this.players.push(new Player(player));
        // 添加到消息通道
        if(player.sid){
            this.channel.add(player.uid, player.sid);
        }
        return i;
    }

    // 获取玩家
    getPlayer (uid) {
        return this.players.find(m => m && m.uid === uid);
    }

    // 删除玩家
    removePlayer (uid, forced = false) {
        this.applyZhuangs.remove(uid);
        const player = this.players.remove('uid', uid);
        if(!player) {
            return false;
        }
        if(!forced) {
            // 是否庄家
            if(player.uid === this.zhuangInfo.uid) {
                this.zhuangInfo.hasRound = 0;
            }
            // 如果是押注阶段离开 就放入离线列表 等待结算
            if(this.status === 'INBET' && !player.isRobot) {
                this.leaves.push(player);
            }
        }
        // 从通道中踢出
        const member = this.channel.getMember(uid);
        member && this.channel.leave(member.uid, member.sid);
        // 如果没有玩家了 关闭房间 必须在结算阶段才可以关闭
        if(this.players.length === 0 && this.status === 'INBIPAI') {
            this.close();
            return false;
        }
        return true;
    }

    // 有玩家离开
    leave (uid) {
        if(!this.removePlayer(uid))
            return;
        // 通知其他玩家有人退出
        this.channel.pushMessage('onExit', {roomCode:this.id,uid: uid});
    }

    // 是否有该玩家
    hasPlayer (uid) {
        return this.players.some(m => m && m.uid === uid);
    }

    // 获取当前状态的倒计时 时间
    getCountdownTime () {
        if(this.status === 'INSETTLE')
            return (BIPAI_COUNTDOWN+1)*1000;
        const time = Date.now() - this.lastCountdownTime;
        if(this.status === 'INBET')
            return Math.max(BET_COUNTDOWN*1000 - time, 1);
        if(this.status === 'INBIPAI')
            return Math.max(BIPAI_COUNTDOWN*1000 - time, 1);
        return 0;
    }

    // 添加最大赢钱
    addBigwin (player, gain) {
        if(gain < 5000)
            return;
        this.bigwins.push({nickname: encodeURI(player.nickname), winNum: gain});
    }

    // 运行游戏
    run () {
        this.lastCountdownTime = Date.now();
        this.countdown = BET_COUNTDOWN;
        this.status = 'INBET';
        this.bet();
        clearInterval(this.runInterval);
        this.runInterval = setInterval(() => this.update(), 1000);
    }

    // 一秒执行一次
    update () {
        if(this.status === 'INSETTLE')
            return;
        --this.countdown;
        if(this.countdown > 0) {
            return;
        }
        this.lastCountdownTime = Date.now();
        switch(this.status) {
            case 'INBET':// 如果是下注阶段 就开始结算
                this.countdown = BIPAI_COUNTDOWN;
                this.status = 'INSETTLE';
                this.bipai();
                break;
            case 'INBIPAI':// 如果是比牌阶段 就开始等待
                this.countdown = BET_COUNTDOWN;
                this.status = 'INBET';
                this.bet();
                break;
        }
    }

    //
    init () {
        this.players.forEach(m => {
            m.initGame();
            (m.uid === this.zhuangInfo.uid) && (m.sumBet = -1);
        });
        this.regions.forEach(m => {
            m.sumBet = 0;
            m.cards = null;
            m.cardType = 0;
            m.multiple = 0;
            m.isWin = false;
        });
        this.zhuangResult.cards = null;
        this.zhuangResult.cardType = 0;
        this.zhuangResult.gain = 0;

        let playerIndex = this.players.find(m=> !m.isRobot);
        if(playerIndex){
            RobotMgr.setMaxBet(this.nid,this.id);//设置房间内机器人本局最大下注金额
            bairenAI.RobotbetRegulationBairen(this);//设置机器人下注规则
            // RobotMgr.activationRobot(this.id,this.nid,true);//开启机器人下注
            // setTimeout(()=>{
            //     RobotMgr.activationRobot(this.id,this.nid,true);//开启机器人下注
            // },2000);
        }

    }

    // 开始下注
    bet () {
        // 判断是否没有人了 关闭房间
        if(this.players.length === 0) {
            return this.close();
        }
        // 初始化数据
        this.init();
        // 过滤上庄列表中 不满足条件的
        const l = this.applyZhuangs.length;
        for (var i = this.applyZhuangs.length - 1; i >= 0; i--) {
            const player = this.getPlayer(this.applyZhuangs[i]);
            if(this.isvip){
                if(!player || player.integral < this.upZhuangCond) {
                    this.applyZhuangs.splice(i, 1);
                }
            }else{
                if(!player || player.gold < this.upZhuangCond) {
                    this.applyZhuangs.splice(i, 1);
                }
            }

        }
        if(l !== this.applyZhuangs.length) {
            this.noticeZhuangInfo();
        }
        // 看是不是需要切换庄了
        if(this.zhuangInfo.uid){
            // 检查庄家是否还满足上庄条件 upZhuangCond
            const zhuang = this.getPlayer(this.zhuangInfo.uid);
            if(this.isvip){
                if (zhuang && zhuang.integral < this.upZhuangCond) {
                    const member = this.channel.getMember(zhuang.uid);
                    member && MessageService.pushMessageByUids('onKickZhuang', {roomCode:this.id}, member);
                    return this.changeZhuang();
                }
            }else{
                if (zhuang && zhuang.gold < this.upZhuangCond) {
                    const member = this.channel.getMember(zhuang.uid);
                    member && MessageService.pushMessageByUids('onKickZhuang', {roomCode:this.id}, member);
                    return this.changeZhuang();
                }
            }

            // 扣除庄家回合
            if(--this.zhuangInfo.hasRound <= 0) {
                this.changeZhuang();
            }
        } else {
            this.changeZhuang();
        }
    }

    // 比牌 结算
    bipai () {
        pomelo.app.rpc.hall.gameRemote.getGameFromHallniuniu(null,{nid:this.nid,isVip:this.isvip,uid:this.vipRoomoWnerId},(err,data) => {
            if(!data){
                console.error('获取游戏信息失败getGameFromHallniuniu',data)
                return;
            }
            const room = data.rooms.find(room => room.roomCode == this.id);
            do {
                // 洗牌
                const pais = GameUtil.shuffle();
                // 发牌 - 庄
                this.zhuangResult.cards = pais.splice(0, 5);
                this.zhuangResult.cards.sort((a, b) => b % 13 - a % 13);
                this.zhuangResult.cardType = GameUtil.getCardType(this.zhuangResult.cards.slice());
                this.zhuangResult.gain = 0;
                const zhuangMultiple = this.conversionMultiple(this.zhuangResult.cardType);
                // 发牌 - 闲
                this.regions.forEach((m, i) => {
                    m.cards = pais.splice(0, 5);
                    m.cards.sort((a, b) => b % 13 - a % 13);
                    m.cardType = GameUtil.getCardType(m.cards.slice());
                    m.isWin = GameUtil.bipaiSole(m, this.zhuangResult);
                    // 记录庄的收益
                    if (m.isWin) {// 如果闲赢
                        m.multiple = this.conversionMultiple(m.cardType);
                        this.zhuangResult.gain -= m.multiple * m.sumBet;
                    } else {
                        m.multiple = zhuangMultiple;
                        this.zhuangResult.gain += zhuangMultiple * m.sumBet;
                    }
                });

                // 是不是系统当庄 如果是要做调控
                if (!this.zhuangInfo.uid && this.addByBairen(this.zhuangResult.gain,room)) {
                } else {
                    break;
                }
                console.log('while21');
            } while (true);
            // 记录历史纪录
            this.regions.forEach(m => {
                (m.historys.length >= 10) && m.historys.shift();
                m.historys.push(m.isWin);
            });
            // 结账 - 在线的
            this.settlement(this.players);
            // 结账 - 离线的
            this.settlement(this.leaves);
            // 执行加减钱 只取赢了钱的
            if(this.isvip){
                HallService.changesIntegralByOnline(this.players.map(m => m.toSettlementInfo()), (err, list) => {
                    list.forEach(x => {
                        const player = this.getPlayer(x.uid);
                        player && (player.integral = x.integral);
                    });
                    this.status = 'INBIPAI';
                });
            }else {
                // console.log('---------------',this.players);
                HallService.changeGoldsByOnline(this.players.map(m => m.toSettlementInfo()), (err, list) => {
                    list.forEach(x => {
                        const player = this.getPlayer(x.uid);
                        player && (player.gold = x.gold);
                    });
                    this.status = 'INBIPAI';
                });
            }
            // 给离线玩家发邮件
            if(this.leaves.length > 0) {
                HallService.changeGoldsByMail({
                    name: '欢乐牛牛',
                    zhuangResult: this.zhuangResult,
                    regions: this.regions
                }, this.leaves.map(m => m.toSettlementInfoByMail()));
                this.leaves.length = 0;
            }
        });
    }

    // 玩家投注
    onBeting (player, betNum, area) {
        this.regions[area].sumBet += betNum;
        player.bets[area] += betNum;
        player.isBet = true;// 记录是否下过注
        const bets = [0,0,0,0];
        bets[area] = betNum;
        // 通知
        this.channel.pushMessage('onBeting', {
            roomCode:this.id,
            uid: player.uid,
            betNums: bets, // 下注金额
            curBetNums: player.bets, // 当前已经下注金额
            sumBets: this.regions.map(m => m.sumBet)
        });
    }

    // 玩家继押
    onGoonBet (player,cb) {
        if(player.onGoonBetNum != 0){
            return cb('只能续押一次');
        }
        if(player.isBet){
            return cb('你已经押注了，不能续押');
        }
        player.onGoonBetNum++;
        console.log('最后一次押注',player.lastBets);
        player.lastBets.forEach((m, i) => {
            this.regions[i].sumBet += m;
            player.bets[i] += m;
        });
        // 通知
        this.channel.pushMessage('onBeting', {
            roomCode:this.id,
            uid: player.uid,
            betNums: player.lastBets, // 下注金额
            curBetNums: player.bets, // 当前已经下注金额
            sumBets: this.regions.map(m => m.sumBet)
        });
        return cb(null);
    }

    // 结算
    settlement (list) {
        for (let i = list.length - 1; i >= 0; i--) {
            const player = list[i];
            if(player.uid === this.zhuangInfo.uid){
                player.gain = this.zhuangResult.gain;
                if(this.goldToIntegral(this.isvip,player)<this.upZhuangCond){//庄家金币低于上庄条件
                    this.applyXiazhuang();//自动申请下庄
                }
            } else {
                player.settlement(this.regions);
            }
            // 抽佣 2% 当然只有盈利才抽佣
            if (player.gain > 0) {
                player.gain = Math.floor(player.gain * 0.98);
            }
            // 记录上次盈利
            player.lastGain = player.gain;
            // 记录最大赢钱
            this.addBigwin(player, player.gain);
        }
    }

    // 更换庄家
    changeZhuang () {
        const uid = this.applyZhuangs.shift() || null;
        this.zhuangInfo.uid = uid;
        this.zhuangInfo.hasRound = uid ? 10 : -1;
    }

    // 通知庄家信息
    noticeZhuangInfo () {
        const zhuang = this.getPlayer(this.zhuangInfo.uid);
        this.channel.pushMessage('onUpdateZhuangInfo', {
            roomCode:this.id,
            zhuangInfo: zhuang && zhuang.strip(this.zhuangInfo.hasRound),
            applyZhuangs: this.applyZhuangs
        });
    }

    // 申请上庄
    applyUpzhuang (uid) {
        const robot = RobotMgr.search({uid: uid});
        if(!robot){
            this.applyZhuangs.push(uid);
            // 通知嘛
            this.noticeZhuangInfo();
        }
    }

    // 申请下庄
    applyXiazhuang () {
        this.changeZhuang();
        // 通知嘛
        this.noticeZhuangInfo();
    }

    // 退出上庄列表
    exitUpzhuanglist (uid) {
        this.applyZhuangs.remove(uid);
        // 通知嘛
        this.noticeZhuangInfo();
    }

    // 算出倍数
    conversionMultiple (type) {
        return type >= 10 ? 10 : (type || 1);
    }

    // 是否超出庄家上限
    isBeyondZhuangLimit (bets) {
        if(!this.zhuangInfo.uid){
            return false;
        }
        let sum = 0;
        this.regions.forEach((m, i) => sum += (m.sumBet + bets[i]));
        const zhuang = this.getPlayer(this.zhuangInfo.uid);
        if(this.isvip){
            return zhuang && zhuang.integral < sum*10;
        }else{
            return zhuang && zhuang.gold < sum*10;
        }

    }

    // 关闭房间
    close () {
        if(this.status === 'NONE')
            return;
        this.status = 'NONE';
        clearInterval(this.runInterval);
        this.zhuangInfo.uid = null;
        this.leaves.length = 0;
        this.players.length = 0;
        this.applyZhuangs.length = 0;
    }

    // 返回开始下注信息
    toBetBack () {
        const zhuang = this.getPlayer(this.zhuangInfo.uid);
        return {
            zhuangInfo: zhuang && zhuang.strip(this.zhuangInfo.hasRound),
            applyZhuangs: this.applyZhuangs,// 上庄列表
        }
    }

    // 返回结果信息
    toResultBack (uid) {
        // RobotMgr.activationRobot(this.id,this.nid,false);//关闭机器人下注
        this.recordRobotBetBairen();//记录机器人押注输赢
        const player = this.getPlayer(uid);
        const zhuang = this.getPlayer(this.zhuangInfo.uid);
        let res = {};
        if(this.isvip){
            res = zhuang ?  {uid: zhuang.uid, integral: zhuang.integral}: {uid: null}
        }else{
            res = zhuang ?  {uid: zhuang.uid, gold: zhuang.gold}: {uid: null}
        }
        return {
            zhuangResult: this.zhuangResult,
            regions: this.regions,
            meInfo: player.result(),
            zhuangInfo: res,
            players: this.players.map(m => m.result()),
        }
    }

    strip () {
        const zhuang = this.getPlayer(this.zhuangInfo.uid);
        return {
            id: this.id,
            zhuangInfo: zhuang && zhuang.strip(this.zhuangInfo.hasRound),
            applyZhuangs: this.applyZhuangs,// 上庄列表
            status: this.status === 'INSETTLE' ? 'INBIPAI' : this.status,
            countdownTime: this.getCountdownTime(),
            regions: this.regions
        };
    }
    addByBairen(money,room){
        if(room.jackpot + money < 0){
            return true;
        }
        room.jackpot += money;
        pomelo.app.rpc.hall.gameRemote.niuniuUpdateGameRoom(null, {nid:this.nid, roomCode:this.id,isVip:this.isvip,uid:this.vipRoomoWnerId}, {jackpot: room.jackpot, consumeTotal: room.consumeTotal, winTotal: room.winTotal, boomNum: room.boomNum, runningPool: room.runningPool, profitPool: room.profitPool},function(){});
        return false;

    }

    //如果是vip房间扣除房主的v点
    deductVipDot(model,totalBet){
        console.log('扣除房主的v点',model,totalBet);
        pomelo.app.rpc.hall.gameRemote.getGameFromHallniuniu(null,{nid:this.nid,isVip:this.isvip,uid:this.vipRoomoWnerId},(err,data) => {
            if(!data){
                console.error('获取游戏信息失败getGameFromHallniuniu',data)
                return;
            }
            if(this.isvip && model == 'common'){
                const reduceNum = -(data.removalTime + data.pumpingRate * totalBet);
                pomelo.app.rpc.hall.playerRemote.updateUserEffectTime(null,this.vipRoomoWnerId, {num: reduceNum}, function(){});
            }
        });

    }

    //记录玩家这局押注
    addBet(uid,bet){
        const player = this.getPlayer(uid);
        player.bet += bet;
    }

    //记录机器人下注输赢
    recordRobotBetBairen(){
        let player = this.players.map(m => m.result());
        player.forEach(m=>{
            if(m.isRobot){
                let robot = RobotMgr.getRobotByRoom(this.nid,this.id,m.uid);
                if(robot.error){
                    console.error(robot.error)
                    return;
                }
                if(m.gain){
                    robot.upStation = true;
                }else{
                    robot.upStation = false;
                }
            }
        });
    }

    //金币转积分
    goldToIntegral(isvip,player){
        if(isvip){
            return player.integral;
        }else{
            return player.gold;
        }
    }
}


module.exports = Room;