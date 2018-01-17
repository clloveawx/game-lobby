'use strict';

const AttMgr = require('../../../domain/transplant/att/AttMgr');
const utils = require('../../../utils');

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

function check (roomId, uid,isvip) {
	const room = AttMgr.getRoom(roomId,isvip);
	if(!room){
		return {err: '房间不存在'};
	}
	const player = room.getPlayer(uid);
	if(!player){
		return {err: '玩家不存在'};
	}
	return {room: room, player: player};
}
// 添加奖池
const addJackpot = function (_this,room,bet) {

    _this.app.rpc.hall.gameRemote.getGameFromHallniuniu(null,{nid:room.nid,isVip:room.isvip,uid:room.vipRoomoWnerId},(err,data) => {
        if(!data){
            console.error('获取游戏信息失败getGameFromHallniuniu',data)
            return;
        }
        const rooms = data.rooms.find(m => m.roomCode == room.id);
        rooms.jackpot += bet;
        _this.app.rpc.hall.gameRemote.niuniuUpdateGameRoom(null, {nid:room.nid, roomCode:room.id,isVip:room.isvip,uid:room.vipRoomoWnerId}, {jackpot: rooms.jackpot, consumeTotal: rooms.consumeTotal, winTotal: rooms.winTotal, boomNum: rooms.boomNum, runningPool: rooms.runningPool, profitPool: rooms.profitPool},function(){});
    });
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
 * 发牌
 */
Handler.prototype.deal = function({roomId, betNum, handNum}, session, next) {
    let isvip = session.get('VIP_ENV');
    let _this = this;
    let uid = session.uid;
    let model = session.get('model');//玩家当前vip房间所处模式
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	if (handNum <= 0) {
		return next(null, {code: 500, error: '手牌不能小于1'});
	}
	const bet = betNum * handNum;
	if (bet <= 0) {
		return next(null, {code: 500, error: '押注筹码太少了吧'});
	}
	if (bet >goldToIntegral(isvip,player)) {
		return next(null, {code: 500, error: '筹码不足'});
	}
	// console.log({nid:room.nid,isVip:isvip,uid:room.vipRoomoWnerId});
    const updateRecord =  () => {
        this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, _player) {
            //添加记录
            const moneyType = isvip ? 'integral' : 'gold';
            player.updateSlipper(uid,betNum*handNum,0);
            AttMgr.addGoldRecordAttMgr({isAdd:'add',isVip:isvip,totalBet:betNum*handNum,totalWin:0,multiple:0,player:_player,uid:uid,moneyType:moneyType},session);
        });
    }
    this.app.rpc.hall.gameRemote.getGameFromHallniuniu(null,{nid:room.nid,isVip:isvip,uid:room.vipRoomoWnerId},(err,data) => {
        if(!data){
            console.error('获取游戏信息失败getGameFromHallniuniu',data)
            return;
        }
        const rooms = data.rooms.find(room1 => room1.roomCode == room.id);
        if(isvip){
            // 执行扣钱
            this.app.rpc.hall.playerRemote.changeIntegral(null, player.uid, -bet, function (integral) {
                    player.integral = integral;
                    addJackpot(_this,room,bet);
                    // 玩家准备开始
                    player.ready(betNum, handNum,rooms,room);
                    //vip场扣v点
                    room.deductVipDot(model,bet);
                    //跟新记录
                    updateRecord();
                    next(null, {code: 200, integral: integral, cards: player.cards});
            });
        }else{
            // 执行扣钱
            this.app.rpc.hall.playerRemote.changeGold(null, player.uid, -bet, function (gold) {
                player.gold = gold;
                addJackpot(_this,room,bet);
                // 玩家准备开始
                player.ready(betNum, handNum,rooms,room);
                //跟新记录
                updateRecord();
                next(null, {code: 200, gold: gold, cards: player.cards});
            });
        }
    });

};

/**
 * 保留
 */
Handler.prototype.retain = function({roomId, retains}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 是否准备好了
	if (!player.isReady()) {
		return next(null, {code: 500, error: '请先发牌'});
	}
    this.app.rpc.hall.gameRemote.getGameFromHallniuniu(null,{nid:room.nid,isVip:room.isvip,uid:room.vipRoomoWnerId},(err,data) => {
        if(!data){
            console.error('获取游戏信息失败getGameFromHallniuniu',data)
            return;
        }
        const rooms = data.rooms.find(room1 => room1.roomCode == room.id);
        const ret = room.exec(player, retains || [],rooms);
        // 如果没有收益直接清空信息
        if (ret.sumGain === 0) {
            player.initGame();
        }
        return next(null, {code: 200, result: ret});
    });


};

/**
 * 领取奖励
 */
Handler.prototype.take = function({roomId,betNum, handNum}, session, next) {
	let isvip = session.get('VIP_ENV');
	let _this = this;
	let uid = session.uid;
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 是否准备好了
	if (!player.isReady()) {
		return next(null, {code: 500, error: '还没有可领取的奖励'});
	}
	const gain = player.sumGain;
	if(isvip){
        // 执行加钱
        this.app.rpc.hall.playerRemote.changeIntegral(null, player.uid, gain, function (integral) {
            player.integral  = integral ;
            // 添加奖池
            addJackpot(_this,room,-gain);
            // 初始玩家信息
            player.initGame();
            console.log('初始化');
            next(null, {code: 200, integral : integral, gain: gain});
        });
	}else{
        // 执行加钱
        this.app.rpc.hall.playerRemote.changeGold(null, player.uid, gain, function (gold) {
            player.gold = gold;
            // 添加奖池
            addJackpot(_this,room,-gain);
            // 初始玩家信息
            player.initGame();
            console.log('初始化');
            next(null, {code: 200, gold: gold, gain: gain});
        });
	}
	console.log('gaingaingain',gain);
    this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, _player) {
        //添加记录
        const moneyType = isvip ? 'integral' : 'gold';
        player.updateSlipper(uid,0,gain);
        AttMgr.addGoldRecordAttMgr({isAdd:'update',isVip:isvip,totalBet:0,totalWin:gain,multiple:0,player:_player,uid:uid,moneyType:moneyType},session);
    });

};

/**
 * 搏一搏
 */
Handler.prototype.atry = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
    let uid = session.uid;
	const {err, room, player} = check(roomId, uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 是否准备好了
	if (!player.isReady()) {
		return next(null, {code: 500, error: '还没有可领取的奖励'});
	}
	// 是否有收益
	if (player.sumGain <= 0) {
		return next(null, {code: 500, error: '必须赢了才能搏一搏'});
	}
	// 准备搏一搏
	player.readyAtry();
    player.updateSlipper(uid,0,player.sumGain);
    AttMgr.addGoldRecordAttMgr({isAdd:'update',isTry:true,isVip:isvip,totalWin:player.sumGain,uid:uid},session);
    next(null, {code: 200, cards: player.atryFlodHeaps, canGuessCount: player.canGuessCount, gain: player.sumGain});
};

/**
 * 搏一搏 - 操作
 */
Handler.prototype.atryOpt = function({roomId, opt}, session, next) {
    let isvip = session.get('VIP_ENV');
    let _this = this;
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 是否准备好了
	if (!player.isReady()) {
		return next(null, {code: 500, error: '还没有可领取的奖励'});
	}
	// 是否有收益
	if (player.sumGain <= 0) {
		return next(null, {code: 500, error: '必须赢了才能搏一搏'});
	}
	// 是否还有次数
	if (player.canGuessCount <= 0) {
		return next(null, {code: 500, error: '可猜次数不够'});
	}
	// 获取牌
	let card, color, mul, gain;
    this.app.rpc.hall.gameRemote.getGameFromHallniuniu(null,{nid:room.nid,isVip:room.isvip,uid:room.vipRoomoWnerId},(err,data) => {
        if(!data){
            console.error('获取游戏信息失败getGameFromHallniuniu',data)
            return;
        }
        const roomhall = data.rooms.find(room1 => room1.roomCode == room.id);
        do {

            card = utils.randomIndex(52, 1, player.atryFlodHeaps);
            color = Math.floor(card/13);
            gain = player.sumGain;
            console.log('player.atryFlodHeaps',player.atryFlodHeaps,'card',card,'color',color);
            mul = 0;
            // 红色
            if (opt === 11 && color%2 === 1) {
                mul = 2;
            } else if (opt === 22 && color%2 === 0) { // 黑色
                mul = 2;
            } else if (color === opt) {
                mul = 4;
            }
            // 如果赢了 加总赢
            if (mul !== 0) {
                gain = gain * mul;
            } else {
                gain = 0;// 否则全部清零
            }
            console.log('ATT搏一搏',roomhall.jackpot,gain);
            if (roomhall.jackpot - gain >= 0) {
                break;
            }
            console.log('while7');
        } while (true);
        roomhall.jackpot += -gain;
        this.app.rpc.hall.gameRemote.niuniuUpdateGameRoom(null, {nid:room.nid, roomCode:room.id,isVip:room.isvip,uid:room.vipRoomoWnerId}, {jackpot: roomhall.jackpot, consumeTotal: roomhall.consumeTotal, winTotal: roomhall.winTotal, boomNum: roomhall.boomNum, runningPool: roomhall.runningPool, profitPool: roomhall.profitPool},function(){});
        player.sumGain = gain;
        // 减去次数
        player.canGuessCount -= 1;
        // 把弃牌放入 弃牌堆
        player.atryFlodHeaps.push(card);
        // 如果次数完了 或者 失败了 就直接结算
        if (player.canGuessCount <= 0 || mul === 0) {
        	if(isvip){
                // 执行加钱
                this.app.rpc.hall.playerRemote.changeIntegral(null, player.uid, gain, function (integral) {
                    player.integral = integral;
                    // 添加奖池
                    addJackpot(_this,room,-gain);
                    // 初始玩家信息
                    player.initGame();
                    next(null, {code: 200, isNext: false, integral: integral, iswin: mul !== 0, card: card, canGuessCount: player.canGuessCount, gain: gain});
                });
			}else{
                // 执行加钱
                this.app.rpc.hall.playerRemote.changeGold(null, player.uid, gain, function (gold) {
                    player.gold = gold;
                    // 添加奖池
                    addJackpot(_this,room,-gain);
                    // 初始玩家信息
                    player.initGame();
                    next(null, {code: 200, isNext: false, gold: gold, iswin: mul !== 0, card: card, canGuessCount: player.canGuessCount, gain: gain});
                });
			}

        } else {
            next(null, {code: 200, isNext: true, iswin: mul !== 0, card: card, canGuessCount: player.canGuessCount, gain: gain});
        }
    })

};