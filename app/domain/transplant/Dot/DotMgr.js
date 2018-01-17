'use strict';
const Room = require('./Room');
const pomelo = require('pomelo');
const util = require('../../../utils');
const game = require('../../../../config/data/games.json');

const stages = // 游戏场列表
[
    {
        id: "17",
        name: '21点',
        rooms:[],// 房间列表
        roomsVip:[]//vip房间

    }
];

//初始化房间频道
exports.init = function (app) {
    let games = game.find(m=>m.nid == stages[0].id);
    if(!games){
        return;
    }
    stages.forEach(m=>{
        for(let i=0; i<games.minRoom; i++){
            let n = i+1;
            let roomCode = util.supplementZero(n,3);
            m.rooms.push(new Room({nid:stages[0].id,id:roomCode, channel: app.channelService.createChannel('21dot'+roomCode)}));
        }
    });
};

// 获取场
exports.getStage = function (id) {
    return stages.find(m => m.id === id);
};

// 根据房间ID 获取房间 - 因为房间ID是全局唯一的所以可以直接找到
exports.getRoom = function (id,isvip) {
    for (let i = stages.length - 1; i >= 0; i--) {
        if(isvip){
            const room = stages[i].roomsVip.find(m => m.id === id);
            if(room) return room;
        }else{
            const room = stages[i].rooms.find(m => m.id === id);
            if(room) return room;
        }

    }
    return null;
};

//totalBet.押注金额，totalWin.总盈利，multiple.连线总赔率,moneyType.货币类型
exports.addGoldRecordDotMgr = function ({isVip,totalBet,totalWin,player,moneyType}) {
    if(!isVip){
        const gameRecordModel = require('../../../../app/utils/db/mongodb').getDao('game_record');
        gameRecordModel.create({
            nid:stages[0].id,
            uid: player.uid,
            nickname: player.nickname,
            gname: '21点',
            createTime: Date.now(),
            input: totalBet,
            multiple: (totalWin/totalBet).toFixed(1),
            profit: totalWin - totalBet,
            selfGold:player.gold,
            playStatus:1
        },function(err, data){
            if(err){
                console.error('创建游戏记录失败 games.slots777Handler.start');
            }
        });
    }else{
        pomelo.app.rpc.hall.playerRemote.updateUser(null, uid, {[moneyType]: player[moneyType], gamesRecord: player.gamesRecord,selfBank:player.selfBank, roomProfit: isVip ? (player.roomProfit + totalWin - totalBet) : 0}, function(){});

    }
}
