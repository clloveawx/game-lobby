'use strict';

const logger = require('pomelo-logger').getLogger('log', __filename);
const Player = require('../../../domain/hall/player/Player');
const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');
const inviteCodeMgr = require('../../../domain/hall/inviteCode/inviteCodeMgr');
const httpMgr = require('../../../domain/hall/player/httpMgr');
const Games = require('../../../domain/ordinaryPlatform/Games');
const GamesMgr = require('../../../domain/ordinaryPlatform/GamesMgr');
const ordinaryPlatformMgr = require('../../../domain/ordinaryPlatform/ordinaryPlatformMgr');
const vipPlatform = require('../../../domain/vipPlatform/Platform');
const vipPlatformMgr = require('../../../domain/vipPlatform/PlatformMgr');
const utils = require('../../../utils');
const db = require('../../../utils/db/mongodb');
const msgService = require('../../../services/MessageService');
const pomelo = require('pomelo');

module.exports = function(app) {
	return new Remote(app);
};

var Remote = function(app) {
	this.app = app;
};

/**
 * 查询玩家是否在线
 */
Remote.prototype.isOnlin = function(data, cb){
	let _this = this;
	const dao = db.getDao('user_info');
	dao.findOne({cellPhone: data.phoneNumber}, function (err, user){
		if(err){
			return cb({code: 500, error:'查找用户失败'});
		}
		if(!user){
			return  cb({code: 500,error:'帐号不存在'})
		}
		if(user.passWord != data.password ){
			return cb({code: 500, error:'密码错误'});
		}
		if(user.passWord === data.password){
			let player = PlayerMgr.getPlayer(user.uid);
			if(player){
				_this.app.rpc.connector.enterRemote.isOnline(null,user.uid, function () {
					return cb({code: 200})
				});
			}else{
				return cb({code: 200})
			}
		}
	});
};

/**
 * 将产生的http验证码加入到httpCode里面
 */
Remote.prototype.getHttpCode = function({}, cb){
	const httpCode = utils.id();
	httpMgr.addHttpCodes(httpCode);
	return cb(httpCode);
};

Remote.prototype.getHttpCodes = function(cb){
	return cb(httpMgr.httpCodes());
};

/**
 * 获取所有在线玩家的信息
 */
Remote.prototype.getPlayers = function({}, cb){
	const players = PlayerMgr.players();
	return cb(players);
};

/**
 * 获取今日注册新玩家的信息
 */
Remote.prototype.getPlayersInfo = function(condition,cb){
	const dao = db.getDao('player_info');
	dao.find(condition,function(err,data){
		if(err){
			console.error('获取数据库数据失败');
		}else{
			return cb(data);
		}
	});
};

/**
 * 获取今日注册新玩家的信息
 */
Remote.prototype.getVipPlayers = function(condition,cb){
    const dao = db.getDao('player_info');
    const dao1 = db.getDao('platform');
    let vipPlayers = [];
    dao.find(condition,function(err,data){
		if(err){
			console.error('获取数据库数据失败');
		}else{
			data.forEach(player=>{
				let  vipPlayer ={};
				vipPlayer.uid = player.uid;
				vipPlayer.nickname = player.nickname;
				if(player.loginTime > player.lastLogoutTime){
					vipPlayer.onLineTime = Date.now() - player.loginTime;
				}else{
					vipPlayer.onLineTime = 0;
				}
				//vipPlayer.vipEffectiveTime = player.vipEffectiveTime;
				vipPlayer.vdot = player.vdot;
				vipPlayer.games = vipPlatformMgr.getPlatform(player.uid).games;
				vipPlayer.members = vipPlatformMgr.getPlatform(player.uid).members.length;
				vipPlayers.push(vipPlayer);
			});
			return cb(vipPlayers);
		}
    });
};

/**
 * 获取某个VIP玩家拥有的游戏信息
 */
Remote.prototype.getVipGames = function(condition, cb){
	// const players = PlayerMgr.players();
	const dao = db.getDao('platform');
	dao.findOne(condition,function(err,data){
			if(err){
				console.error('获取数据库数据失败');
			}else{
		 			let vipgames=[];
		 			let games = data.games;
		 			// console.log('games.....',games[0]);
			 		if(data.games){
			 			for(let i =0;i<games.length;i++){
					 		let  vipgame = {};
					 		let game = games[i]
					 		// console.log('game',game)
					 		vipgame.id = game.id;
					 		// vipgames.createTime = data.createTime;
						 	vipgame.rooms = game.rooms;
						 	vipgame.name = game.name;
                            vipgame.users = game.users;
						 	vipgame.nid = game.nid;
						 	vipgame.heatDegree = game.heatDegree;
						 	// console.log('vipgame',vipgame);
					 		let winMoney ;
				 			if(game.rooms.length >0){
						 		for(let i =0;i< game.rooms.length;i++){
						 			let room = game.rooms[i];
						 			winMoney +=room.winTotal - room.consumeTotal;
						 			vipgame.winMoney = winMoney;
							 		// console.log('vipgame.......',vipgame)
						 		}
				 			}
				 			vipgames.push(vipgame);
			 	   		}
		 			}
		 		return cb(vipgames);
			}
	});
};


/**
 * 获取玩家的金币和钻石交易记录
 */
Remote.prototype.getRecordCoinData = function(condition,cb){
	const dao = db.getDao('record_coin');
	dao.find(condition,function(err,data){
			if(err){
				console.error('获取数据库数据失败');
			}else{
		 		return cb(data);
			}
	});
};

/**
 * 获取客服消息
 */
Remote.prototype.getCustomer = function({type, search},cb){
	const dao = db.getDao('customer_info');
	const condition = {type};
	if (search) {
		condition.$and = [];
		//定义空的或条件
		const orcond = [];
		// 定义模糊匹配的查询条件
		const searchCon = {"$regex": search};
		// 模糊匹配编码
		orcond.push({"uid": searchCon});
		// 模糊匹配名称
		orcond.push({"player": searchCon});
		// 将或条件插入整体查询条件中
		condition.$and.push({"$or": orcond});
	}
	dao.find(condition, function(err,data){
		if(err){
			console.error('获取数据库数据失败');
		}else{
			return cb(data);
		}
	});
};

/**
 * 获取客服消息
 */
Remote.prototype.setCustomer = function(data, cb){
	const dao = db.getDao('customer_info');
    const playerModel = db.getDao('player_info');

    pomelo.app.rpc.hall.playerRemote.getUserInfo(null, data.uid, (err, userInfo) => {
        if(userInfo && userInfo.viperId && data.pass===true){
            playerModel.findOne({uid:userInfo.viperId}, function(err, result2){
                return cb(null,{belongToVip:true,vipNickname:result2.nickname});
            });
        }else{
            playerModel.findOne({uid:data.uid}, function(err, result){
                if(result.viperId && data.pass===true){
                    playerModel.findOne({uid:result.viperId}, function(err, result2){
                        return cb(null,{belongToVip:true,vipNickname:result2.nickname});
                    });
                }else{
                    const updateInfo = {};
                    if(data.pass === true){
                        updateInfo.passStatus = 1;
                    }
                    if(data.pass === false){
                        updateInfo.passStatus = 2;
                    }
                    if(data.num){
                        updateInfo.isSolve = data.num;
                    }
                    updateInfo.remark = data.remark;
                    updateInfo.passType = data.passType;// 1 为代理 2 为测试
                    dao.findOneAndUpdate({_id:data._id}, {$set: updateInfo}, {new: true}, function(err, res) {
                        if(err){
                            console.error(err)
                        }
                        err && logger.error('保存数据库失败');
                        if(err){
                            return cb({error:'绑定失败:',err})
                        }
                        return cb(null, {info: res});
                    });
                }
            });
        }
    });
};

/**
 * 发送公告
 */
Remote.prototype.postNotice = function(condition,cb){
	msgService.notice(condition, (err) =>{
        if(err != null){
            console.error('发送系统公告出错');
        }else{
            return cb(null, {code: 200});
        }
    })
};

/**
 * 根据输出的游戏进行查询游戏
 */
Remote.prototype.getGames = function(data,cb){
	let nid = data.nid;
	let game =	GamesMgr.getGame(nid);
	return cb(game);
};

/**
 * 根据输出的游戏和房间号进行查询游戏房间号
 */
Remote.prototype.getGameRoom = function(data,cb){
	let backRoom = {};
	let nid = data.nid;
	let roomCode = data.roomCode;
	let game =	GamesMgr.getGame(nid); 
	let room = game.rooms.find(room =>room.roomCode==roomCode);
	backRoom.room = room;
	backRoom.nid = game.nid;
	backRoom.name = game.name;
	return cb(backRoom);
};

/**
 * 获取当前所有的游戏
 */
Remote.prototype.getAllGames = function({},cb){
	let game =	GamesMgr.Games(); 
	return cb(game);
};

/*
*  获取玩家所有兑换的记录
*/
Remote.prototype.getCardRecord = function({},cb){
 	const dao = db.getDao('card_record');
	dao.find({},function(err,data){
		if(err){
			console.error('获取数据库数据失败');
		}else{
			return cb(data);
		}
	});
};

/*
*  获取玩家还没有兑换成功的记录
*/
Remote.prototype.getFalseCard = function({},cb){
 	const dao = db.getDao('card_record');
	dao.find({status:false},function(err,data){
		if(err){
			console.error('获取数据库数据失败');
		}else{
			return cb(data);
		}
	});
};

/*
*  改变玩家兑换成功的记录
*/
Remote.prototype.getChangeStatus = function(data,cb){
 	const dao = db.getDao('card_record');
	dao.update({_id:data._id}, {$set:{status:data.status}}, function(err,data){
			err && logger.error(uid, '保存数据库失败');
		if(err){
			return cb(null, {code: 500,error:'绑定失败'})
		}
		return cb(null, {code: 200})
	});
};

/**
 * 获取所有的邮件
 */
Remote.prototype.getMails = function({page},cb){
	const playerInfo = db.getDao('player_info');
	playerInfo.find({},{'uid':1,'nickname':1},function(err,players){
		require('../../../services/MailService').allMails({page}, function(err, {mails, len}){
			if(err){
				console.error(err);
				return cb(err);
			}
			const list = mails.map(m=>{
				const temp = players.find(x=>x.uid === m.receiverId);
				return {
					id:m.id,
					receiverId:m.receiverId,
					sender:m.sender,
					name:m.name,
					isRead:m.isRead,
					content:m.content,
					time:m.time,
					attachment:m.attachment,
					nickname:temp.nickname,
				}

			})
			return cb(null, {docs: list, len});
		});
	});
};


/**
 * 设置邀请码
 */
Remote.prototype.setInviteCode = function({uid,promoterId},cb){
	const platform = db.getDao('platform');
	const inviteCodeInfo = db.getDao('invite_code_info');
	 platform.findOne({'creator.uid': uid},function(err,viper){
	 	if(viper){
			inviteCodeMgr.refreshInviteCodeInternal(uid,function(err,inviteCode){
				if(err){
						cb({code: 500, error: err.message});
				}else{
					const info = {
						inviteCode :inviteCode,
						uid:uid,
						promoterId: promoterId,
						createTime: Date.now(),
						boundUid :'',
						viper:uid,
						integral:0,
						rebate:0,
						inviteRecords:[],
					};
					inviteCodeInfo.create(info,function(err,data){
								if (!err || user) {
									cb({code: 200});
								}else{
									cb({code: 500, error: err.message});
								} 
					});
				}
			});
	 	}else{
	 		cb({code: 500, error: '该房主不存在不能绑定！'});
	 	}


	 });

};


/**
 * 获取内存中所有在线玩家
 */
Remote.prototype.allPlayersInMemory = function(cb){
	cb(PlayerMgr.players());
};

/**
 * 发送通知给前端要关闭的游戏
 */
Remote.prototype.closeGame = function(data,cb){

	const userInfo = utils.values(PlayerMgr.players()).map(player =>{
		return {uid: player.uid, sid: player.sid};
	});
	// console.log('data.........',data);
	// console.log('userInfo.........',userInfo);
    msgService.pushMessageByUids('shutGame', { //对玩家进行通知要addCoin
    	[data.nid]:data.status
    }, userInfo);
   		cb({code: 200});
};




/**
 * 根据渠道获取代理下面的玩家相关数据总和
 */
Remote.prototype.agencyOfData = function({uid},cb){
		const  playerInfo = db.getDao('player_info');
		const  inviteCodeInfo = db.getDao('invite_code_info');
		const  payInfo = db.getDao('pay_info');
		const  userInfo = db.getDao('user_info');
		const  goldBackRecord = db.getDao('gold_back_record');
		const  dailiAddMoney = db.getDao('daili_add_money');
		let arr =[];
		let results = [];
		let secondlength = 0;
		inviteCodeInfo.findOne({uid:uid},function(err,invites){ //一级代理的uid
			// console.log('invites......',invites);	
			if(invites){
				const invite  = invites.inviteRecords;//获取二级代理的uid
				inviteCodeInfo.find({uid:{$in:invite}},function(err,invitePlayers){
					invitePlayers.forEach(m=>{   
						arr = arr.concat(m.inviteRecords); //组合  获取三级代理的uid
					});
					// console.log("arr.......",arr);
					inviteCodeInfo.find({uid:{$in:arr}},function(err,ars){
						// console.log('ars..........',ars);
						// if(ars.length !=0){
							arr.forEach(m=>{
								let result = {};
							 	 const temp = ars.filter(x=>x.uid === m);
							 	 // console.log('temp.....',temp);
							 	 let playerlength = 0;
							 	 for(var i =0;i<temp.length;i++){
							 	 	 playerlength +=temp[i].inviteRecords.length;

							 	 }
							 	 // result.uid = temp[0].uid;
							 	 result.superior = m;
							 	 result.playerlength = playerlength;
							 	 results.push(result);
							});
							// console.log('result......',results);	
						userInfo.find({uid:{$in:invite}},function(err,users){
							dailiAddMoney.find({uid:{$in:invite}},function(err,moneys){
								playerInfo.find({uid:{$in:invite}},function(err,players){
								  //   goldBackRecord.aggregate()  //聚合该玩家所有的返利情况
										// .match({uid:{$in:invite}})
										// .group({_id: {uid:'$uid',},'sum': {'$sum': '$backGold'}})
										// .then(function(backGolds){
											const list = players.map(m => {
												const temp2  = invitePlayers.find(x => x.uid === m.uid);
												const temp1 = results.filter(x=>x.superior === m.uid);
												const temp4 = users.find(x =>x.uid === m.uid);
												const temp5 =  PlayerMgr.getPlayer(m.uid);
												const temp6 = moneys.find(x=>x.uid === m.uid);
												// console.log('temp5.....',temp5);
												// const temp3 = backGolds.find(x => x._id.uid === m.uid);
												let  lengths = 0;
												temp1.forEach( m =>{
													lengths +=m.playerlength;
												});
												// console.log('lengths......',lengths);
												// console.log('temp1......',temp1);  

												return {
													uid: m.uid,
													nickname: m.nickname,
													onePlayer: temp2 ? temp2.inviteRecords.length : 0,
													sePlayers: lengths,
													addRmb: m.addRmb,
													gold: m.gold,
													props: m.props,
													createTime:m.createTime,
													cellPhone:(temp4.cellPhone ? temp4.cellPhone:'没有绑定手机'),
													sex :m.sex ? m.sex : 0 ,
													remark :temp4 ? temp4.remark:'没有备注',
													online:temp5 ? 1 : 0,
													money : temp6 ? temp6.money :0, 

													// backGold : temp3 ? temp3.sum:0,
												}
											});
											cb({code:200,result:list});

									// });
								});
							});	
						});		
						// }else{
						//    res.send({code:500,error:'该渠道的邀请码没有二级玩家'});
						// }
					});
				});
				
			}else{
				cb({code:500,error:'该渠道还没有二维码以及相关数据'});
			}
		});
};


/**
 * 获取该渠道下面的玩家
 */
Remote.prototype.getAgencyAllDate = function({uid},cb){
	const  playerInfo = db.getDao('player_info');
		const  inviteCodeInfo = db.getDao('invite_code_info');
		const  payInfo = db.getDao('pay_info');
		const  userInfo = db.getDao('user_info');
		const  goldBackRecord = db.getDao('gold_back_record');
		let  arr = [];
		let  arrall = [];
		inviteCodeInfo.findOne({uid:uid},function(err,playerinvite){
			if(playerinvite){
				inviteCodeInfo.find({viper:uid},function(err,invites){
					// console.log('invites......',!invites);
					if(invites){
						invites.forEach( m =>{
						  	arr = arr.concat(m.inviteRecords);
						});
						// arr.push();
						arrall = arrall.concat(arr);
						// console.log('arr.........',arr,playerinvite.inviteRecords);
						arr = utils.difference(arr,playerinvite.inviteRecords);//将一级代理从数组中剔除
						arrall.push(uid);//将渠道的Uid加入该数组
						// console.log('arrall.....',arrall);
						// console.log('arr.....',arr);
							playerInfo.find({uid:{$in:arr}},{'uid':1,'nickname':1,'createTime':1,'addRmb':1,'gold':1,'props':1,'inviteCode':1},function(err,players){
								userInfo.find({uid:{$in:arr}},function(err,users){
									playerInfo.find({uid:{$in:arrall}},{'uid':1,'nickname':1,'createTime':1,'addRmb':1,'gold':1,'props':1,'inviteCode':1},function(err,allplayers){
										inviteCodeInfo.find({uid:{$in:arrall}},function(err,invitePlayers){
												// goldBackRecord.aggregate()  //聚合该玩家所有的返利情况
												// 	.match({uid:{$in:invite}})
												// 	.group({_id: {uid:'$uid',},'sum': {'$sum': '$backGold'}})
												// 	.then(function(backGolds){
													// console.log('invitePlayers.....',invitePlayers);
													// console.log('players....',players);
														const list = players.map(m => {
															const temp  = invitePlayers.find(x => m.uid === x.uid);
															const temp5 =  PlayerMgr.getPlayer(m.uid);
															const temp1 = invitePlayers.find(x => x.inviteCode === m.inviteCode); //查找上级玩家邀请码
															const temp3 = allplayers.find(x=>x.uid === temp1.uid);//根据上级玩家的uid查找玩家的基本信息
															const temp4 = users.find(x=>x.uid === m.uid);
															// const temp2 = players.find(x=>x.uid === temp2.superior );
															// const temp3 = backGolds.find(x => x._id.uid === m.uid);
															// console.log('temp.....',temp);
															// console.log('temp3.....',temp3);
															return {
																uid: m.uid,
																nickname: m.nickname,
																upPlayer: temp1 ? temp1.uid : 0,
																upPlayerName:temp3?temp3.nickname :'渠道',
																createTime:m.createTime,
																players:  temp ? temp.inviteRecords.length:0,
																addRmb: m.addRmb,
																cellPhone:(temp4.cellPhone ? temp4.cellPhone:'没有绑定手机'),
																gold: m.gold,
																props: m.props,
																online:temp5 ? 1 : 0,
																// backGold : temp3 ? temp3.sum:0,
															}
														});
														// console.log('result............',list);
														cb({code:200,result:list});
												// });
										});
									});	
								});		
							});
					}else{
						cb({code:500,error:'该渠道还没有二维码以及相关数据'});
					}
				});
			}else{
				cb({code:500,error:'该渠道还没有二维码以及相关数据'});
			}
		});



};

/**
 * 获取一级代理下面所有玩家
 */
Remote.prototype.getDailiPlayers = function({uid},cb){
		const  playerInfo = db.getDao('player_info');
		const  inviteCodeInfo = db.getDao('invite_code_info');
		const  userInfo = db.getDao('user_info');
		let arr =[];
		inviteCodeInfo.find({secondViper:uid},function(err,invites){
			if(invites){
				// console.log('invites...........',invites)
				invites.forEach(m=>{
						arr = arr.concat(m.inviteRecords);
				});
				// console.log('arr.........',arr)
				playerInfo.find({uid:{$in:arr}},function(err,players){
					userInfo.find({uid:{$in:arr}},function(err,users){
						console.log('player...',players)
						const list = players.map(m => {
							const temp = invites.find(x=>x.uid === m.uid );
							const temp1 = invites.find(x=>x.inviteCode === m.inviteCode);
							const temp5 =  PlayerMgr.getPlayer(m.uid);
							const temp4 = users.find(x=>x.uid === m.uid);
							// console.log('temp...',temp)
							// console.log('temp1...',temp1)
							return {
								uid: m.uid,
								nickname: m.nickname,
								superior: temp1 ? temp1.uid : 0,
								inviteRecords: temp ? temp.inviteRecords.length : 0,
								addRmb: m.addRmb,
								gold: m.gold,
								props: m.props,
								online:temp5 ? 1 : 0,
								cellPhone:(temp4.cellPhone ? temp4.cellPhone:'没有绑定手机'),
							}
						});
						cb({code:200,result:list});	
					});
				});

			}else{
				cb({code: 500,error:'没有相关数据！'});
			}
		});
}


/**
 * 获取一级代理下面所有玩家
 */
Remote.prototype.getAllVip = function({},cb){
	const playerModel = db.getDao('player_info');
	const changeIntegral = db.getDao('change_integral');
	const platform = db.getDao('platform');
	const customerInfo = db.getDao('customer_info');
	playerModel.find({vip:true},function(err, players){
		playerModel.find({viperId: {$in: players.map(m => m.uid)}},function(err, all){
			changeIntegral.aggregate()
				.group({_id: {viperId:'$viperId', type:'$type'},'sum': {'$sum': '$integral'}}).then(function (vips) {
					platform.find({'creator.uid': {$in: players.map(m => m.uid)}}, function (err, arr) {
						customerInfo.find({uid:{$in: players.map(m => m.uid)},passStatus:1}, function (err, cuntomers) {
							const list = players.map(m => {
								// const temp = arr.find(x => x.creator.uid === m.uid);
								const temp2 = vips.find(x => x._id.viperId === m.uid);
								const temp3 = cuntomers.find(x => x.uid === m.uid);
								const temp4 = all.filter(x => x.viperId === m.uid);
								// console.log('temp4..........',temp4);
								return {
									uid: m.uid,
									nickname: m.nickname,
									vipEffectiveTime: m.vipEffectiveTime,
									vdot: m.vdot,
									addRmb: m.addRmb,
									members: temp4.length,
									add: temp2 && temp2._id.type === 'add' ? temp2.sum : 0,
									del: temp2 && temp2._id.type === 'del' ? temp2.sum : 0,
									tester:temp3.passType,
									remark:temp3.remark,
								}
							});
							// console.log(list);
							cb({code:200, result:list});
					    });
					});
			});
		});
	});
}