'use strict';

const xml2js = require('xml2js');
const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');
const db = require('../../../utils/db/mongodb');
const msgService = require('../../../services/MessageService');
const MailService = require('../../../services/MailService');
const logger = require('pomelo-logger').getLogger('log', __filename);
const InviteCodeMgr = require('../../../domain/hall/inviteCode/inviteCodeMgr');
const utils = require('../../../utils');

module.exports = function (app) {
    return new Remote(app);
};

function Remote(app) {
    this.app = app;
}

// 店铺充值回传
Remote.prototype.shopPayCallback = function (data, next) {
    // const data = JSON.parse(String(_data));
    // 充值数据量
    console.log('充值毀掉.....',data);
    const field1 = data.field1.split('-');
    const attach = field1[0];
    const uid = field1[1];
    const total_fee = data.orderPrice * 100 ;
    const dao = db.getDao('pay_info');
    const dao1 = db.getDao('player_info');
    const info = {
        id: data.orderNo, // 订单号
        time: Date.now(),
        time_end: data.orderTime, // 交易结束时间
        attach: attach, // 附加参数
        bank_type: '', // 交易银行
        fee_type: '',
        total_fee: total_fee, // 交易金额
        openid: '',
        remark: data.remark,
        uid: uid, // 玩家UID
        nickname: '',// 昵称
        addgold: 0,// 获得金豆uid
        gold: 0,// 当前金币
        agencylink: ''// 代理地址
    };
    //判断订单号是否存在
    dao.findOne({id:data.orderNo},function (err, res) {
        // console.log(res);
        if(!res){
            dao.create(info, function (err, res) {
                if (err || !res) {
                    return next({code: 500});
                }
             let player = PlayerMgr.getPlayer(uid);
             if(attach === 'gold'){
                if(player){
                    player.gold += total_fee * 10;
                    player.addRmb += total_fee;
                    let msgUserIds = player.uids();
                    msgService.pushMessageByUids('addCoin', { //充值成功过后，对玩家的金币进行增加
                         gold:player.gold,//充值的金币
                         rmb:total_fee, //充值的人名币
                         remark:'充值成功，获得'+ total_fee * 10+'金币'
                    }, msgUserIds); 
                    if(player.inviteCode){
                        goldBackToplayer(player.inviteCode,total_fee,player);
                        addRmbDaili(player.inviteCode,total_fee);
                    }

                    //月卡
                    if(total_fee >= 600 && !player.monthlyCard.active && !player.monthlyCard.joined){
                        player.monthlyCard.active = true;
                        player.monthlyCard.joined = true;
                    }

                }else{
                    dao1.findOne({uid:uid},function (err, res) {
                          if(res){
                            let gold = res.gold +total_fee * 10;
                            let addRmb = res.addRmb +total_fee;
                            const udtInfo = {$set:{gold: gold, addRmb: addRmb}};
                            // console.log('11111111');
                            if(total_fee >= 600 && !res.monthlyCard.active && !res.monthlyCard.joined){
                                res.monthlyCard.active = true;
                                res.monthlyCard.joined = true;
                                udtInfo.monthlyCard = res.monthlyCard;  
                            }
                             // console.log('222222');
                            dao1.update({uid:uid}, udtInfo, function(err,data){
                                    // err && logger.error(uid, '保存数据库失败');
                                if(err){
                                    return next(null, {code: 500,error:'绑定失败'})
                                }
                                if(res.inviteCode){
                                    goldBackToplayer(res.inviteCode,total_fee,res);
                                    addRmbDaili(res.inviteCode,total_fee);
                                }
                                return next(null, {code: 200})
                            });
                          }
                    });
                }
             }else if(attach ==='point'){
                if(player){
                    //player.vipEffectiveTime += data.total_fee * 10;
                    player.vdot += total_fee/100;
                    player.addRmb += total_fee;
                    let msgUserIds = player.uids();
                    msgService.pushMessageByUids('addCoin', { //充值成功过后，对玩家的金币进行增加
                         //vipEffectiveTime:player.vipEffectiveTime,//充值的金币
                         vdot:player.vdot,
                         rmb:total_fee, //充值的人名币
                         remark:'充值成功，获得'+total_fee/100+'V点数'
                    }, msgUserIds); 

                }else{
                    dao1.findOne({uid:uid},function (err, res) {
                          if(res){
                            //let vipEffectiveTime = res.vipEffectiveTime +data.total_fee * 10;
                            let vdot = res.vdot + total_fee/100;
                            let addRmb = res.addRmb +total_fee;   
                            dao1.update({uid:uid}, {$set:{vdot:vdot,addRmb:addRmb}}, function(err,data){
                                    err && logger.error(uid, '保存数据库失败');
                                if(err){
                                    return next(null, {code: 500,error:'绑定失败'})
                                }
                                return next(null, {code: 200})
                            });
                          }
                    });
                }
             }
            });
        }
    });
};

// 第三种支付
Remote.prototype.shopThreePayCallback = function (data, next) {
    // const data = JSON.parse(String(_data));
    // 充值数据量
    console.log('第三方支付充值毀掉.....',data);
    const ext = data.ext.split('-');
    const attach = ext[0];
    const uid = ext[1];
    const total_fee = data.money * 100 ;
    const dao = db.getDao('pay_info');
    const dao1 = db.getDao('player_info');
    const info = {
        id: data.orderid, // 订单号
        time: Date.now(),
        time_end:  Date.now(), // 交易结束时间
        attach: attach, // 附加参数
        bank_type: '', // 交易银行
        fee_type: '',
        total_fee: total_fee, // 交易金额
        openid: '',
        remark: data.remark,
        uid: uid, // 玩家UID
        nickname: '',// 昵称
        addgold: 0,// 获得金豆uid
        gold: 0,// 当前金币
        agencylink: ''// 代理地址
    };
    //判断订单号是否存在
    dao.findOne({id:data.orderid},function (err, res) {
        // console.log(res);
        if(!res){
            dao.create(info, function (err, res) {
                if (err || !res) {
                    return next({code: 500});
                }
             let player = PlayerMgr.getPlayer(uid);
             if(attach === 'gold'){
                if(player){
                    player.gold += total_fee * 10;
                    player.addRmb += total_fee;
                    let msgUserIds = player.uids();
                    msgService.pushMessageByUids('addCoin', { //充值成功过后，对玩家的金币进行增加
                         gold:player.gold,//充值的金币
                         rmb:total_fee, //充值的人名币
                         remark:'充值成功，获得'+ total_fee * 10+'金币'
                    }, msgUserIds); 
                    if(player.inviteCode){
                        goldBackToplayer(player.inviteCode,total_fee,player);
                        addRmbDaili(player.inviteCode,total_fee);
                    }

                    //月卡
                    if(total_fee >= 600 && !player.monthlyCard.active && !player.monthlyCard.joined){
                        player.monthlyCard.active = true;
                        player.monthlyCard.joined = true;
                    }

                }else{
                    dao1.findOne({uid:uid},function (err, res) {
                          if(res){
                            let gold = res.gold +total_fee * 10;
                            let addRmb = res.addRmb +total_fee;
                            const udtInfo = {$set:{gold: gold, addRmb: addRmb}};
                            // console.log('11111111');
                            if(total_fee >= 600 && !res.monthlyCard.active && !res.monthlyCard.joined){
                                res.monthlyCard.active = true;
                                res.monthlyCard.joined = true;
                                udtInfo.monthlyCard = res.monthlyCard;  
                            }
                             // console.log('222222');
                            dao1.update({uid:uid}, udtInfo, function(err,data){
                                    // err && logger.error(uid, '保存数据库失败');
                                if(err){
                                    return next(null, {code: 500,error:'绑定失败'})
                                }
                                if(res.inviteCode){
                                    goldBackToplayer(res.inviteCode,total_fee,res);
                                    addRmbDaili(res.inviteCode,total_fee);
                                }
                                return next(null, {code: 200})
                            });
                          }
                    });
                }
             }else if(attach ==='point'){
                if(player){
                    //player.vipEffectiveTime += data.total_fee * 10;
                    player.vdot += total_fee/100;
                    player.addRmb += total_fee;
                    let msgUserIds = player.uids();
                    msgService.pushMessageByUids('addCoin', { //充值成功过后，对玩家的金币进行增加
                         //vipEffectiveTime:player.vipEffectiveTime,//充值的金币
                         vdot:player.vdot,
                         rmb:total_fee, //充值的人名币
                         remark:'充值成功，获得'+total_fee/100+'V点数'
                    }, msgUserIds); 

                }else{
                    dao1.findOne({uid:uid},function (err, res) {
                          if(res){
                            //let vipEffectiveTime = res.vipEffectiveTime +data.total_fee * 10;
                            let vdot = res.vdot + total_fee/100;
                            let addRmb = res.addRmb +total_fee;   
                            dao1.update({uid:uid}, {$set:{vdot:vdot,addRmb:addRmb}}, function(err,data){
                                    err && logger.error(uid, '保存数据库失败');
                                if(err){
                                    return next(null, {code: 500,error:'绑定失败'})
                                }
                                return next(null, {code: 200})
                            });
                          }
                    });
                }
             }
            });
        }
    });
};
// 店铺充值回传
Remote.prototype.shopWeixinPayCallback = function (_data, next) {
    const data = JSON.parse(String(_data));
    // console.log('11111111111111111111111',data);
    // 充值数据量
    const uid = data.uid;
    const total_fee = data.total_fee;
    const dao = db.getDao('pay_info');
    const dao1 = db.getDao('player_info');
    const attach = data.attach;
    const info = {
        id: data.out_trade_no, // 订单号
        time: Date.now(),
        time_end: data.time_end, // 交易结束时间
        attach: attach, // 附加参数
        bank_type: '', // 交易银行
        fee_type: '',
        total_fee: total_fee, // 交易金额
        openid: '',
        remark: data.remark,
        uid: data.uid, // 玩家UID
        nickname: '',// 昵称
        addgold: 0,// 获得金豆uid
        gold: 0,// 当前金币
        agencylink: ''// 代理地址
    };
    //判断订单号是否存在
    dao.findOne({id:data.out_trade_no},function (err, res) {
        // console.log(res);
        if(!res){
            dao.create(info, function (err, res) {
                if (err || !res) {
                    return next({code: 500});
                }
             let player = PlayerMgr.getPlayer(uid);
             if(attach === 'gold'){
                if(player){
                    player.gold += total_fee * 10;
                    player.addRmb += total_fee;
                    let msgUserIds = player.uids();
                    msgService.pushMessageByUids('addCoin', { //充值成功过后，对玩家的金币进行增加
                         gold:player.gold,//充值的金币
                         rmb:total_fee, //充值的人名币
                         remark:'充值成功，获得'+ total_fee * 10+'金币'
                    }, msgUserIds); 
                    if(player.inviteCode){
                        goldBackToplayer(player.inviteCode,total_fee,player);
                        addRmbDaili(player.inviteCode,total_fee);
                    }

                    //月卡
                    if(total_fee >= 600 && !player.monthlyCard.active && !player.monthlyCard.joined){
                        player.monthlyCard.active = true;
                        player.monthlyCard.joined = true;
                    }

                }else{
                    dao1.findOne({uid:uid},function (err, res) {
                          if(res){
                            let gold = res.gold +total_fee * 10;
                            let addRmb = res.addRmb +total_fee;
                            const udtInfo = {$set:{gold: gold, addRmb: addRmb}};
                            // console.log('11111111');
                            if(total_fee >= 600 && !res.monthlyCard.active && !res.monthlyCard.joined){
                                res.monthlyCard.active = true;
                                res.monthlyCard.joined = true;
                                udtInfo.monthlyCard = res.monthlyCard;  
                            }
                             // console.log('222222');
                            dao1.update({uid:uid}, udtInfo, function(err,data){
                                    // err && logger.error(uid, '保存数据库失败');
                                if(err){
                                    return next(null, {code: 500,error:'绑定失败'})
                                }
                                if(res.inviteCode){
                                    goldBackToplayer(res.inviteCode,total_fee,res);
                                    addRmbDaili(res.inviteCode,total_fee);
                                }
                                return next(null, {code: 200})
                            });
                          }
                    });
                }
             }else if(attach ==='point'){
                if(player){
                    //player.vipEffectiveTime += data.total_fee * 10;
                    player.vdot += total_fee/100;
                    player.addRmb += total_fee;
                    let msgUserIds = player.uids();
                    msgService.pushMessageByUids('addCoin', { //充值成功过后，对玩家的金币进行增加
                         //vipEffectiveTime:player.vipEffectiveTime,//充值的金币
                         vdot:player.vdot,
                         rmb:total_fee, //充值的人名币
                         remark:'充值成功，获得'+total_fee/100+'V点数'
                    }, msgUserIds); 

                }else{
                    dao1.findOne({uid:uid},function (err, res) {
                          if(res){
                            //let vipEffectiveTime = res.vipEffectiveTime +data.total_fee * 10;
                            let vdot = res.vdot + total_fee/100;
                            let addRmb = res.addRmb +total_fee;   
                            dao1.update({uid:uid}, {$set:{vdot:vdot,addRmb:addRmb}}, function(err,data){
                                    err && logger.error(uid, '保存数据库失败');
                                if(err){
                                    return next(null, {code: 500,error:'绑定失败'})
                                }
                                return next(null, {code: 200})
                            });
                          }
                    });
                }
             }
            });
        }
    });
};
//充值的金额依次给上级玩家进行加钱

function  addRmbDaili (inviteCode,total_fee){
    const dailiAddMoney = db.getDao('daili_add_money');
    const inviteCodeInfo = db.getDao('invite_code_info');
    inviteCodeInfo.findOne({inviteCode:inviteCode},function(err,invite){
        const uid = invite.uid;
        // console.log('invite...',invite)
        const superior = invite.superior;
            dailiAddMoney.update({uid:uid},{$inc: {money:total_fee}},{upsert:true},function(err,data){
                    if(!err){
                        if(superior){
                            addRmbDailiToUp(superior,total_fee);
                        }
                    }
            });

    });
}

//充值的金额依次给上级玩家进行加钱
function  addRmbDailiToUp (uid,total_fee){
    const dailiAddMoney = db.getDao('daili_add_money');
    const inviteCodeInfo = db.getDao('invite_code_info');
    inviteCodeInfo.findOne({uid:uid},function(err,invite){
        const superior = invite.superior;
            dailiAddMoney.update({uid:uid},{$inc: {money:total_fee}},{upsert:true},function(err,data){
                    if(!err){
                        if(superior){
                            addRmbDailiToUp(superior,total_fee);
                        }
                    }
            });

    });
}



//充值金币的时候给玩家进行返利金币这是给二级返利

function  goldBackToplayer (inviteCode,total_fee,player){
    const addGoldRebates = db.getDao('add_gold_rebates'); 
    const playerInfo = db.getDao('player_info'); 
    InviteCodeMgr.findOneInviteCodeInfo({inviteCode: inviteCode}, (error, data) => {  
            if (error || !data) {
                logger.error("出错：查找邀请码出错或未找到：" + inviteCode);
                return next(null);
            }
             // let upPlayer = PlayerMgr.getPlayer(data.uid);
             // let player  = PlayerMgr.getPlayer(uid);
              // let msgUserIds = upPlayer.uids();
        playerInfo.findOne({uid:data.uid},function(err,upPlayer){
            addGoldRebates.findOne({rebateId:'123456'},function(err,result){
                if(result){
                   const rebate =  result.rebate;
                   // const rebate =  5;
                   const backGold = total_fee * 10 * rebate * 0.01;
                    // if(upPlayer){
                        // upPlayer.gold += backGold;
                            // msgService.pushMessageByUids('addCoin', { //充值成功过后，对玩家的金币进行增加
                            //      gold:upPlayer.gold,//充值的金币
                            //      // rmb:total_fee, //充值的人名币
                            //      // remark:'您推荐的玩家充值了'+ total_fee * 10+'金币,你获得返利'+ backGold +'金币！'
                            // }, msgUserIds);
                            let opts = {};
                            opts.name = '下级返利';
                            opts.content = '您的下级玩家'+player.nickname+'充值'+total_fee * 10+'金币,您获得'+backGold+'金币的返利';
                            opts.attachment = {gold:backGold};
                            MailService.generatorMail(opts, data.uid, function(err, mailDocs){
                                if(err){
                                  return next(null, {code: 500, error: '系统生成邮件'});
                                }
                            });
                        if(upPlayer.inviteCode){
                            // console.log('111111111111',upPlayer.uid);
                            goldOneBackToplayer(upPlayer.inviteCode,total_fee,upPlayer.uid,player.nickname)
                        }    
                         saveGoldRecord(upPlayer,player.uid,backGold);
                    // }else{
                    //         playerInfo.update({uid:data.uid},{$inc:{gold:backGold}},{new:true},function (err, res) {
                    //                 if(err || !res){
                    //                     console.log('充值金币返利失败',res.uid);
                    //                     if(res.inviteCode){
                    //                         console.log('222222222');
                    //                         goldOneBackToplayer(res.inviteCode,total_fee,res.uid)
                    //                     }
                    //                 }else{
                    //                     saveGoldRecord(res,uid,backGold);
                    //                 }

                    //         });
                    // }
                }else{
                   return next(null);
                }
            });
        });      
    });

}



//充值金币的时候给玩家进行返利金币这是给一级返利

function  goldOneBackToplayer (inviteCode,total_fee,uid,nickname){
    const addGoldRebates = db.getDao('add_gold_rebates'); 
    const playerInfo = db.getDao('player_info'); 
    InviteCodeMgr.findOneInviteCodeInfo({inviteCode: inviteCode}, (error, data) => {  
            if (error || !data) {
                logger.error("出错：查找邀请码出错或未找到：" + inviteCode);
                return next(null);
            }
             // let upPlayer = PlayerMgr.getPlayer(data.uid);
              // let msgUserIds = upPlayer.uids();
        playerInfo.findOne({uid:data.uid},function(err,upPlayer){
            if (error || !data) {
                logger.error("出错：查找上级玩家出错或未找到：" + upPlayer);
                return next(null);
            }      
            addGoldRebates.findOne({rebateId:'234567'},function(err,result){
                if(result){
                   const rebate =  result.rebate;
                   // const rebate =  5;
                   const backGold = total_fee * 10 * rebate * 0.01;
                    // if(upPlayer){
                        // upPlayer.gold += backGold;
                        //     msgService.pushMessageByUids('addCoin', { //充值成功过后，对玩家的金币进行增加
                        //          gold:upPlayer.gold,//充值的金币
                        //          // rmb:total_fee, //充值的人名币
                        //          // remark:'您推荐的玩家充值了'+ total_fee * 10+'金币,你获得返利'+ backGold +'金币！'
                        //     }, msgUserIds);
                            let opts = {};
                            opts.name = '下级返利';
                            opts.content = '您的下级玩家'+nickname+'充值'+total_fee * 10+'金币,您获得'+backGold+'金币的返利';
                            opts.attachment = {gold:backGold};
                            MailService.generatorMail(opts, data.uid, function(err, mailDocs){
                                if(err){
                                  return next(null, {code: 500, error: '系统生成邮件'});
                                }
                            });
                         saveGoldRecord(upPlayer,uid,backGold);
                    // }else{
                    //         playerInfo.update({uid:data.uid},{$inc:{gold:backGold}},{new:true},function (err, res) {
                    //                 if(err || !res){
                    //                     console.log('充值金币返利失败');
                    //                 }else{
                    //                     saveGoldRecord(upPlayer,uid,backGold);
                    //                 }

                    //         });
                    // }
                }else{
                   return next(null);
                }
            });
        });    
    });

}

//充值金币的时候给玩家进行返利金币,返利记录
function  saveGoldRecord (upPlayer,uid,backGold){ 
    const goldBackRecord = db.getDao('gold_back_record'); 
    const info = {
        id:utils.id(),
        upPlayerUid : upPlayer.uid,
        nickname :upPlayer.nickname,
        payUid :uid,
        backGold :backGold,
        time : Date.now(),
    };
    //保存该返回金币记录
    goldBackRecord.create(info,function(err,data){
        if(err){
            console.error('返回金币返回失败' + upPlayer.uid);
        }
    });



}