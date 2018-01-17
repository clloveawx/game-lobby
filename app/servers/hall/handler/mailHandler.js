'use strict';

const MailService = require('../../../services/MailService');
const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');
const util = require('../../../utils');

module.exports = function (app) {
	return new Handler(app);
};

function Handler(app) {
	this.app = app;
}

/**
 * 系统生成邮件
 * @param {img,name,reason,content,attachment}-邮件信息 {receiverUids}-接收者uid数组
 */
Handler.prototype.generatorMail = ({opts, receiverUids}, session, next) => {
    MailService.generatorMail(opts, receiverUids, function(err, mailDocs){
		if(err){
			return next(null, {code: 500, error: '系统生成邮件'});
		}
		return next(null, {code: 200, mailDocs});
	});
};

/**
 * 玩家请求所有邮件
 */
Handler.prototype.userMailBox = ({}, session, next) =>{
	const uid = session.uid;
	MailService.userMails(uid, function(err, userMails){
		if(err){
			return next(null, {code: 500, error: '请求邮件失败'});
		}
		return next(null, {code: 200, userMails});
	})
};

/**
 * 玩家打开指定的邮件
 */
Handler.prototype.openMail = ({_id}, session, next) =>{
	if(!_id){
		return next(null, {code: 500, error: '请传入 _id'});
	}
	MailService.openMail(_id, function(err, mail){
		if(err){
			return next(null, {code: 500, error: '打开邮件失败'}); 
		}
		return next(null, {code: 200, mail});
	})
};

/**
 * 玩家删除指定邮件 (即领取-标记isdelete为true)
 */
Handler.prototype.removeMail = ({_id}, session, next) =>{
	if(!_id){
		return next(null, {code: 500, error: '请传入 _id'});
	}
	MailService.removeMail(_id, function(err, gift){
		if(err){
			return next(null, {code: 500, error: '玩家删除指定邮件' + err}); 
		}
		if(gift == null){
			return next(null, {code: 200});
		}else{
			const player = PlayerMgr.getPlayer(session.uid);
			Object.keys(gift).forEach(type =>{
				if(['gold', 'props'].includes(type)){
					player[type] += gift[type];
				}
			});
			return next(null, {code: 200, gold:player.gold, props:player.props});
		}
	})
};

/**
 * 玩家删除所有的邮件
 */
Handler.prototype.removeAllMails = ({}, session, next) =>{
	const uid = session.uid;
	MailService.removeAllMails(uid, function(err, gifts, userMails){
		if(err){
			return next(null, {code: 500, error: err});
		}
		const player = PlayerMgr.getPlayer(session.uid);
		if(gifts.length > 0){
			gifts.forEach(gift =>{
				Object.keys(gift).forEach(type =>{
					if(['gold', 'props'].includes(type)){
						player[type] += gift[type];
					}
				});
			});
		}
		return next(null, {code: 200, gold: player.gold, props: player.props, userMails});
	})
};