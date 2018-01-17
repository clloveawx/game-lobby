'use strict';
const Mails  = require('../domain/hall/mail/mail');
const PlayerMgr = require('../domain/hall/player/PlayerMgr');
const db = require('../utils/db/mongodb');
const util = require('../utils');
const msgService = require('./MessageService');
const pomelo = require('pomelo');

/**
 * 系统生成邮件
 * @param {img,name,reason,content,attachment}-邮件信息 {receiverUids}-接收者uid数组
 */
exports.generatorMail = (opts, receiverUids, cb) => {
	let uids = typeof(receiverUids) === 'string' ? [receiverUids] : receiverUids;
	const mails = [];
	const  msgUserIds = [];
	uids.forEach(uid =>{
		opts.id = util.id();
		const newMail = Mails(opts, uid);
		const ss = PlayerMgr.getPlayer(uid);
		if(ss){
			msgUserIds.push(ss.uids());	
		}
		mails.push(newMail);
	});
	const mailModel = db.getDao('mails');
	mailModel.collection.insert(mails, function(err,mailDatas){
		if(err){
			console.error('批量创建邮件失败');
			return cb(err);
		}
		msgUserIds.forEach(m=>{
			 const temp = mailDatas.ops.find(x=>x.receiverId = m.uid);
			msgService.pushMessageByUids('informMail', { //有邮件的时候通知玩家
	          	 mailDatas:temp,
	    	}, m);
		});
		cb(null, mailDatas);
	});
};

/**
 * 请求玩家的所有邮件
 */
exports.userMails = (uid, cb) =>{
	const mailModel = db.getDao('mails');
	mailModel.find({receiverId: uid}).exec(function(err,mailDocs){
		if(err){
			console.error(err);
			return cb(err);
		}
		const sortMails = util.sortWith([
			(m1, m2) => m1.isRead - m2.isRead,
			//(m1, m2) => !util.isVoid(m2.attachment) - !util.isVoid(m1.attachment),
			(m1, m2) => m2.time - m1.time, 
		])(mailDocs);
		const results = sortMails.reduce((result, mail) =>{
			const m = JSON.parse(JSON.stringify(mail));
			// m.countDown = util.timeInterval(mail.time, false);
			// m.deleteCountDown = util.timeInterval(mail.time + 1000 * 60 * 60 * 24 * 3);
			m.countDown = Date.now() - mail.time;
			m.deleteCountDown = (mail.time + 1000 * 60 * 60 * 24 * 3 - Date.now()) > 0 ? (mail.time + 1000 * 60 * 60 * 24 * 3 - Date.now()) : 0;
			result.push(m);
			return result;
		}, []);
		return cb(null, results);
	});
};

/**
 * 玩家打开指定邮件
 */
exports.openMail = (_id, cb) =>{
	const mailModel = db.getDao('mails');
	mailModel.findByIdAndUpdate(_id,{$set:{isRead: true}}, {new: true},function(err, doc){
		if(err || !doc){
			console.error('未找到指定邮件');
			return cb(err);
		}
		let haveGift = false
		if(!util.isVoid(doc.attachment)){
			haveGift = true;
		}
		return cb(null, {doc, haveGift});
	});
};

/**
 * 玩家删除指定的邮件
 */
exports.removeMail = (_id, cb) =>{
	const mailModel = db.getDao('mails');
	mailModel.findOneAndUpdate({_id, isdelete: false},{$set:{isRead: true, isdelete:true}}, {new: true}, function(err, mailDoc){
		if(err){
			console.error('删除指定邮件失败 1');
			return cb(err);
		}
		if(!mailDoc){
			return cb('该邮件不存在或已被删除');
		}
		if(util.isVoid(mailDoc.attachment)){  // 没有附件的情况
			// mailDoc.remove(function(err){
			// 	if(err){
			// 		console.error('删除指定邮件失败 2');
			// 		return cb(err);
			// 	}
				return cb('该邮件没有可领取的附件');
			// });
		}else{
			const gift = mailDoc.attachment;
			// mailDoc.remove(function(err){
			// 	if(err){
			// 		console.error('删除指定邮件失败 3');
			// 		return cb(err);
			// 	}
				return cb(null, gift);
			// });
		}
	})
}

/**
 * 玩家删除所有的邮件
 */
exports.removeAllMails = (uid, cb) =>{
	const mailModel = db.getDao('mails');
	const gifts  = [];
	mailModel.find({receiverId: uid, isdelete: false, attachment: {'$ne': null}}, function(err, mails){
		if(err || util.isVoid(mails)){
			console.error('一键领取并删除邮件失败 1');
			return cb(err || '暂无带附件的邮件');
		}
		// if(err){
		// 	console.error('一键领取并删除邮件失败 1');
		// 	return cb(err);
		// }
		const promises = [];
		const removeOne = function(mail){
			if(!util.isVoid(mail.attachment)){
				gifts.push(mail.attachment);
			}
			mail.isdelete = true;
			return mail.save();
		};
		for(let i = 0; i < mails.length; i++){
			promises.push(removeOne(mails[i]));
		}

		Promise.all(promises).then(function(){
			exports.userMails(uid, function(err, docs){
				if(err){
					return cb(err);
				}else{
					return cb(null, gifts, docs);
				}
			});
		})
		.catch(error => {
			console.error('一键领取并删除邮件失败 2:', error.message);
			return cb(error);
		})
	})
};

/**
 * 后台管理系统请求所有的邮件
 */
exports.allMails = ({page}, cb) =>{
	const mailModel = db.getDao('mails');
	let start = 0, count = 20;

	if(page){
		start = 20 * (page - 1);
	}
	mailModel.find({}).sort('-time').skip(start).limit(count).exec(function(err,mailDocs){
		if(err){
			console.error(err);
			return cb(err);
		}
		mailModel.count({}, function(err, num){
			return cb(null, {mails: mailDocs, len: num});
		})
	});
};