'use strict';

const pomelo = require('pomelo');
const util = require('../utils');
const playerMgr = require('../domain/hall/player/PlayerMgr');

/**
 * 消息推送类
 */
exports.pushMessageByUids = function (route, msg, uids) {
	if(!Array.isArray(uids)){
		uids = [uids];
	}
	if(!uids || uids.length === 0){
		return;
	}
	uids = uids.filter(m => !!m);
	if(uids.length === 0){
		return;
	}
	pomelo.app.channelService.pushMessageByUids(route, msg, uids, errHandler);
};



exports.rpc = function () {
	return pomelo.app.rpc;
};

function errHandler(err, fails){
	if(!!err){
		console.error('Push Message error! %j', err.stack);
	}
	console.log('发送消息成功',fails)
}

exports.notice = ({route,nickname, game, VIP_ENV, uid, session, content, des = ''},cb) =>{
	if(route == 'onBigWin'){
		pomelo.app.rpc.hall.playerRemote.noticeuserInfo(session, uid, VIP_ENV, (err, userInfo) =>{
			if(err){
				console.error('大奖公告出错');
			}
			console.error('======userinfo====',userInfo)
			const content = '恭喜<color=#FDD105>' + decodeURI(game.nickname) + '</c>在<color=#FDD105>' + game.name + '</c>游戏 中得<color=#FDD105>' + (game.odd ? game.odd : '') + '</c>' + '倍, 共赢得<color=#FDD105>' + util.moneyToString(game.num) + '</c>' + game.moneyType;
			pomelo.app.channelService.pushMessageByUids('notice', {sponsor:'system',msg:content,type:'bigWin',uid: uid, gameNid:game.nid, des}, userInfo, errHandler);
		});
	}else if(route == 'system'){
		const userInfo = util.values(playerMgr.players()).map(player =>{
			return {uid: player.uid, sid: player.sid};
		});
		if(!util.isVoid(userInfo)){
			pomelo.app.channelService.pushMessageByUids('notice', {sponsor:'system',msg:content,type:'system',}, userInfo, (err, result) =>{
				if(!!err){
					cb(err)
					console.error('Push Message error! %j', err.stack);
				}
				cb(null);
			});
		}else{
			cb(null);
		}
	}else if(route == 'bigNotice'){
		const userInfo = util.values(playerMgr.players()).map(player =>{
			return {uid: player.uid, sid: player.sid};
		});
		if(!util.isVoid(userInfo)){
			pomelo.app.channelService.pushMessageByUids('notice', {sponsor:nickname,msg:content,type:'bigNotice',}, userInfo, (err, result) =>{
				if(!!err){
					cb(err)
					console.error('Push Message error! %j', err.stack);
				}
				cb(null);
			});
		}else{
			cb(null);
		}
	}else if(route == 'onJackpotWin'){
		pomelo.app.rpc.hall.playerRemote.noticeuserInfo(session, uid, VIP_ENV, (err, userInfo) =>{
			if(err){
				console.error('大奖公告出错');
			}
			const content = '恭喜<color=#FDD105>' + decodeURI(game.nickname) + '</c>在<color=#4FFF01>' + game.name + '</c>游戏 中' + game.jackpotType +'大奖<color=#FDD105>' + util.moneyToString(game.num) + '</c>' + game.moneyType;
			pomelo.app.channelService.pushMessageByUids('notice', {sponsor:'system',msg:content,type:'jackpotWin',uid:session.uid,jackpotType:game.jackpotType,gameNid:game.nid}, userInfo, errHandler);
		});
	}else if(route == 'contentWin'){
		pomelo.app.rpc.hall.playerRemote.noticeuserInfo(session, uid, VIP_ENV, (err, userInfo) =>{
			if(err){
				console.error('大奖公告出错');
			}
			console.error('======userinfo====',userInfo)
			pomelo.app.channelService.pushMessageByUids('notice', {sponsor:'system', msg:content, type:'bigWin', uid: uid, gameNid:game.nid, des}, userInfo, errHandler);
		});
	}
};



