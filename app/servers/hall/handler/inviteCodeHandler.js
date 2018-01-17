'use strict';

const InviteCodeMgr = require('../../../domain/hall/inviteCode/inviteCodeMgr');
const PlayerMgr = require('../../../utils/db/dbMgr/playerMgr');
const db = require('../../../utils/db/mongodb');

module.exports = function(app) {
	return new inviteCodeHandler(app);
};

const inviteCodeHandler = function(app) {
	this.app = app;
};

const Handler = inviteCodeHandler.prototype;

/**
 * 刷新获取邀请码
 * @param: {}
 * @return: {inviteCode}，邀请码
 * @route: hall.inviteCodeHandler.refreshInviteCode
 * */
Handler.refreshInviteCode = ({}, session, next) => {
	const uid = session.uid;
	if (!uid) {
		return next(null, {code: 500, error: "refreshInviteCode: 未获取到uid"});
	}
	InviteCodeMgr.refreshInviteCodeInternal(uid, (error, inviteCode) => {
		if (error) {
			return next(null, {code: 500, error: error.message});
		}
		return next(null, {code: 200, inviteCode});
	});
};

/**
 * 普通玩家查看邀请码
 * @route: hall.inviteCodeHandler.commonPlayerInviteCode
 */
Handler.commonPlayerInviteCode = ({}, session, next) =>{
	const uid = session.uid;
	if (!uid) {
		return next(null, {code: 500, error: "commonPlayerInviteCode: 未获取到uid"});
	}
	const viper = session.get('viper');
	if(!viper){
		return next(null, {code: 500, error: '玩家未在vip平台'});
	}
	InviteCodeMgr.commonPlayerInviteCode({uid}, (error, result) => {
		if (error) {
			return next(null, {code: 500, error: error.message});
		}
		return next(null, {code: 200, result});
	});
};

/**
 * 普通玩家查看邀请码(网吧版)
 * @route: hall.inviteCodeHandler.internetPlayerInviteCode
 */
Handler.internetPlayerInviteCode = ({}, session, next) =>{
	const uid = session.uid;
	if (!uid) {
		return next(null, {code: 500, error: "internetPlayerInviteCode: 未获取到uid"});
	}
	InviteCodeMgr.internetPlayerInviteCode({uid}, (error, result) => {
		if (error) {
			return next(null, {code: 500, error: error.message});
		}
		return next(null, {code: 200, result});
	});
};

/**
 * 配置邀请码
 * @param: {inviteCode, integral, rebate, boundUid}，邀请码、积分、返奖率、绑定uid
 * @return: {}
 * @route: hall.inviteCodeHandler.configureInviteCode
 * */
Handler.configureInviteCode = ({inviteCode, integral, rebate, boundUid, effectiveTimes}, session, next) => {
	const uid = session.uid;
	if (!uid) {
		return next(null, {code: 500, error: "configureInviteCode: 未获取到uid"});
	}
	if (!inviteCode) {
		return next(null, {code: 500, error: "邀请码参数错误"});
	}
	
	if (typeof Number(integral) !== "number" || Number(integral) < 0 ) {
		return next(null, {code: 500, error: "积分参数错误"});
	}
	
	InviteCodeMgr.configureInviteCodeInternal(uid, inviteCode, integral, rebate, boundUid, false, effectiveTimes, (error) => {
		if (error) {
			return next(null, {code: 500, error: error.message});
		}
		return next(null, {code: 200});
	});
};

/**
 * 打开邀请码库
 * @param: {}
 * @return: {inviteCodesInfo: []}
 * @route: hall.inviteCodeHandler.listInviteCodes
 * */
Handler.listInviteCodes = ({}, session, next) => {
	const uid = session.uid;
	if (!uid) {
		return next(null, {code: 500, error: "listInviteCodes: 未获取到uid"});
	}
	InviteCodeMgr.listInviteCodesInternal(uid, (error, inviteCodesInfo) => {
		if (error) {
			return next(null, {code: 500, error: error.message});
		}
		return next(null, {code: 200, inviteCodesInfo});
	});
};

/**
 * 点击查看，查看邀请码
 * @param: {inviteCode}
 * @return: {codePlayers: []}
 * @route: hall.inviteCodeHandler.viewInviteCode
 * */
Handler.viewInviteCode = ({inviteCode}, session, next) => {
	const uid = session.uid;
	if (!uid) {
		return next(null, {code: 500, error: "manageInviteCode: 未获取到uid"});
	}
	if (!inviteCode) {
		return next(null, {code: 500, error: "邀请码参数错误"});
	}
	InviteCodeMgr.viewInviteCodeInternal(inviteCode, (error, codePlayers) => {
		if (error) {
			return next(null, {code: 500, error: error.message});
		}
		return next(null, {code: 200, codePlayers});
	});
};

/**
 * modified by CL
 * VIP获取该VIP下面的玩家列表
 * @param: {inviteCode}
 * @return: {codePlayers: []}
 * @route: hall.inviteCodeHandler.viewInviteCode
 * */
Handler.getVipAllPlayers = ({}, session, next) => {
	const uid = session.uid;
	if(!uid) {
		return next(null, {code: 500, error: "getVipAllPlayers: 未获取到uid"});
	}
	
	playerMgr.getPlayer({uid}, function(err, player) {
		if(err) {
			return next(null, err);
		}
		if(!player) {
			return next(null, {code: 500, error: `玩家不存在: ${uid}`});
		}
		if(!player.vip){
			return next(null, {code: 500, error: `玩家不是vip: ${uid}`});
    }
    const inviteCodeModel = db.getDao('invite_code_info');
		inviteCodeModel.load(function(err, codeInfos){
		  if(err){
		    return next(null, err);
      }
      let codesInviteRecoeds = [];
      codeInfos.forEach(codeInfo =>{
        codesInviteRecoeds = codesInviteRecoeds.concat(codeInfo.inviteRecords);
      });
		  const playerModel = db.getDao('player_info');
		  playerModel.load(function(err, players){
		    const result = players.map(player =>{
		      return {
		        uid: player.uid,
            nickname: player._uid.nickname,
			      integral: player.integral,
			      inviteCode: player.inviteCode,
          }
        }).reverse();
		    return next(null, {code: 200, result});
      }, {
		    uid: {$in: codesInviteRecoeds},
      }, {
		    'uid': 1,
        'inviteCode': 1,
        'integral': 1,
        '_uid': 1,
      });
    }, {
		  uid: player.viperId,
    });
	});
};    

