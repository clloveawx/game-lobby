'use strict';

const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');
const Games = require('../../../domain/ordinaryPlatform/Games');
const GamesMgr = require('../../../domain/ordinaryPlatform/GamesMgr');
const vipPlatform = require('../../../domain/vipPlatform/Platform');
const vipPlatformMgr = require('../../../domain/vipPlatform/PlatformMgr');
const msgService = require('../../../services/MessageService');
const sessionService = require('../../../services/sessionService');
const db = require('../../../utils/db/mongodb');
const utils = require('../../../utils');

module.exports = function(app) {
	return new teaseHandler(app);
};

var teaseHandler = function(app) {
	this.app = app;
};

/**
 * 吐槽
 * @route：hall.teaseHandler.tease
 */
teaseHandler.prototype.tease = function(msg, session, next) {
    const uid = session.uid;
    const player = PlayerMgr.getPlayer(uid);
    const nid = session.get('game');
    const roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const user = PlayerMgr.getPlayer(uid);
    if(!user){
        return next({error:'未找到玩家'});
    }
    let game;
    if(isVip){
        game = vipPlatformMgr.getGameByUid(viper, nid);
    }else{
        game = GamesMgr.getGame(nid);
        // if(player.gold < 200){
        // 	return next(null, {code:500,error :'你的金币不足，发送不了吐槽！'});
        // }
        // player.gold -=200;
    }
    if(!game){
        return next(null, {code: 500, error:'获取游戏信息失败'})
    }
    if(session.get('game') != game.nid){
        return next(null, {code: 500, error:'玩家已进入其他游戏'});
    }
    // 获取游戏中的房间
    const room = game.rooms.find(room => room.roomCode == roomCode);
    if(!room){
        return next(null, {code: 500, error:'机器未找到'});
    }
    const users= room.users;
    const msgUserIds = users.map(user =>{
        return   {uid:user.uid,sid:user.sid}
    });
    msgService.pushMessageByUids('onTease', { //通知房间所有人吐槽
         message:msg.message,
         nickname: player.nickname
    }, msgUserIds);
    
 	if(isVip){
 		 return next(null, {code:200,diamond:player.diamond});
 	}else{
 		 return next(null, {code:200,gold:player.gold});	
 	} 	
};


teaseHandler.prototype.systemNotice = function({content}, session, next) {
    const route = 'bigNotice';
    const bigPostNotice = db.getDao('big_post_notice');
    const user = PlayerMgr.getPlayer(session.uid); 
    if(user.gold < 200){
        return next(null, {code: 500,error:'金币不足,不能发送金币！'});
    }
    user.gold -= 200;
    const nickname = user.nickname;
	msgService.notice({route,nickname,content}, (err) =>{
        if(err != null){
            console.error('发送系统公告出错');
            return next(null, {code: 500,error:'发送失败'});
        }
    const info ={
        id : utils.id(),
        nickname : user.nickname,
        content :content,
        uid : session.uid,
        time :Date.now(),
    }
    bigPostNotice.create(info,function(err,res){
        if(err){
            console.error('大喇叭保存失败');
        }
    });
        return next(null, {code: 200,gold:user.gold});
    })
};


teaseHandler.prototype.getBigPostNotice = function(msg, session, next) {
    const bigPostNotice = db.getDao('big_post_notice');

    bigPostNotice.find({}).sort('-time').limit(100).exec(function(err, datas){
        if(datas){
            return next(null, {code: 200,result:datas});
        }else{
            return next(null, {code: 500,error:'网络繁忙！'});   
        }
    })
    
};
