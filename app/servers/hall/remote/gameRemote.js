'use strict';

const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');
const GamesMgr = require('../../../domain/ordinaryPlatform/GamesMgr');
const Games = require('../../../domain/ordinaryPlatform/Games');
const ordinaryPlatformMgr = require('../../../domain/ordinaryPlatform/ordinaryPlatformMgr');
const vipPlatform = require('../../../domain/vipPlatform/Platform');
const vipPlatformMgr = require('../../../domain/vipPlatform/PlatformMgr');

module.exports = function(app) {
	return new Remote(app);
};

var Remote = function(app) {
	this.app = app;
};

/**
 * 根据指定的nid从大厅服务器获取游戏信息
 */
Remote.prototype.getGameFromHall = ({nid, isVip, uid}, next) =>{
    if(nid == null){
        next({error: '请传入nid'});
    }
    const user = PlayerMgr.getPlayer(uid);
    if(!user){
        return next({error:'未找到玩家'});
    }
    let game;
    if(isVip){
        game = vipPlatformMgr.getGameByUid(user.viperId, nid);
    }else{
        game = GamesMgr.getGame(nid);
    }
    return next(null, game);
};

Remote.prototype.getGameFromHallniuniu = function ({nid, isVip, uid},next) {
    // console.log('niuniu房间信息',{nid, isVip, uid});
    if(nid == null){
        next({error: '请传入nid'});
    }
    let game;
    if(isVip){
        game = vipPlatformMgr.getGameByUid(uid, nid);
    }else{
        game = GamesMgr.getGame(nid);
    }
    return next(null, game);
}
/**
 * 从大厅服务器获取 游戏信息 (新方式)
 */
Remote.prototype.gameFromHall = ({nid, viper}, next) =>{
    if(nid == null){
        next({error: '请传入nid'});
    }
    let game;
    if(viper){
        game = vipPlatformMgr.getGameByUid(viper, nid);
    }else{
        game = GamesMgr.getGame(nid);
    }
    return next(null, game);
};

/**
 * 从大厅服务器获取所有游戏信息 (系统环境 和 所有vip环境)
 */
Remote.prototype.gamesFromHall = (next) =>{
    
    const games = {};
    const platforms = vipPlatformMgr.platforms(); //所有的平台
    for(let i in platforms){
        games[i] = platforms[i].games;
    }
    games['system'] = GamesMgr.Games();
    return next(null, games);
};

/**
 * 更新指定游戏的指定房间信息
 */
Remote.prototype.updateGameRoom = ({nid, roomCode, isVip, uid}, roomInfo, next) =>{
    let game;
    const user = PlayerMgr.getPlayer(uid);
    if(!user){
        return next({error:'未找到玩家'});
    }
    if(isVip){
        game = vipPlatformMgr.getGameByUid(user.viperId, nid);
    }else{
        game = GamesMgr.getGame(nid);
    }
    //返回的是更新后的room信息
    const room = game.updateRoom({roomCode}, roomInfo);
    return next(null, room);
};

/**
 * 更新指定游戏的指定房间信息 (新方式)
 */
Remote.prototype.udtGameRoom = ({nid, roomCode, viper, changeMoney}, roomInfo, next) =>{
    let game;
    if(viper){
        game = vipPlatformMgr.getGameByUid(viper, nid);
    }else{
        game = GamesMgr.getGame(nid);
    }
    //返回的是更新后的room信息
    const room = game.updateRoom({changeMoney, roomCode}, roomInfo);
    return next(null, room);
}

Remote.prototype.udtGame = ({nid, viper}, gInfo, next) =>{
    let game;
    if(viper){
        game = vipPlatformMgr.getGameByUid(viper, nid);
    }else{
        game = GamesMgr.getGame(nid);
    }
    const udtGame = game.updateGame(gInfo);
    return next(null, udtGame);
}

//niuniu更新游戏房间信息
Remote.prototype.niuniuUpdateGameRoom = function ({nid,roomCode,isVip,uid},roomInfo,next) {
    let game;

    if(isVip){
        game = vipPlatformMgr.getGameByUid(uid, nid);
    }else{
        game = GamesMgr.getGame(nid);
    }
    const room = game.updateRoom({roomCode}, roomInfo);
    // console.log('nid',nid,'roomCode',roomCode,'isVip',isVip,'uid',uid,roomInfo,room.jackpot);
    return next(null);
}

/**
 * 掉线离开
 */
Remote.prototype.offlineLeave = function({uid, nid, roomCode, isVip, viper}, next){
    const user = PlayerMgr.getPlayer(uid);
    if(!user){
        return next({error:'未找到玩家'});
    }
    if(isVip){
        const platform = vipPlatformMgr.getPlatform(user.viperId);
        const userIndex = platform.envMembers.findIndex(user => user.uid == uid);
        platform.envMembers.splice(userIndex, 1);
        nid != null && !user.vip && platform.removeGameMember(nid, uid);
    }else{
        ordinaryPlatformMgr.removePlayer(uid);
    }
    if(nid == null){
        return next(null);
    }else{
        let game, viperUid;
        if(isVip){
            game = vipPlatformMgr.getGameByUid(user.viperId, nid);
            viperUid = user.viperId;
        }else{
            game = GamesMgr.getGame(nid);
        }
        if(roomCode == null){
            const userGameIndex = game.users.findIndex(user => user.uid == uid);
            if(userGameIndex != -1){
                game.users.splice(userGameIndex, 1);
            }
            return next(null);
        }else{
            user.leaveRoomTime = Date.now();

            //生成积分记录
            const addRecord = function () {
                const integralModel = require('../../../utils/db/mongodb').getDao('integral_record');
                integralModel.create({
                    viperUid: viperUid,
                    uid: uid,
                    nickname: user.nickname,
                    duration: user.leaveRoomTime - user.enterRoomTime,
                    createTime: user.leaveRoomTime,
                    integral: user.roomProfit,
                    gname: game.zname,
                    settleStatus: false
                }, function(err, data){
                    if(err || !data){
                        console.error('生成积分记录失败');
                    }
                    user.roomProfit = 0;
                });
            }
            const room = game.findRoom(roomCode);
            const userRoomIndex = room.users.findIndex(user => user.uid == uid);
            if(userRoomIndex != -1){
                room.users.splice(userRoomIndex, 1);
            }
            const userGameIndex = game.users.findIndex(user => user.uid == uid);
            if(userGameIndex != -1){
                game.users.splice(userGameIndex, 1);
            }

            switch (game.nid){
                case '1': case '2': case '7':
                    this.app.rpc.games.gameRemote.slotsOfflineMail(null, {isVip, uid, roomCode, viper, nid: game.nid}, function(err){
                        if(err){
                            return next({error: err});
                        }
                        if(isVip){
                            addRecord();
                        }
                        console.log(`${game.nid} 中掉线离开`);
                        return next(null);
                    });
                    break;
                case '4':
                    this.app.rpc.games.gameRemote.getUserProfit(null, {isVip, uid, roomCode, viper, offLine: true}, function(err, profit){
                        if(err){
                            return next({error: err});
                        }
                        if(isVip){
                            addRecord();
                        }
                        if(profit == null){
                            return next(null);
                        }
                        const moneyType = isVip ? 'integral' : 'gold';
                        user[moneyType] += profit;
                        return next(null);
                    });
                    break;
                case '12':
                    this.app.rpc.pharaoh.mainRemote.getUserProfit(null, {isVip, uid, roomCode, viper, offLine: true}, function(err, profit){
                        if(err){
                            return next({error: err});
                        }
                        if(isVip){
                            addRecord();
                        }
                        if(profit == null){
                            return next(null);
                        }
                        const moneyType = isVip ? 'integral' : 'gold';
                        user[moneyType] += profit;
                        return next(null);
                    });
                    break;
                case '3':
                    this.app.rpc.huoguo.mainRemote.kickUserFromChannel(null, {roomCode, uid, isVip, viper}, function(data){
                        return next(null);
                    });
                    break;
                case '8':
                    this.app.rpc.games.baijiaRemote.leave(null,uid,game.nid,isVip,roomCode,(err)=>{
                        console.log(err);
                        return next(null);
                    });
                    break;
                case '9':
                    this.app.rpc.games.bairenRemote.leave(null, uid, game.nid,isVip,roomCode,(err) => {
                        console.log(err);
                        console.log(`${game.nid} 中掉线离开`);
                        return next(null);
                    });
                    break;
                case '11':
                    this.app.rpc.games.attRemote.leave(null, uid, game.nid,isVip,(err) => {
                        console.log(err);
                        console.log(`${game.nid} 中掉线离开`);
                        return next(null);
                    });
                    break;
                case '15':
                    this.app.rpc.games.bipaiRemote.leave(null,uid,game.nid,isVip,(err)=>{
                        console.log(err);
                        return next(null);
                    });
                    break;
                case '17':
                    this.app.rpc.games.dotRemote.leave(null,uid,game.nid,isVip,(err)=>{
                        console.log(err);
                        return next(null);
                    });
                    break;
                case '10':
                    this.app.rpc.games.pirateRemote.leave(null,uid,isVip,(err)=>{
                        if(isVip){
                            addRecord();
                        }
                        console.log(err);
                        return next(null);
                    });
                    break;
                default:
                    if(isVip){
                        addRecord();
                    }
                    console.log(`${game.nid} 中掉线离开`);
                    return next(null);
            }
        }
    }
};

/**
 * 清除房间的定时器
 */
Remote.prototype.removeRoomSchedule = function({env, nid, roomCode}, callback){
    const key = `${env}${nid}${roomCode}`;
    require('../../../domain/hall/jackpotShow/jackpotMgr').removeSchedule(key);
    return callback();
};
