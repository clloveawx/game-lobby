'use strict';

const DotMgr = require('../../../domain/transplant/Dot/DotMgr');
const GameUtil = require('../../../utils/GameUtil');
const HallService = require('../../../services/HallService');

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

function check (roomId, uid,isvip) {
    const room = DotMgr.getRoom(roomId,isvip);
    if(!room){
        return {err: '房间不存在'};
    }
    const player = room.getPlayer(uid);
    if(!player){
        return {err: '玩家不存在'};
    }
    return {room: room, player: player};
}

//金币转积分
function goldToIntegral(isvip,player){
    if(isvip){
        return player.integral;
    }else{
        return player.gold;
    }
}
/**
 * 加载完成
 * 路由games.dotHandler.loaded
 **/
Handler.prototype.loaded = function({roomId}, session, next){
    let isvip = session.get('VIP_ENV');
    let countDown = 0;
    const {err, room, player} = check(roomId, session.uid,isvip);
    if (err){
        return next(null, {code: 500, error: err});
    }
    room.channel.pushMessage('onEnteryDot', {player: player.strip(),players:room.packagingPlayer()});
    if(room.roomStatus === 'NONE'){//如果房间没有运行,玩家进入开始运行房间
        countDown = room.run();
    }else{
        countDown = room.countdown;
    }
    return next(null, {code: 200, room:room.roomStrip(),player: player.strip(),playerArr:room.packagingPlayer(),countDown:countDown});

};

/*
加倍
 路由games.dotHandler.addMultiple
*/
Handler.prototype.addMultiple = function ({roomId,seat}, session, next) {
    let isvip = session.get('VIP_ENV');
    const {err, room, player} = check(roomId, session.uid,isvip);
    if (err){
        return next(null, {code: 500, error: err});
    }
    //加倍扣钱
    player.addMultiples(seat,room,(error,data)=>{
        if(error){
            return next(null, {code: 500, error: error});
        }
        let ob = {code: 200,currMoney:data.currMoney,money:data.money,player:player.strip()};
        if(data.msg){
            ob['msg'] = data.msg;
        }
        return next(null,ob);
    });
}

/*分牌
* 路由games.dotHandler.separateCard
* */
Handler.prototype.separateCard = function ({roomId,seat}, session, next) {
    let isvip = session.get('VIP_ENV');
    const {err, room, player} = check(roomId, session.uid,isvip);
    if (err){
        return next(null, {code: 500, error: err});
    }
    player.separateCards(seat,room,(error,data)=>{
        if(error){
            return next(null, {code: 500,error:error});
        }
        return next(null, {code: 200,player:player.strip(),money:data,isPart:this.currPoker});
    });

}

/*
要牌
路由games.dotHandler.getPlayingCard
*/
Handler.prototype.getPlayingCard = function ({roomId,seat,isGet},session, next) {
    let isvip = session.get('VIP_ENV');
    const {err, room, player} = check(roomId, session.uid,isvip);
    if (err){
        return next(null, {code: 500, error: err});
    }
    if(seat>=5){
        return next(null, {code: 500, error: '不该你操作'});
    }
    let achieved;
    if(isGet){
        achieved = player.getCardUser({seat,room});
    }else{
        achieved = player.noCardUser({seat,room});
    }
    let res;

    if(achieved){
        if(achieved.error){
            return next(null, {code: 500, error:achieved.error});
        }
        res = {code: 200, getCardUser:achieved?achieved.isCard:achieved,player: player.strip()};
        if(achieved.isPart){
            res['isPart'] = achieved.isPart;
        }
        console.log('--------',achieved.msg);
        if(achieved.msg){

            res['msg'] = achieved.msg
        }
    }
    return next(null,res);
};

//下注
//路由games.dotHandler.Bet
Handler.prototype.Bet = function ({roomId,location,bet},session, next) {
    let isvip = session.get('VIP_ENV');
    const {err, room, player} = check(roomId, session.uid,isvip);
    if (err){
        return next(null, {code: 500, error: err});
    }
    // 金币是否够
    if (bet > goldToIntegral(isvip,player)) {
        return next(null, {code: 500, error: isvip?'积分不足':'金币不足'});
    }
    console.log('this.roomStatus2222',room.roomStatus)
    if(room.roomStatus !== 'INBET'){
        return next(null, {code: 500, error: '下注时间已过'});
    }
    player.bottomPour(room,location,bet);

    return next(null, {code: 200, bet:bet,player:player.strip()});
}

//买保险
//路由games.dotHandler.buyInsurance
Handler.prototype.buyInsurance = function ({roomId,isBuy}, session, next) {
    let isvip = session.get('VIP_ENV');
    const {err, room, player} = check(roomId, session.uid,isvip);
    if (err){
        return next(null, {code: 500, error: err});
    }
    // 金币是否够
    if (isBuy && player.bet/2 > goldToIntegral(isvip,player)) {
        return next(null, {code: 500, error: isvip?'积分不足':'金币不足'});
    }
    player.buyInsurance(room,isBuy,(data)=>{
        return next(null, {code: 200, currMoney: data.currMoney,money:data.money,player:player.strip()});
    });
}
