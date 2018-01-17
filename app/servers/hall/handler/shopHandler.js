
'use strict';

const Logger = require('pomelo-logger').getLogger('log', __filename);
const PropsMgr = require('../../../domain/hall/props/PropsMgr');
const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');
const vipPlatformMgr = require('../../../domain/vipPlatform/PlatformMgr');
const Props = require('../../../domain/hall/props/Props');
const JsonMgr = require('../../../../config/data/JsonMgr');
const MailService = require('../../../services/MailService');
const sessionService = require('../../../services/sessionService');
const pomelo = require('pomelo');
const utils = require('../../../utils');
const db = require('../../../utils/db/mongodb');
const RongcloudSmsService = require('../../../services/RongcloudSmsService');
const async = require('async');
const shopChange = require('../../../../config/data/shopchange.json');
const shopUrl = require('../../../../config/data/shopUrl.json');

module.exports = function (app) {
	return new Handler(app);
};

function Handler(app) {
	this.app = app;
}

const proto = Handler.prototype;

/**
 * 获取商店的道具信息 
 * @param msg name
 */

proto.shopAll = function (msg, session, next) {
	 let shop = JsonMgr.get('shop');
	 let datas = shop.datas;
	 return  next(null,{code :200,shopAll : datas})
};

/**
 * 购买vip
 * @param {vipId}
 * @route: hall.shopHandler.buyVip
 */
proto.buyVip = ({vipId}, session, next) =>{
	if(vipId == null){
		return next(null, {code:500, error:'请传入vipId'});
	}
	const shop = JsonMgr.get('shop');
	const vipInfo = shop.datas.find(data => data.id == vipId); 
	const player = PlayerMgr.getPlayer(session.uid);
	if(!player.canViper){
		return next(null, {code: 502, error:'请提交代理申请'});
	}
	if(player.gold - vipInfo.price < 0){
		return next(null, {code: 500, error:'玩家金币数量不足'});
	}
	player.gold -= vipInfo.price;
	// 构建平台 生成邀请码
	if(player.vip){
		//player.vipEffectiveTime += vipInfo.pfv * 1000; //充值过后加上累积点数
		player.vdot += vipInfo.pfv * 1000; //充值过后加上累积点数
		return next(null, {code: 200, platform: vipPlatformMgr.getPlatform(session.uid),gold:player.gold});
	}else{
		new Promise((resolve, reject) =>{
			if(player.inviteCode){  //如果玩家有邀请码,需要将他从对应的vip环境清除
				vipPlatformMgr.removeUserFromPlatform(player.uid, player.viperId);
				const inviteCodeMgr = require('../../../domain/hall/inviteCode/inviteCodeMgr');
				inviteCodeMgr.findOneInviteCodeInfo({inviteCode: player.inviteCode},function(err,doc){
					if(err){
						return reject('查找出错',err)
					}
					if(!doc){
						return reject('未找到该邀请码对应数据')
					}
					const index = doc.inviteRecords.findIndex(user => user == player.uid);
					if(index == -1){
						return reject('玩家未在该邀请码环境',uid, doc.inviteRecords);
					}
					doc.inviteRecords.splice(index, 1);

					inviteCodeMgr.updateInviteCode({inviteCode: player.inviteCode}, {'$set':{inviteRecords: doc.inviteRecords}}, {}, function(err){
						if(err){
							return reject('更新数据失败',err);
						}
						//清除玩家已有的邀请码
						player.inviteCode = '';
						resolve();
					});
				});
			}else{
				resolve();
			}
		}).then(()=>{
			//player.vipEffectiveTime += vipInfo.pfv * 1000; //充值过后加上累积点数
			player.vdot += vipInfo.pfv * 1000;
			player.vipStartTime = new Date(new Date().toLocaleDateString()).getTime();//开通VIP的时间是计算当天凌晨的时间错
			player.vip = true;
			player.viperId = session.uid;
			player.inviteCodeBindTime = Date.now(); //vip綁定時間
			vipPlatformMgr.createPlatform(player);
			const newPlatform = vipPlatformMgr.getPlatform(session.uid);
			newPlatform.addMember(player.bindToPlatform());
			return next(null, {code: 200, platform: vipPlatformMgr.getPlatform(session.uid),gold:player.gold});
		}).catch(err =>{
			console.error(err)
			Logger.error('购买vip失败',err);
		})
	}
};

/**
 * 获取充值卡的信息
 * @param msg name
 */
proto.phoneCard = function (msg, session, next) {
	let phoneCard = JsonMgr.get('shopchange');
	const cardRecord = db.getDao('card_record');
	let cardData = phoneCard.datas;
	const promises = [];
	const dealOne = (data) =>{
		return new Promise((resolve, reject) =>{
			cardRecord.count({id:data.id}, function(err,count){
				if(err){
					console.error("查询失败");
				}
				data.count = count;
				resolve(data);
			});
		});
	};
	for(let i=0; i<cardData.length;i++){
		promises.push(dealOne(cardData[i]));
	}
	Promise.all(promises).then((result) =>{
		return next(null, {code: 200, phoneCard:cardData});
	});

};
/**
 * 兑换充值卡的信息
 * @param msg name
 */
proto.buyCard = function (msg, session, next) {
	const cardRecord = db.getDao('card_record');//兑换记录数据库
	const userInfo = db.getDao('user_info');
    const saveCardThings = db.getDao('save_card_things');//话费卡数据库
    const warnDB = db.getDao('warn_value');//兑奖开关
    const closeCard = db.getDao('close_card');
    let player = PlayerMgr.getPlayer(session.uid);
    let userPhone = '';
    let sendStauts = 1;

	let recordTime = Date.now();
	async.waterfall([
		(callback) =>{//兑奖开关
			closeCard.findOne({id:'123456'},function(err,res){
				if(!res.isOpen){
					return callback('库存不足，请稍后再试');
				}
                return callback(null);
			});

		},
		(callback) => {//查询用户信息
			userInfo.findOne({uid:session.uid},function(err,user){
				if(!user.cellPhone){
					return callback('为了方便及时的联系玩家您,请您绑定手机过后再进行兑换商品！');
				}
				if(player.props < msg.allGold){
					return callback('你的碎片不足,无法兑换');
				}

				userPhone = user.cellPhone;
				return callback(null);

			});
		},
		(callback) => {//查询可以使用的卡
			saveCardThings.find({id:msg.id,status:0},(error,data)=>{
				if(error){
					return callback('查询卡数据库出错');
				}
				if(data.length<msg.cardNum){
					return callback('卡余量不足');
				}
				return callback(null,data);

			}).limit(msg.cardNum);
		},
        (arg1,callback) =>{//审核用户兑奖
            warnDB.findOne({},(error,data)=>{
                if(error){
                    return callback('查询卡数据库出错');
                }
                let currNum = shopChange.find(m=>m.id == msg.id).price * msg.cardNum;//本次兑换总价值
                let newPlayerRmb = player.addRmb || data.money;
                if((player.addExchange+currNum)/newPlayerRmb >= data.moneyTimes){
                    sendStauts = 0;//审核中
                    //发送审核短信
                    RongcloudSmsService.sendWarn(
                        player,
                        shopChange.find(m=>m.id == msg.id).name,
                        player.addExchange+currNum
                    );
                }
                return callback(null,arg1);
            });
        },
        (arg1,callback)=>{//添加兑换记录
            player.address = msg.address;
            player.props -= msg.allGold;
            let arr = [];
            arg1.forEach(m=>{//添加环境兑换的卡号卡密数据
                let ob = {};
                let card = shopChange.find(h=>h.id == m.id);
                ob['cardNo'] = m.cardNo;
                ob['cardPassWord'] = m.cardPassWord;
                player.addExchange += card.price;//记录玩家累计兑换金额
                arr.push(ob);
            });
            const  info = {
                uid:session.uid,
                recordId:utils.id(),
                id:msg.id,
                cardNum:msg.cardNum,
                name:msg.name,
                allGold:msg.allGold,
                time:recordTime,
                status:sendStauts,
                address:msg.address,
                cardNo:arr

            }
            cardRecord.create(info,function(err, res){
                if (err || !res) {
                    callback('兑换失败');
                } else {
                    callback(null,{props:player.props,cardData:arg1});
                }
            });
        }
    ], function (err, result) {
		if(err){
			return next(null,{code :500,error:err});
		}
		result.cardData.forEach(m=>{
			saveCardThings.update({cardNo:m.cardNo},{status:1,recordTime:recordTime},()=>{});//更新卡状态

			if(sendStauts){
                RongcloudSmsService.remindExchange1(userPhone,m.cardName,m.cardNo,m.cardPassWord);//发送短信给玩家
                //发送邮件
                let card = shopChange.find(h=>h.id == m.id);
                let opts = {
                    name:'['+card.dese.substring(2,card.dese.length)+']兑换成功',
                    content : '恭喜您成功'+card.dese+'。'+'卡号['+m.cardNo+'] 卡密['+m.cardPassWord+'] '+'闲置专让['+shopUrl.url+']'
                }
                MailService.generatorMail(opts,player.uid, function(err, mailDocs){//给玩家发邮件
                    if(err){
                        return next(null, {code: 500, error: '系统生成邮件'});
                    }
                });
            }
		});

		if(sendStauts){
            setTimeout(()=>{
                //查询该类型卡的剩余
                saveCardThings.find({id: msg.id, status: 0}, (error, data) => {
                    if (error) {
                        console.error('查询出错');
                        return;
                    }
                    result.cardData.forEach(m => {
                        RongcloudSmsService.remindExchange(session.uid, msg.name, m.cardNo, data.length);//发送短信给市场
                    });

                });
            },1000);
        }

        if(sendStauts == 0){
            return next(null,{code :200,msg:'兑奖审核中，客服将尽快处理',props:result.props});
        }

		return next(null, {code: 200, msg:'兑奖成功，请在邮件中查看奖品',props:result.props});//返回奖券

	});


};

/**
 * 获取该玩家的兑换信息
 * @param msg name
 */
proto.getCardRecord = function (msg, session, next) {
	const cardRecord = db.getDao('card_record');
	cardRecord.find({uid:session.uid},function(err,data){
		if(err){
			return	next(null, {code: 500,error: '查询失败'});
		}else{
			return	next(null, {code: 200,getCardRecord:data});
		}
	});
};

/**
 * 获取充值的信息
 * @param msg name
 */
proto.recharge = function (msg, session, next) {
	let gold = JsonMgr.get('gold');
	let diamond = JsonMgr.get('diamond');
	let buyGold = gold.datas;
	let buyDiamond = diamond.datas;
	const isVipEnv = session.get('VIP_ENV');
	if(isVipEnv){ //是VIP发送砖石
		return  next(null,{code :200, recharge:buyDiamond})
	}else{					//不是VIP发送金币
		return  next(null,{code :200, recharge : buyGold })
	} 
};



/**
 * 获取存钱罐的信息
 * @param msg name
 */
 proto.getSelfBank = function (msg, session, next) {
 	 let  user = PlayerMgr.getPlayer(session.uid);
 	 let  selfBank = user.selfBank;
 	 let  discount;
 	 if(selfBank < 60000){
 	 	 discount = 1;
 	 }else if(60000<=selfBank<300000){
 	 	 discount =0.95
 	 }else if(300000<=selfBank<980000){
 	 	 discount =0.9
 	 }else if(980000<=selfBank<1980000){
 	 	 discount =0.85
 	 }else if(1980000<=selfBank<3280000){
 	 	 discount =0.8
 	 }else if(3280000<=selfBank<6480000){
 	 	 discount =0.75
 	 }
 	 let  rmb = (selfBank/6480000 * 648 * discount).toFixed(2);
 	 return next(null,{code:200,selfBank:selfBank,discount:discount,rmb:rmb});
};

/**
 * 添加市场的道具信息
 * @param msg name
 */
proto.addProps = function (msg, session, next) {

	const isVipEnv = session.get('VIP_ENV');
	let  propsPrice = msg.propsPrice;
	let  user = PlayerMgr.getPlayer(session.uid);
	const props = new Props({});

	if(user.props < 1){
		return  next(null,{code :500,error : '你挂售的道具数量不够！'})
	}
	if(isVipEnv == true){
		props.inviteCode = user.inviteCode;
		props.coinType = 1; //1是钻石，2是金币 3是人名币
		let shopAll  = PropsMgr.getPropsforSellerId(user.inviteCode,user.uid)
		if(shopAll.length >=5){
			return  next(null,{code :500,error : '最多可挂售五个道具！'})
		}
	}else{
		props.coinType = 2;
		let shopAll  = PropsMgr.getPropsforSellerId('',user.uid)
		if(shopAll.length >=5){
			return  next(null,{code :500,error : '最多可挂售五个道具！'})
		}
	}
	props.price  = propsPrice;
	props.id = utils.id();
	props.seller = user.nickname;
	props.sellerId = user.uid;
	user.props -=1;
	props.name = '道具1';
	PropsMgr.addProps(props);
	if(isVipEnv){
		return  next(null,{code :200,propsAll : PropsMgr.getPropsforinviteCode(user.inviteCode,user.uid),props:user.props })
	}
	return  next(null,{code :200,propsAll : PropsMgr.getPropsforinviteCode('',user.uid),props:user.props})

};

/**
 * 查找市场的道具信息
 * @param msg name
 */
proto.getProps = function (msg, session, next) {
	let user = PlayerMgr.getPlayer(session.uid);
	let shopAll  = PropsMgr.getPropsforinviteCode(msg.inviteCode)
	const isVipEnv = session.get('VIP_ENV');
	if(isVipEnv){
		return  next(null,{code :200,getProps : PropsMgr.getPropsforinviteCode(user.inviteCode,user.uid)})
	}
	return  next(null,{code :200,getProps : PropsMgr.getPropsforinviteCode('',user.uid)})
};


/**
* 购买市场的道具信息
*/
proto.buyProps = function (msg, session, next) {
	let user = PlayerMgr.getPlayer(session.uid);
	let props = PropsMgr.getPropsforId(msg.id);
	if(!props){
		return next(null,{code :500,error:'该道具已下架或者不存在！'})
	}
	const isVipEnv = session.get('VIP_ENV');
	let opts = {};
	let opts1 ={};
	opts.name = '卖售的道具';
	opts.content = '恭喜你，你的道具已经被购买，请查收你得到的金币或者钻石';
	opts1.name = '购买的道具';
	opts1.attachment ={props:1}
	if(isVipEnv){
		if(user.diamond <  props.price){
			return next(null,{code :500,msg : '你的钻石不足,购买不了该道具'})
		}else{
			opts.attachment = {diamond:props.price};
			opts1.content = '恭喜你，你花费了'+props.price+'的钻石价格购买了该道具!';
			user.diamond  -= props.price;
			PropsMgr.removeProps(msg.id);
			MailService.generatorMail(opts, props.sellerId, function(err, mailDocs){
				if(err){
					return next(null, {code: 500, error: '系统生成邮件'});
				}
			});
			//购买了道具发送邮件
			MailService.generatorMail(opts1, session.uid, function(err, mailDocs){
				if(err){
					return next(null, {code: 500, error: '系统生成邮件'});
				}
			});
			//记录交易
			pomelo.app.rpc.hall.playerRemote.recordCoin(session, {uid:session.uid,nickname:user.nickname,coinType:'diamond',diamond:user.diamond,gold:user.gold,changeNum:'-'+props.price,changeType:3},function(){});
			next(null,{code :200,diamond:user.diamond})
		}
	}else{
		if(user.gold <  props.price){
			return next(null,{code :500,error : '你的金币不足,购买不了该道具'})
		}else{
			user.gold  -= props.price;
			PropsMgr.removeProps(msg.id);
			opts.attachment = {gold:props.price};
			opts1.content = '恭喜你，你花费了'+props.price+'的金币价格购买了该道具!';
			MailService.generatorMail(opts, props.sellerId, function(err, mailDocs){
				if(err){
					return next(null, {code: 500, error: '系统生成邮件'});
				}
			});

			//购买了道具发送邮件
			MailService.generatorMail(opts1, session.uid, function(err, mailDocs){
				if(err){
					return next(null, {code: 500, error: '系统生成邮件'});
				}
			});

			//记录交易
			pomelo.app.rpc.hall.playerRemote.recordCoin(session, {uid:session.uid,nickname:user.nickname,coinType:'gold',diamond:user.diamond,gold:user.gold,changeNum:'-'+props.price,changeType:3},function(){});
			next(null,{code :200,gold:user.gold})
		}
 	}
};

/**
* 下架市场的道具信息
*/
proto.downProps = function (msg, session, next) {
	let  props = PropsMgr.getPropsforId(msg.id);
	if(!props){
		return next(null,{code :500,error:'该道具已下架或者不存在！'})
	}
	let  user = PlayerMgr.getPlayer(session.uid);
	PropsMgr.removeProps(msg.id);
	user.props +=1;
	return next(null,{code :200,props:user.props})
	
};


/**
* 积分商城充值上传图片
*/
proto.setPayImage = function (msg, session, next) {
	const payImage = db.getDao('pay_image');
	if(!msg.imageName){
		 return next({code: 500,error:'上传图片失败！'});
	}
	const info = {
		uid : session.uid,
		imageId :utils.id(),
		imageName :msg.imageName,
		creatTime : Date.now(),
		remark : msg.remark,
	}
        payImage.create(info, function (err, res) {
                if (err || !res) {
                    return next({code: 500,error:'上传图片失败！'});
                }else{
                   return next(null,{code :200,setPayImage:res})
                }
        });   

};

/**
* 积分商城充值删除图片
*/
proto.delPayImage = function (msg, session, next) {
	const payImage = db.getDao('pay_image');
        payImage.remove({imageId:msg.imageId}, function (err, res) {
                if (err ) {
                    return next({code: 500,error:'删除配置失败！'});
                }
        });   
	return next(null,{code :200,msg:'删除配置成功！'})
};

/**
* 积分商城充值获取图片
*/
proto.getPayImage = function (msg, session, next) {
	const payImage = db.getDao('pay_image');
	const player = PlayerMgr.getPlayer(session.uid);
	let userId;
	if(player.vip){
		userId = session.uid;
	}else{
		userId = player.viperId;
	}
    payImage.find({uid:userId}, function (err, data) {
    	// console.log(data);
      	if(data){
      		return next(null,{code :200,getPayImage:data})
      	}else{
      		return next(null,{code :500,error:'获取积分商城失败！'})
      	}
    });   
};


/**
* 积分商城充值获取图片
*/
proto.updatePayImage = function (msg, session, next) {
	const payImage = db.getDao('pay_image');
	console.log('msg.imageName',msg);
	let info = {};
	if(msg.imageName){
		info = {imageName:msg.imageName,remark:msg.remark};
	}else{
		info = {remark:msg.remark};
	}
    payImage.update({imageId:msg.imageId},{$set: info},{new:true}, function (err, data) {
    	// console.log(data);
      	if(data){
      		payImage.findOne({imageId:msg.imageId},function(err,res){
      			if(res){
      				return next(null,{code :200,setPayImage:res});
      			}
      		});
      	}else{
      		return next(null,{code :500,error:'获取积分商城失败！'});
      	}
    });   
};

/**
* 获取那些支付是开启的
*/
proto.getOpenPayType = function (msg, session, next) {
		const payType = db.getDao('pay_type');
		payType.find({isOpen:true},function(err,result){
			if(!err){
				return next(null,{code :200,result:result});
			}else{
				return next(null,{code :500,error:'获取数据失败'});
			}
		});

};