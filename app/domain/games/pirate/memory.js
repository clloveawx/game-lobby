const utils = require('../../../utils');
const schedule = require('node-schedule');
const config = require('./config');
const pomelo = require('pomelo');
//海盗船放奖
class releaseAward{
    constructor(opt){
        this.curr_basics = opt.curr_basics || 0;//当前放奖的基础奖池
        this.curr_time = opt.curr_time || new Date().getTime();//当前房间的时间
        this.award_quantity = opt.award_quantity || 0;//普通连线放奖量
        this.jackpotPirate = opt.jackpotPirate || 0;//mini奖池放奖量
        this.status = 0;//放奖状态
        this.nid = opt.nid || '';
        this.roomCode = opt.roomCode || '';
    }

    //每分钟执行一次监控奖池状态
    minuteTime(room,isVip,uid){
        let monitor = setInterval(()=>{
            // console.log('每分钟一次监控奖池变化',this,room.jackpot,this.curr_basics);
            let increase =room.jackpot <= 0 ? 0 : (room.jackpot - this.curr_basics)/room.jackpot;//奖池增幅量
            let randomTimes = this.randomTime(config.releaseTime2) * 60000; //随机放奖时间戳
            let increase2 = room.jackpot - 0;//当前基础奖池减初始奖池
            let award = (room.jackpot - this.curr_basics)*0.7;//放奖量为增幅的70%
            let wireJackpot = (room.jackpot - this.curr_basics)*0.2;//mini-jackpot 放奖量
            // console.log('奖池增幅量',increase,'放奖时间间隔',new Date().getTime() - this.curr_time,'随机时间',randomTimes,'基础-初始',increase2,'房间人数',room.users.length);
            if(increase > 0.1 && (new Date().getTime() - this.curr_time) > 60000){
                console.log('开始放奖1');
                clearInterval(monitor);
                this.timing(config.releaseTime,()=>{
                    this.update(room,award,wireJackpot,isVip,uid);
                    console.log(room.nid,'-',room.roomCode,'房间开始放奖1,普通连线放奖量',this.award_quantity,'mini奖池放奖量',this.jackpotPirate);

                });
            }else if((new Date().getTime() - this.curr_time)>randomTimes && increase2 > 100*room.users.length){
                console.log('开始放奖2');
                clearInterval(monitor);
                this.timing(config.releaseTime,()=>{
                    this.update(room,award,wireJackpot);
                    console.log(room.nid,'-',room.roomCode,'房间开始放奖2,普通连线放奖量',this.award_quantity,'mini奖池放奖量',this.jackpotPirate);

                });
            }
        },60000)
    }

    //在指定范围内随机时间
    randomTime({startTime,endTime}) {
        let rand = Math.random() * endTime;
        while (rand < startTime) {
            rand = Math.random() * endTime
        }
        return parseInt(rand);
    }

    //定时函数
    timing(timePassage,cb) {
        let randomTimes = this.randomTime(timePassage); //随机一个时间
        let date = new Date().getTime(); //获取当前时间戳
        let times = utils.cDate(date + randomTimes); //在指定时间后执行函数
        console.log(times,this.nid,'-',this.roomCode,'时开始放奖');
        schedule.scheduleJob(times, function() {
            return cb();
        });
    }
    //跟新放奖状态
    update(room,award,wireJackpot,isVip,uid){
        this.status = 1;
        this.award_quantity = award;
        this.curr_basics = room.jackpot;
        this.curr_time = new Date().getTime();
        this.jackpotPirate =wireJackpot;
        if(uid){
            this.updateRoom(room,isVip,uid);
        }

    }
    //更新房间信息
    updateRoom(room,isVip,uid){
        let ob = {
            curr_basics : this.curr_basics,
            curr_time : this.curr_time,
            award_quantity : this.award_quantity,
            jackpotPirate : this.jackpotPirate,
            status : this.status,
            nid : this.nid,
            roomCode : this.roomCode
        }
        // console.log('跟新房间状态',{nid:room.nid, roomCode:room.roomCode, isVip:isVip, uid:uid,releaseAward:ob});
        pomelo.app.rpc.hall.gameRemote.updateGameRoom(null, {nid:room.nid, roomCode:room.roomCode, isVip:isVip, uid:uid}, {releaseAward:ob},function(){
        });
    }
}

module.exports = {
    pirateAdjust:{//返奖率

    },
    releaseAward:releaseAward
}