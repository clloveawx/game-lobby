'use strict';
const GameUtil = require('../../../utils/GameUtil');
const utils = require('../../../utils');
const HallService = require('../../../services/HallService');
const BETCOUNTDOWN = 10;
const CARDDOWN = 10;
const pomelo = require('pomelo');
const DotMgr = require('../../../domain/transplant/Dot/DotMgr');
//玩家
class Player {
    constructor(i, opts) {
        this.seat = i;//玩家位置
        this.isPlay = opts.isPlay;//玩家类型 三种 玩家 看家 庄家
        this.headurl = opts.headurl;
        this.uid = opts.uid;
        this.nickname = opts.nickname;
        this.gold = opts.gold || 0;//金币
        this.integral = opts.integral || 0;//积分
        this.playerStatus = 'GREY'; //BRIGHT亮 GREY灰
        this.poker = [];//玩家自己的牌
        this.currDot = [];//当前点数
        this.bet = 0;//玩家所有位置下注的总金额
        this.insuranceBet = 0;//买保险的钱
        this.gain = 0;//玩家赢的钱
        this.separatePoker = [];//分牌后的数组
        this.buyPoker = [//玩家买的牌
            {poker: [], bet: 0, currDot: [], isSeparate: false, separatePoker: [], partStatus: 0, mulriple: 2},
            {poker: [], bet: 0, currDot: [], isSeparate: false, separatePoker: [], partStatus: 0, mulriple: 2},
            {poker: [], bet: 0, currDot: [], isSeparate: false, separatePoker: [], partStatus: 0, mulriple: 2},
            {poker: [], bet: 0, currDot: [], isSeparate: false, separatePoker: [], partStatus: 0, mulriple: 2},
            {poker: [], bet: 0, currDot: [], isSeparate: false, separatePoker: [], partStatus: 0, mulriple: 2}
        ],
        this.winStatus = false;//是否赢钱
        this.isSeparate = false;//是否可以分牌
        this.insuranceStatus = 0;//买保险状态
        this.partStatus = 0;//是否分过牌
        this.currPoker = 1;//分牌后当前操作哪一副牌
        this.mulriple = 2;//倍数
        this.enterIntoTime = new Date().getTime();//玩家进入房间时间
        this.upStation = 0;//玩家上局输赢情况
        this.leaveStatus = opts.leaveStatus || 0;//玩家离线状态 true.玩家掉线
    }

    //初始化玩家信息
    initGame() {
        this.poker = [];
        this.currDot = [];
        this.separatePoker = [];
        this.isSeparate = false;
        this.partStatus = 0;
        this.currPoker = 1;
        this.winStatus = false;
        this.playerStatus = 'BRIGHT';
        this.bet = 0;
        this.insuranceBet = 0;
        this.insuranceStatus = 0;
        this.gain = 0;
        this.buyPoker = [//玩家买的牌
            {poker: [], bet: 0, currDot: [], isSeparate: false, separatePoker: [], partStatus: 0, mulriple: 2},
            {poker: [], bet: 0, currDot: [], isSeparate: false, separatePoker: [], partStatus: 0, mulriple: 2},
            {poker: [], bet: 0, currDot: [], isSeparate: false, separatePoker: [], partStatus: 0, mulriple: 2},
            {poker: [], bet: 0, currDot: [], isSeparate: false, separatePoker: [], partStatus: 0, mulriple: 2},
            {poker: [], bet: 0, currDot: [], isSeparate: false, separatePoker: [], partStatus: 0, mulriple: 2}
        ];
    }

    //玩家加倍
    addMultiples(seat, room, cb) {

        let isBet = room.bottomPourArea[seat].other.find(m => m.uid == this.uid);
        // 金币是否够
        if (isBet.bet > room.goldToIntegral(room.isvip, this)) {
            return cb(room.isvip ? '积分不足' : '金币不足');
        }
        let selfCard = room.bottomPourArea[seat].other.find(m => m.uid == this.uid);
        console.log('selfCardselfCard',selfCard);
        if (selfCard.status == 4) {
            return cb('等待其它玩家操作');
        }
        this.buyPoker[seat].bet += isBet.bet;//该区域的总下注
        isBet.bet += isBet.bet;//该区域的总下注
        this.bet += isBet.bet;//自己的总下注
        let addM = {};
        if (this.seat == seat) {
            this.getCardUserNoPartSelf({seat, room, isAddMul: true});//要一张牌
        } else {
            addM = this.getCardUserNoPartBuy({seat, room, getNum: 1, isAddMul: true});//要一张牌
        }
        room.channel.pushMessage('onMultiple', {seat: seat, bet: isBet.bet, uid: this.uid});
        this.changeMoney(room, -isBet.bet, (money) => {
            return cb(null, {money: isBet.bet, currMoney: money,msg:addM.msg == undefined?'':addM.msg});
        });

    }

    //玩家分牌
    separateCards(seat, room, cb) {
        console.log('分牌');
        this.separateCard = 1;
        //扣钱处理
        let currBet = room.bottomPourArea[seat].other.find(m => m.uid == this.uid);
        // 金币是否够
        if (currBet.bet > room.goldToIntegral(room.isvip, this)) {
            return cb(room.isvip ? '积分不足' : '金币不足');
        }

        this.bet += currBet.bet;

        let ob = {uid: this.uid, seat: seat, bet: currBet.bet};
        if (this.seat == seat) {//分自己的牌
            if (!this.isSeparate) {
                return cb('你不能分牌了');
            }
            this.separatePoker[0] = {poker: [this.poker[0], room.getCard()], bet: currBet.bet};
            this.separatePoker[1] = {poker: [this.poker[1], room.getCard()], bet: currBet.bet};
            this.separatePoker[0]['dot'] = room.calculateDot(this.separatePoker[0].poker);
            this.separatePoker[1]['dot'] = room.calculateDot(this.separatePoker[1].poker);
            ob['partPoker'] = this.separatePoker;
            this.isSeparate = false;//完成分牌
            this.partStatus = 1;
            room.bottomPourArea[seat].separatePoker = this.separatePoker;//分牌后牌桌上的数据

        } else {//分下注的牌
            if (!this.buyPoker[seat].isSeparate) {
                return cb('你不能分下注牌了');
            }
            this.buyPoker[seat].separatePoker[0] = {
                poker: [this.buyPoker[seat].poker[0], room.getCard()],
                bet: currBet.bet
            }
            this.buyPoker[seat].separatePoker[1] = {
                poker: [this.buyPoker[seat].poker[1], room.getCard()],
                bet: currBet.bet
            }
            this.buyPoker[seat].separatePoker[0]['dot'] = room.calculateDot(this.buyPoker[seat].separatePoker[0].poker);
            this.buyPoker[seat].separatePoker[1]['dot'] = room.calculateDot(this.buyPoker[seat].separatePoker[1].poker);
            ob['partPoker'] = this.buyPoker[seat].separatePoker;
            this.buyPoker[seat].isSeparate = false;//完成分牌
            this.buyPoker[seat].partStatus = 1;
            room.bottomPourArea[seat].separatePoker = this.buyPoker[seat].separatePoker;//分牌后牌桌上的数据
        }

        room.nextTime(room, false);//开始第二回合操作
        //通知玩家分牌
        room.channel.pushMessage('onSeparateCard', ob);//通知其它玩家分牌

        this.changeMoney(room, -currBet.bet, (money) => {
            return cb(null, currBet.bet);
        });
    }

    //要牌
    getCardUser({seat, room}) {
        if (this.seat == seat) {//自己的牌
            this.isSeparate = false;//设置分牌状态为不可分牌
            if (this.partStatus) {
                return this.getCardUserIsPartSelf({seat, room});//有分牌
            } else {
                return this.getCardUserNoPartSelf({seat, room});//没有分牌
            }
        } else {//买的牌
            this.buyPoker[seat].isSeparate = false;//设置分牌状态为不可分牌
            if (this.buyPoker[seat].partStatus) {
                return this.getCardUserIsPartBuy({seat, room});//有分牌
            } else {
                return this.getCardUserNoPartBuy({seat, room});//没有分牌
            }
        }
    }

    //过牌
    noCardUser({seat, room}) {
        if (this.seat == seat) {//自己的牌
            this.isSeparate = false;//设置分牌状态为不可分牌
            if (this.partStatus) {
                return this.noCardUserIsPartSelf({room});//有分牌
            } else {
                return this.noCardUserNoPartSelf({room});//没有分牌
            }
        } else {//买的牌
            this.buyPoker[seat].isSeparate = false;//设置分牌状态为不可分牌
            if (this.buyPoker[seat].partStatus) {
                return this.noCardUserIsPartBuy({seat, room});//有分牌
            } else {
                return this.noCardUserNoPartBuy({seat, room});//没有分牌
            }
        }
    }

    //玩家要牌(分牌，自己的牌)
    getCardUserIsPartSelf({seat, room}) {
        let arrPlayer = [this.uid];
        let alluid = [];
        let dot = 0;
        let isCard = room.getCard();
        this.separatePoker[this.partStatus - 1].poker.push(isCard);
        this.separatePoker[this.partStatus - 1].dot = room.calculateDot(this.separatePoker[this.partStatus - 1].poker);

        dot = this.separatePoker[this.partStatus - 1].dot;

        //跟新牌桌上的分牌数据
        room.bottomPourArea[seat].separatePoker = this.separatePoker;

        if (this.separatePoker[this.partStatus - 1].dot[0] >= 21) {//分牌中的其中一副牌满21点了
            if (this.partStatus == 1) {
                console.log('分牌要牌，你爆了，自己的牌');
                room.nextTime(room, false);//继续第二副操作
                this.partStatus++;//爆牌了，进入下一副牌
                this.currPoker = 1;
                room.channel.pushMessage('onCheck', {seat: seat, isPart: this.partStatus});
            } else if (this.partStatus == 2) {//第二副满21
                console.log('分牌要牌，第二副牌，自己的牌', this.currPoker);
                this.currPoker = 2;
                room.nextTime(room, true);//下一家说话
            }
        } else {
            if (this.partStatus == 1) {
                this.currPoker = 1;
            } else if (this.partStatus == 2) {
                this.currPoker = 2;
            }
            console.log('分牌要牌没满21点，自己的牌');
            room.nextTime(room, false);//继续操作
        }
        room.noteDeal({seat, isCard, dot, player: arrPlayer, alluid: alluid, isPart: this.currPoker});
        return {isPart: this.currPoker, isCard, dot}
    }

    //玩家要牌(分牌，自己买的牌)
    getCardUserIsPartBuy({seat, room}) {
        let dot = 0;
        let isCard = room.getCard();
        this.buyPoker[seat].separatePoker[this.buyPoker[seat].partStatus - 1].poker.push(isCard);
        this.buyPoker[seat].separatePoker[this.buyPoker[seat].partStatus - 1].dot = room.calculateDot(this.buyPoker[seat].separatePoker[this.buyPoker[seat].partStatus - 1].poker);

        dot = this.buyPoker[seat].separatePoker[this.buyPoker[seat].partStatus - 1].dot;

        //更新牌桌上的分牌数据
        room.bottomPourArea[seat].separatePoker = this.buyPoker[seat].separatePoker;

        if (this.buyPoker[seat].separatePoker[this.buyPoker[seat].partStatus - 1].dot[0] >= 21) {//分牌中的其中一副牌满21点了
            if (this.buyPoker[seat].partStatus == 1) {
                console.log('你爆了,买的牌,分牌要牌');
                room.nextTime(room, false);//继续第二副操作
                this.buyPoker[seat].partStatus++;
                this.currPoker = 1;
                room.channel.pushMessage('onCheck', {seat: seat, isPart: this.buyPoker[seat].partStatus});
            } else if (this.buyPoker[seat].partStatus == 2) {//第二副满21
                this.currPoker = 2;
                console.log('第二副,买的牌，分牌要牌');
                room.nextTime(room, true);//下一家说话
            }
        } else {
            if (this.buyPoker[seat].partStatus == 1) {
                this.currPoker = 1;
            } else if (this.buyPoker[seat].partStatus == 2) {
                this.currPoker = 2;
            }
            console.log('没满21点,买的牌，分牌要牌');
            room.nextTime(room, false);//继续操作
        }
        room.noteDeal({seat, isCard, dot, player: [this.uid], isPart: this.currPoker});
        return {isPart: this.currPoker, isCard, dot};
    }


    //玩家要牌(不分牌，自己的牌)
    getCardUserNoPartSelf({seat, room, isAddMul}) {
        let arrPlayer = [this.uid];
        let alluid = [];
        let dot = 0;
        let isCard = room.getCard();
        this.poker.push(isCard);
        this.currDot = room.calculateDot(this.poker);

        dot = this.currDot;

        //更新牌桌上的数据
        room.bottomPourArea[seat].initPoker = this.poker;
        room.bottomPourArea[seat].currDot = this.currDot;

        if (this.currDot[0] >= 21) {//玩家最优牌型达到或超过21点，玩家终止操作
            console.log('玩家要牌，不分牌，满21点');
            room.nextTime(room, true);//下一家说哈
        } else {
            console.log('玩家要牌，不分牌');
            if (isAddMul) {//如果是加倍
                room.nextTime(room, true);//下一家说话
            } else {
                room.nextTime(room, false);//继续操作
            }

        }

        room.noteDeal({seat, isCard, dot, player: arrPlayer, alluid: alluid});
        return {isCard, dot};
    }

    //玩家要牌(不分牌，买的牌)
    getCardUserNoPartBuy({seat, room, getNum, isAddMul}) {
        let arrPlayer = [];
        let alluid = [];
        let dot = 0;
        let isCard = room.getCard();
        let selfCard = room.bottomPourArea[seat].other.find(m => m.uid == this.uid);
        selfCard.getNum++;
        //查找还有没有没有操作的玩家
        let isFinish = room.bottomPourArea[seat].other.find(m => m.status == 0);

        if (selfCard.status != 0 && isFinish) {//有玩家还没有操作
            return {error: '等待其它玩家操作'}
        }
        let getNums = getNum ? getNum : selfCard.getNum;
        //获取牌
        let isGet = room.bottomPourArea[seat].getCardArr.length;
        if (isGet >= getNums) {
            isCard = room.bottomPourArea[seat].getCardArr[getNums - 1];
        } else {
            room.bottomPourArea[seat].getCardArr.push(isCard);
        }

        //更新自己买的牌的信息
        this.buyPoker[seat].poker.push(isCard);
        this.buyPoker[seat].currDot = room.calculateDot(this.buyPoker[seat].poker);

        dot = this.buyPoker[seat].currDot;

        //更新牌桌上的数据
        room.bottomPourArea[seat].initPoker = this.buyPoker[seat].poker;
        room.bottomPourArea[seat].currDot = this.buyPoker[seat].currDot;


        console.log('要牌玩家状态，', room.bottomPourArea[seat].other);

        if (selfCard.status == 0) selfCard.status = 1;//要牌
        if (isAddMul) {
            selfCard.status = 4;//加倍操作
        }

        isFinish = room.bottomPourArea[seat].other.find(m => m.status == 0);
        let ob = {isCard, dot}
        if(isFinish){
            ob['msg'] = '等待其它玩家操作'
        }
        if (this.buyPoker[seat].currDot[0] >= 21) {
            selfCard.status = 3;//爆牌
            console.log('要牌玩家状态，爆牌', room.bottomPourArea[seat].other);
            if (!isFinish) {//所有玩家完成操作，进入下一步操作
                //找出需要发牌的玩家
                room.bottomPourArea[seat].other.filter(m => m.status == 3).forEach(m => {
                    arrPlayer.push(m.uid);
                });
                room.bottomPourArea[seat].other.forEach(m => {
                    alluid.push(m.uid);
                });
                room.noteDeal({seat, isCard, dot, player: arrPlayer, alluid: alluid});
                console.log('玩家要牌，买的牌，不分牌，满21点');
                room.nextTime(room, true);//进入下一家
            }

        } else {//没满21点
            if (!isFinish) {//所有玩家完成操作，进入下一步操作
                let exitGetCard = room.bottomPourArea[seat].other.find(m => m.status == 1);//存在要牌的玩家

                //找出需要发牌的玩家
                room.bottomPourArea[seat].other.filter(m => m.status == 1 || m.status == 4).forEach(m => {
                    arrPlayer.push(m.uid);
                });
                room.bottomPourArea[seat].other.forEach(m => {
                    alluid.push(m.uid);
                });
                room.noteDeal({seat, isCard, dot, player: arrPlayer, alluid: alluid});

                if (exitGetCard) {//存在要牌的玩家
                    room.bottomPourArea[seat].other.forEach(m => {
                        if (m.status == 1) m.status = 0;
                    });
                    console.log('玩家要牌，买的牌，不分牌，存在要牌的玩家');
                    room.nextTime(room, false);//开始第二回合要牌
                } else {//不存在要牌的玩家，只有过牌和加倍的玩家
                    console.log('玩家要牌，买的牌，不分牌，不存在要牌的玩家，只有过牌和加倍的玩家');
                    room.nextTime(room, true);//开始下一家
                }
            }
        }

        return ob;
    }


    //玩家过牌(分牌,自己的牌)
    noCardUserIsPartSelf({room}) {
        if (this.partStatus == 1) {//分牌的第一副牌
            console.log('自己的牌过牌，分牌，第一副牌', this.partStatus);
            room.nextTime(room, false);//第二回合说哈
            this.partStatus++;//玩家过牌了进入下一副牌
            room.channel.pushMessage('onCheck', {seat: seat, isPart: this.partStatus});
        } else if (this.partStatus == 2) {
            console.log('自己的牌过牌，分牌，第二副牌', this.partStatus);
            room.nextTime(room, true);//第二回合说哈
        }

        return {isPart: this.partStatus};
    }

    //玩家过牌(分牌,买的牌)
    noCardUserIsPartBuy({seat, room}) {
        if (this.buyPoker[seat].partStatus == 1) {//分牌的第一副牌
            console.log('买的牌过牌，分牌，第一副牌', this.buyPoker[seat].partStatus);
            room.nextTime(room, false);//第二回合说哈
            this.buyPoker[seat].partStatus++;//玩家过牌了进入下一副牌
            room.channel.pushMessage('onCheck', {seat: seat, isPart: this.buyPoker[seat].partStatus});//通知前端
        } else if (this.buyPoker[seat].partStatus == 2) {
            console.log('买的牌过牌，分牌，第二副牌', this.buyPoker[seat].partStatus);
            room.nextTime(room, true);//第二回合说哈
        }



        return {isPart: this.buyPoker[seat].partStatus};
    }

    //玩家过牌(不分牌,自己的牌)
    noCardUserNoPartSelf({room}) {
        console.log('过牌自己的牌，不分牌');
        room.nextTime(room, true);//过牌，直接下一家说话
        return null;
    }

    //玩家过牌(不分牌,买的牌)
    noCardUserNoPartBuy({seat, room}) {
        let arrPlayer = [];
        let alluid = [];
        let dot = 0;
        let selfCard = room.bottomPourArea[seat].other.find(m => m.uid == this.uid);
        selfCard.status = 2;//所有过牌的玩家
        let isFinish = room.bottomPourArea[seat].other.find(m => m.status == 0);//有人没操作
        let getCardPlayer = room.bottomPourArea[seat].other.find(m => m.status == 1 || m.status == 3);//有人要牌
        let addMu = room.bottomPourArea[seat].other.find(m => m.status == 4);//有人加倍
        if (!isFinish) {//所有玩家完成操作，进入下一步操作
            if (getCardPlayer || addMu) {//有玩家要牌或加倍的玩家
                //拿到最后一张牌
                let isCard = room.bottomPourArea[seat].getCardArr[room.bottomPourArea[seat].getCardArr.length - 1];

                //找出要发牌的人
                room.bottomPourArea[seat].other.filter(m => m.status == 1 || m.status == 4 || m.status == 3).forEach(m => {
                    arrPlayer.push(m.uid);
                });
                room.bottomPourArea[seat].other.forEach(m => {
                    alluid.push(m.uid);
                });
                let arrs = this.buyPoker[seat].poker.slice();
                arrs.push(isCard);
                dot = room.calculateDot(arrs);
                room.noteDeal({seat, isCard, dot, player: arrPlayer, alluid: alluid});
                if (dot[0] >= 21 || addMu || !getCardPlayer) {
                    console.log('过牌，不分牌，没人要牌，有人加倍或牌21点');
                    room.nextTime(room, true);
                } else {
                    console.log('过牌，不分牌，有玩家要牌或加倍的玩家');
                    room.nextTime(room, false);
                }

            } else {
                console.log('过牌，不分牌，没人要牌');
                room.nextTime(room, true);
            }
        }
        isFinish = room.bottomPourArea[seat].other.find(m => m.status == 0);//有人没操作
        let ob = {};
        if(isFinish){
            ob['msg'] = '等待其它玩家操作';
        }
        return ob

    }


    //下注玩家数据包装
    betStrip(seat, bet) {
        console.log('下注', seat, bet);
        return {
            uid: this.uid,
            bet: bet,
            status: 0,
            getNum: 0
        }
    }

    //玩家下注
    bottomPour(room, seat, bet) {
        //判断玩家是否在自己的位置下注
        if (this.seat == seat) {
            room.bottomPourArea[seat].self = true;
        }

        //在对应区域记录下注玩家
        let isBet = room.bottomPourArea[seat].other.find(m => m.uid == this.uid);
        if (!isBet) {//在没有下注过的地方下注
            let betPlayer = this.betStrip(seat, bet);
            room.bottomPourArea[seat].other.push(betPlayer);
        } else {//在自己下注过的地方继续下注
            isBet.bet += bet;
        }

        //自己买的牌总下注
        this.buyPoker[seat].bet += bet;

        //该区域的所以玩家累计下注
        room.bottomPourArea[seat].bet += bet;

        //改变金币
        this.changeMoney(room, -bet, () => {
        });

        this.bet += bet;//玩家所有的累计下注

        room.isBet = true;//房间有人下注

        console.log('该区域下注玩家', seat, room.bottomPourArea[seat].other)
        room.channel.pushMessage('onBeting', {uid: this.uid, seat: seat, bet: bet});//通知其它玩家下注
    }

    //玩家买保险
    buyInsurance(room, isBuy, cb) {
        console.log('isBuyisBuy',isBuy,this.insuranceStatus,this.bet);
        if (isBuy) {
            this.insuranceStatus = 1;
            this.insuranceBet = this.bet / 2;
            this.changeMoney(room, -this.bet / 2, (money) => {
                return cb({currMoney: money, money: this.bet / 2});
            })
            this.bet += this.insuranceBet;
        } else {
            this.insuranceStatus = 2;
            this.insuranceBet = 0;
            this.changeMoney(room, 0, (money) => {
                return cb({currMoney: money, money: this.bet / 2});
            })
        }
        let isExitInsurPlayer = room.players.find(m => m && m.bet && m.insuranceStatus == 0);
        if (!isExitInsurPlayer) {//买保险所有玩家操作过了,直接结算
            clearTimeout(room.insurTimer);//关闭买保险定时器
            let zhaungPoker = room.players[0].currDot[0];
            if (zhaungPoker == 21) {//开局庄家21点结束游戏结算保险
                //结算保险结果
                room.channel.pushMessage('onSelect', {seat: 5, playerType: 3, zhuang: room.players[0]});//装亮牌

                room.settlementInsurance()//结算保险
            } else {//开局庄家非21点继续说话
                room.speak();
            }

        }


    }

    //改变金币
    changeMoney(room, bet, cb) {
        //玩家下注扣钱
        if (room.isvip) {//vip场
            HallService.changeIntegral(this.uid, bet, (integral) => {
                this.integral = integral;
                return cb(this.integral);
            });
        } else {//金币场
            HallService.changeGold(this.uid, bet, (gold) => {
                this.gold = gold;
                return cb(this.gold);
            });
        }
        //改变房间奖池
        room.addJackpot(bet);
    }

    //返回给前端的数据
    strip() {
        return {
            seat: this.seat,
            isPlay: this.isPlay,
            uid: this.uid,
            headurl: this.headurl,
            gold: this.gold,
            integral: this.integral,
            poker: this.poker,
            currDot: this.currDot,
            separatePoker: this.separatePoker,
            buyPoker: this.buyPoker,
            bet: this.bet,
            gain: this.gain,
            nickname: this.nickname,
            isSeparate: this.isSeparate,
            playerStatus: this.playerStatus,
            upStation: this.upStation,
            leaveStatus:this.leaveStatus
        }
    }

    //排行榜数据
    stripRanking() {
        return {
            uid: this.uid,
            headurl: this.headurl,
            nickname: this.nickname,
            upStation: this.upStation
        }
    }
}

//房间
class Room {
    constructor(opts) {
        this.nid = opts.nid;//游戏
        this.id = opts.id;//房间id
        this.channel = opts.channel;//房间频道
        this.isvip = opts.isvip || false;//房间类型
        this.vipRoomoWnerId = opts.vipRoomoWnerId || '';//vip房主uid
        this.players = [];// 玩家列表
        this.maxCount = opts.maxCount || 20;//房间最大玩家数
        this.playCount = opts.playCount || 5;//玩游戏的玩家
        this.roomStatus = 'NONE';//房间状态 INBET.下注阶段 DEAL.发牌 SPEAK.说话阶段
        this.countdown = BETCOUNTDOWN;//下注倒计时
        this.playerDown = CARDDOWN * 1000;//玩家过牌倒计时
        this.timer = '';//下注定时器
        this.setIntervalOnOff = '';//询问玩家要牌定时器
        this.dealTimer = '';//延迟发牌定时器
        this.lookCardTime = '';//延迟看牌定时器
        this.settlementTimer = '';//结算延迟定时器
        this.zhuangTimer = '';//庄要牌定时器
        this.insurTimer = '';//买保险倒计时定时器
        this.initP = GameUtil.getPai(5);//初始化5副牌
        this.bottomPourArea = [//五个下注区域 self自己是否下过注，other其他人下注集合
            {self: false, bet: 0, initPoker: [], initDot: [], other: [], getCardArr: [], separatePoker: []},
            {self: false, bet: 0, initPoker: [], initDot: [], other: [], getCardArr: [], separatePoker: []},
            {self: false, bet: 0, initPoker: [], initDot: [], other: [], getCardArr: [], separatePoker: []},
            {self: false, bet: 0, initPoker: [], initDot: [], other: [], getCardArr: [], separatePoker: []},
            {self: false, bet: 0, initPoker: [], initDot: [], other: [], getCardArr: [], separatePoker: []}
        ];//五个下注区域
        this.inning = 0;//玩家说话次数
        this.num = 0;//询问次数
        this.isBet = false;//这局是否下注过
        this.seatArr = [];//发牌的位置
        this.speakTime = 0;//玩家说话时间
        this.roomJackpot = '';//房间奖池数据
    }

    //初始化房间信息
    init() {
        console.log('初始化房间信息');
        this.roomStatus = 'NONE';
        this.isBet = false;
        this.seatArr = [];
        this.num = 0;
        this.countdown = BETCOUNTDOWN;//下注倒计时
        this.speakTime = 0;
        this.bottomPourArea = [
            {self: false, bet: 0, initPoker: [], initDot: [], other: [], getCardArr: [], separatePoker: []},
            {self: false, bet: 0, initPoker: [], initDot: [], other: [], getCardArr: [], separatePoker: []},
            {self: false, bet: 0, initPoker: [], initDot: [], other: [], getCardArr: [], separatePoker: []},
            {self: false, bet: 0, initPoker: [], initDot: [], other: [], getCardArr: [], separatePoker: []},
            {self: false, bet: 0, initPoker: [], initDot: [], other: [], getCardArr: [], separatePoker: []}
        ];
        //初始化玩家信息
        this.players.forEach(m => {
            if (m) {
                m.initGame();
            }

        });
        //关闭房间所有定时器
        this.closeAllTimer();
    }

    //关闭定时器
    closeAllTimer() {
        clearInterval(this.timer);
        clearInterval(this.dealTimer);
        clearInterval(this.setIntervalOnOff);
        clearInterval(this.lookCardTime);
        clearTimeout(this.settlementTimer);
        clearInterval(this.zhuangTimer);
        clearInterval(this.insurTimer);
    }

    //运行游戏
    run() {
        let isTextPlayer = this.kickPlayer();//踢掉离线的玩家
        console.log('isTextPlayerisTextPlayer', isTextPlayer);
        if (!isTextPlayer) {
            return;
        }
        this.retrievePlayerList();//检索玩家列表是否正常
        this.init();//初始化房间信息
        this.countdown = BETCOUNTDOWN;
        this.roomStatus = 'INBET';//运行游戏房间状态改为下注阶段
        this.lookerSitDown();//检查有无空位置
        this.timer = setInterval(() => {
            this.countdown--;
            console.log(this.countdown, '后发牌，21点', this.id);
            if (this.countdown == 0) {//倒计时结束，开始发牌
                clearInterval(this.timer);
                this.roomStatus = 'DEAL';
                this.deal()//发牌,延迟一下
            }
        }, 1000);
        return this.countdown;
    }

    //发牌
    deal() {
        console.log('发牌');

        if (!this.isBet) {
            //结束游戏开始下一局
            console.log('没有人下注，直接开始下一局');
            this.run();
            this.channel.pushMessage('onStart', {countDown: this.countdown, error: '没有人下注，直接开始下一局'});
            return;
        }

        let arr = [0,11];

        //庄家的牌
        for (let i = 0; i < 2; i++) {
            this.players[0].poker.push(this.getCard());
        }
        this.players[0].currDot = this.calculateDot(this.players[0].poker);


        this.bottomPourArea.forEach((m, j) => {
            if (m.bet) {//空位有人下注
                this.speakTime++;
                this.num++;
                this.seatArr.push(j);

                for (let i = 0; i < 2; i++) {//发两张牌
                    m.initPoker.push(this.getCard());//区域初始牌
                }
                m.initDot = this.calculateDot(m.initPoker);//发完牌计算点数

                if (this.players[j + 1]) {//这个区域有玩家
                    let isBet = m.other.find(n => n.uid == this.players[j + 1].uid);
                    if (isBet) {//玩家自己在这个区域下了注
                        this.players[j + 1].poker = m.initPoker.slice();//给玩家发牌
                        this.players[j + 1].currDot = m.initDot.slice();
                    }
                }

                //给玩家买的牌发牌
                m.other.forEach(n => {
                    let isBuyPlayer = this.players.find(a => a && n.uid == a.uid);
                    isBuyPlayer.buyPoker[j].poker = m.initPoker.slice();
                    isBuyPlayer.buyPoker[j].currDot = m.initDot.slice();
                });

            }
        });
        this.check();//服务器看牌

        //通知前端发牌
        this.channel.pushMessage('onDeal', {players: this.packagingPlayer(), bottomPourArea: this.bottomPourArea});//通知前端发牌
        console.log('发牌完成', this.num, this.seatArr,this.speakTime)

    }

    //查看庄家和玩家牌型
    check() {
        console.log('看牌');
        let isA = [0, 13, 26, 39];//牌A
        let blackjack = [];

        this.players.forEach(m => {
            if (m) {
                if (m.isPlay != 'ZHUANG') {//如果玩家起手21点播放blackjack特效
                    if (m.currDot[0] == 21) {
                        m.mulriple = 2.5;
                        if (!blackjack.includes(m.seat)) {
                            blackjack.push(m.seat);
                        }

                    }
                    console.log('玩家的牌', m.poker);
                    if (this.isPartCard(m.poker)) {//判断是否可以分牌
                        m.isSeparate = true;
                    }
                }
                //玩家买的牌
                m.buyPoker.forEach((n, j) => {
                    //有且只有一个人下注这副牌
                    if (n.bet && this.bottomPourArea[j].other.length == 1 && this.isPartCard(n.poker)) {
                        n.isSeparate = true;
                    }
                    if (this.bottomPourArea[j].initDot[0] == 21) {
                        n.mulriple = 2.5;
                        if (!blackjack.includes(j)) {
                            blackjack.push(j);
                        }
                    }
                });


            }
        });
        //玩家发话
        setTimeout(() => {
            //21点播放动画
            if (blackjack.length) {
                this.channel.pushMessage('onBlackjack', {seat: blackjack});
            }
            if (isA.includes(this.players[0].poker[0])) {//如果庄家第一张牌是A通知房间里面的所有玩家是否购买保险
                let arr = [];
                this.players.forEach(m => {
                    if (m && m.bet && m.isPlay != 'ZHUANG') {
                        let ob = {uid: m.uid, bet: m.bet,isPlay:m.isPlay};
                        arr.push(ob);
                    }
                });
                this.channel.pushMessage('onInsurance', {players: arr});//通知房间内所有玩家是否买保险
                this.insuranceTimer();//开启买保险倒计时
                return;
            }
            if (this.players[0].currDot[0] == 21) {//庄家起手21
                this.channel.pushMessage('onSelect', {seat: 5, playerType: 3, zhuang: this.players[0]});//装亮牌
                this.settlement();//直接结算
                return;
            }
            this.speak();
        }, this.speakTime * 1000);

    }

    //买保险倒计时
    insuranceTimer() {
        this.insurTimer = setTimeout(() => {
            let zhaungPoker = this.players[0].currDot[0];
            if (zhaungPoker == 21) {//倒计时结束开始下一局
                //结算保险结果
                this.settlementInsurance()//结算保险
            } else {//倒计时结束不是21点，下一家说话
                this.speak();
            }
        }, 10000);
    }

    //询问玩家发话
    speak() {
        this.roomStatus = 'SPEAK';

        //变换说话顺序
        let startRext = this.seatArr.findIndex(m => m == this.inning % 5);
        if (this.seatArr.length && startRext) {
            const last = [this.seatArr.pop()];
            this.seatArr = last.concat(this.seatArr);
        }

        this.inquiry(this.seatArr[this.seatArr.length - 1]);
        this.inning++;
        this.setTime(this);
    }

    //定时询问玩家要牌
    setTime(room) {
        if (!room.num) {//没有下一家说话直接return
            return;
        }
        room.setIntervalOnOff = setInterval(() => {
            room.num--;
            let temp = room.num - 1;
            room.inquiry(room.seatArr[temp]);
        }, room.playerDown);
    }

    //开局询问玩家选择
    inquiry(seat) {
        console.log('玩家说话++++++++++++++', seat,this.num)
        if(this.num<0){//说话异常 关闭定时器
            clearInterval(this.setIntervalOnOff);
            return;
        }
        let isUnder = this.allBet(seat);//判断上一家多人操作的牌玩家操作状态
        if (isUnder) return;

        if (seat == undefined) {//庄说话
            console.log('所有玩家说话完成，装说话，关闭定时器', this.num,this.id);
            clearInterval(this.setIntervalOnOff);
            this.zhuangGetCard();
            this.channel.pushMessage('onSelect', {seat: 5, playerType: 3, zhuang: this.players[0]});
            return;
        }

        if (this.bottomPourArea[seat].self) {//自己桌上的牌说话
            this.channel.pushMessage('onSelect', {
                playerType: 1,
                seat: seat,
                player: this.players[seat + 1],
                playerDown: this.playerDown / 100
            });
            if (this.bottomPourArea[seat].initDot[0] == 21) {//如果21点
                setTimeout(() => {
                    console.log('21点直接下一家说话自己的牌');
                    this.nextTime(this, true);//下一家说话
                }, 500);

            }
            return;
        }

        if (this.bottomPourArea[seat].self == false && this.bottomPourArea[seat].bet) {//自己买的牌说话
            let arr = [];
            let playerOther = this.bottomPourArea[seat].other.filter(m => m.status != 4 && m.status != 2);//过滤加倍和过牌的玩家

            playerOther.forEach((m, i, arrs) => {

                let player = this.players.find(n => n && n.uid == m.uid);
                if(player){
                    arr.push(player.strip());
                }else{
                    console.error('没有在玩家列表找到',m.uid);
                }

            });
            //给所以下注过这个位置的玩家推送
            this.channel.pushMessage('onSelect', {
                playerType: 2,
                seat: seat,
                players: arr,
                playerDown: this.playerDown / 100
            });

            if (this.bottomPourArea[seat].initDot[0] == 21) {//如果21点
                setTimeout(() => {
                    console.log('21点直接下一家说话，买的牌');
                    this.nextTime(this, true);//下一家说话
                }, 500);
            }
            return;
        }

    }

    //计算是否可以分牌
    isPartCard(arr) {
        if (arr.length == 2) {
            let arr1 = this.calculateDot([arr[0]])[0];
            let arr2 = this.calculateDot([arr[1]])[0];
            if (arr1 == arr2) {//玩家两张牌一样,可以分牌操作
                return true;
            }
        }
        return false;
    }

    // 是否满
    isFull() {
        return this.players.length >= this.maxCount;
    }

    // 添加一个玩家
    addPlayer(player) {
        let arr = [];
        this.players.forEach(m=>{
            if(m && m.isPlay != 'ZHUANG'){
                arr.push(m.nickname)
            }

        });
        console.log('所有在游戏里面的玩家',arr)
        let leavePlayer = this.players.find(m => m && m.uid == player.uid);
        if (leavePlayer) {//玩家还在这个房间
            console.log('掉线重连',leavePlayer.uid);
            leavePlayer.leaveStatus = false;
            this.channel.add(player.uid, player.sid);//重新添加消息通道
            //离线重连通知
            this.channel.pushMessage('onReconnection', {player: leavePlayer, roomStatus: this.roomStatus});
            return leavePlayer.seat;
        }

        console.log('----------');
        player['isPlay'] = 'LOOK';
        let isZhuang = this.players[0];
        if (!isZhuang) {//第一个玩家进入，激活庄家
            this.players[0] = new Player(0, {isPlay: 'ZHUANG'});
            this.getRoomData((error, data) => {
                if (error) {
                    console.error(error);
                }
                if (data) {
                    this.roomJackpot = data;//获取游戏奖池数据
                }
            });
        }

        //判断人数是否满了
        if (this.isFull()) {
            return -1;
        }

        if (this.players.length < (this.playCount + 1)) {
            player['isPlay'] = 'PLAY';
        }
        let i = this.players.length - 1;
        let nullIndex = this.players.findIndex(m => m == null);
        if (nullIndex >= 0) {//如果有空位置
            i = nullIndex;
            this.players[i] = new Player(i - 1, player);
        } else {
            this.players.push(new Player(i, player));
        }

        // 添加到消息通道
        if (player.sid) {
            this.channel.add(player.uid, player.sid);
        }
        return i;
    }

    // 是否有该玩家
    hasPlayer(uid) {
        return this.players.some(m => m && m.uid === uid);
    }

    // 有玩家离开
    leave(uid,isLeave) {
        const player = this.players.find(m => m && m.uid === uid);
        if(isLeave){//玩家强制退出游戏
            player.leaveStatus = true;//改变玩家离线状态
        }else{//正常退出游戏
            const idx = this.players.findIndex(m => m && m.uid === uid);
            if(idx != -1 && idx <= 5){//如果玩家是坐下的玩家
                this.players[idx] = null;
            }else{
                this.players.remove('uid', uid);
            }
        }

        //把玩家从消息通道删除
        const member = this.channel.getMember(uid);
        member && this.channel.leave(member.uid, member.sid);
        // 通知其他玩家有人退出
        this.channel.pushMessage('onExit', {player: player, players: this.players});

    }


    //计算点数最优点数
    calculateDot(dotArr) {
        let isA = [0, 13, 26, 39];
        let allDot = 0;//最优
        let worstDot = 0;//最差
        let temp = 0;
        dotArr.forEach(m => {
            if (isA.includes(m)) {//查看牌型中A有几张
                temp++;
            } else {
                let dot = m % 13;
                allDot += (dot > 9 ? 10 : dot + 1);
                worstDot += (dot > 9 ? 10 : dot + 1);
            }
        });

        //计算最优解
        if (temp) {//有A
            if (allDot < 21) {//除A以外的所有点数小于21点
                let surplusDot = 21 - allDot;
                let ADot = 0;
                let num = surplusDot % 11;
                if (surplusDot == 11) {
                    if (temp == 1) {
                        ADot += 11;
                    } else {
                        for (let i = 0; i < temp; i++) {
                            ADot += 1;
                        }
                    }
                } else if (surplusDot > 11) {
                    if (num >= temp) {
                        for (let i = 0; i < temp; i++) {
                            if (i == 0) {
                                ADot += 11;
                            } else {
                                ADot += 1;
                            }
                        }
                    } else {
                        for (let i = 0; i < temp; i++) {
                            ADot += 1;
                        }
                    }
                } else if (surplusDot < 11) {
                    for (let i = 0; i < temp; i++) {
                        ADot += 1;
                    }
                }
                allDot += ADot;

                //计算最差点数
                let Dotnew = 0;
                for (let i = 0; i < temp; i++) {
                    Dotnew += 1;
                }
                worstDot += Dotnew;

                if (allDot != worstDot) {
                    return [allDot, worstDot];
                }
                return [allDot];
            } else {//除A外的所有点数大于或等于21点爆牌
                let Dotnew = 0;
                for (let i = 0; i < temp; i++) {
                    Dotnew += 1;
                }
                allDot += Dotnew;
                return [allDot];
            }
        } else {//没有A
            return [allDot];
        }
    }

    //要牌，没牌时补牌
    getCard() {
        let card = this.initP.shift();
        if (this.initP.length == 0) {
            this.initP = GameUtil.getPai(5);//所有牌用完了，重新加载五副牌
        }
        return card;
    }

    // 获取玩家
    getPlayer(uid) {
        return this.players.find(m => m && m.uid === uid);
    }

    //包装玩家列表里面的数据发送给前端
    packagingPlayer() {
        let arr = [];
        this.players.forEach(m => {
            if (m) {
                if (m.isPlay != 'ZHUANG') {
                    arr.push(m.strip());
                } else {
                    arr.push(m);
                }
            }

        });
        return arr;
    }

    //包装排行榜数据
    packagingPlayerRanking() {
        let arr = [];
        this.players.forEach(m => {
            if (m) {
                if (m.isPlay != 'ZHUANG') {
                    arr.push(m.stripRanking());
                } else {
                    arr.push(m);
                }
            }

        });
        return arr;
    }

    //结算
    settlement() {
        console.log('结算');
        let playerAllProfit = this.playerAllProfit();
        let arrs = playerAllProfit.arrs;
        let allArr = playerAllProfit.allArr;

        let findZhuangIndex = arrs.findIndex(m => m.isZhuang == 'ZHUANG');

        arrs.forEach((m, i, arr) => {
            if (m.isZhuang == 'PLAY') {
                let winPlayer = allArr.find(n => n.uid == m.uid);
                let winSeat = winPlayer.allSeat.find(n => n.seat == m.seat);
                let winPlayerdata = this.players.find(n => n && n.uid == m.uid);
                console.log('玩家庄家点数', m.currDot, arr[findZhuangIndex].currDot);
                if (m.currDot > 21) {//玩家爆牌
                    winSeat.gain = -m.bet;
                } else {//玩家没爆
                    if (arr[findZhuangIndex].currDot > 21) {//庄爆牌的情况下
                        winSeat.gain = m.bet * m.mulriple;
                        winPlayerdata.bet *= m.mulriple;
                        winPlayerdata.winStatus = true;
                    } else {//庄没爆

                        if (m.currDot > arr[findZhuangIndex].currDot) {//点数比庄大
                            winSeat.gain = m.bet * m.mulriple;
                            winPlayerdata.bet *= m.mulriple;
                            winPlayerdata.winStatus = true;
                        } else if (m.currDot == arr[findZhuangIndex].currDot) {
                            winPlayerdata.winStatus = true;
                        } else {//点数比庄家小
                            winSeat.gain = -m.bet;

                        }

                    }
                }

            }

        });

        allArr.forEach(m => {
            m.allSeat.forEach(n => {
                if (n.gain > 0) {
                    m.allProfit += n.gain;
                    m.allGain += n.gain / 2;
                } else if (n.gain == 0) {
                    m.allProfit += n.bet;
                } else {
                    m.allGain += n.gain;
                }
            });
            if (this.isvip) {
                m.integral += m.allProfit;
            } else {
                m.gold += m.allProfit;
            }
        });

        //根据玩家的输赢状态结算金币或积分
        this.players.forEach(m => {
            if (m && m.isPlay != 'ZHUANG') {
                if (m.winStatus) {//玩家赢钱
                    let gains = allArr.find(n => n.uid == m.uid);//上局的输赢情况
                    m.upStation = gains.allGain;
                    m.gain = gains.allProfit;//玩家当局总收益
                    console.log('玩家离线状态',m.leaveStatus);
                    if(!m.leaveStatus) {//玩家在线
                        m.changeMoney(this, gains.allProfit, (money) => {
                        });//改变玩家金币
                    }
                }
                console.log('玩家离线状态',m.leaveStatus);
                if(m.leaveStatus) {//玩家离线
                    this.sendMail(m);
                }
            }
        });
        this.updateRecord();//添加实况记录
        //通知前端结算
        this.channel.pushMessage('onSettlement', {players: allArr, playerArr: this.packagingPlayerRanking()});

        this.settlementTimer = setTimeout(() => {
            this.run();
            this.channel.pushMessage('onStart', {countDown: this.countdown, msg: '结算奖励，开始下一局'});
        }, 3000)//4秒后重新开始游戏
    }

    //结算保险结果
    settlementInsurance() {
        this.players.forEach(m => {
            if (m && m.isPlay != 'ZHUANG' && m.insuranceStatus == 1) {
                m.gain = m.insuranceBet * 3;
                console.log('获得的保险',m.gain);
                if (this.isvip) {
                    m.integral += m.gain;
                } else {
                    m.gold += m.gain;
                }

                if(m.leaveStatus){//玩家离线
                    //发送邮件给离线玩家
                    this.sendMail(m);
                }else{
                    m.changeMoney(this, m.gain, () => {
                    });
                }

            }
        });

        this.updateRecord();//添加实况记录

        let settlementPlayer = this.players.filter(m => m && m.isPlay != 'ZHUANG' && m.bet);
        //通知前端结算
        this.channel.pushMessage('onSettlementInsurance', {
            players: settlementPlayer,
            playerArr: this.packagingPlayerRanking()
        });

        this.settlementTimer = setTimeout(() => {
            this.run();
            this.channel.pushMessage('onStart', {countDown: this.countdown, msg: '结算奖励，开始下一局'});
        }, 3000)//两秒后重新开始游戏
    }

    //最后一个玩家退出房间，关闭房间
    colseRoom() {
        //初始化房间数据
        this.init();
    }

    //庄要牌
    zhuangGetCard() {

        let zhuang = this.players[0];
        console.log('庄要牌');

        //判断玩家盈利是否击穿奖池
        let allP = this.playerAllProfit().arrs;
        let allBetNum = 0;
        allP.forEach(m => {
            if (m.currDot <= 21 && (m.currDot > zhuang.currDot[0] || zhuang.currDot[0]>21)) {//玩家没有爆牌且比庄家的牌大
                allBetNum += m.bet * m.mulriple;
            }
        });
        console.log('奖池状况',allBetNum,this.roomJackpot.jackpot,zhuang.currDot[0]);
        if(allBetNum>this.roomJackpot.jackpot && (zhuang.currDot[0] >= 17 || zhuang.currDot[0] <= 10) ){//如果所有玩家盈利大于奖池,重新给庄家一张牌
            do{
                zhuang.poker[1] = this.getCard();
                zhuang.currDot = this.calculateDot(zhuang.poker);
                if(zhuang.currDot[0]<=16 || zhuang.currDot[0]>=11){
                    break
                }
            }while (true);
        }
        //庄每一秒要一次牌
        this.zhuangTimer = setInterval(() => {
            if (zhuang.currDot[0] < 17) {
                let card;
                if(allBetNum>this.roomJackpot.jackpot){
                    let pokerNum = 21 - zhuang.currDot[0];//差的点数
                    card = this.createPoker([pokerNum - 1])[utils.random(0,3)];
                }else{
                    card = this.getCard();
                }
                zhuang.poker.push(card);
                zhuang.currDot = this.calculateDot(zhuang.poker);
                this.channel.pushMessage('onZhuang', {getCard: card, zhuang: zhuang});//通知玩家庄家要牌了
            } else {
                console.log('庄要牌完成');
                clearInterval(this.zhuangTimer);
                this.settlement();//结算游戏


            }
        }, 1000);

    }

    //下一家发话
    nextTime(room, isNext) {
        clearInterval(room.setIntervalOnOff);//关闭询问玩家要牌定时器直接下一家
        if (isNext) room.num--;
        room.inquiry(room.seatArr[room.num - 1]);
        room.setTime(room);//开启下一轮定时器
    }

    //多人下注的牌
    allBet(seat) {
        let temp = false;
        if (seat == undefined) {
            seat = this.seatArr[0];//轮到庄说话 庄的前一个位置
        } else {
            seat = this.seatArr[this.num];
        }

        if (this.num < this.seatArr.length && this.bottomPourArea[seat].other.length >= 2) {//超过两家以上的人下注了这副牌

            let getCard = this.bottomPourArea[this.seatArr[this.num]].other.find(m => m.status == 1 || m.status == 3 || m.status == 4);//有人要牌爆牌或加倍
            let getCard2 = this.bottomPourArea[this.seatArr[this.num]].other.find(m => m.status == 1);//有人要牌
            let isNoOperation = this.bottomPourArea[this.seatArr[this.num]].other.find(m => m.status == 0);//有人没操作
            if (isNoOperation && getCard) {
                if (isNoOperation) {//有人没操作设置为过牌状态
                    console.log('这副牌有人没有操作', this.bottomPourArea[this.seatArr[this.num]].other);
                    this.bottomPourArea[this.seatArr[this.num]].other.forEach(m => {
                        if (m.status == 0) m.status = 2;
                    });
                    console.log('这副牌有人没有操作2', this.bottomPourArea[this.seatArr[this.num]].other);
                }
                let isCard = this.bottomPourArea[seat].getCardArr[this.bottomPourArea[seat].getCardArr.length - 1];
                let arrs = this.bottomPourArea[seat].initPoker;
                let dot;
                arrs.concat(isCard);
                dot = this.calculateDot(arrs);
                let arrPlayer = [];
                let alluid = [];

                //找出要发牌的人
                this.bottomPourArea[seat].other.filter(m => m.status == 1 || m.status == 4 || m.status == 3).forEach(m => {
                    arrPlayer.push(m.uid);
                });
                this.bottomPourArea[seat].other.forEach(m => {
                    alluid.push(m.uid);
                });
                this.noteDeal({seat: this.seatArr[this.num], isCard, dot, player: arrPlayer, alluid: alluid});
                if (getCard2) {//有人要牌继续发牌
                    this.num++;
                    this.bottomPourArea[seat].other.forEach(m => {
                        if (m.status == 1) m.status = 0;
                    });
                    console.log('多人下注的牌，说话前判断上一副多人操作的牌的状态');
                    this.nextTime(this, false);
                    temp = true;
                }
            }
        }
        return temp;
    }

    //通知前端发牌
    noteDeal({seat, isCard, dot, player, isPart, alluid}) {
        this.channel.pushMessage('onGetcard', {
            seat: seat,
            getCardUser: isCard,
            dot: dot,
            players: player,
            isPart,
            alluid
        });
    }

    //踢掉离线的玩家
    kickPlayer() {
        let temp = false;
        this.players.forEach((m, i, arr) => {
            if (m && m.leaveStatus === true) {//离线的玩家
                if (i <= 5) {//坐下的玩家
                    arr[i] = null;
                } else {//观看的玩家
                    arr.splice(i, 1);
                }
                temp = true;


            }
        });

        //判断继续玩游戏的玩家个数
        let exitPlayer = this.players.find(m => m && m.isPlay != 'ZHUANG');
        if (this.players.length <= 6 && !exitPlayer) {
            this.colseRoom();
            console.log('最后一个玩家退出21，关闭房间');
            return false;
        }

        //通知前端有人离线
        if(temp)this.channel.pushMessage('onOffline',{players:this.players})
        return true;
    }

    //观看的玩家坐下
    lookerSitDown() {
        let isNullIndex = this.players.findIndex(m => m == null);
        if (isNullIndex >= 0 && isNullIndex <= 5) {//有空位置
            let lookPlayer = this.players.filter(m => m && m.isPlay == 'LOOK');//筛选出观看的玩家

            //根据进入房间时间排序
            lookPlayer.sort((a, b) => {
                return a.enterIntoTime - b.enterIntoTime;
            });

            for (let i = 0; i < 5; i++) {
                if (this.players[i] == null) {//有玩家离开有空位
                    if (lookPlayer.length) {
                        this.players.remove('uid',lookPlayer.uid);
                        this.players[i] = lookPlayer.shift();
                        this.players[i].isPlay = 'PLAY';
                        this.players[i].seat = i - 1;
                        this.channel.pushMessage('onEnteryDot', {
                            player: this.players[i].strip(),
                            players: this.packagingPlayer()
                        });
                    }
                }
            }
        }
    }

    //包装房间数据
    roomStrip() {
        return {
            roomStatus: this.roomStatus,
            bottomPourArea: this.bottomPourArea,
            zhuangPoker: {poker: this.players[0].poker, currDot: this.players[0].currDot}
        }
    }

    //积分金币转换
    goldToIntegral(isvip, player) {
        if (isvip) {
            return player.integral;
        } else {
            return player.gold;
        }
    }

    //玩家盈利
    playerAllProfit() {
        let arrs = [];//所有牌型
        let allArr = [];//所有玩家
        this.players.forEach((m, j) => {
            if (m) {
                if (m.isPlay == 'ZHUANG') {//庄
                    arrs.push({currDot: m.currDot[0], isZhuang: m.isPlay, bet: 0, uid: m.uid});
                } else if (m.bet) {//玩家
                    // console.log('___________',m);
                    let ob = {};
                    ob['uid'] = m.uid;
                    ob['allSeat'] = [];
                    ob['gold'] = m.gold;
                    ob['integral'] = m.integral;
                    ob['allGain'] = 0;
                    ob['allProfit'] = 0;

                    if (m.separatePoker.length) {//玩家的牌有分牌
                        m.separatePoker.forEach(n => {
                            ob.allSeat.push({seat: m.seat, gain: 0, bet: n.bet});
                            arrs.push({
                                currDot: n.dot[0],
                                isZhuang: m.isPlay,
                                bet: n.bet,
                                uid: m.uid,
                                mulriple: m.mulriple,
                                seat: m.seat
                            });

                        });
                    }

                    m.buyPoker.forEach((n, i) => {//玩家下注的牌，包括自己位置上的下注
                        // console.log('nnnnnnnnnnnnn',n);
                        if (n.bet) {
                            if (i == m.seat) {//玩家自己的牌
                                ob.allSeat.push({seat: i, gain: 0, bet: n.bet});
                                arrs.push({
                                    currDot: m.currDot[0],
                                    isZhuang: m.isPlay,
                                    bet: n.bet,
                                    uid: m.uid,
                                    mulriple: m.mulriple,
                                    seat: i
                                });
                            } else {//玩家下注的牌
                                if (n.separatePoker.length) {//下注的牌有分牌
                                    n.separatePoker.forEach(a => {
                                        ob.allSeat.push({seat: i, gain: 0, bet: a.bet});
                                        arrs.push({
                                            currDot: a.dot[0],
                                            isZhuang: m.isPlay,
                                            bet: a.bet,
                                            uid: m.uid,
                                            mulriple: n.mulriple,
                                            seat: i
                                        });
                                    });
                                } else {//下注的牌没分牌
                                    ob.allSeat.push({seat: i, gain: 0, bet: n.bet});
                                    arrs.push({
                                        currDot: n.currDot[0],
                                        isZhuang: m.isPlay,
                                        bet: n.bet,
                                        uid: m.uid,
                                        mulriple: n.mulriple,
                                        seat: i
                                    });

                                }
                            }

                        }
                    });
                    allArr.push(ob);
                }
            }
        });
        return {arrs, allArr}
    }

    //改变奖池
    addJackpot(money) {
        console.log('改变奖池',money,this.roomJackpot.jackpot);
        this.roomJackpot.jackpot += -money;
        //跟新游戏房间
        pomelo.app.rpc.hall.gameRemote.niuniuUpdateGameRoom(null,
            {
                nid: this.nid,
                roomCode: this.id,
                isVip: this.isvip,
                uid: this.vipRoomoWnerId
            },
            {
                jackpot: this.roomJackpot.jackpot,
                consumeTotal: this.roomJackpot.consumeTotal,
                winTotal: this.roomJackpot.winTotal,
                boomNum: this.roomJackpot.boomNum,
                runningPool: this.roomJackpot.runningPool,
                profitPool: this.roomJackpot.profitPool
            }, function () {
            });
        return false;
    }

    //获取房间数据
    getRoomData(cb) {
        pomelo.app.rpc.hall.gameRemote.getGameFromHallniuniu(null, {
            nid: this.nid,
            isVip: this.isvip,
            uid: this.vipRoomoWnerId
        }, (err, data) => {
            if (!data) {
                return cb('获取游戏信息失败21Dot');
            }
            const room = data.rooms.find(room => room.roomCode == this.id);//根据房间号找到房间
            return cb(null, room);
        })
    }

    //根据余数生成所有指定的牌
    createPoker(Number){
        let pokerArr = [];
        Number.forEach(m=>{
            for(let i=0; i<4; i++){
                pokerArr.push(13*i + m);
            }
        });
        return pokerArr;
    }

    //发送邮件给离线玩家
    sendMail(player){
        HallService.changeGoldsByMail4({name: '21点'}, player);
    }

    //检索玩家列表是否异常
    retrievePlayerList(){

        let arr = [];
        let arrUid = [];
        this.players.forEach(m=>{
            if(m && m.uid) arr.push(m.uid);
        });
        console.log('检索玩家列表',arr);
        arr.forEach(m=>{
            if(!arrUid.includes(m)){
                arrUid.push(m);
            }else{
                console.log('21点玩家列表出现重复玩家',m);
                this.players.forEach((n,i,arr)=>{
                    //删除位置错误的玩家
                    if(m == n.uid && n.seat != i-1){
                        if(i<=5){//如果是坐下的玩家
                            arr[i] = null;
                        }else{//如果是观看的玩家
                            arr.splice(i,1);
                        }
                    }
                });
            }
        });

    }

    //更新实况记录
    updateRecord(){
        this.players.forEach(m=>{
            const moneyType = this.isvip ? 'integral' : 'gold';
            if(m && m.uid) DotMgr.addGoldRecordDotMgr({isVip:this.isvip,totalBet:m.bet,totalWin:m.gain,player:m,moneyType:moneyType});//添加实况记录
        });

    }
}
module.exports = Room;