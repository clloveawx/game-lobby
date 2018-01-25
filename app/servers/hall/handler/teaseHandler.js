'use strict';

const db = require('../../../utils/db/mongodb');
const gutil = require('../../../domain/games/util');
const utils = require('../../../utils');
const playerMgr = require('../../../utils/db/dbMgr/playerMgr');
const msgService = require('../../../services/MessageService');

module.exports = function(app) {
	return new teaseHandler(app);
};

var teaseHandler = function(app) {
	this.app = app;
};

/**
 * modified by CL
 * 吐槽
 * @route：hall.teaseHandler.tease
 */
teaseHandler.prototype.tease = function({message}, session, next) {
    
  const {uid, nid, roomCode, viper, isVip} = gutil.sessionInfo(session);
	playerMgr.getPlayer({uid}, function(err, player) {
		if (err) {
			return next(null, err);
		}
		if (!player) {
			return next(null, {code: 500, error: '未找到玩家 tease'});
		}
    gutil.getRoomByEnv({viper, nid, roomCode}).then(room =>{
	    if(!room){
		    return next(null, {code: 500, error: `未找到遊戲房間`});
	    }
	    //通知房间所有人吐槽
	    msgService.pushMessageByUids('onTease', {
		    message,
		    nickname: player.nickname
	    }, room.users);
	    
	    const moneyType = isVip ? 'integral' : 'gold';
	    return next(null, {code: 200, [moneyType]: util.sum(player[moneyType])});
    });
	});
};

/**
 * modified by CL
 * 系統公告
 * @route：hall.teaseHandler.systemNotice
 */
teaseHandler.prototype.systemNotice = function({content}, session, next) {
  
  const uid = session.uid;
	playerMgr.getPlayer({uid}, function(err, player) {
		if (err) {
			return next(null, err);
		}
		if (!player) {
			return next(null, {code: 500, error: '未找到玩家 systemNotice'});
		}
		if(utils.sum(player.gold) < 200){
			return next(null, {code: 500, error: '金币不足,不能发送大喇叭！'});
		}
		player.gold = gutil.funningMoneyDeduct({isVip: false, num: 200, gold: player.gold});
		
		msgService.notice({route: 'bigNotice', nickname: player.nickname, content }, (err) => {
			if(err ) {
				console.error('发送系统公告出错', err);
				return next(null, {code: 500, error: '发送失败'});
			}
			
			const bigPostModel = db.getDao('big_post_notice');
			bigPostModel.add(function(){}, {
				nickname: player.nickname,
				content,
				uid,
				time: Date.now(),
      });
			
			playerMgr.updatePlayer(player, function(err){
				if(err){
					console.error(`保存玩家${uid}的修改失败: systemNotice`, err);
				}
			});
      return next(null, {code: 200, gold: player.gold});
		})
	});
};

/**
 * modified by CL
 * 获取最新的100条大喇叭
 * @route：hall.teaseHandler.getBigPostNotice
 */
teaseHandler.prototype.getBigPostNotice = function({}, session, next) {
	const bigPostModel = db.getDao('big_post_notice');
	
	bigPostModel.find({}).sort('-time').limit(100).exec(function(err, datas){
    if(err){
        return next(null, {code: 500, error: '获取大喇叭失败'});
    }
		return next(null, {code: 200, result: datas || []});
  })
};