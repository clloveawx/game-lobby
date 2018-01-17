'use strict';

const BaijiaMgr = require('../../../domain/transplant/baijia/BaijiaMgr');

module.exports = function(app) {
	return new baijiaHandler(app);
};

var baijiaHandler = function(app) {
	this.app = app;
};

function check (roomId, uid,isvip) {
	const room = BaijiaMgr.getRoom(roomId,isvip);
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
 */
baijiaHandler.prototype.loaded = function({roomId}, session, next) {
	let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 通知其他玩家有人加入房间
	room.channel.pushMessage('onEntry', {roomCode:room.id,player: player.strip()});
	// 检查之前是不是关闭了 如果人数1个以上就可以开始了
	if(room.status === 'NONE'){
		room.run();
	}
	// 返回给客户端
	next(null, {code: 200, room: room.strip()});
};

/**
 * 申请开始下注
 */
baijiaHandler.prototype.applyBet = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500});
	}
	if(room.status === 'INSETTLE') {
		return next(null, {code: 200, status: 'INBIPAI', countdownTime: room.getCountdownTime()});
	}
	next(null, {
		code: 200, 
		status: room.status, 
		countdownTime: room.getCountdownTime(), 
		data: room.toBetBack()
	});
};

/**
 * 申请结果
 */
baijiaHandler.prototype.applyResult = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
    let uid = session.uid;
    const {err, room, player} = check(roomId, session.uid,isvip);
    if (err){
        return next(null, {code: 500});
    }
    if(room.status === 'INSETTLE' || room.status === 'INBET') {
		return next(null, {code: 200, status: 'INBET', countdownTime: 1000});
	}
	let res = room.toResultBack();

    let allBet = 0;
   	//计算总押注
	for(var x in player.bets){
        allBet += player.bets[x].bet;
	}
    this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, _player){
        //添加记录
        const moneyType  = isvip ? 'integral' : 'gold';

        //在玩家列表里面找到自己的信息
        let meEarnings  = res.players.find(m => m.uid == uid);

        if(allBet && meEarnings.gain){
            //添加金币和积分记录
            BaijiaMgr.addGoldRecordBaijia({isVip:isvip,totalBet:allBet,totalWin:meEarnings.gain,multiple:0,player:_player,uid:uid,moneyType:moneyType},session);
        }
        next(null, {
            code: 200,
            status: room.status,
            countdownTime: room.getCountdownTime(),
            data: res
        });
	});

};

/**
 * 下注
 */
baijiaHandler.prototype.bet = function({roomId, betNum, area}, session, next) {
    let isvip = session.get('VIP_ENV');
    let model = session.get('model');//玩家当前vip房间所处模式
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 是否下注时间
	if(room.status !== 'INBET') {
		return next(null, {code: 500, error: '当前不能下注'});
	}
	if(!room.dishs[area]) {
		return next(null, {code: 500, error: '操作错误'});
	}
	//押注上限
    if (player.bets[area].bet + betNum > room.dishs[area].betUpperLimit) {
        return next(null, {code: 500, error: '你押得太多啦！'});
    }
	// 金币是否够
	if (betNum > goldToIntegral(isvip,player)) {
		return next(null, {code: 500, error: isvip?'积分不足':'金币不足'});
	}

	next(null, {code: 200});
	// 投注
	room.onBeting(player, betNum, area,model);
};

/**
 * 需押
 */
baijiaHandler.prototype.goonBet = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
    let model = session.get('model');//玩家当前vip房间所处模式
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 是否下注时间
	if(room.status !== 'INBET') {
		return next(null, {code: 500, error: '当前不能下注'});
	}
	// 押注上限
    for (let key in player.lastBets) {
        if (player.bets[key].bet+player.lastBets[key] > room.dishs[key].betUpperLimit) {
            return next(null, {code: 500, error: '你押得太多啦！'});
        }
    }
	// 金币是否够
    const betNum = player.lastSumBetNum();
    if (betNum >goldToIntegral(isvip,player)) {
		return next(null, {code: 500, error: isvip?'积分不足':'金币不足'});
	}
    // 需押
    room.onGoonBet(player, betNum,model,(error)=>{
    	if(error){
            return next(null, {code: 500, error: error});
		}
        next(null, {code: 200});
	});


};

/**
 * 取消押注
 */
baijiaHandler.prototype.cancelBet = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
    let model = session.get('model');//玩家当前vip房间所处模式
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 是否下注时间
	if(room.status !== 'INBET') {
		return next(null, {code: 500, error: '当前不能操作'});
	}
	next(null, {code: 200});
	// 需押
	room.onCancelBet(player,model);
};

/**
 * 申请玩家列表
 */
baijiaHandler.prototype.applyplayers = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	next(null, {code: 200, list: room.players.map(m => m.strip())});
};