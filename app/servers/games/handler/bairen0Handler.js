'use strict';

const BairenMgr = require('../../../domain/transplant/bairen/BairenMgr');
const utils = require('../../../utils');

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

function check (roomId, uid,isvip) {
	const room = BairenMgr.getRoom(roomId,isvip);
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
Handler.prototype.loaded = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 通知其他玩家有人加入房间
	room.channel.pushMessage('onEntry', {player: player.strip()});
	// 检查之前是不是关闭了 如果人数1个以上就可以开始了
	if(room.status === 'NONE'){
		room.run();
	}
	// 来个欢迎么。。。
	const zhuang = room.getPlayer(room.zhuangInfo.uid) || {uid: null, nickname: '系统'};
	const info = {
		uid: zhuang.uid, 
		nickname: encodeURI(zhuang.nickname),
		msg: encodeURI('欢迎['+player.nickname+']加入游戏，祝你输得痛快。')
	};
	room.channel.pushMessage('onChat', info);
	// 返回给客户端
	next(null, {code: 200, room: room.strip()});
};

/**
 * 申请开始下注
 */
Handler.prototype.applyBet = function({roomId}, session, next) {
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
Handler.prototype.applyResult = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
    let uid = session.uid;
	const {err, room, player} = check(roomId, uid,isvip);
	if (err){
		return next(null, {code: 500});
	}
	if(room.status === 'INSETTLE' || room.status === 'INBET') {
		return next(null, {code: 200, status: 'INBET', countdownTime: 1000});
	}
	let res = room.toResultBack(player.uid);
    this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function(err, _player){
        next(null, {
            code: 200,
            status: room.status,
            countdownTime: room.getCountdownTime(),
            data: res
        });
        const moneyType  = isvip ? 'integral' : 'gold';

        console.log('resres',res);
		if(res.meInfo.bet && res.meInfo.gain){
            //添加金币和积分记录
            BairenMgr.addGoldRecordBaiRen({isVip:isvip,totalBet:res.meInfo.bet,totalWin:res.meInfo.gain,multiple:0,player:_player,uid:uid,moneyType:moneyType},session);
        }
    });

};

/**
 * 下注
 */
Handler.prototype.bet = function({roomId, betNum, area}, session, next) {
	let isvip = session.get('VIP_ENV');
    let model = session.get('model');//玩家当前vip房间所处模式
	let uid = session.uid;
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 是否下注时间
	if(room.status !== 'INBET') {
		return next(null, {code: 500, error: '当前不能下注'});
	}
	if(!room.regions[area]) {
		return next(null, {code: 500, error: '操作错误'});
	}
	const ret = {code: 200};
	// 是不是超出10倍了
	const sumCount = player.bets.reduce((sum, value) => sum + value, 0) + betNum;
	if (sumCount*10 >goldToIntegral(isvip,player)) {
		const num = goldToIntegral(isvip,player) - (sumCount - betNum)*10;
		const num1 = Math.pow(10, Math.max(Math.floor(num*0.1).toString().length-1, 0));
		if((sumCount - betNum + num1)*10 > goldToIntegral(isvip,player)) {
			return next(null, {code: 500, error: '下注金额的10倍需低于本金'});
		} else {
			ret.changeJettonNum = betNum = num1;
		}
	}
	// 押注上限
	if(sumCount > room.singleBetLimit) {
		// return next(null, {code: 500, error: '你押得太多啦！'});
	}
	// 够不够庄家赔
	const bets = [0,0,0,0];
	bets[area] = betNum;
	if(room.isBeyondZhuangLimit(bets)) {
		return next(null, {code: 500, error: '再下注庄家就赔不起啦'});
	}

	//记录玩家自己这局押注
    room.addBet(uid,betNum);
	//扣除v点
	room.deductVipDot(model,betNum);
	next(null, ret);
	// 投注
	room.onBeting(player, betNum, area);
};

/**
 * 需押
 */
Handler.prototype.goonBet = function({roomId}, session, next) {
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
	// 需押总金币
	const betNum = player.lastBets.reduce((sum, value) => sum + value, 0);
	if(betNum === 0) {
		return next(null, {code: 200});
	}
	// 是不是超出10倍了
	const sumCount = player.bets.reduce((sum, value) => sum + value, 0) + betNum;
	if (sumCount*10 > goldToIntegral(isvip,player)) {
		return next(null, {code: 500, error: '下注金额的10倍需低于本金'});
	}
	// 押注上限
	if(sumCount > room.singleBetLimit) {
		// return next(null, {code: 500, error: '你押得太多啦！'});
	}
	// 够不够庄家赔
	if(room.isBeyondZhuangLimit(player.lastBets)) {
		return next(null, {code: 500, error: '再下注庄家就赔不起啦'});
	}

    //扣除v点
    room.deductVipDot(model,betNum);

	// 需押
	room.onGoonBet(player,(error)=>{
		if(error){
            return next(null, {code: 500, error: error});
		}
        next(null, {code: 200});
	});
};

/**
 * 申请玩家列表
 */
Handler.prototype.applyplayers = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	next(null, {code: 200, list: room.players.map(m => m.strip())});
};

/**
 * 申请上庄列表
 */
Handler.prototype.applyupzhuangs = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	next(null, {code: 200, list: []});
};

/**
 * 申请上庄
 */
Handler.prototype.applyUpzhuang = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 是否已经上庄了
	if(room.zhuangInfo.uid === player.uid) {
		return next(null, {code: 500, error: '已经是庄了'});
	}
	// 是否在列表中
	if(room.applyZhuangs.indexOf(player.uid) !== -1) {
		return next(null, {code: 500, error: '已经在队列中了'});
	}
	// 金币是否够
	if(goldToIntegral(isvip,player) < room.upZhuangCond) {
		return next(null, {code: 500, error: '需要'+utils.simplifyMoney(room.upZhuangCond)+'筹码才能上庄哦'});
	}
	// 放入队列
	room.applyUpzhuang(player.uid);
	next(null, {code: 200});
};

/**
 * 申请下庄
 */
Handler.prototype.applyXiazhuang = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 必须在结算的时候才可以下庄
	if(room.status !== 'INBIPAI') {
		return next(null, {code: 500, error: '当前不能下庄'});
	}
	// 申请下庄
	room.applyXiazhuang();
	next(null, {code: 200});
};

/**
 * 取消上庄队列
 */
Handler.prototype.exitUpzhuanglist = function({roomId}, session, next) {
    let isvip = session.get('VIP_ENV');
	const {err, room, player} = check(roomId, session.uid,isvip);
	if (err){
		return next(null, {code: 500, error: err});
	}
	// 是否在队列中
	if(room.applyZhuangs.indexOf(player.uid) === -1) {
		return next(null, {code: 500, error: '请先申请上庄'});
	}
	// 从队列中删除
	room.exitUpzhuanglist(player.uid);
	next(null, {code: 200});
};