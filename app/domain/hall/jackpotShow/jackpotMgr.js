'use strict';

const vipPlatformMgr = require('../../vipPlatform/PlatformMgr');
const GamesMgr = require('../../ordinaryPlatform/GamesMgr');
const msgService = require('../../../services/MessageService');

//所有开启的房间的定时器任务  key-env+nid+roomCode value-timer
const scheduleJobs = {};

const timer = ({env, nid, roomCode}) =>{

    return setInterval(function(){
        
        let game, room;
        if(env == 'system'){
            game = GamesMgr.getGame(nid);
        }else{
            const platform = vipPlatformMgr.getPlatform(env);
            if(!platform){
                return;
            }
            if(!game){
                return;
            }
            game = platform.getGame(nid);
        }
        room = game.rooms.filter(r => r.open).find(room => room.roomCode == roomCode);
        if(!room){
            return;
        }
        const now = Date.now();

        if(0 <= room.jackpot && room.jackpot < 2000000){
            room.jackpotShow.show = room.jackpot;
            room.jackpotShow.rand = Math.floor((room.jackpot + 1000000)/300);
            room.jackpotShow.ctime = now;
        }else if(room.jackpot >= 2000000){
            room.jackpotShow.show = room.jackpot * 0.5;
            room.jackpotShow.rand = Math.floor((room.jackpot * 0.5)/300);
            room.jackpotShow.ctime = now;
        }

        //通知所有可看到机器奖池的玩家 奖池显示的改变
        const us = game.users.map(u => {
            return {uid: u.uid, sid:u.sid};
        });
        msgService.pushMessageByUids('onJackpotShowChange', {
            roomCode,
            jackpotShow :{
                show: room.jackpotShow.show,
                rand: room.jackpotShow.rand,
            }
        }, us)

    }, 1000 * 60 * 5);
}

Object.assign(module.exports, {

    //增加定时器
    addSchedule({env, nid, roomCode}){
        scheduleJobs[`${env}${nid}${roomCode}`] = timer({env, nid, roomCode});
    },
    //查看是否存在某个定时器
    scheduleExists(key){
        return !!scheduleJobs[key];
    },
    //删除指定定时器
    removeSchedule(key){
        if(this.scheduleExists(key)){
            clearInterval(scheduleJobs[key]);
            delete scheduleJobs[key];
        }
    },
    //查看定时器
    showScheduleJobs(key){
        return Object.keys(scheduleJobs);
    },
});