'use strict';

const MessageService = require('../../../services/MessageService');
const HallService = require('../../../services/HallService');
const GameUtil = require('../../../utils/GameUtil');
const util = require('../../../utils');
const GamesMgr = require('../../ordinaryPlatform/GamesMgr');
const BET_COUNTDOWN = 20; // 下注倒计时（发牌，下注）
const BIPAI_COUNTDOWN = 10; // 比牌倒计时 （比牌动画，展示结果，等待）
const pomelo = require('pomelo');
const RobotMgr = require('../robot/RobotMgr');
const baijiaAI = require('../robot/ai/baijiaAI');
// 一个玩家
class Player {
    constructor (opts) {
        this.uid = opts.uid;
        this.headurl = opts.headurl;
        this.nickname = opts.nickname;
        this.sex = opts.sex;
        this.gold = opts.gold || 0;//金币
        this.integral = opts.integral || 0;//积分
        this.isRobot = !opts.sid;// 是否机器人

        this.lastBets = {};// 最后一次的押注
        this.bets = {
            play: {mul: 1, bet: 0, gain: 0}, // 闲
            draw: {mul: 8, bet: 0, gain: 0}, // 和
            bank: {mul: 0.95, bet: 0, gain: 0}, // 庄
            small: {mul: 1.5, bet: 0, gain: 0}, // 小
            pair0: {mul: 11, bet: 0, gain: 0}, // 闲对
            pair1: {mul: 11, bet: 0, gain: 0}, // 庄对
            big: {mul: 0.5, bet: 0, gain: 0}, // 大
        };
        this.recordBets = null;// 记录下注

        this.sumGain = 0;// 当前总收益
        this.refundNum = 0;//开和退钱总额
        this.lastGain = 0;// 最后一次的收益
        this.onGoonBetNum = 0;//记录续押次数
    }

    // 初始游戏信息
    initGame () {
        for (let key in this.bets) {
            this.bets[key].bet = 0;
            this.bets[key].gain = 0;
        }
        this.lastGain = this.sumGain;// 总收益
        this.sumGain = 0;// 当前收益
        this.refundNum = 0;
        if(this.onGoonBetNum){
            for (let x in this.recordBets){
                if(this.lastBets[x] == undefined){
                    this.lastBets[x] = this.recordBets[x];
                }else{
                    this.lastBets[x] += this.recordBets[x];
                }
            }
        }else{
            this.lastBets = this.recordBets ? this.recordBets : this.lastBets;
        }


        this.recordBets = null;
        this.onGoonBetNum = 0;
    }

    // 获取总押注
    sumBetNum () {
        let num = 0;
        for (let key in this.bets) {
            num += this.bets[key].bet;
        }
        return num;
    }

    //最后一次押注
    lastSumBetNum () {
        let num = 0;
        for (let key in this.lastBets) {
            num += this.lastBets[key];
        }
        return num;
    }

    // 结算
    settlement (ret) {
        this.sumGain = 0;
        this.refundNum = 0;
        for (let key in ret) {
            const v = this.bets[key];
            v.gain = Math.floor(v.bet * (v.mul + 1));
            this.sumGain += v.gain;
        }
        // 如果是和 把压得庄和闲退回
        if (ret.draw) {
            this.refundNum += this.bets.play.bet;
            this.refundNum += this.bets.bank.bet;
        }
        this.sumGain += this.refundNum;
        this.lastGain = this.sumGain;
    }

    // 是否有下注
    hasBet () {
        for (let key in this.bets) {
            if(this.bets[key].bet > 0) {
                return true;
            }
        }
        return false;
    }

    // 结算信息 - 参与扣除金币
    toSettlementInfo () {
        return {
            uid: this.uid,
            gain: this.sumGain
        }
    }

    // 结算信息 - 参与发送邮件
    toSettlementInfoByMail () {
        return {
            uid: this.uid,
            gain: this.sumGain,
            bets: this.bets
        }
    }

    // 返回给前端
    result () {

        return {
            uid: this.uid,
            gold: this.gold,
            gain: this.sumGain,
            refundNum: this.refundNum,
            integral:this.integral,
            isRobot:this.isRobot,
            bets:this.bets
        };
    }

    strip () {
        return {
            uid: this.uid,
            headurl: this.headurl,
            nickname: encodeURI(this.nickname),
            sex: this.sex,
            gold: this.gold,
            integral:this.integral,
            gain: this.lastGain
        };
    }
}


/**
 * 百家乐 - 游戏房间
 */
class Room {

    constructor (opts) {
        this.nid = opts.nid;//游戏
        this.id = opts.id;//房间id
        this.maxCount = opts.maxCount || 50;// 最大人数
        this.channel = opts.channel;
        this.entryCond = opts.entryCond || 0;// 进入条件
        this.singleBetLimit = opts.singleBetLimit || 0;// 单人押注上限

        this.status = 'NONE';// 状态 INBET.下注阶段 INBIPAI.比牌结算阶段 INSETTLE.结算中
        this.players = [];// 玩家列表
        this.leaves = [];// 记录强退玩家信息 方便本局游戏结束发放邮件
        this.pais = [];// 牌

        this.lastCountdownTime = 0;// 记录最后一次的倒计时 时间
        this.dishs = {// 下注区域
            play: {mul: 1,betUpperLimit: 10000000,  sumBet: 0}, // 闲
            draw: {mul: 8,  betUpperLimit: 1100000,sumBet: 0}, // 和
            bank: {mul: 0.95,betUpperLimit: 10000000, sumBet: 0}, // 庄
            small: {mul: 1.5,betUpperLimit: 6000000,  sumBet: 0}, // 小
            pair0: {mul: 11, betUpperLimit: 800000,sumBet: 0}, // 闲对
            pair1: {mul: 11,betUpperLimit: 800000, sumBet: 0}, // 庄对
            big: {mul: 0.5, betUpperLimit: 20000000,sumBet: 0} // 大
        };
        this.regions = [
            {cards: null, cardType: 0, oldCardType: 0},// 庄
            {cards: null, cardType: 0, oldCardType: 0},// 闲
        ];
        this.result = null;// 结果
        this.historys = [];// 历史纪录
        this.historys2 = [];// 历史纪录

        this.bigwins = [];// 最大赢钱
        this.isvip = opts.isvip || false;

        this.additionalCountdown = 0;// 额外倒计时
        this.vipRoomoWnerId = opts.vipRoomoWnerId || '';//vip房主uid

        this.roomRandomRobotNum = util.random(10,15);//房间拥有最大机器人数量

        this.robotAddRoomTime = 0;//机器人加入房间的时间
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
        const player = this.players.remove('uid', uid);
        if(!player) {
            return false;
        }
        if(!forced) {
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
            return (BIPAI_COUNTDOWN+1+this.additionalCountdown)*1000;
        const time = Date.now() - this.lastCountdownTime;
        if(this.status === 'INBET')
            return Math.max((BET_COUNTDOWN)*1000 - time, 1);
        if(this.status === 'INBIPAI')
            return Math.max((BIPAI_COUNTDOWN+this.additionalCountdown)*1000 - time, 1);
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
        console.log(this.id+' 房间开始');
    }

    // 一秒执行一次
    update () {
        // console.log('当前状态1',this.nid,this.id,this.status);
        if(this.status === 'INSETTLE')
            return;
        --this.countdown;
        // console.log('this.countdownthis.countdown',this.countdown);
        if(this.countdown > 0) {
            return;
        }
        this.lastCountdownTime = Date.now();
        switch(this.status) {
            case 'INBET':// 如果是下注阶段 就开始结算
                this.status = 'INSETTLE';
                this.bipai();
                break;
            case 'INBIPAI':// 如果是比牌阶段 就开始等待
                this.countdown = BET_COUNTDOWN;
                this.status = 'INBET';
                this.bet();
                break;
        }
        // console.log('当前状态2',this.nid,this.id,this.status);
    }

    //初始化
    init () {
        this.players.forEach(m => m.initGame());
        this.regions.forEach(m => {
            m.cards = null;
            m.cardType = 0;
        });
        for (let key in this.dishs) {
            this.dishs[key].sumBet = 0;
        }

        let playerIndex = this.players.find(m=> !m.isRobot);
        if(playerIndex){
            RobotMgr.setMaxBet(this.nid,this.id);//设置房间内机器人本局最大下注金额
            baijiaAI.RobotbetRegulation(this);//设置机器人下注规则
        }
    }

    //开始下注
    bet () {
        // console.log('开始下注-----------');
        // 判断是否没有人了 关闭房间
        if(this.players.length === 0) {
            return this.close();
        }
        // 初始化数据
        this.init();
    }

    // 比牌 结算
    bipai () {
        // 当盘面总押注
        const sumBet = this.getSumBet();
        const paiCount = this.pais.length;
        let cards0 = null, cards1 = null, cardType0 = 0, cardType1 = 0;
        pomelo.app.rpc.hall.gameRemote.getGameFromHallniuniu(null,{nid:this.nid,isVip:this.isvip,uid:this.vipRoomoWnerId},(err,data) =>{
            if(!data){
                console.error('获取游戏信息失败getGameFromHallniuniu',data)
                return;
            }
            const room = data.rooms.find(room => room.roomCode == this.id);
            do {
                // 发牌 - 闲
                cards0 = this.regions[0].cards = this.deal(2);
                cardType0 = this.regions[0].oldCardType = GameUtil.getCardTypeTo9(cards0);
                // 发牌 - 庄
                cards1 = this.regions[1].cards = this.deal(2);
                cardType1 = this.regions[1].oldCardType = GameUtil.getCardTypeTo9(cards1);
                // 检查 闲 是否补第三张牌
                this.additionalCountdown = 0;
                if(GameUtil.canBupaiByPlay(cardType0, cardType1)) {
                    var bupai = this.deal();
                    cards0.push(bupai);
                    this.additionalCountdown += 1;
                }
                // 检查 庄 是否补第三张牌
                if(GameUtil.canBupaiByBank(cardType0, cardType1, bupai)) {
                    cards1.push(this.deal());
                    this.additionalCountdown += 1;
                }
                // 设置倒计时 时间
                // tempCountdown = tempCountdown === 4 ? 5 : tempCountdown;
                this.countdown = BIPAI_COUNTDOWN+this.additionalCountdown;
                // 获取结果
                cardType0 = this.regions[0].cardType = GameUtil.getCardTypeTo9(cards0);
                cardType1 = this.regions[1].cardType = GameUtil.getCardTypeTo9(cards1);
                this.result = GameUtil.getResultTo9(cards0, cards1, cardType0, cardType1);

                var playerSumGain = 0;// 玩家总盈利
                // 结账 - 在线的
                playerSumGain += this.settlement(this.players);
                // 结账 - 离线的
                playerSumGain += this.settlement(this.leaves);
                // 盘面总押注 - 玩家盈利 = 系统盈利

                if (this.addByBaijia(sumBet - playerSumGain,room)) {
                    if (paiCount <= 6) {
                        this.pais = GameUtil.getPai(3);
                    } else {
                        this.pais = this.pais.concat(cards0).concat(cards1);
                        this.pais.sort(() => 0.5 - Math.random());
                    }
                } else {
                    if (paiCount <= 6) { // 52 * 3 = 156
                        const count = paiCount - (cards0.length + cards1.length);
                        this.pais = this.pais.slice(0, count <= 0 ? 156+count : count);
                    }
                    break;
                }
            } while(true);
            // 记录 历史纪录
            this.recordHistorys2(this.result, cards0, cards1, cardType0, cardType1);
            // 记录 历史纪录
            this.recordHistorys(this.result);
            // 记录最大赢钱
            this.recordBigwins(this.players.concat(this.leaves));
            // 执行加钱 - 在线的
            if(this.isvip) {
                HallService.changesIntegralByOnline(this.players.map(m => m.toSettlementInfo()), (err, list) => {
                    list.forEach(m => {this.setPlayerIntegral(m.uid, m.integral)});
                    this.status = 'INBIPAI';
                });
            }else{
                HallService.changeGoldsByOnline(this.players.map(m => m.toSettlementInfo()), (err, list) => {
                    list.forEach(m => this.setPlayerGold(m.uid, m.gold));
                    this.status = 'INBIPAI';
                });
            }
            // 执行加钱 - 邮件
            if(this.leaves.length > 0) {
                HallService.changeGoldsByMail2({name: '欢乐百家', regions: this.regions}, this.leaves.map(m => m.toSettlementInfoByMail()));
                this.leaves.length = 0;
            }
        });
    }

    // 获取牌
    deal (count = 1) {
        const ret = [];
        for (let i = 0; i < count; i++) {
            // 没有牌了 获取新的 目前用三副牌
            if(this.pais.length === 0) {
                this.pais = GameUtil.getPai(3);
            }
            // 取第一张
            ret.push(this.pais.shift());
        }
        return ret;
    }
    // 总押注
    getSumBet () {
        let num = 0;
        let list = this.players.concat(this.leaves);

        for (let i = list.length - 1; i >= 0; i--) {
            const player = list[i];
            if (!player.isRobot) {
                num += player.sumBetNum();
            }
        }
        return num;
    }
    // 结算
    settlement (list) {
        let sum = 0;
        for (let i = list.length - 1; i >= 0; i--) {
            const player = list[i];
            player.settlement(this.result);
            // 机器人不参与计算
            if(!player.isRobot) {
                sum += player.sumGain;
            }
        }
        return sum;

    }
    // 设置玩家金币
    setPlayerGold (uid, gold) {
        const player = this.getPlayer(uid);
        if(player) {
            player.gold = gold;
        } else {
            console.error('设置玩家金币出错，找不到玩家');
        }
    }
    // 设置玩家积分
    setPlayerIntegral(uid, integral){
        const player = this.getPlayer(uid);
        if(player) {
            player.integral = integral;
        } else {
            console.error('设置玩家积分出错，找不到玩家');
        }
    }
    // 记录 历史纪录
    recordHistorys (result) {
        if(this.historys.length >= 180) {
            this.historys.shift();
            // 第一个不能为和
            while (this.historys[0] === 'draw') {
                this.historys.shift();
            }
        }
        let value = '';
        if(result.play) {
            value = 'play';
        } else if(result.bank) {
            value = 'bank';
        } else if(result.draw && this.historys.length !== 0) {
            value = 'draw';
        }
        if (value !== '') {
            if (result.pair0) {
                value += '-0';
            }
            if (result.pair1) {
                value += '-1';
            }
            this.historys.push(value);
        }
    }
    // 历史纪录2
    recordHistorys2 (result, cards0, cards1, cardType0, cardType1) {
        (this.historys2.length >= 10) && this.historys2.pop();
        this.historys2.unshift({
            result: result,
            play: {cards: cards0, cardType: cardType0},
            bank: {cards: cards1, cardType: cardType1},
        });
    }
    // 记录最大赢钱
    recordBigwins (list) {
        list.forEach(m => this.addBigwin(m, m.sumGain));
    }
    // 下注
    onBeting (player, betNum, area,model) {

        if(this.isvip){
            // 先扣除积分
            HallService.changeIntegral(player.uid, -betNum, (integral) => {
                player.integral = integral;
                player.bets[area].bet += betNum;
                this.dishs[area].sumBet += betNum;
                // 记录需押
                (!player.recordBets) && (player.recordBets = {});
                player.recordBets[area] = (player.recordBets[area] || 0) + betNum;

                const robot = RobotMgr.search({uid: player.uid});
                if(!robot){
                    //扣除vip v点
                    this.deductVipDot(model,betNum);
                }

                // 通知
                this.channel.pushMessage('onBeting', {
                    roomCode:this.id,
                    uid: player.uid,
                    integral: player.integral,
                    betNums: {[area]: betNum}, // 下注金额
                    curBetNums: player.bets, // 当前已经下注金额
                    dishs: this.dishs
                });
            });
        }else{
            // 先扣除金币
            HallService.changeGold(player.uid, -betNum, (gold) => {
                player.gold = gold;
                player.bets[area].bet += betNum;
                this.dishs[area].sumBet += betNum;
                // 记录需押
                (!player.recordBets) && (player.recordBets = {});
                player.recordBets[area] = (player.recordBets[area] || 0) + betNum;
                // console.log(this.nid,this.id,'正在下注');
                // 通知
                this.channel.pushMessage('onBeting', {
                    roomCode:this.id,
                    uid: player.uid,
                    gold: player.gold,
                    betNums: {[area]: betNum}, // 下注金额
                    curBetNums: player.bets, // 当前已经下注金额
                    dishs: this.dishs
                });
            });

        }

    }

    // 需押
    onGoonBet (player, betNum, model,cb) {
        if(player.onGoonBetNum != 0){
            return cb('只能续押一次');
        }

        if(player.recordBets){
            return cb('你已经押注了，不能续押');
        }
        player.onGoonBetNum++;
        if (betNum <= 0) {
            return cb('押注金额不够');
        }
        if(this.isvip){
            // 先扣除积分
            HallService.changeIntegral(player.uid, -betNum, (integral) => {
                player.integral = integral;
                for (let key in player.lastBets) {
                    const num = player.lastBets[key];
                    player.bets[key].bet += num;
                    this.dishs[key].sumBet += num;
                }
                const robot = RobotMgr.search({uid: player.uid});
                if(!robot) {
                    //扣除vip v点
                    this.deductVipDot(model, betNum);
                }
                // 通知
                this.channel.pushMessage('onBeting', {
                    roomCode:this.id,
                    uid: player.uid,
                    integral: player.integral,
                    betNums: player.lastBets, // 下注金额
                    curBetNums: player.bets, // 当前已经下注金额
                    dishs: this.dishs
                });

            });
            return cb(null);
        }else{
            // 先扣除金币
            HallService.changeGold(player.uid, -betNum, (gold) => {
                player.gold = gold;
                for (let key in player.lastBets) {
                    const num = player.lastBets[key];
                    player.bets[key].bet += num;
                    this.dishs[key].sumBet += num;
                }
                // 通知
                this.channel.pushMessage('onBeting', {
                    roomCode:this.id,
                    uid: player.uid,
                    gold: player.gold,
                    betNums: player.lastBets, // 下注金额
                    curBetNums: player.bets, // 当前已经下注金额
                    dishs: this.dishs
                });

            });
            return cb(null);
        }

    }

    // 取消押注
    onCancelBet (player,model) {
        const betNum = player.sumBetNum();
        if(betNum <= 0) {
            return;
        }
        if(this.isvip){
            // 先加钱
            HallService.changeIntegral(player.uid, betNum, (integral) => {
                player.integral = integral;
                const cancelBets = {};
                for (let key in player.bets) {
                    const v = player.bets[key];
                    if (v.bet <= 0) {
                        continue;
                    }
                    cancelBets[key] = v.bet;
                    this.dishs[key].sumBet -= v.bet;
                    v.bet = 0;
                }
                const robot = RobotMgr.search({uid: player.uid});
                if(!robot) {
                    //取消押注补充v点
                    this.deductVipDot(model, -betNum);
                }
                // 取消记录
                player.recordBets = null;
                // 通知
                this.channel.pushMessage('onCancelBet', {
                    roomCode:this.id,
                    uid: player.uid,
                    integral: player.integral,
                    cancelBets: cancelBets, // 取消下注列表
                    curBetNums: player.bets, // 当前已经下注金额
                    dishs: this.dishs
                });
            });
        }else{
            // 先加钱
            HallService.changeGold(player.uid, betNum, (gold) => {
                player.gold = gold;
                const cancelBets = {};
                for (let key in player.bets) {
                    const v = player.bets[key];
                    if (v.bet <= 0) {
                        continue;
                    }
                    cancelBets[key] = v.bet;
                    this.dishs[key].sumBet -= v.bet;
                    v.bet = 0;
                }
                // 取消记录
                player.recordBets = null;
                // 通知
                this.channel.pushMessage('onCancelBet', {
                    roomCode:this.id,
                    uid: player.uid,
                    gold: player.gold,
                    cancelBets: cancelBets, // 取消下注列表
                    curBetNums: player.bets, // 当前已经下注金额
                    dishs: this.dishs
                });
            });
        }

    }

    // 关闭房间
    close () {
        if(this.status === 'NONE')
            return;
        this.status = 'NONE';
        clearInterval(this.runInterval);
        this.leaves.length = 0;
        this.players.length = 0;
        console.log(this.id+' 房间关闭');
    }

    // 返回开始下注信息
    toBetBack () {
        return {paiCount: this.pais.length};
    }

    // 返回结果信息
    toResultBack () {
        this.recordRobotBet();//记录机器人押注输赢
        // RobotMgr.activationRobot(this.id,this.nid,false);//关闭机器人下注
        return {
            paiCount: this.pais.length,
            regions: this.regions,
            result: this.result,
            historys: this.historys,
            historys2: this.historys2,
            players: this.players.map(m => m.result())
        }
    }

    strip () {
        return {
            id: this.id,
            status: this.status === 'INSETTLE' ? 'INBIPAI' : this.status,
            countdownTime: this.getCountdownTime(),
            paiCount: this.pais.length,
            dishs: this.dishs,
            historys: this.historys,
            historys2: this.historys2,
        };
    }

    addByBaijia(money,room){
        if(room.jackpot + money < 0){//奖池钱不够扣
            return true;
        }
        room.jackpot += money;
        //跟新游戏房间
        pomelo.app.rpc.hall.gameRemote.niuniuUpdateGameRoom(null, {nid:this.nid, roomCode:this.id,isVip:this.isvip,uid:this.vipRoomoWnerId}, {jackpot: room.jackpot, consumeTotal: room.consumeTotal, winTotal: room.winTotal, boomNum: room.boomNum, runningPool: room.runningPool, profitPool: room.profitPool},function(){});
        return false;

    }

    //如果是vip房间扣除房主的v点
    deductVipDot(model,totalBet){
        console.log('vip房间扣除房主的v点',model,totalBet,this.vipRoomoWnerId,this.nid,this.isvip);
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

    //记录机器人下注输赢
    recordRobotBet(){
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
}


module.exports = Room;