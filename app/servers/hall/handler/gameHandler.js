'use strict';

const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');
const Games = require('../../../domain/ordinaryPlatform/Games');
const GamesMgr = require('../../../domain/ordinaryPlatform/GamesMgr');
const vipPlatform = require('../../../domain/vipPlatform/Platform');
const vipPlatformMgr = require('../../../domain/vipPlatform/PlatformMgr');
const msgService = require('../../../services/MessageService');
const sessionService = require('../../../services/sessionService');
const util = require('../../../utils');
const db = require('../../../utils/db/mongodb');
const pomelo = require('pomelo');

module.exports = function(app) {
    return new gameHandler(app);
};

var gameHandler = function(app) {
    this.app = app;
};

/**
 * 进入房间
 * @route：hall.gameHandler.enterRoom
 */
gameHandler.prototype.enterRoom = function({roomCode}, session, next) {
    if(roomCode == null){
        return next(null, {code: 500, error: '缺少参数  hall.gameHandler.enterRoom'});
    }
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const uid = session.uid;
    const nid = session.get('game');
    const env = viper == null ? 'system' : viper;
    const user = PlayerMgr.getPlayer(uid);
    if(!user){
        return next(null, {code: 500, error:'未找到玩家'});
    }
    if(user.vip && isVip){
        return next(null, {code: 500, error: 'vip玩家不能进入机器!'})        
    }
    let game;
    if(isVip){
        game = vipPlatformMgr.getGameByUid(viper, nid);
    }else{
        game = GamesMgr.getGame(nid);
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
    if(room.users.find(user => user.uid == uid)){
        return next(null, {code:500, error:'玩家已在游戏中'});
    }
    if(room.users.length == game.roomUserLimit){
        return next(null, {code: 500, error:'该机器无法容纳更多玩家'});
    }

    // 进入游戏房间的条件判断
    let minBet = 0, maxBet;
    if(['1'].includes(nid)){
        const avgAward = room.users.length === 0 ? 0 : room.matchDot / 0.1 / room.users.length;
        const avgBet = avgAward / (600 / 10) / 0.71;
        if(user[isVip ? 'integral' : 'gold'] >= avgBet * 5){
            if(room.users.length === 0 && room.socialRound == null){
                require('../../../services/socialService')(room);
            }
            minBet = avgBet / 250 > 250000 ? 250000 : avgBet / 250;
        }else{
            return next(null, {code: 500, error: `进入该房间需要金额为${Math.ceil(avgBet * 5)}`});
        }

        //处理游戏最大押注解锁
        const moneyType = viper == null ? 'gold' : 'integral';
        if(user.unlock[nid] == null){
            user.unlock[nid] = {};
        }
        if(user.unlock[nid][env] == null){
            user.unlock[nid][env] = 0;
        }
        if(user[moneyType] * 0.1 >= user.unlock[nid][env] * 25){
            user.unlock[nid][env] = Math.floor(user[moneyType] * 0.1 * 0.04);
            if(user.unlock[nid][env] > 10000){
                user.unlock[nid][env] = 10000;
            }
        }
        maxBet = user.unlock[nid][env];
    }

    if(nid == '3'){
        //对于火锅游戏,如果该房间没有开始回合，则开启回合
        let _app=this.app;
        this.app.rpc.huoguo.mainRemote.findRound(session, isVip, session.get('viper'), roomCode, session.frontendId, uid, room, (doc) =>{
            if(room.users.filter(u=>!u.uid.startsWith("ai")).length <= 1 && room.socialRound == null){//room.users.length === 0 &&
                require('../../../domain/games/hotpot/socialRound.js')(room,null,_app);
                //this.app.rpc.huoguo.mainRemote.startSocialRound(null,room,function(){});
            }
            if(doc && doc.aiLeave){
                const userIndex = room.users.findIndex(user => user.uid == doc.uid);
                room.users.splice(userIndex, 1);
                const roomUids = [];
                const users= room.users;
                game.rooms.forEach(room => roomUids.concat(room.users.map(user =>user.uid)));
                const msgUserIds = game.users.map(user => {
                    return {uid:user.uid,sid:user.sid}
                }).filter(obj => !roomUids.includes(obj.uid));
                msgService.pushMessageByUids('changeRoomInfo', { //通知前端有人退出机器
                    users,
                    nid,
                    roomCode,
                }, msgUserIds);
            }
        });
    }
    if(nid == '1'){
        room.users.forEach(u =>{
            u.slotsGameEarnings = PlayerMgr.getPlayer(u.uid).slotsGameEarnings;
        })
    }
    if(nid == '3'){
        room.users.forEach(u =>{
            if(!u.uid.startsWith("ai")){
                u.hotpotGameEarnings = PlayerMgr.getPlayer(u.uid).hotpotGameEarnings;
            }else{
                this.app.rpc.huoguo.mainRemote.getRobotById(null,u.uid,function(data){
                    if(data.code===200){
                        u.hotpotGameEarnings=data.result.hotpotGameEarnings;
                    }else{
                        console.log("火锅获取机器人失败",data.msg);
                    }
                });
            }
        })
    }

    //进入移植游戏
    switch (nid){
        case '8':
            this.app.rpc.games.baijiaRemote.entry(null,user.wrapGameData(),nid,roomCode,isVip,viper,(err)=>{
                console.log(err);
            });
            break;
        case '9':
            this.app.rpc.games.bairenRemote.entry(null,user.wrapGameData(),nid,roomCode,isVip,viper,(err)=>{
                console.log(err);
            });
            break;
        case '11':
            this.app.rpc.games.attRemote.entry(null,user.wrapGameData(),nid,roomCode,isVip,viper,uid,(err)=>{
                console.log(err);
            });
            break;
        case '15':
            this.app.rpc.games.bipaiRemote.entry(null,user.wrapGameData(),nid,roomCode,isVip,viper,(err)=>{
                console.log(err);
            });
            break;
        case '17':
            this.app.rpc.games.dotRemote.entry(null,user.wrapGameData(),nid,roomCode,isVip,viper,(err)=>{
                console.log(err);
            });
            break;
    }

    user.enterRoomTime = Date.now();
    room.users.push(user.roomuser());
    sessionService.sessionSet(session, {'roomCode': roomCode});

    const roomUids = [];
    const users= room.users;
    game.rooms.forEach(room => roomUids.concat(room.users.map(user =>user.uid)));

    const msgUserIds = game.users.map(user => {
        return {uid:user.uid,sid:user.sid}
    }).filter(obj => !roomUids.includes(obj.uid));
    msgService.pushMessageByUids('changeRoomInfo', { //通知前端有人进入机器
        users,
        nid,
        roomCode,
    }, msgUserIds);
    
    let envLGC = user.lastGameContents[env];	

    if(envLGC.nid != nid){
		envLGC.nid = nid;
	}
    envLGC.room[nid] = roomCode;

    return next(null, {code:200, user: user.strip(), roomCode, users: room.users, minBet, maxBet, socialDot: room.socialDot});
};

/**
 * 快速进入房间
 * @route: hall.gameHandler.enterRoomQuickly
 */
gameHandler.prototype.enterRoomQuickly = ({}, session, next) =>{
    const uid = session.uid;
    const nid = session.get('game');
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const user = PlayerMgr.getPlayer(uid);
    const env = viper == null ? 'system' : viper;
    if(!user){
        return next(null, {code: 500, error:'未找到玩家'});
    }
    if(user.vip && isVip){
        return next(null, {code: 500, error: 'vip玩家不能进入机器!'})        
    }
    let game;
    if(isVip){
        game = vipPlatformMgr.getGameByUid(viper, nid);
        user.enterRoomTime = Date.now();
    }else{
        game = GamesMgr.getGame(nid);
    }
    if(!game){
        return next(null, {code: 500, error:'获取游戏信息失败'})
    }
 
    const canUseRooms = util.clone(game.rooms).filter(room => room.users.length < game.roomUserLimit);
    const selectRoom = util.sortWith([
        (r1, r2) => r1.users.length - r2.users.length,
        (r1, r2) => r2.jackpot - r1.jackpot,
        (r1, r2) => Number(r1.roomCode) - Number(r2.roomCode)
    ])(game.rooms.filter(room => {
        if(['1'].includes(nid)){
            const avgAward = room.users.length === 0 ? 0 : room.matchDot / 0.1 / room.users.length;
            const avgBet = avgAward / (600 / 10) / 0.71;
            return (room.users.length < game.roomUserLimit) && (user[isVip ? 'integral' : 'gold'] >= avgBet * 5);
        }else{
            return room.users.length < game.roomUserLimit
        }    
    }))[0];

    if(selectRoom == null){
        if(canUseRooms.length == 0){
            return next(null, {code: 500, error: '没有空位机'});
        }else{
            return next(null, {code: 500, error: '金额不足'});
        }
    }
    const room = game.rooms.find(room => room.roomCode == selectRoom.roomCode);

    // 进入游戏房间的条件判断
    let minBet = 0, maxBet;
    if(['1'].includes(nid)){
        const avgAward = room.users.length === 0 ? 0 : room.matchDot / 0.1 / room.users.length;
        const avgBet = avgAward / (600 / 10) / 0.71;
        if(user[isVip ? 'integral' : 'gold'] >= avgBet * 5){
            if(room.users.length === 0 && room.socialRound == null){
                require('../../../services/socialService')(room);
            }
            minBet = avgBet / 250 > 250000 ? 250000 : avgBet / 250;
        }else{
            return next(null, {code: 500, error: `进入房间${selectRoom.roomCode}需要金额为${Math.ceil(avgBet * 5)}`});
        }

        //处理游戏最大押注解锁
        const moneyType = viper == null ? 'gold' : 'integral';
        if(user.unlock[nid] == null){
            user.unlock[nid] = {};
        }
        if(user.unlock[nid][env] == null){
            user.unlock[nid][env] = 0;
        }
        if(user[moneyType] * 0.1 >= user.unlock[nid][env]){
            user.unlock[nid][env] = Math.floor(user[moneyType] * 0.1 * 0.04);
        }
        maxBet = user.unlock[nid][env];
    } 

    //移植游戏进入
    switch (nid){
        case '8'://百家
            pomelo.app.rpc.games.baijiaRemote.entry(null,user.wrapGameData(),nid,room.roomCode,isVip,viper,(err)=>{
                console.log(err);
            });
            break;
        case '9'://百人
            pomelo.app.rpc.games.bairenRemote.entry(null,user.wrapGameData(),nid,room.roomCode,isVip,viper,(err)=>{
                console.log(err);
            });
            break;
        case '11'://att
            pomelo.app.rpc.games.attRemote.entry(null,user.wrapGameData(),nid,room.roomCode,isVip,viper,uid,(err)=>{
                console.log(err);
            });
            break;
        case '15'://比牌
            pomelo.app.rpc.games.bipaiRemote.entry(null,user.wrapGameData(),nid,room.roomCode,isVip,viper,(err)=>{
                console.log(err);
            });
            break;
        case '17'://21点
            pomelo.app.rpc.games.botRemote.entry(null,user.wrapGameData(),nid,room.roomCode,isVip,viper,(err)=>{
                console.log(err);
            });
            break;
    }
    if(nid == '3'){
        //对于火锅游戏,如果该房间没有开始回合，则开启回合
        let _app=pomelo.app;
        pomelo.app.rpc.huoguo.mainRemote.findRound(session, isVip, session.get('viper'), room.roomCode, session.frontendId, uid, room, (doc) =>{
            if(room.users.filter(u=>!u.uid.startsWith("ai")).length===1 && room.socialRound == null){//room.users.length === 0 &&
                require('../../../domain/games/hotpot/socialRound')(room,null,_app);
                //this.app.rpc.huoguo.mainRemote.startSocialRound(null,room,function(){});
            }
            if(doc && doc.aiLeave){
                const userIndex = room.users.findIndex(user => user.uid == doc.uid);
                room.users.splice(userIndex, 1);
                const roomUids = [];
                const users= room.users;
                game.rooms.forEach(room => roomUids.concat(room.users.map(user =>user.uid)));
                const msgUserIds = game.users.map(user => {
                    return {uid:user.uid,sid:user.sid}
                }).filter(obj => !roomUids.includes(obj.uid));
                msgService.pushMessageByUids('changeRoomInfo', { //通知前端有人退出机器
                    users,
                    nid,
                    roomCode: room.roomCode,
                }, msgUserIds);
            }
        });
    }

    room.users.push(user.roomuser());
    sessionService.sessionSet(session, {'roomCode': room.roomCode});

    const roomUids = [];
    const users= room.users;
    game.rooms.forEach(room => roomUids.concat(room.users.map(user =>user.uid)));
    const msgUserIds = game.users.map(user => {
        return {uid:user.uid,sid:user.sid}
    }).filter(obj => !roomUids.includes(obj.uid));

    msgService.pushMessageByUids('changeRoomInfo', { //通知前端有人进入机器
        users,
        nid:nid,
        roomCode : room.roomCode,
    }, msgUserIds);

    let envLGC = user.lastGameContents[env];	
    
    if(envLGC.nid != nid){
        envLGC.nid = nid;
    }
    envLGC.room[nid] = room.roomCode;

    return next(null, {code:200, user: user.strip(), roomCode: room.roomCode, minBet, maxBet});
};

/**
 * 离开房间(退出到机器列表页)
 * @route: hall.gameHandler.leaveRoom
 */
gameHandler.prototype.leaveRoom = function({saveProfit = false}, session, next){

    const uid = session.uid;
    const nid = session.get('game');
    const roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const user = PlayerMgr.getPlayer(uid);
    const env = viper == null ? 'system' : viper;
    if(!user){
        return next(null, {code: 500, error:'未找到玩家'});
    }
    let game, viperUid;
    if(isVip){
        game = vipPlatformMgr.getGameByUid(viper, nid);
        viperUid = viper;
        user.leaveRoomTime = Date.now();
    }else{
        game = GamesMgr.getGame(nid);
    }
    if(!game){
        return next(null, {code: 500, error: '游戏未找到 hall.gameHandler.leaveRoom'})
    }
    const room = game.rooms.find(room => room.roomCode == roomCode);
    if(!room){
        return next(null, {code: 500, error: '游戏房间未找到 hall.gameHandler.leaveRoom'})
    }

    //修正每个房间的奖池显示
	game.rooms.forEach(room =>{
		let passTime = (Date.now() - room.jackpotShow.ctime) / 1000;
		if(passTime > 300){
			passTime = 300;
		}
		room.jackpotShow.show = passTime * room.jackpotShow.rand;
    })
    
    const userIndex = room.users.findIndex(user => user.uid == uid);

    //玩家退出房间
    const userOutRoom = function () {
        room.users.splice(userIndex, 1);
        sessionService.sessionSet(session, {roomCode: null});
        const roomUids = [];
        const users= room.users;
        game.rooms.forEach(room => roomUids.concat(room.users.map(user =>user.uid)));
        const msgUserIds = game.users.map(user => {
            return {uid:user.uid,sid:user.sid}
        }).filter(obj => !roomUids.includes(obj.uid));
        msgService.pushMessageByUids('changeRoomInfo', { //通知前端有人退出机器
            users,
            nid,
            roomCode,
        }, msgUserIds);
    }

    //生成积分记录
    const createIntegralRecord = function () {
        if(isVip){
            integralModel.create({
                viperUid: viperUid,
                uid: uid,
                nickname: user.nickname,
                duration: user.leaveRoomTime - user.enterRoomTime,
                createTime: user.leaveRoomTime,
                integral: user.roomProfit,
                gname :game.zname,
                settleStatus: false
            }, function(err, data){
                if(err || !data){
                    console.error('生成积分记录失败');
                }
                user.roomProfit = 0;
            });
        }
    }

    const integralModel = require('../../../utils/db/mongodb').getDao('integral_record');//积分数据库

    //对于夺宝游戏, 在离开房间之后要将其积累的盈利取出, 并清除记录
    const moneyType = isVip ? 'integral' : 'gold';

    const lastRoom = user.lastGameContents[env].room;

    // 记录停用时间
    if(room.users.length == 0){
        room.disableTime = Date.now();
    }
    //离开游戏
    switch (game.nid){
        case '4':
            this.app.rpc.games.gameRemote.getUserProfit(session, {isVip, uid, offLine: false, viper: session.get('viper'), roomCode, saveProfit}, function(err, profit){
                if(err){
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                if(profit == null){
                    return next(null, {code: 200, rooms: game.rooms});
                }
                user[moneyType] += profit;
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]: user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
            });
            break;
        case '12':
            this.app.rpc.pharaoh.mainRemote.getUserProfit(session, {isVip, uid, offLine: false, viper: session.get('viper'), roomCode, saveProfit}, function(err, profit){
                if(err){
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                if(profit == null){
                    return next(null, {code: 200, rooms: game.rooms.filter(r => r.open)});
                }
                user[moneyType] += profit;
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]: user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
            });
            break;
        case '3':
            this.app.rpc.huoguo.mainRemote.kickUserFromChannel(null, {roomCode, uid, isVip, viper: session.get('viper')}, function(data){
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]: user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
            });
            break;
        case '8':
            this.app.rpc.games.baijiaRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
                if(err){
                    return next(null,{code:500,error:err});
                }
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});


            });
            break;
        case '9':
            this.app.rpc.games.bairenRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
                if(err) {
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});

            });
            break;
        case '11':
            this.app.rpc.games.attRemote.exit(null,uid,game.nid,isVip,(err)=>{
                if(err) {
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});

            });
            break;
        case '15':
            this.app.rpc.games.bipaiRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
                if(err) {
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms.filter(r => r.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});


            });
            break;
        case '17':
            this.app.rpc.games.dotRemote.exit(null,uid,game.nid,isVip,roomCode,(err)=>{
                if(err) {
                    return next(null, {code: 500, error: err});
                }
                createIntegralRecord();
                userOutRoom();
                return next(null, {code: 200, rooms: game.rooms, [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
            });
            break;
        default:
            createIntegralRecord();
            userOutRoom();
            return next(null, {code: 200, rooms: game.rooms.filter(room => room.open), [moneyType]:user[moneyType], lastRoom, lastGame: user.lastGameContents[env].nid});
    }
};

/**
 * 离开游戏(退出到游戏大厅页)
 * @route: hall.gameHandler.leaveGame
 */
gameHandler.prototype.leaveGame = ({}, session, next) =>{
    const uid = session.uid;
    const nid = session.get('game');
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const user = PlayerMgr.getPlayer(uid);
    const env = viper == null ? 'system' : viper;
    if(!user){
        return next(null, {code: 500, error:'未找到玩家'});
    }
    let game, games, gameMembers;
    if(isVip){
        const platform = vipPlatformMgr.getPlatform(viper);
        game = vipPlatformMgr.getGameByUid(viper, nid);
        const gameWeight = {'11':20,'8':19,'1':18,'4':17,'3':16,'10':15,'7':14,'16':13,'12':12,'2':11,'9':10,'13':9,'14':8};
        if(user.vip){
            const nowTime = Date.now();
                games = platform.games.map(m=>{
                return{
                    nid:m.nid,
                    heatDegree:m.heatDegree,
                    roomUserLimit:m.roomUserLimit,
                    topicon: m.topicon,
                    name:m.name,
                    time: m.gameStartTime + m.gameHaveTime - nowTime,
                }
            })
            const addGames = util.clone(GamesMgr.Games()).filter(game => !platform.games.map(g => g.nid).includes(game.nid));
            addGames.forEach(g => g.needBuy = true);
            games = games.sort((g1, g2) => gameWeight[g2.nid] - gameWeight[g1.nid]).concat(addGames).filter(g =>![].includes(g.nid));
            gameMembers = platform.gameMembers;
        }else{
            platform.removeGameMember(nid, uid);
            games = platform.games.filter(g =>![].includes(g.nid)).sort((g1, g2) => gameWeight[g2.nid] - gameWeight[g1.nid]);
        }
    }else{
        game = GamesMgr.getGame(nid);
        games = GamesMgr.Games().filter(g =>![].includes(g.nid));
    }

    if(!game){
        return next(null, {code: 500, error: '游戏未找到 hall.gameHandler.leaveGame'})
    }
    const userIndex = game.users.findIndex(user => user.uid == uid);
    game.users.splice(userIndex, 1);
    sessionService.sessionSet(session,{game:null});
    
    const lastGame = user.lastGameContents[env].nid;
    let list = [];
    const inviteCodeInfo = db.getDao('invite_code_info');
     new Promise((resolve, reject) =>{
                    if(user.inviteCode){ //根据渠道下面的玩家对绑定的邀请码来进行查询如果渠道有邀请码同时设置了那些游戏是否开放
                        inviteCodeInfo.findOne({inviteCode:user.inviteCode},function(err,invites){
                                const viper = invites.viper;
                                inviteCodeInfo.findOne({uid:viper},function(err,inviteViper){
                                    const  inviteGames = inviteViper.games;
                                    if(inviteGames !=0){
                                        games.forEach(m=>{
                                                const temp = inviteGames.find(x => x.nid === m.nid);
                                                if(temp.status === true){
                                                    list.push(m);
                                                }
                                        })
                                        resolve();
                                    }else{ //这个是渠道下面的玩家,然后该渠道没有设置哪些游戏是否开放
                                        list = games;
                                        resolve();
                                    }
                                });
                        });
                    }else{
                        inviteCodeInfo.findOne({uid:user.uid},function(err,invite){
                            if(invite && invite.games.length !=0){ //这个是渠道本身没有邀请码进行查询自己开放了哪些有些
                                const  inviteGames = invite.games;
                                    games.forEach(m=>{
                                            const temp = inviteGames.find(x => x.nid === m.nid);
                                            if(temp.status == true){
                                                list.push(m);
                                            }
                                    })
                                    resolve();
                            }else{ //这个是渠道本身进入的接口然后没有设置哪些游戏开放
                                list = games;
                                resolve();
                            }

                        });
                    }
     })
    .then(function(){
            return next(null, {code: 200, games: list.map(game => {
                const {nid, heatDegree, roomUserLimit, topicon, name, needBuy,time} = game;
                return {nid, heatDegree, roomUserLimit, topicon, name, needBuy,time};
            }), gameMembers, lastGame, lastRoom: user.lastGameContents[env].room});
    })
};

/**
 * 奖池填充  (填充到 基础奖池)
 * @route:hall.gameHandler.jackpotFilling
 */
gameHandler.prototype.jackpotFilling = ({nid, roomCode, num}, session, next) =>{
    if(num == null){
        return next(null, {code: 500, error:'请正确输入充值数量'});
    }
    if(nid == null){
        nid = session.get('game');
    }
    const isVip = session.get('VIP_ENV');
    const uid = session.uid;
    const player = PlayerMgr.getPlayer(uid);
    if(!player.vip){
        return next(null, {code: 500, error:'没有充值资格'});
    }
    const game = vipPlatformMgr.getGameByUid(uid, nid);
    if(!game){
        return next(null, {code: 500, error:'游戏未找到'});
    }
    const room = game.rooms.find(room => room.roomCode == roomCode);
    if(!room){
        return next(null, {code: 500, error: '游戏房间未找到 '})
    }
    if(num < 0 && Math.abs(num) > room.jackpot ){
        return next(null, {code: 500, error: '积分扣除大于房间奖池不能进行扣除！'})
    }
    room.jackpot += parseInt(num);
    player.vdot -= Number(num)  * 0.001;
    //更新房主的V点
    msgService.pushMessageByUids('addCoin', { 
        vdot:player.vdot,
    }, player.uids()); 
    // if(room.jackpot < 0){
    //     room.jackpot = 0;
    // }
    return next(null, {code: 200,  jackpot: room.jackpot});
};

/**
 * 请求slots777比赛的状态信息
 * @route: hall.gameHandler.matchStatus
 */
gameHandler.prototype.matchStatus = ({}, session, next) =>{

    const nid = session.get('game');
    const roomCode = session.get('roomCode');
    const viper = session.get('viper');
    const game = viper ? vipPlatformMgr.getGameByUid(viper, nid) : GamesMgr.getGame(nid);
    const room = game.rooms.find(room => room.roomCode == roomCode);
    if(!game || !room){
        return next(null, {code: 500, error:'请求slots777比赛的状态信息出错'});
    }
    console.error('当前房间社交点',room.socialDot)
    return next(null, {code: 200, status: room.socialRound, socialDot: room.socialDot});
};

/**
 * 查看某个游戏的联机大奖奖池
 * @route: hall.gameHandler.onlineAwards
 */
gameHandler.prototype.onlineAwards = ({nid, viper, num, set = false}, session, next) =>{
    viper = viper || session.get('viper');
    nid = nid || session.get('game');
    if(!nid){
        return next(null, {code: 500, error:'请传入nid 或进入游戏'});
    }
    const game = viper ? vipPlatformMgr.getGameByUid(viper, nid) : GamesMgr.getGame(nid);
    if(set){
        game.onlineAwards = num;
    }
    return next(null, {code: 200, onlineAwards: game.onlineAwards || 0});
};

/**
 * 更改游戏奖池
 * @route: hall.gameHandler.setJackpot
 */
gameHandler.prototype.setJackpot = ({nids}, session, next) =>{

    if(util.isVoid(nids)){
        nids = ['2', '4', '12', '1', '7', '10'];
    }
    const operators = [];
    nids.forEach(nid =>{
        const game = GamesMgr.getGame(nid);
        game.rooms.filter(r => r.open).forEach(room =>{
            if(room.jackpot > 3000000){
                const before = room.jackpot;
                room.jackpot = util.random(1000000, 2000000);
                operators.push({nid, roomCode:room.roomCode, before, after: room.jackpot});
            }
        })
    })
    return next(null, {code: 200, operators});
};