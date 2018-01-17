/**
 * Created by 14060 on 2017/10/12.
 */
'use strict';
const logic = require('../../../domain/games/pirate/logic');
const config = require('../../../domain/games/pirate/config');
const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');
const pomelo = require('pomelo');
module.exports = function(app) {
    return new pirateHandler(app);
};

var pirateHandler = function(app) {
    this.app = app;
};

/**
 *  海盗船初始化
 * @param {}押注倍数
 * @return {pirateMiniGames}
 * @route：games.pirateHandler.pirateInit
 */
pirateHandler.prototype.reqPirateArray = function ({},session, next) {
    const uid = session.uid;
    const _this = this;
    const isVip = session.get('VIP_ENV');
    if(!uid){
        return next(null, {code: 500, error:'海盗船参数有误'});
    }
    _this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
        if(!player){
            return next(null, {code: 500, error: '获取玩家信息失败 games.pirateHandler.pirateInit'});
        }
        if(player[logic.goldToIntegral(isVip,'pirateMiniGames')] instanceof Array){
            let ob = {};
            for(let i=0;i<player[logic.goldToIntegral(isVip,'pirateMiniGames')].length; i++){
                let goldArr = player[logic.goldToIntegral(isVip,'pirateMiniGames')][i];
                if(goldArr.length){
                    ob[i] = player[logic.goldToIntegral(isVip,'pirateMiniGames')][i];
                }else{
                    ob[i] = [0,0,0,0,0,0,0];
                }
            }
            player[logic.goldToIntegral(isVip,'pirateMiniGames')] =ob;
            _this.app.rpc.hall.playerRemote.updateUser(session, uid, {[logic.goldToIntegral(isVip,'pirateMiniGames')]:player[logic.goldToIntegral(isVip,'pirateMiniGames')]}, function(err,player){
                return next(null,{code:200,'pirateMiniGames':player[logic.goldToIntegral(isVip,'pirateMiniGames')]});
            });
        }else {
            return next(null,{code:200,'pirateMiniGames':player[logic.goldToIntegral(isVip,'pirateMiniGames')]});

        }
    });
}
/**
 *  开始游戏
 * @param {multiply,freespin}押注倍数,是否进入freespin
 * @return {element, wire, gold, getGold}
 * @route：games.pirateHandler.startPirate
 */
pirateHandler.prototype.startPirate = function ({multiply,freespin},session, next) {
    const nid = session.get('game');
    const roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
    const uid = session.uid;
    const _this = this;
    const pirateBet = freespin ? 0 : config.betMultiple[multiply]*50;//押注扣钱
    const model = session.get('model');//玩家当前vip房间所处模式
    const viper = session.get('viper');

    if(!uid || typeof multiply != 'number' ){
        return next(null, {code: 500, error:'海盗船参数有误'});
    }

    //获取玩家信息
    _this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
        if(!player){
            return next(null, {code: 500, error: '获取玩家信息失败 games.pirateHandler.startPirate'});
        }
        if(isVip?player.integral<pirateBet:player.gold<pirateBet){
            return next(null,{code:500,error:isVip?'积分不足':'金币不足'});
        }
        logic.getElement({
            isVip:isVip,
            mult:config.betMultiple[multiply],
            freespin:freespin,
            uid:uid,
            nid:nid,
            roomCode:roomCode
        },session,(em)=>{//产生海盗船元素
            const moneyType  = isVip ? 'integral' : 'gold';
            const getType = isVip ? 'getIntegral' : 'getGold';
            const allM = em.allMultiple.allMu + em.allMultiple.basicsMu;//连线总盈利
            const deductMoney = isVip ? player.integral + allM - (freespin ? 0:pirateBet) : player.gold + allM - (freespin ? 0:pirateBet);
            let freespinNum;
            //金币收集进度
            let pirateMiniGames = logic.goldGather({em,player,multiply,isVip});

            //计算freespin剩余次数
            if(freespin){
                if(player[logic.goldToIntegral(isVip,'freespinNum')]){
                    freespinNum  = logic.freespinNum(freespin,player,isVip);
                    console.log('freespin剩余次数',freespinNum);
                }else{
                    return next(null, {code: 500, error:'freespin次数不足'});
                }
            }
            //添加金币和积分记录
            logic.addGoldRecord({isAdd:freespin?'update':'add',freespin,isVip,totalBet:pirateBet,totalWin:allM,multiple:allM/config.betMultiple[multiply],player:player,uid,moneyType},session);


            logic.roomJackpotAdd({nid,isVip,roomCode,uid,pirateBet},session,()=>{
                //向奖池扣钱
                logic.roomJackpotSubtract({nid:nid,isVip:isVip,roomCode:roomCode,uid:uid,pirateProfit:em.allMultiple,isType:'all'});
            });

            //记录每个玩家的返奖率
            logic.intoAwardQuotiety(uid,pirateBet,allM);

            //vip房间扣v点
            logic.deductVipDot({nid,isVip,uid,pirateBet,model,viper});

            //扣钱处理
            _this.app.rpc.hall.playerRemote.updateUser(session, uid, {[moneyType]: deductMoney,[logic.goldToIntegral(isVip,'pirateMiniGames')]:pirateMiniGames,[logic.goldToIntegral(isVip,'freespinNum')]:freespinNum}, function(err,player){
                return next(null,{code:200,element:em.element,wire:em.wire,[moneyType]:deductMoney,[getType]:allM});
            });
        });
    });
}

/*
* 海盗船猜箱子
* @param {multiply}押注倍数
* @return {}
* @route：games.pirateHandler.pirateBox
*/
pirateHandler.prototype.pirateBox = function ({multiply},session,next) {
    const nid = session.get('game');
    const roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
    const uid = session.uid;
    const _this = this;
    if(!uid){
        return next(null, {code: 500, error:'海盗船参数有误'});
    }
    //获取玩家信息
    _this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
        if(!player){
            return next(null, {code: 500, error: '获取玩家信息失败 games.pirateHandler.pirateBox'});
        }
        let isBoxTemp = true;

        //验证收集的金币是否满足开箱子
        if(player[logic.goldToIntegral(isVip,'pirateMiniGames')][multiply-1] != undefined){
            player[logic.goldToIntegral(isVip,'pirateMiniGames')][multiply-1].forEach((m,i,arr)=>{
                if(arr.length == 7){
                    if(m!=1)isBoxTemp = false;
                }else{
                    isBoxTemp = false;
                }
            });
        }else{
            player[logic.goldToIntegral(isVip,'pirateMiniGames')][multiply-1] = [0,0,0,0,0,0,0]
            isBoxTemp = false;
        }

        if(!isBoxTemp){
            return next(null, {code: 500, error: '当前收集的金币不满足开宝箱'});
        }

        //根据奖池数据产生宝箱元素
        let getBoxM = logic.getBoxElement(nid,isVip,uid);//获取宝箱元素
        let boxArr = [];
        pomelo.app.rpc.hall.gameRemote.getGameFromHall(null, {nid: nid, viper:isVip,uid:uid}, function(err, game) {
            const room = game.rooms.find(room => room.roomCode == roomCode);
            let jackpotArr = [1,2,3,4];//jackpot奖励
            let goldM = [8,9,10,11,12,13,14]//金币翻倍
            getBoxM.forEach(m=>{
                let ob = {};
                ob.status = 0;
                ob.boxEm = m;
                ob.index = -1;
                let configJackppt = config.jackpotM[m];
                if(jackpotArr.includes(m)){//jackpot
                    let value1 = configJackppt.m * config.betMultiple[multiply];
                    let value2 = ((configJackppt.p/100) * room.releaseAward.jackpotPirate)/(config.betMultiple[6]/config.betMultiple[multiply]);
                    ob.value = Math.round(value1+value2);
                    ob.value = parseInt(ob.value);
                    if(ob.value>room.releaseAward.jackpotPirate){//如果奖池钱不够
                        ob.boxEm = 8;
                        ob.value = config.goldM[8]*config.betMultiple[multiply] * 50;
                        logic.roomJackpotSubtract({nid:nid,isVip:isVip,roomCode:roomCode,uid:uid,pirateProfit:ob.value,isType:'gold'});
                    }else{
                        logic.roomJackpotSubtract({nid:nid,isVip:isVip,roomCode:roomCode,uid:uid,pirateProfit:ob.value,isType:'basics'});
                    }
                }else if(goldM.includes(m)){//金币
                    ob.value = config.goldM[m]*config.betMultiple[multiply] * 50;
                    logic.roomJackpotSubtract({nid:nid,isVip:isVip,roomCode:roomCode,uid:uid,pirateProfit:ob.value,isType:'gold'});

                }else{//其它元素
                    ob.value = config.goldM[m] || 1;
                }

                boxArr.push(ob);
            })

            console.log('新宝箱',boxArr,'旧宝箱',player[logic.goldToIntegral(isVip,'pirateBox')])

            let ob = {
                [logic.goldToIntegral(isVip,'pirateBox')]:player[logic.goldToIntegral(isVip,'pirateBox')].length ? player[logic.goldToIntegral(isVip,'pirateBox')]:boxArr,
            }

            //跟新宝箱数据
            _this.app.rpc.hall.playerRemote.updateUser(session, uid,ob , function(err,player){
                return next(null,{code:200,box:player[logic.goldToIntegral(isVip,'pirateBox')].length ? player[logic.goldToIntegral(isVip,'pirateBox')]:boxArr,freespinNum:player[logic.goldToIntegral(isVip,'freespinNum')]});
            });
        });
    });
}

/*
 * 海盗船打开箱子,记录箱子打开状态
 * @param {boxElement}打开的元素
 * @return {}
 * @route：games.pirateHandler.boxOpenStatus
 */
pirateHandler.prototype.boxOpenStatus = function ({boxElement},session,next) {
    const uid = session.uid;
    const _this = this;
    const isVip = session.get('VIP_ENV');
    if(!uid){
        return next(null, {code: 500, error:'海盗船参数有误'});
    }
    _this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player){
        if(!player){
            return next(null, {code: 500, error: '获取玩家信息失败 games.pirateHandler.boxOpenStatus'});
        }
        let isBox = player[logic.goldToIntegral(isVip,'pirateBox')].find(m=>{return m.boxEm == boxElement.boxEm});
        if(!isBox){
            return next(null, {code: 500, error:'宝箱元素有误'});
        }
        console.log(player[logic.goldToIntegral(isVip,'pirateBox')]);
        let boxIndex = player[logic.goldToIntegral(isVip,'pirateBox')].findIndex(m=>{return m.boxEm == boxElement.boxEm && m.status == 0});
        player[logic.goldToIntegral(isVip,'pirateBox')][boxIndex].status = 1;
        player[logic.goldToIntegral(isVip,'pirateBox')][boxIndex].index = boxElement.indexes;

        //记录freespin次数
        if(boxElement.boxEm == 5 || boxElement.boxEm == 6 || boxElement.boxEm == 7){
            player[logic.goldToIntegral(isVip,'freespinNum')] += config.goldM[boxElement.boxEm]
        }


        let ob={
            [logic.goldToIntegral(isVip,'pirateBox')]:player[logic.goldToIntegral(isVip,'pirateBox')],
            [logic.goldToIntegral(isVip,'freespinNum')]:player[logic.goldToIntegral(isVip,'freespinNum')]
        };
        _this.app.rpc.hall.playerRemote.updateUser(session, uid,ob , function(err,player){
            return next(null,{code:200});
        });

    });
}

/*
 * 海盗船结算箱子奖励
 * @param {multiply}押注倍数
 * @return {}
 * @route：games.pirateHandler.settlement
 */
pirateHandler.prototype.settlement = function ({multiply},session,next) {
    const uid = session.uid;
    const _this = this;
    const isVip = session.get('VIP_ENV');
    const moneyType  = isVip ? 'integral' : 'gold';
    const getType = isVip ? 'getIntegral' : 'getGold';
    if(!uid){
        return next(null, {code: 500, error:'海盗船参数有误'});
    }
    _this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, player) {
        if (!player) {
            return next(null, {code: 500, error: '获取玩家信息失败 games.pirateHandler.settlement'});
        }
        let allGold = 0;


        //判断宝箱是否全部打开
        player[logic.goldToIntegral(isVip,'pirateBox')].forEach(m=>{
            let arr = [1,2,3,4,8,9,10,11,12,13,14];//金币翻倍
            if(m.status != 0 && arr.includes(m.boxEm)){
                allGold += m.value;
            }
        });
        const deductMoney = isVip ? player.integral + allGold : player.gold + allGold;
        //重置金币收集进度
        if(player[logic.goldToIntegral(isVip,'pirateMiniGames')][multiply-1] != undefined){
            player[logic.goldToIntegral(isVip,'pirateMiniGames')][multiply-1].forEach((m,i,arr)=>{
                if(arr[arr.length - 1] == 1){
                    arr.fill(0);
                }
            });
        }else{
            player[logic.goldToIntegral(isVip,'pirateMiniGames')][multiply-1] = [0,0,0,0,0,0,0];
        }

        //重置箱子收集进度
        player[logic.goldToIntegral(isVip,'pirateBox')] = [];
        //重置freespin次数
        player[logic.goldToIntegral(isVip,'freespinNum')] = 0;
        //添加金币积分记录
        logic.addGoldRecord({isAdd:'update',settlement:true,isVip:isVip,totalBet:0,totalWin:allGold,multiple:0,player:player,uid:uid,moneyType:moneyType},session);

        let ob = {
            [moneyType]: deductMoney,
            [logic.goldToIntegral(isVip,'pirateBox')]:player[logic.goldToIntegral(isVip,'pirateBox')],
            [logic.goldToIntegral(isVip,'pirateMiniGames')]:player[logic.goldToIntegral(isVip,'pirateMiniGames')],
            [logic.goldToIntegral(isVip,'freespinNum')]:player[logic.goldToIntegral(isVip,'freespinNum')]
        }
        //更新玩家信息
        _this.app.rpc.hall.playerRemote.updateUser(session, uid, ob , function(err,player){
            return next(null,{code:200,[moneyType]:deductMoney,[getType]:allGold});
        });
    });
}