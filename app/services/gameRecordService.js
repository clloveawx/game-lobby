'use strict';

const db = require('../utils/db/mongodb'); 
const gameRecordModel = db.getDao('game_record');
const payInfo = db.getDao('pay_info');
const playerInfo = db.getDao('player_info');
const util = require('../utils');

/**
 * 根据条件查找游戏记录
 */
exports.findGameRecord = function(params, callback){

    // 前台传入的排序规则
    let orderBy = params.orderBy;
    if (!orderBy)
        orderBy = "-createTime";

    // 处理查询条件
    let condition = {};
    condition.$and = [];

    if(params.uid){
        condition.$and.push({uid: params.uid});
    }
    if(params.nids && params.nids.length > 0){
        condition.$and.push({nid: {'$in': params.nids}});
    }
    if(params.playStatus){
        condition.$and.push({playStatus:params.playStatus});
    }
    if (condition.$and.length == 0){
        condition = {};
    }
    const limited = params.num && params.num > 0;
    gameRecordModel.find(condition).limit(limited ? params.num : 100).sort(orderBy).exec(function(err, docs){
        if(err){
            console.error('查找游戏记录失败', docs);
            return callback(err);
        }
        const result = {docs: docs};

        if(!params.uid){
            gameRecordModel.aggregate()
                .match({createTime: {$gt: util.zerotime(Date.now())}})
                .group({_id: "max", max_value: {$max: "$profit"}})
                .project({_id: 0, max_value: 1})
                .exec(function(err, datas) {
                    if(datas.length == 0){
                        result.maxProfit = 0;
                    }else{
                        result.maxProfit = datas[0].max_value > 0 ? datas[0].max_value : 0;
                    }
                    return callback(null, result);
                })
        }else{
            gameRecordModel.aggregate()
                .match(condition)
                .group({_id: "", inputAll: {$sum: "$input"}, profitAll: {$sum: "$profit"}})
                .project({_id: 0, inputAll: 1, profitAll: 1})
                .exec(function(err, datas) {
                    if(datas.length == 0){
                        result.inputAll = 0;
                        result.profitAll = 0;
                    }else{
                        result.inputAll = datas[0].inputAll;
                        result.profitAll = datas[0].profitAll;
                    }
                    result.rechargeAll = 0;
                    return callback(null, result);
                })
        }
    });
};

exports.rankGameRecord = ({cond}, cb) =>{
    gameRecordModel.aggregate()
        .match(cond)
        .sort('-createTime')
        .group({'_id': '$uid', 'winTotal': {'$sum': '$profit'},'nickname': {'$first': '$nickname'}})
        .match({'winTotal': {'$gt': 0}})
        .sort('-winTotal')
        .limit(10)
        .then(function(result){
            // console.log('===================',result)
            // const maxProfit = (result[0] && result[0].winTotal) || 0;   //真实玩家最大收益
            // console.log('最大收益=============',maxProfit)
            
            // gameRecordModel.find({robot: true}).sort('-profit').exec((err, docs) =>{
            //     docs.forEach(doc =>{
            //         if(doc.profit <= maxProfit){
            //             doc.profit += util.random(1000, 20000);
            //             //doc.nickname = nicknames[util.randomIndex(nicknames.length)];
            //             doc.save();
            //         }
            //     });
            //     const mockResults = docs.sort((d1, d2) => d2.profit - d1.profit).map(doc =>{
            //         return {winTotal: doc.profit, nickname: doc.nickname}
            //     });
            //     cb(null, mockResults)
            // });
            cb(null, result);
        })
};


exports.rankRmbRecord = ({cond}, cb) =>{

        playerInfo.find({},function(err,players){
            payInfo.aggregate()
                .match(cond)
                .sort('time')
                .group({'_id': '$uid', 'pay': {'$sum': '$total_fee'}, 'time':{'$first': '$time'}})
                .sort('-pay time')
                .limit(10)
                .then(function(result){
                    let  arr = result.filter(x=>x.pay >= 1000);
                   let list =  arr.map(m=>{
                    const temp = players.find(x=>x.uid === m._id);
                        return  {
                            uid:m._id,
                            nickname : temp?temp.nickname:'xxxx',
                            allPay : m.pay,
                        }
                   });
                cb(null, list);
            })
        })        
}
