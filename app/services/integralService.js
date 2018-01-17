'use strict';

const db = require('../utils/db/mongodb'); 

/**
 * 根据条件查找积分记录
 */
exports.findIntegral = function(params, callback){
    const integralModel = db.getDao('integral_record');

    // 前台传入的排序规则
    let orderBy = params.orderBy;
    if (!orderBy)
        orderBy = "-createTime";

    // 处理查询条件
    let condition = {};
    condition.$and = [];

    if(params.viperUid){
        condition.$and.push({viperUid: params.viperUid});
    }
    if(params.uid){
        condition.$and.push({uid: params.uid});
    }
    // 如果传入了search, 按照玩家昵称和uid做模糊查询
    if (params.search) {
        //定义空的或条件
        const orcond = [];
        // 定义模糊匹配的查询条件
        const search = {"$regex": params.search};
        // 模糊匹配编码
        orcond.push({"uid": search});
        // 模糊匹配名称
        orcond.push({"nickname": search});
        // 将或条件插入整体查询条件中
        condition.$and.push({"$or": orcond});
    }
    if (condition.$and.length == 0){
        condition = {};
    }

    if(params.vip){
        integralModel.aggregate()
            .match({viperUid: params.viperUid})
            .group({_id: "$uid", totalDuration: {$sum: "$duration"}, totalIntegral: {$sum: '$integral'}})
            .project({_id: 0, uid: "$_id", nickname: 1, totalDuration: 1, totalIntegral: 1})
            .exec(function(err, datas) {

                const promises = [];
                const findOne = (data) =>{
                    return new Promise((resolve, reject) =>{
                        integralModel.find({uid: data.uid}, function(err,userDocs){
                            if(err){
                                console.error('查询积分记录失败',err);
                            }
                            data.nickname = userDocs[0].nickname;
                            data.detailRecord = userDocs;
                            let noSettleIntegral = userDocs.reduce((num, doc) =>{
                                if(doc.settleStatus == false){
                                    return num + doc.integral;
                                }else{
                                    return num;
                                }
                            }, 0);
                            noSettleIntegral = noSettleIntegral > 0 ? `+${noSettleIntegral}` : `${noSettleIntegral}`;
                            data.noSettleIntegral = noSettleIntegral;
                            resolve(data);
                        })
                    })
                };
                for(let i=0; i< datas.length; i++){
                    promises.push(findOne(datas[i]));
                }
                Promise.all(promises).then(function(docs){
                    return callback(null, docs);
                })
            })
    }else{
        integralModel.find(condition).sort(orderBy).exec(function(err, docs){
            if(err){
                console.log('查询积分记录失败', err);
                return callback(err);
            }
            return callback(null, docs);
        })
    }
};

/**
 * 更新积分记录
 */
exports.updateIntegral = function(params, callback){
    const integralModel = db.getDao('integral_record');
    integralModel.update({uid: params.uid, viperUid: params.viperUid, settleStatus:false},{$set:{settleStatus: params.settleStatus}}, {new: true, multi: true}, function(err, docs){
        if(err){
            console.error('更新积分记录 失败');
            return callback(err);
        }
        integralModel.find({uid: params.uid, viperUid: params.viperUid},function(err,datas){
            if(err){
                console.error('更新积分记录 失败');
                return callback(err);
            }
            return callback(null, datas);
        });
    })
};
