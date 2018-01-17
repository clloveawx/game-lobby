'use strict';
const config = require('./config');
const pomelo = require('pomelo');
const memory = require('./memory');
const releaseAwards = require('./memory').releaseAward;
const util = require('../../../utils');
const mailService = require('../../../services/MailService');

/**
 * Created by 14060 on 2017/10/12.
 */
const sendMail = function (opts, uid, littleGame = false) {
    const moneyType = opts.isVip ? "积分" : "金币";
    mailService.generatorMail({
        name: '游戏中断',
        content: littleGame ? '由于断线/退出游戏, 您在'+opts.name+'中的盈利已自动结算' + '\n赢得'+opts.win+`${moneyType}。`
            : '由于断线/退出游戏, 您在'+opts.name+'游戏中押注'+opts.bet+ `${moneyType}已自动结算` + '\n赢得'+opts.win+`${moneyType}。`
    }, uid, function(err, mailDocs){});
}

//获得连线元素
module.exports.getElement = function ({isVip,mult,freespin,uid,nid,roomCode},session,cb) {
    produceDlement({isVip,freespin,uid,nid,roomCode,mult},session,(data)=>{//产生元素
        let wire = isWire(data,mult);//检索连线,计算倍数
        let goldNum = recordGold(data);
        return cb({element:data,wire:wire.wire,allMultiple:wire.allMultiple,goldNum:goldNum});
    });
}

//获得宝箱元素
module.exports.getBoxElement = function (nid,isVip,uid) {
    let boxM = createBoxElement();
    return boxM;
}

//向房间奖池加钱
module.exports.roomJackpotAdd = function ({nid,isVip,roomCode,uid,pirateBet},session,cb) {
    pomelo.app.rpc.hall.gameRemote.getGameFromHall(null, {nid: nid, viper:isVip,uid:uid}, function(err, game) {
        if(!game){
            console.error('获取游戏信息失败',game)
            return;
        }
        const room = game.rooms.find(room => room.roomCode == roomCode);
        room.jackpot += pirateBet * config.jackpotMoney.jackpotOdds;
        room.runningPool += pirateBet * 0.8;
        room.profitPool += pirateBet * 0.03;
        room.consumeTotal += pirateBet;
        pomelo.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid}, {jackpot: room.jackpot, consumeTotal: room.consumeTotal, winTotal: room.winTotal, boomNum: room.boomNum, runningPool: room.runningPool, profitPool: room.profitPool},function(){
            return cb(null);
        });

    });
}

//从房间奖池扣钱
module.exports.roomJackpotSubtract = function ({nid,isVip,roomCode,uid,pirateProfit,isType},session) {
    pomelo.app.rpc.hall.gameRemote.getGameFromHall(null, {nid: nid, viper:isVip,uid:uid}, function(err, game) {
        if(!game){
            console.error('获取游戏信息失败',game)
            return;
        }
        const room = game.rooms.find(room => room.roomCode == roomCode);
        if(isType == 'basics'){//jackpot走基础奖池
            room.jackpot -= pirateProfit;
            //如果放奖调控处于放奖状态，从放奖调控里扣钱
            if(room.releaseAward.status){
                if(room.releaseAward.award_quantity >= pirateProfit){
                    room.releaseAward.award_quantity -= pirateProfit;
                }else{
                    room.releaseAward.award_quantity = 0;
                }
            }
        }else if(isType == 'all'){
            room.jackpot -= pirateProfit.basicsMu;//元素8地图连线走基础奖池
            room.runningPool -= pirateProfit.allMu;//其余联线走流通池
            //如果放奖调控处于放奖状态，从放奖调控里扣钱
            if(room.releaseAward.status){
                if(room.releaseAward.award_quantity >= (pirateProfit.basicsMu+pirateProfit.allMu)){
                    room.releaseAward.award_quantity -= (pirateProfit.basicsMu+pirateProfit.allMu);
                }else{
                    room.releaseAward.award_quantity = 0;
                }
            }
        }else if(isType == 'gold'){
            room.runningPool -= pirateProfit;//其余联线走流通池
        }
        // console.log('改变前的状态',room);
        let ob = {
            jackpot: room.jackpot,
            consumeTotal: room.consumeTotal,
            winTotal: room.winTotal,
            boomNum: room.boomNum,
            runningPool: room.runningPool,
            profitPool: room.profitPool,

        };
        console.log('room.roomCode',room.roomCode,'room.releaseAward.status:',room.releaseAward.status,'room.releaseAward.award_quantity:',room.releaseAward.award_quantity);
        if(room.releaseAward.status == 1 && room.releaseAward.award_quantity<=0){//如果放奖量被放完，再次开启奖池监控
            room.releaseAward = new releaseAwards({nid:room.nid,roomCode:room.roomCode});
            room.releaseAward.minuteTime(room,isVip,uid);
            console.log('开启监控',room.roomCode,isVip,uid);
            ob['releaseAward'] = room.releaseAward;
        }else{
            ob['releaseAward.award_quantity'] = room.releaseAward.award_quantity;
        }
        pomelo.app.rpc.hall.gameRemote.updateGameRoom(session, {nid, roomCode, isVip, uid},ob,function(){
        });

    });
}

//对于金币场,添加游戏记录
//totalBet.押注金额，totalWin.总盈利，multiple.连线总赔率,moneyType.货币类型
module.exports.addGoldRecord = function ({isAdd,settlement,freespin,isVip,totalBet,totalWin,multiple,player,uid,moneyType},session) {

    if(!isVip){
        const gameRecordModel = require('../../../../app/utils/db/mongodb').getDao('game_record');
        switch (isAdd){
            case 'add'://添加游戏记录
                util.queryRecently(gameRecordModel,{uid:uid,playStatus:0,'createTime':{$lte:Date.now()}},'createTime',(data)=> {
                    if(data){
                        let ob = {
                            uid: data.uid,
                            createTime: data.createTime
                        }
                        gameRecordModel.update(ob, {playStatus: 1}, () => {});
                    }
                    gameRecordModel.create({
                        nid:'10',
                        uid: uid,
                        nickname: player.nickname,
                        gname: '海盗',
                        createTime: Date.now(),
                        input: totalBet,
                        multiple: multiple,
                        profit: totalWin - totalBet,
                        selfGold: player.gold,
                        playStatus: 0
                    }, function (err, data) {
                        if (err) {
                            console.error('创建游戏记录失败 games.slots777Handler.start');
                        }
                    });
                });
                break;
            case 'update'://更新游戏记录
                let ob = {uid:uid,playStatus:0,'createTime':{$lte:Date.now()}};
                if(settlement){
                    delete ob.playStatus;
                }
                util.queryRecently(gameRecordModel,ob,'createTime',(data)=>{
                    if(data){
                        let ob = {
                            uid:data.uid,
                            createTime:data.createTime
                        }
                        let profit = data.profit+(totalWin - totalBet);
                        //跟新这条记录和状态
                        gameRecordModel.update(ob,{profit:profit,createTime: Date.now(),playStatus:freespin ? 0 : profit==0 ? 0 : 1},()=>{});
                    }
                });
                break;
            case 'leave'://玩家掉线离开
                //更新金币实况记录
                util.queryRecently(gameRecordModel,{uid:uid,playStatus:0,'createTime':{$lte:Date.now()}},'createTime',(data)=>{
                    if(data){
                        let ob = {
                            uid:data.uid,
                            createTime:data.createTime
                        }
                        //跟新这条记录和状态
                        gameRecordModel.update(ob, {playStatus: 1}, () => {});
                        //发送通知邮件
                        sendMail({name: "海盗", bet: data.input, win: data.profit, isVip}, uid);
                    }
                });


                break;
        }

    }else{
        pomelo.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: player[moneyType], gamesRecord: player.gamesRecord,selfBank:player.selfBank, roomProfit: isVip ? (player.roomProfit + totalWin - totalBet) : 0}, function(){});

    }
}

//金币收集进度
module.exports.goldGather = function ({em,player,multiply,isVip}) {
    //金币收集进度
    if(em.goldNum){
        for(let i=0; i<em.goldNum; i++){
            if(player[goldToIntegral(isVip,'pirateMiniGames')] instanceof Array){
                let ob = {};
                for(let i=0;i<player[goldToIntegral(isVip,'pirateMiniGames')].length; i++){
                    ob[i] = player[goldToIntegral(isVip,'pirateMiniGames')];
                }
                player[goldToIntegral(isVip,'pirateMiniGames')] =ob;
            }
            if(player[goldToIntegral(isVip,'pirateMiniGames')][multiply-1] == undefined || player[goldToIntegral(isVip,'pirateMiniGames')][multiply-1].length == 0){
                player[goldToIntegral(isVip,'pirateMiniGames')][multiply-1] = [0,0,0,0,0,0,0];
            }
            let goldGather = player[goldToIntegral(isVip,'pirateMiniGames')][multiply-1].findIndex((value, index, arr)=>{return value == 0});
            if(goldGather<=6 && goldGather>=0){
                player[goldToIntegral(isVip,'pirateMiniGames')][multiply-1].splice(goldGather,1,1);
            }else{
                break;
            }
        }
    }
    return player[goldToIntegral(isVip,'pirateMiniGames')];
}

//freespin剩余次数
module.exports.freespinNum = function (freespin,player,isVip) {
    if(freespin){
        if(player[goldToIntegral(isVip,'freespinNum')]) {
            player[goldToIntegral(isVip, 'freespinNum')] -= 1;
        }else{
            let freespinN = 0;
            player[goldToIntegral(isVip,'pirateBox')].forEach(m=>{
                if(m.status == 1 && (m.boxEm == 5 || m.boxEm == 6 || m.boxEm == 7)){
                    freespinN += config.goldM[m.boxEm];
                }
            });
            if(freespinN) player[goldToIntegral(isVip,'freespinNum')] = freespinN - 1;
        }


    }
    return player[goldToIntegral(isVip,'freespinNum')];
}

//记录海盗船玩家每一把玩家返奖率
module.exports.intoAwardQuotiety = function (uid,bet,profit) {
    let pirateAdjust = memory.pirateAdjust;
    if(pirateAdjust[uid+'Pirate'] == undefined){
        pirateAdjust[uid+'Pirate'] = {bet:bet,profit:profit,num:1}
    }else{
        let playerOb = pirateAdjust[uid+'Pirate'];
        pirateAdjust[uid+'Pirate'] = {
            bet:playerOb.bet+bet,
            profit:playerOb.profit+profit,
            num:playerOb.num+1
        }
    }
}

//扣除v点
module.exports.deductVipDot = function ({nid,isVip,uid,pirateBet,model,viper}) {
    pomelo.app.rpc.hall.gameRemote.getGameFromHall(null,{nid:nid,isVip:isVip,uid:uid},(err,data) => {
        if(isVip && model == 'common'){
            const reduceNum = -(data.removalTime + data.pumpingRate * pirateBet);
            pomelo.app.rpc.hall.playerRemote.updateUserEffectTime(null,viper, {num: reduceNum}, function(){});
        }
    });
}

//金币场和积分场转换
module.exports.goldToIntegral = function (isVip,value) {
    return goldToIntegral(isVip,value);
}


const goldToIntegral = function (isVip,value) {
    if(isVip){
        return value+'Integral';
    }
    return value;
}

//调控(轮盘)
const releaseAward = function ({isVip,uid,config,nid,roomCode},session,cb) {
    let _config = config.map(m => {
        const obj = {};
        for (let key in m) {
            obj[key] = m[key];
        }
        return obj;
    });
    pomelo.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
        if(!player){
            console.error('没找到玩家信息')
            return;
        }
        const gameRecord = player.gamesRecord[isVip ? 'platform' : 'system'];
        if(gameRecord['slotsPirate'] == null){
            gameRecord['slotsPirate'] = {
                number: 0,//玩家自上次充钱以来所玩的把数
            };
        }
        if(gameRecord['slotsPirate'].number <= 30){//游戏次数小于30次，走新人调控
            _config.forEach((m,i,arr)=>{
               m[8] += 5;
               arr[i] = m;
            });
        }else{
            _config = entirety(_config);//整体调控
            _config = individual(uid,_config);//个体调控
            pomelo.app.rpc.hall.gameRemote.getGameFromHall(null, {nid: nid, viper:isVip,uid:uid}, function(err, game) {
                if (!game) {
                    console.error('获取游戏信息失败', game)
                    return;
                }
                const room = game.rooms.find(room => room.roomCode == roomCode);
                _config = reAward(room,_config);//放奖调控
            });

        }
        gameRecord['slotsPirate'].number++;//记录玩家游戏次数
        //更新玩家信息
        pomelo.app.rpc.hall.playerRemote.updateUser(session, uid, {gamesRecord: player.gamesRecord}, function(){});
        return cb(_config);

    });
}

//个体调控
const individual = function (uid,config) {
    let pirateAdjust = memory.pirateAdjust;
    let num = pirateAdjust[uid+'Pirate'] == undefined ? 0 : pirateAdjust[uid+'Pirate'].num;
    if(num>=10){
        let aq = pirateAdjust[uid+'Pirate'].profit/pirateAdjust[uid+'Pirate'].bet;
        if(aq>=0.85){
            return config;
        }else if(aq<=0.55){
            config.forEach((m,i,arr)=>{
                m[8] += 12;
                arr[i] = m;
            });
        }else if(aq<=0.35){
            config.forEach((m,i,arr)=>{
                m[8] += 17;
                arr[i] = m;
            });
        }
    }
    return config;
}

//整体调控
const entirety = function (config) {
    let pirateAdjust = memory.pirateAdjust;
    let allBet = 0;
    let allProfit = 0;
    for(var x in pirateAdjust){
        allBet += pirateAdjust[x].bet;
        allProfit += pirateAdjust[x].profit;
    }
    let aq = allProfit/allBet;
    if(aq>0.85){
        config.forEach((m,i,arr)=>{
            m[8] -= 10;
            arr[i] = m;
        });
    }else if(aq<0.6){
        config.forEach((m,i,arr)=>{
            m[8] += 9;
            arr[i] = m;
        });
    }
    return config;
}

//放奖调控
const reAward = function (room,config) {
    if(room.releaseAward.status) {
        config.forEach((m, i, arr) => {
            m[8] += 10;
            m[7] += 60;
            arr[i] = m;
        });
    }
    return config;
}

//随机数偏移量
const randomTime = function({offset1 ,offset2}) {
    let rand = Math.random() * util.sortProbability(Math.random(),config.offsetWeight).name;
    while (rand < offset1) {
        console.log('while2');
        rand = Math.random() * offset2;
    }
    return rand;
}


//产生海盗船元素
const produceDlement = function ({isVip,freespin,uid,nid,roomCode,mult},session,cb) {
    let em = freespin > 0 ? config.elementFreespin:config.element;
    releaseAward({isVip:isVip,uid:uid,config:em,nid:nid,roomCode:roomCode},session,(configs)=>{//放奖调控
        // console.log('海盗船元素权重',configs);
        var createE = function () {
            var arr=[],goldArr=[];
            for (let i=0; i<configs.length; i++){
                let isEven = (i+1) % 2 == 0 ? 4:3;
                let str=[];
                for(let j=0; j<isEven; j++){
                    let elements = util.sortProbability(Math.random(),config.elementWeightSetting(configs[i]));
                    //金币一回合只能出现一次
                    while(goldArr.includes('9') && elements.name == '9'){
                        console.log('while3');
                        elements = util.sortProbability(Math.random(),config.elementWeightSetting(configs[i]));
                    }
                    goldArr.push(elements.name);
                    str.push(elements.name);
                }
                arr.push(str);
            }
            return arr;
        }
        pomelo.app.rpc.hall.gameRemote.getGameFromHall(null, {nid: nid, viper:isVip,uid:uid}, function(err, game) {
            if(!game){
                console.error('获取游戏信息失败',game)
                return;
            }
            const room = game.rooms.find(m => m.roomCode == roomCode);
            if(!room){
                console.error('没有找到房间信息',roomCode)
                return;
            }
            var data;
            do{
                data = createE();
                let wire = isWire(data,mult);//检索连线,计算倍数
                let allM = wire.allMultiple.allMu + wire.allMultiple.basicsMu;
                console.log('海盗当前奖池',room.roomCode,room.jackpot);
                if(room.jackpot<=0){
                    if(wire.wire.length == 0){
                        break;
                    }

                }else if(allM<=room.jackpot){
                    break;
                }
            }while (true);

            return cb(data);
        });
    });

}

const eixtEm = function (arr,boxM) {
    let openBox = [15,16],openBoxTemp = false;
    let transparent = [17],transparentTemp = false;

    if(openBox.includes(boxM)){
        openBox.forEach(m=>{
            if(arr.includes(m)){
                openBoxTemp = true;
            }
        });
        return openBoxTemp;
    }
    if(transparent.includes(boxM)){
        transparent.forEach(m=>{
            if(arr.includes(m)){
                transparentTemp = true;
            }
        });
        return transparentTemp;
    }
}

//产生宝箱元素
const createBoxElement = function () {
    let em1 = config.pirateBox.gold;
    let em2 = config.pirateBox.freespin;
    let em3 = config.pirateBox.special;

    let boxArr = [];

    //出5个gold
    for(let i=0; i<5; i++){
        let boxM = util.sortProbability(Math.random(),em1).name;
        while(eixtEm(boxArr,boxM)){
            console.log('while411');
            boxM = util.sortProbability(Math.random(),em1).name;
        }
        boxArr.push(boxM);
    }

    //出一个freespin
    for(let i=0; i<1; i++){
        let boxM = util.sortProbability(Math.random(),em2).name;
        while(eixtEm(boxArr,boxM)){
            console.log('while422');
            boxM = util.sortProbability(Math.random(),em2).name;
        }
        boxArr.push(boxM);
    }

    //出1个特殊奖
    for(let i=0; i<1; i++){
        let boxM = util.sortProbability(Math.random(),em3).name;
        while(eixtEm(boxArr,boxM)){
            console.log('while433');
            boxM = util.sortProbability(Math.random(),em3).name;
        }
        boxArr.push(boxM);
    }

    boxArr = util.disorganizeArr(boxArr);
    console.log('boxArrboxArrboxArr',boxArr)
    return boxArr;
}

//从左到右判断数组重复元素的个数
const repetitionArr = function (arr) {
    let num = 0;
    for(let i=0; i<arr.length; i++){
        if(i+1 <= 4 ){
            let arrs1 = arr[i].indexOf('-') >= 0 ? arr[i].split('-')[1]: arr[i];
            let arrs2 = arr[i+1].indexOf('-') >= 0 ? arr[i+1].split('-')[1]: arr[i+1];
            if(arrs1 != arrs2){
                break;
            }else{
                num = i+2;
            }
        }else{
            num = 5;
        }

    }
    return num;
}

//从左到有检索Wild
const isWild = function (arr) {
    //判断连线中是否存在Wild
    let first = '';

    if(arr.indexOf('8')>=0){
        //得到第一个不是wild的元素
        for(let i=0; i<arr.length; i++){
            if(arr[i] != '8'){
                first = arr[i];
                break
            }
        }

        //把当前这排是wild的元素替换成第一个不是wild的元素
        for(let i=0; i<arr.length; i++){
            if(arr[i] == '8'){
                arr[i] = first ? '8'+'-'+first:'8';
            }
        }
    }
    return arr;
}

//长美人鱼替换
const lengthWild = function (arr) {
    for(let j=0; j<arr.length; j++){
        for(let i=0; i<arr[j].length; i++){
            if(arr[j][i].indexOf('10')>=0){
                arr[j].fill('8');
            }
        }
    }
    return arr;
}

//去掉金币连线
const deleteGold = function (arr4) {
    let arr = [];
    for(let i=0; i<arr4.length; i++){
        if(arr4[i].em[0] != '9' && arr4[i].em[1] != '9' && arr4[i].em[2] != '9'){
            arr.push(arr4[i]);
        }
    }
    return {arr};
}

//获取金豆个数
const recordGold = function (arr) {
    let goldNum = 0;
    arr.forEach(m=>{
        m.forEach(n=>{
            if(n=='9') goldNum ++;
        })
    });
    return goldNum
}

//判断几连线
const isWire = function (arr,mult) {
    let wire = config.winningLine;
    lengthWild(arr);//长美人鱼换小美人鱼
    let arr1 = [],arr4 = [],isExist =[],arrWire = [];
    //循环50次
    wire.forEach((m,i)=>{
        let arr2 = [];
        let arr3 = {};
        //循环5次
        arr.forEach((n,j)=>{
            arr2.push(n[m[j]-1]);
        })
        arr3['em'] = arr2;
        let arrs = [];
        m.forEach((x,i)=>{
            let offset = randomTime(config.offset);
            while (isExist.indexOf(offset)>=0){
                console.log('while6');
                offset = randomTime(config.offset);
            }
            isExist.push(offset);
            arrs[i] = {offset:offset,index:x};
        })
        arr3['winningLine'] = arrs;
        arr1.push(arr3);
    });

    //检索连线
    for (let i=0; i<arr1.length; i++){
        let em = isWild(arr1[i].em);//替换wild
        let isWire = repetitionArr(em);//单元素连线
        if(isWire == 3){
            arr1[i]['jilian'] = 3;
            arr4.push(arr1[i]);
        }
        if(isWire == 4){
            arr1[i]['jilian'] = 4;
            arr4.push(arr1[i]);
        }
        if(isWire == 5){
            arr1[i]['jilian'] = 5;
            arr4.push(arr1[i]);
        }
    }



    let getGold = deleteGold(arr4);
    let allMultiple = calculate(getGold.arr,mult);//计算倍数
    return {wire:getGold.arr,allMultiple:allMultiple};
}

//计算倍数
const calculate = function (wire,mult) {
    let eleMu = config.eleMu;//元素倍数
    let allMu = 0;//除了走基础奖池的所有盈利
    let basicsMu = 0;//走基础奖池的盈利
    if(wire.length){
        wire.forEach((m,i)=>{
            let firstEm = m.em[0].indexOf('-') >= 0 ? m.em[0].split('-')[1] : m.em[0];//连线的第一个元素
            if(firstEm != '7'){//不是第8个元素地图
                allMu += eleMu[firstEm][m.jilian-3]*mult;
            }else{
                basicsMu += eleMu[firstEm][m.jilian-3]*mult;
            }

        });
    }
    return {allMu,basicsMu};
}

//去掉-
const deleteW = function (arr4) {
    for(let i=0; i<arr4.length; i++){
        for(let j=0; j<arr4[i].em.length; j++){
            if(arr4[i].em[j].indexOf('8')>=0){
                arr4[i].em[j] = arr4[i].em[j].split('-')[0];
            }
        }
    }
    return arr4;
}