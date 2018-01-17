'use strict';

const MessageService = require('../../../services/MessageService');
const HallService = require('../../../services/HallService');
// const JackpotMgr = require('../JackpotMgr');
const utils = require('../../../utils');
const GameUtil = require('../../../utils/GameUtil');
const pomelo = require('pomelo');
const config = require('./config');
const db = require('../../../utils/db/mongodb');
// 一个玩家
class Player {
    constructor (opts) {
        this.uid = opts.uid;
        this.headurl = opts.headurl;
        this.nickname = opts.nickname;
        this.sex = opts.sex;
        this.gold = opts.gold;
        this.integral = opts.integral;
        this.isRobot = !opts.sid;// 是否机器人

        this.cards = null;// 牌列表
        this.betNum = 0;// 押注
        this.handNum = 0;// 几手

        this.process = [];// 过程列表
        this.sumGain = 0;// 当前总收益

        this.atryFlodHeaps = null;// 搏一搏弃牌堆
        this.canGuessCount = 0;// 搏一搏可猜次数
        this.mrr = opts.mrr || 0;
        this.bet = 0;//玩家投注
        this.profit = 0;//玩家盈利
    }

    // 准备游戏
    ready(betNum, handNum, roomJackpot,room) {
        this.betNum = betNum;
        this.handNum = handNum;
        const jackpot = Math.max(roomJackpot.jackpot, 0);
        room.initPoker();//初始化牌


        console.log('att',this);
        // 再发5张
        do {
            if(this.mrr<0.6){
                console.log('SuitPatternsSuitPatterns');
                let randm = utils.random(1,100);
                if(randm<=8){
                    let poker = utils.sortProbability(Math.random(),config.SuitPatterns).name;
                    console.log('SuitPatternsSuitPatterns',poker);

                    switch (poker){
                        case 'AA':
                            this.cards = room.SuitPatterns1(1);
                            break;
                        case 'AABB':
                            this.cards = room.SuitPatterns1(2);
                            break;
                        case 'AAA':
                            this.cards = room.SuitPatterns3();
                            break;
                        case 'AB(E)CD':
                            this.cards = room.SuitPatterns4();
                            break;
                        case '(A)BCDE(F)':
                            this.cards = room.SuitPatterns5();
                            break;
                        case '(A)BCD(E)':
                            this.cards = room.SuitPatterns6();
                            break;
                        case '&&&&':
                            this.cards = room.SuitPatterns8(1);
                            break;
                        case '&&&':
                            this.cards = room.SuitPatterns8(2);
                            break;
                        case 'ABCD':
                            this.cards = room.SuitPatterns9(1);
                            break;
                        case 'ABC':
                            this.cards = room.SuitPatterns9(2);
                            break;
                    }

                }else{
                    this.cards = utils.randomIndex(52, 5);
                }
            }else{
                this.cards = utils.randomIndex(52, 5);
            }
            console.log('this.cardsthis.cards',this.cards);
            // this.cards = [1,2,3,4,5];
            // 算出起手牌的盈利
            const ret = GameUtil.getResultByAtt(this.cards);
            const gain = betNum * handNum * (ret ? ret.mul : 0);
            // 调控
            if (jackpot - gain >= 0) {
                break;
            }
            console.log('while8');
        } while (true);

    }

    // 是否准备好了
    isReady () {
        return this.handNum !== 0 && this.cards !== null;
    }

    initGame () {
        this.sumGain = 0;
        this.process.length = 0;
        this.cards = null;// 牌列表
        this.betNum = 0;// 押注
        this.handNum = 0;// 几手
        this.atryFlodHeaps = null;// 搏一搏弃牌堆
        this.canGuessCount = 0;
    }

    // 准备搏一搏
    readyAtry () {
        this.canGuessCount = 5;
        this.atryFlodHeaps = utils.randomIndex(52, 5);
    }

    //跟新游戏返奖率
    updateSlipper(uid,bet,profit){

        if(bet){
            this.bet += bet;
        }
        if(profit){
            this.profit += profit;
        }
        this.mrr = this.profit/this.bet;


    }

    //玩家离开ATT保存返奖率到数据库
    onLeaveeupdateSlipper(){

        let Att_data = db.getDao('ATT_data');
        let ob = {}
        if(this.bet){
            ob['bet'] = this.bet;
        }
        if(this.profit){
            ob['profit'] = this.profit;
        }
        console.log('保存ATT返奖率到数据库',ob);
        Att_data.update({uid:this.uid},{$set:ob},(error,data)=>{},false,true);
    }
}

/**
 * ATT - 游戏房间
 */
class Room {

    constructor (opts) {
        this.nid = opts.nid;//游戏id
        this.id = opts.id;
        this.maxCount = opts.maxCount || 50;// 最大人数
        this.channel = opts.channel;
        this.entryCond = opts.entryCond || 0;// 进入条件

        this.players = [];// 玩家列表

        this.bigwins = [];// 最大赢钱
        this.vipRoomoWnerId = opts.vipRoomoWnerId;//房主uid
        this.isvip = opts.isvip;
        this.initP = [];//初始化5副牌
        this.initArr = [0,1,2,3];//牌的花色数组
    }

    //初始化牌
    initPoker(){
        this.initP = GameUtil.getPai(1);
        this.initArr = [0,1,2,3];//牌的花色数组
        this.initP.forEach((m,i,arr)=>{
            let ob = {};
            ob['dot'] = m;
            ob['color'] = Math.floor(m/13);
            arr[i] = ob;
        });
    }


    // 是否满
    isFull () {
        return this.players.length >= this.maxCount;
    }

    // 添加一个玩家
    addPlayer (player,cb) {
        let Att_data = db.getDao('ATT_data');
        let slipper = 0;
        Att_data.find({uid:player.uid}, (error,data) =>{
            console.log('--------',error,data);
            if(error){
                return cb('ATT_data查询失败');
            }
            if(!data.length){
                Att_data.create({game:'ATT',bet:0,profit:0,uid:player.uid},(error,data)=>{
                    console.log('444444444',error,data);
                });
                slipper = 0;
            }else{
                slipper = data[0].profit/data[0].bet;
            }
            if(this.isFull())
                return -1;
            const i = this.players.length;
            let players = new Player(player);
            players['bet'] = data.length ? data[0].bet:0;
            players['profit'] = data.length ? data[0].profit:0;
            players['mrr'] = slipper;
            console.log('slipperslipper',slipper);
            this.players.push(players);
            // 添加到消息通道
            if(player.sid){
                this.channel.add(player.uid, player.sid);
            }
            console.log('--------',i);
            return cb(null,i);
        });

    }

    // 获取玩家
    getPlayer (uid) {
        return this.players.find(m => m && m.uid === uid);
    }

    // 删除玩家
    removePlayer (uid,room) {
        const player = this.players.remove('uid', uid);
        if(!player) {
            return false;
        }
        // 如果有押注强行退出游戏 那么给他发放邮件
        if(player.isReady() && !player.isRobot) {
            // 如果还没有执行过游戏 那么默认全部不保留 帮他执行
            if (player.process.length !== player.handNum) {
                this.exec(player, [],room);
            }
            if (player.sumGain > 0) {
                this.addByAtt(-player.sumGain,room);
                HallService.changeGoldsByMail3({name:'ATT连环炮'}, {uid: player.uid, sumBet: player.betNum*player.handNum, gain: player.sumGain});

            }
        }
        // 从通道中踢出
        const member = this.channel.getMember(uid);
        member && this.channel.leave(member.uid, member.sid);
        return true;
    }

    // 有玩家离开
    leave (uid,room) {
        this.removePlayer(uid,room);
    }

    // 是否有该玩家
    hasPlayer (uid) {
        return this.players.some(m => m && m.uid === uid);
    }

    // 添加最大赢钱
    addBigwin (player, gain) {
        if(gain < 5000)
            return;
        this.bigwins.push({nickname: encodeURI(player.nickname), winNum: gain});
    }

    bupai (count, ignore) {
        if (count === 1) {
            return [utils.randomIndex(52, count, ignore)];
        }
        return utils.randomIndex(52, count, ignore);
    }

    // 执行游戏
    exec (player, retains,room) {
        const count = player.handNum;
        // 补牌列表, 结果
        let bupais = null, result = null;
        if(room.jackpot<0){
            console.error('奖池为负数了');
        }
        const jackpot = Math.max(room.jackpot, 0);
        do {
            console.log('55555555555retains.length',retains.length,'player.cards.length',player.cards.length)
            player.sumGain = 0;
            player.process.length = 0;
            // 全部保留的话 直接结算
            if (retains.length === player.cards.length) {
                const ret = GameUtil.getResultByAtt(player.cards);
                if (ret) {
                    result = {bupais: [], id: ret.id, gain: player.betNum*ret.mul};
                } else {
                    result = {bupais: [], id: -1, gain: 0};
                }
                player.process.push(result);
                player.sumGain = result.gain*count;
                console.log('result.gain*count',result.gain*count);
                break;
            } else {
                // 先删除没有保留的
                const cards = player.cards.filter((m, i) => retains.indexOf(i) !== -1);
                // 需要补牌个数
                const bupaiCount = player.cards.length - retains.length;
                for (let i = 0; i < count; i++) {
                    bupais = this.bupai(bupaiCount, cards);
                    const ret = GameUtil.getResultByAtt(cards.concat(bupais));
                    if (ret) {
                        result = {bupais: bupais, id: ret.id, gain: player.betNum*ret.mul};
                    } else {
                        result = {bupais: bupais, id: -1, gain: 0};
                    }
                    player.process.push(result);
                    player.sumGain += result.gain;
                    console.log('result.gain',result.gain);
                }
            }
            console.log('游戏奖池',room.jackpot,player.sumGain)
            if (jackpot - player.sumGain >= 0) {
                break;
            }
            console.log('while9');
        } while (true);

        this.addBigwin(player, player.sumGain);
        return {retains: retains, process: player.process.slice(), sumGain: player.sumGain};
    }

    strip () {
        return {
            id: this.id
        };
    }
    //向奖池加钱
    addByAtt(num,room){
        console.log('向奖池加钱',room.jackpot,num)
        room.jackpot += num*0.97;
        room.profitPool += num*0.03;
        pomelo.app.rpc.hall.gameRemote.niuniuUpdateGameRoom(null, {nid:this.nid, roomCode:this.id,isVip:this.isvip,uid:this.vipRoomoWnerId}, {jackpot: room.jackpot, consumeTotal: room.consumeTotal, winTotal: room.winTotal, boomNum: room.boomNum, runningPool: room.runningPool, profitPool: room.profitPool},function(){});

    }

    //玩家下注扣v点
    deductVipDot(model,totalBet){
        console.log('玩家下注扣v点ATT',model,totalBet,this.vipRoomoWnerId,this.nid,this.isvip);
        pomelo.app.rpc.hall.gameRemote.getGameFromHallniuniu(null,{nid:this.nid,isVip:this.isvip,uid:this.vipRoomoWnerId},(err,data) => {
            if(!data){
                console.error('获取游戏信息失败getGameFromHallniuniu',data)
                return;
            }
            if(this.isvip && model == 'common'){
                const reduceNum = -(data.removalTime + data.pumpingRate * totalBet);
                console.log(reduceNum);
                pomelo.app.rpc.hall.playerRemote.updateUserEffectTime(null,this.vipRoomoWnerId, {num: reduceNum}, function(){});
            }
        });

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

    //生成对子(一对)
    SuitPatterns1(number){
        let arr = [];
        for(let i=0; i<number; i++){
            let card = this.initP.shift().dot;//抽一张牌
            this.initArr.splice(Math.floor(card/13),1);
            let randNum = this.initArr[utils.random(0,2-i)];//在随机一张花色中抽一张一样的
            console.log('&&&&&&&',card,this.initArr);
            let temp = this.initP.find(m=>m.color == randNum && m.dot%13 == card%13).dot;
            arr.push(card,temp);//对子
            let deleteIndex =  this.initP.findIndex(m=>m.dot == arr[1]);
            this.initP.splice(deleteIndex,1);//删除指定位置的数组

        }
        //再要三张牌
        let num = number == 2?1:3;
        for(let i=0; i< num; i++){
            arr.push(this.initP.shift().dot);
        }
        arr = utils.disorganizeArr(arr);//打乱数组顺序
        return arr;
    }

    //生成3缺二
    SuitPatterns3(){
        let card = this.initP.shift().dot;//抽一张牌
        let arr = [card];
        for(let i=0; i<2; i++){
            if(i == 0){
                this.initArr.splice(Math.floor(card/13),1);
            }else{
                this.initArr.splice(Math.floor(arr[1]/13),1);
            }
            let randNum = this.initArr[utils.random(0,2-i)];//在随机一张花色中抽一张一样的
            console.log('&&&&&&&',card,this.initArr);
            let temp = this.initP.find(m=>m.color == randNum && m.dot%13 == card%13).dot;
            arr.push(temp);//对子
            let deleteIndex =  this.initP.findIndex(m=>m.dot == arr[1]);
            this.initP.splice(deleteIndex,1);//删除指定位置的数组
        }
        //补两张牌
        for(let i=0; i<2; i++){
            arr.push(this.initP.shift().dot);
        }
        arr = utils.disorganizeArr(arr);//打乱数组顺序
        return arr;
    }

    //生成4顺子中缺一
    SuitPatterns4(){
        let card = this.initP.shift().dot;//先随机要一张牌
        let num = 12 - card%13;
        let arr = [card];
        for(let i=0; i<4; i++){
            let tempPoker = this.createPoker([card%13 + (num>=4 ? (i+1) : -(i+1))])[utils.random(0,3)];
            let deleteIndex = this.initP.findIndex(m=>m.dot == tempPoker);
            this.initP.splice(deleteIndex,1);
            arr.push(tempPoker);//随机一个花色的点数
        }
        arr.splice(2,1,this.initP.shift().dot);//在替换一张牌
        return arr;
    }

    //生成4顺子缺两头任意一头
    SuitPatterns5(){
        let card = this.initP.shift().dot;//先随机要一张牌
        let num = 12 - card%13;
        let arr = [card];
        for(let i=0; i<4; i++){
            let tempPoker = this.createPoker([card%13 + (num>=4 ? (i+1) : -(i+1))])[utils.random(0,3)];
            let deleteIndex = this.initP.findIndex(m=>m.dot == tempPoker);
            this.initP.splice(deleteIndex,1);
            arr.push(tempPoker);//随机一个花色的点数
        }
        let random = utils.random(0,1);
        arr.splice(random==0?0:4,1,this.initP.shift().dot);
        return arr;
    }

    //生成3顺子缺两头
    SuitPatterns6(){
        let card = this.initP.shift().dot;//先随机要一张牌
        let num = 12 - card%13;
        let arr = [card];
        for(let i=0; i<4; i++){
            let tempPoker = this.createPoker([card%13 + (num>=4 ? (i+1) : -(i+1))])[utils.random(0,3)];
            let deleteIndex = this.initP.findIndex(m=>m.dot == tempPoker);
            this.initP.splice(deleteIndex,1);
            arr.push(tempPoker);//随机一个花色的点数
        }
        arr.splice(0,1,this.initP.shift().dot);
        arr.splice(4,1,this.initP.shift().dot);
        return arr;
    }


    //生成同花缺两色
    SuitPatterns8(number){
        let card = this.initP.shift();//先随机要一张牌
        let arr = [card.dot];
        //补两张张一样花色的牌
        for(let i=0; i<4-number; i++){
            let tempPoker = this.initP.find(m=>m.color == card.color).dot;
            let deleteIndex = this.initP.findIndex(m=>m.dot == tempPoker);
            this.initP.splice(deleteIndex,1);
            arr.push(tempPoker);
        }

        //在补两张其它牌
        for(let i=0; i<number; i++){
            arr.push(this.initP.shift().dot);
        }
        arr = utils.disorganizeArr(arr);//打乱数组顺序
        return arr;
    }

    //生成同花顺缺一
    SuitPatterns9(number){
        let card = this.initP.shift();//先随机要一张牌
        let arr = [card.dot];
        let num = 12 - card.dot%13;
        for(let i=0; i<4-number; i++){
            let tempPoker = this.createPoker([card.dot%13 + (num>=4 ? (i+1) : -(i+1))])[card.color] ;
            let deleteIndex = this.initP.findIndex(m=>m.dot == tempPoker);
            this.initP.splice(deleteIndex,1);
            arr.push(tempPoker);
        }
        for (let i=0;i<number; i++){
            arr.push(this.initP.shift().dot);
        }
        arr = utils.disorganizeArr(arr);//打乱数组顺序
        return arr;
    }

}

module.exports = Room;