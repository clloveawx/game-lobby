'use strict';

const logger = require('pomelo-logger').getLogger('log', __filename);
const Player = require('../../../domain/hall/player/Player');
const RecordCoin = require('../../../domain/hall/recordCoin/RecordCoin');
const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');
const Games = require('../../../domain/ordinaryPlatform/Games');
const GamesMgr = require('../../../domain/ordinaryPlatform/GamesMgr');
const ordinaryPlatformMgr = require('../../../domain/ordinaryPlatform/ordinaryPlatformMgr');
const vipPlatform = require('../../../domain/vipPlatform/Platform');
const vipPlatformMgr = require('../../../domain/vipPlatform/PlatformMgr');
const InviteCodeMgr = require('../../../domain/hall/inviteCode/inviteCodeMgr');
const utils = require('../../../utils');
const db = require('../../../utils/db/mongodb');
const msgService = require('../../../services/MessageService');
const MailService = require('../../../services/MailService');
const JsonMgr = require('../../../../config/data/JsonMgr');


module.exports = function(app) {
	return new Remote(app);
};

var Remote = function(app) {
	this.app = app;
};

// 创建
const create = function (uid, isRobot, inviteCode, next) {
	const nickname = '游客' + uid;
    let player = new Player({
        uid: uid,
        nickname: nickname,
        vip: false,
        headurl: utils.getHead(),
        isRobot: isRobot,
        gold:2000,
    });
    if (!inviteCode || inviteCode === 'seetook') {
        insertPlayerIntoDatabase(player, null, next);
	} else {
			let gameVersion = JsonMgr.get('gameBeat').getById(1).gameVersion;
		if(gameVersion == 1){ //当版本号为1 的时候为网吧版本 
			internetCafesToInviteCode(player,inviteCode,next);
		}else{
       	 	officialToInviteCode(player,inviteCode,next);
		}
	}
};

	//网吧版本的版本路线
function internetCafesToInviteCode(player,inviteCode,next){
	InviteCodeMgr.findOneInviteCodeInfo({inviteCode: inviteCode}, (error, data) => {
            if (error || !data) {
                logger.error("出错：查找邀请码出错或未找到：" + inviteCode);
                return next(null);
			}
			player.inviteCode = inviteCode;
            insertPlayerIntoDatabase(player, data, next);
        });


}


	//正式服务器的版本路线
function officialToInviteCode (player,inviteCode,next){
	InviteCodeMgr.findOneInviteCodeInfo({inviteCode: inviteCode}, (error, data) => {
            if (error || !data) {
                logger.error("出错：查找邀请码出错或未找到：" + inviteCode);
                return next(null);
			}
			if (data.effectiveTimes != null && data.effectiveTimes <= data.inviteRecords.length) {
                logger.error("该邀请码的有效次数已用完" + inviteCode);
                return next(null);
			}
			player.inviteCode = inviteCode;
			player.viperId = data.uid;
            //只有是邀请码绑定者且积分不为0才更新积分
            player.integral = data.integral;
            //根据初始积分来进行返利积分
            if(data.boundUid  && data.rebate){
				let playerBound = PlayerMgr.getPlayer(data.boundUid);
				// const platform = vipPlatformMgr.getPlatform(data.boundUid);
				// let moshi = platform.vipModel;
				// if(moshi == 'discount'){
					if(playerBound){
						playerBound.integral += data.integral  * data.rebate * 0.01;
					}else{
						//在数据中进行修改房主的V点
						require('../../../utils/db/mongodb').getDao('player_info').update({uid:data.boundUid}, {$inc: {vdot: data.integral  * data.rebate * 0.01}},{new: true},function(err, data){
							if(err){
								console.error('查找玩家失败:',uid);
							}
						})
					}
				// }
            }
            //根据初始积分来进行扣除房主的V点
    //         if(data.integral > 0){
				// let playerVip = PlayerMgr.getPlayer(data.uid);
				// const platform = vipPlatformMgr.getPlatform(data.uid);
				// let moshi = platform.vipModel;
				// if(moshi == 'discount'){
				// 	if(playerVip){
				// 		playerVip.vdot -= data.integral  * 0.001;
				// 	}else{
				// 		//在数据中进行修改房主的V点
				// 		require('../../../utils/db/mongodb').getDao('player_info').update({uid:data.viper}, {$inc: {vdot: -data.integral  * 0.001}},{new: true},function(err, data){
				// 			if(err){
				// 				console.error('查找玩家失败:',uid);
				// 			}
				// 		})
				// 	}
				// }
    //         }
            if( data.integral != 0){
	            const integralRecord = db.getDao('change_integral');
	            let record = {
					uid:player.uid,
					nickname:player.nickname,
					integral : data.integral,
					isback : false,
					rebate: data.rebate,
					type: player.integral > 0 ? 'add':'del',
					time : Date.now(),
					inviteCode : player.inviteCode,
					viperId:player.viperId,
				}
				// console.log('积分记录',record);
				integralRecord.create(record, function (err, res) {
					if (err || !res) {
						console.error('积分记录保存失败！');
					}
				});
            }
            insertPlayerIntoDatabase(player, data, next);
        });
}


/**
 * 插入数据库
 * */
function insertPlayerIntoDatabase(player, inviteCodeInfo, next) {
    // 在数据库创建
	const dao = db.getDao('player_info');
    dao.create(player.wrapDatebase(), (err, res) => {
        if (err || !res ) {
            return next(null);
        }
        //把玩家加到邀请码的字段里面
        if (inviteCodeInfo && player.uid !== inviteCodeInfo.uid) {
			inviteCodeInfo.inviteRecords.push(player.uid);
            InviteCodeMgr.updateInviteCode(
                {inviteCode: inviteCodeInfo.inviteCode},
                {inviteRecords: inviteCodeInfo.inviteRecords},
                {multi: false});
        }
        return next(player);
    });
}

/**
 * 获取用户信息 如果没有就创建一个
 * 获取游戏列表
 */
Remote.prototype.getPlayer = function(uid, sid,isRobot, inviteCode, ip, cb) {
	const next = function (player) {
		if(!player) {
			return cb({message:'未找到玩家信息'}, null);
		}
		player.init(sid, ip);
		const loginTime = player.loginTime;
		const zerotime = utils.zerotime();
		let isTodayLogin = false;
		if(zerotime > loginTime || !loginTime){
			isTodayLogin = true;
		}
		player.loginTime = Date.now();
		if(player.monthlyCard && player.monthlyCard.active && player.monthlyCard.joined == null){
			player.monthlyCard.joined = true;
		}else if(player.monthlyCard && !player.monthlyCard.active && player.monthlyCard.joined == null){
			player.monthlyCard.joined = false;
		}
		PlayerMgr.addPlayer(player);// 添加到内存
		let games, VIP_ENV, viper = null, modeDeclaration = false, model, gameMembers, startingGoldActivity = false;
		const gameWeight = {'11':20,'8':19,'1':18,'4':17,'3':16,'10':15,'7':14,'16':13,'12':12,'2':11,'9':10,'13':9,'14':8};
		//初始化玩家游戏记录
		if(utils.isVoid(player.gamesRecord)){
			player.gamesRecord = {
				platform: {},
				system: {},
			};
		}
		new Promise((resolve, reject) =>{
			if(player.vip && !player.needPlatform){
				VIP_ENV = true;
				// 获取 vip平台游戏列表
				const platform = vipPlatformMgr.getPlatform(player.viperId);
				viper = platform.creator.uid;
				// 玩家会进入到该平台
				platform.addEnvMembers(player);
				if(platform.vipModel == null){
					modeDeclaration = true;
				}
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
				const addGames = utils.clone(GamesMgr.Games()).filter(game => !platform.games.map(g => g.nid).includes(game.nid)).filter(g =>![].includes(g.nid));
				addGames.forEach(g => g.needBuy = true);
				games = games.sort((g1, g2) => gameWeight[g2.nid] - gameWeight[g1.nid]).concat(addGames);
				model = platform.vipModel;
                gameMembers = platform.gameMembers;
				resolve();
			}else if(player.vip && player.needPlatform){   //需要创建平台
				return new Promise((resolve, reject) =>{
					if(player.inviteCode){  //如果玩家有邀请码,需要将他从对应的vip环境清除
						const inviteCodeMgr = require('../../../domain/hall/inviteCode/inviteCodeMgr');
						inviteCodeMgr.findOneInviteCodeInfo({inviteCode: player.inviteCode},function(err,doc){
							if(err){
								return reject('查找出错',err)
							}
							if(!doc){
								return reject('未找到该邀请码对应数据')
							}
							vipPlatformMgr.removeUserFromPlatform(player.uid, doc.uid);
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
								player.integral = 0;
								resolve();
							});
						});
					}else{
						resolve();
					}
				}).then(()=>{

					player.inviteCodeBindTime = Date.now(); //vip綁定時間
					player.needPlatform = false;
					vipPlatformMgr.createPlatform(player);
					const newPlatform = vipPlatformMgr.getPlatform(player.uid);
					newPlatform.addMember(player.bindToPlatform());
					newPlatform.vipModel = 'discount';	 //将平台固定为折扣模式
					VIP_ENV = true;
					model = newPlatform.vipModel;
					viper = newPlatform.creator.uid;
					// 玩家会进入到该平台
					newPlatform.addEnvMembers(player);

					const addGames = utils.clone(GamesMgr.Games()).filter(g =>![].includes(g.nid));
					addGames.forEach(g => g.needBuy = true);
					games = newPlatform.games.concat(addGames);
					console.log('games......11111',games);
					modeDeclaration = true;
                    gameMembers = newPlatform.gameMembers;
					resolve();
				}).catch(err =>{
					console.error(err)
					Logger.error('购买vip失败',err);
				})
			}else{
				if(player.viperId){
					VIP_ENV = true;
					// 获取 vip平台游戏列表
					const platform = vipPlatformMgr.getPlatform(player.viperId);
					viper = platform.creator.uid;
					// 玩家会进入到该平台
					platform.addEnvMembers(player);
					// games = platform.games;
					games = platform.games.map(m=>{
						if( m.gameStartTime + m.gameHaveTime - nowTime > 0){
							return{
								nid:m.nid,
								heatDegree:m.heatDegree,
								roomUserLimit:m.roomUserLimit,
								topicon: m.topicon,
								name:m.name,
								time: m.gameStartTime + m.gameHaveTime - nowTime,
							}
						}
					})
					console.log('games......2222',games);
					model = platform.vipModel;
					resolve();
				}else{
					VIP_ENV = false;
					games = GamesMgr.Games();
					// 玩家进入到普通环境
					ordinaryPlatformMgr.addPlayer(player);
					resolve();
				}
			}
		}).then(function(){
			//成功进入一次 加一个 
			require('../../../domain/hall/player/census').loginTotal.add(uid);
			const playerLoginRecord = db.getDao('player_login_record');	
			const starTime = utils.zerotime();
			const endTime = utils.zerotime() + 24*60*60*1000;
			playerLoginRecord.update({uid:uid,loginTime:{'$gt':starTime,'$lt': endTime}},{'$set': {'nickname': player.nickname, 
				'loginTime': Date.now(), 'gold': player.gold,'integral':player.integral,'addRmb':player.addRmb}},{upsert:true},function(err,data){
					// console.log('err..........',err);
					// console.log('data.......',data);
					if(err){
						console.error('数据库保存失败！')
					}
			});
			//记录玩家登录时间
			player.loginTime = Date.now();
            player.loginCount+=1;
			let payConfig = JsonMgr.get('payConfig');
			let goldTable = JsonMgr.get('gold');
			const bindPhone = goldTable.getById(200).num;
			let payType={};
			payConfig.datas.forEach(m=>{
				payType[m.name] = m.url;
			});

			const env = viper ? viper : 'system';
			if(utils.isVoid(player.lastGameContents['system'])){
				player.lastGameContents['system'] = {nid:'', room:{}};
			}
			if(utils.isVoid(player.lastGameContents[env])){
				player.lastGameContents[env] = {nid:'', room:{}};
			}
			const closeGame = db.getDao('close_game');
			const inviteCodeInfo = db.getDao('invite_code_info');
			let allgames = JsonMgr.get('games');
			let closeGames = {};
			let list = [];
			let gameVersion = JsonMgr.get('gameBeat').getById(1).gameVersion;
			if(gameVersion == 1){
				new Promise((resolve, reject) =>{
					closeGame.find({},function(err,arr){ //将那些游戏进行维护中
						if(err){
							resolve();
						}
						allgames.datas.forEach(m=>{
							const temp = arr.find(x => x.nid === m.nid);
							if(temp){
								closeGames[temp.nid] = temp.status;
							}else{
								closeGames[m.nid] = true;
							}
						})
						resolve();
					});
				}).then(() =>{
					new Promise((resolve, reject) =>{ //根据渠道下面的玩家对绑定的邀请码来进行查询如果渠道有邀请码同时设置了那些游戏是否开放
						if(player.inviteCode){
							inviteCodeInfo.findOne({inviteCode:player.inviteCode},function(err,invites){
								const viper = invites.viper;
								inviteCodeInfo.findOne({uid:viper},function(err,inviteViper){
									const  inviteGames = inviteViper.games;
									if(inviteGames !=0){
										games.forEach(m=>{
											const temp = inviteGames.find(x => x.nid === m.nid);
											console.log('temp...',temp);
											if(temp && temp.status === true){
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
						}else{ //这个是渠道本身没有邀请码进行查询自己开放了哪些有些
							inviteCodeInfo.findOne({uid:player.uid},function(err,invite){
								if(invite && invite.games.length !=0){
									const  inviteGames = invite.games;
									games.forEach(m=>{
										const temp = inviteGames.find(x => x.nid === m.nid);
										if(temp && temp.status === true){
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
						db.getDao('starting_gold').findOne({}).exec(function(err, doc){
							const date = utils.dateKey();
							if(doc && doc.activation){
								if(!player.allowances){
									player.allowances = {
										num:  2000 + 500 * (doc.day - 1),
										today:false, 
										tomNum: 0,
										date : date,
									}
								}else{
									if(player.allowances.date != date){
										if(player.allowances.today){
											player.allowances.today = false;
										}
										player.allowances.num = 2000 + 500 * (doc.day - 1);
										player.allowances.date = date;
									}
								}
							}else{
								player.allowances = null;
							}

							cb(null, {user: player.strip(), games:list, VIP_ENV, viper, payConfig: payType, bindPhone, modeDeclaration, model, gameMembers, lastGame: player.lastGameContents[env].nid,
								lastRoom: player.lastGameContents[env].room, closeGames:closeGames, startingGoldActivity: doc.activation, isTodayLogin,
							});
						})
					})
				})
			}else{
				closeGame.find({},function(err,arr){ //将那些游戏进行维护中
						if(err){
							resolve();
						}
						allgames.datas.forEach(m=>{
							const temp = arr.find(x => x.nid === m.nid);
							if(temp){
								closeGames[temp.nid] = temp.status;
							}else{
								closeGames[m.nid] = true;
							}
						})
						cb(null, {user: player.strip(), games:games, VIP_ENV, viper, payConfig: payType, bindPhone, modeDeclaration, model, gameMembers, 
							lastGame: player.lastGameContents[env].nid,lastRoom: player.lastGameContents[env].room, closeGames:closeGames,
						});
				});
			}
		}).catch(err => {
			console.error('进入游戏处理出错', err);
			cb('进入游戏处理出错' + err.message);
		});
	};

	const player = PlayerMgr.getPlayer(uid);
	if(player) {
		next(new Player(player));
	} else {
		// 直接从数据库获取
		const dao = db.getDao('player_info');
		dao.findOne({uid: uid}, (err, res) => {
			if(err || !res){// 没有创建一个
				create(uid, isRobot,inviteCode, next);
			} else {
				if(res.monthlyCard && res.monthlyCard.active && res.monthlyCard.receiveDates.length >= 30){
					res.monthlyCard = {'active':false, 'alert': true, 'receiveDates': [], 'today': true, 'joined': true};
				}
				next(new Player(res));
			}
		});
	}
};

/**
 * 用户离线
 */
Remote.prototype.leave = function({uid, nid}, cb) {
	const dao = db.getDao('player_info');
	const playerLoginRecord = db.getDao('player_login_record');
	let user = PlayerMgr.getPlayer(uid);
	if(!user){
		return cb(`${uid} 玩家未找到  leave`);
	}
	user.lastLogoutTime = Date.now();
	if(!user){
		console.error( 'Remote.prototype.leave 没找到该玩家');
	}
	// 保存数据库
	dao.update({uid: uid}, {$set: user.wrapDatebase()},{new: true}, function(err, res) {
		if(err){
			logger.error(uid, '保存数据库失败');
		}
		const starTime = utils.zerotime();
		const endTime = utils.zerotime() + 24*60*60*1000;
		playerLoginRecord.update({uid:uid,loginTime:{'$gt':starTime,'$lt': endTime}},{'$set': {'leaveTime':Date.now()}},{new:true},function(err,data){
				console.log('err..........',err);
				console.log('data.......',data);
				if(err){
					console.error('数据库保存失败！')
				}
		});

		console.log(`${user.nickname} 成功下线  ${user.lastLogoutTime}`);
		if(nid != '3'){
			PlayerMgr.removePlayer(uid);// 删除内存数据
		}
		cb(user.strip());
	});
};

/**
 * 根据 uid 获取玩家信息
 */
Remote.prototype.getUserInfo = function(uid, cb) {
	return cb(null, PlayerMgr.getPlayer(uid));
};

/**
 * 根据 uid 更新玩家信息
 */
Remote.prototype.updateUser = function(uid, updateInfo, cb){
	const player = PlayerMgr.getPlayer(uid);
	player.update(updateInfo);
	return cb(null, player);
};

/**
 * 根据 uid 更新数据库中玩家信息
 */
Remote.prototype.updateDBUser = function(uid, updateInfo, cb){

	const playerModel = db.getDao('player_info');
	playerModel.update({uid: uid}, {"$set": updateInfo}, function(err){
		if(err){
			console.error("更新玩家数据库失败  updateDBUser", err);
			return cb(err);
		}
		return cb(null);
	})
};

/**
 * 充值
 */
Remote.prototype.addMoney = function({uid, type, num}, cb){

	const player = PlayerMgr.getPlayer(uid);
	const moneyType = type == 1 ? 'vdot' : (type == 2 ? 'gold' :(type == 3 ? 'integral' : 'props'));
	if(player){
		// console.log('===============', num, '==',player[moneyType] + num)
		player.update({[moneyType]: player[moneyType] + num});
		msgService.pushMessageByUids('addCoin', { //充值成功过后，对玩家的金币进行增加
			[moneyType]:player[moneyType],//充值的金币
			remark:'充值成功!'
        }, player.uids()); 
		return cb(null, player);
	}
	const playerModel = db.getDao('player_info');
	const addGoldRecord = db.getDao('add_gold_record');
	const info ={
		id : utils.id(),
		create:Date.now(),
		gold : num,
		remark : '后台管理进行刷金币',
		uid :uid
	}
	playerModel.update({uid: uid}, {"$inc": {[moneyType]: num}}, function(err){
		if(err){
			console.error("更新玩家数据库失败  updateDBUser", err);
			return cb(err);
		}
		addGoldRecord.create({info},function(err,result){
			if(!err){
				return cb(null);
			}
		});
	
	})
};

/**
 * 根据uid更新玩家数据,在内存中更新内存,否则更新数据库
 */
Remote.prototype.updateUserEffectTime = function(uid, {num}, cb){
	num = num * 0.001;
	const player = PlayerMgr.getPlayer(uid);
	// console.log(player);
	if(player){
		player.update({vdot: player.vdot + num});
		return cb(null, player);
	}else{
		const playerModel = db.getDao('player_info');
		playerModel.update({uid: uid}, {"$inc": {vdot: num}}, function(err){
			if(err){
				console.error("更新玩家数据库失败  updateUserEffectTime", err);
			}
		})
		return cb(null);
	}
};

/**
 * 更新所有玩家的数据
 */
Remote.prototype.updateAllUsers = function(info, type, cb){
	
	//更新内存玩家
	const memoryUsers = PlayerMgr.players();
	const memoryUids = Object.keys(memoryUsers);
	utils.values(memoryUsers).forEach(user =>{
		if(type == '1'){
			user.update(info);
		}
		if(type == '2'){
			if(user.monthlyCard && user.monthlyCard.active){
				if(user.monthlyCard.receiveDates.length >= 30){
					user.updateMonthlyCard({
						'active':false, 
						'alert': true, 
						'receiveDates': [], 
						'today': true,
						'joined': true,
					});
				}else{
					user.updateMonthlyCard({ 
						'alert': true, 
						'today': true,
					});
				}
			}
		}
	});

	//更新数据库玩家
	const udtInfo = {};
	if(type == '1'){
		db.getDao('player_info').update({uid: {'$nin': memoryUids}}, {'$set': info}, {multi: true}, function(err, result){
			if(err){
				cb('更新所有离线玩家失败', err);
			}
			cb(null);
		})
	}else if(type == '2'){
		udtInfo['$set'] = {'monthlyCard.alert': true, 'monthlyCard.today': true};
		db.getDao('player_info').update({uid: {'$nin': memoryUids}, 'monthlyCard.active': true}, udtInfo, {multi: true}, function(err, result){
			if(err){
				cb('更新所有离线玩家失败', err);
			}
			cb(null);
		})
	}
};

/**
 * 根据所在游戏环境获取 公告获取人
 */
Remote.prototype.noticeuserInfo = function(uid, VIP_ENV, cb){
	let userInfo;
	if(VIP_ENV){  // 如果在vip环境
		let viper;
		if(uid.startsWith('ai')){
			viper = VIP_ENV;
		}else{
			const player = PlayerMgr.getPlayer(uid);
			if(!player){
				return cb('未找到该玩家');
			}
			viper = player.viperId;
		}
		userInfo = vipPlatformMgr.getPlatform(viper).envMembers
			.map(user =>{
				return {uid: user.uid, sid: user.sid};
			});
	}else{
		userInfo = ordinaryPlatformMgr.ordinaryEnvPlayers()
			.map(user =>{
				return {uid: user.uid, sid: user.sid};
			});
	}
	return cb(null, userInfo);
};

/**
 * 切换账号
 */
Remote.prototype.changeAccount = function({uid, passWord, cellPhone}, cb){
	const dao = db.getDao('user_info');
	dao.findOne({cellPhone: cellPhone}, function (err, user){
		if(err){
			return cb({code: 500, error:'查找用户失败'});
		}
		if(!user){
			return  cb({code: 500,error:'帐号不存在'})
		}
		if(uid != null && user.uid === uid){
			return cb({code: 500, error:'已是当前账号'});
		}
		if(user.passWord != passWord){
			return cb({code: 500, error:'密码错误'});
		}
		const playerModel = db.getDao('player_info');
		playerModel.findOne({uid: user.uid}, function(err, player){
			if(err){
				return cb({code: 500, error:'查找玩家失败'});
			}
			if(!player){
				return cb({code: 500, error:'未找到玩家'});
			}
			return cb(null, true);
		});
	});	
};

/**
 * 记录每一次玩家游戏消费记录 changeType: 1为押注 2为中奖
 */
Remote.prototype.recordCoin = ({uid, changeType, changeNum,nickname,integral,gold,coinType}, next) =>{
    const dao = db.getDao('record_coin');
    const recordCoin = new RecordCoin({
    	uid:uid,
    	changeType:changeType,
    	changeNum:changeNum,
    	nickname:nickname,
    	integral:integral,
    	gold:gold,
    	coinType:coinType,
	});
	// 在数据库创建
	dao.create(recordCoin.wrapDatebase(), (err, res) => {
		if(err){
			console.error(err);
		}
	});
	return next(null);
};

/**
 * 根据 uids 获取玩家信息
 */
Remote.prototype.getUsersInfo = function(uids, cb) {
	const users = [];
	uids.forEach(uid =>{
		const user = PlayerMgr.getPlayer(uid);
		if(uid && user){
			users.push(user);
		}
	});
	return cb(null, users);
};

/**
 * 改变玩家金币
 */
Remote.prototype.changeGold = function(uid, value, cb) {
    const player = PlayerMgr.getPlayer(uid);
    const num = player.gold + value < 0 ? -player.gold : value;
    player.gold += num;
    return cb(player.gold);
};
/**
 * 改变玩家积分
 */
Remote.prototype.changeIntegral = function(uid, value, cb) {
    const player = PlayerMgr.getPlayer(uid);
    const num = player.integral + value < 0 ? -player.integral : value;
	player.integral += num;
    return cb(player.integral);
};
/**
 * 改变玩家金币 - 在线改变
 */
Remote.prototype.changeGoldsByOnline = function(players, cb) {
    let ret = [], player = null;
    for (let i = players.length - 1; i >= 0; i--) {
        const {uid, gain} = players[i];
        player = PlayerMgr.getPlayer(uid);
        if(!player){
            continue;
        }
        const num = player.gold + gain < 0 ? -player.gold : gain;
        player.gold += num;
        ret.push({uid: player.uid, gold: player.gold});
    }
    cb(null, ret);
};

/**
 * 改变玩家积分 - 在线改变
 */
Remote.prototype.changesIntegralByOnline = function(players, cb) {
    let ret = [], player = null;
    for (let i = players.length - 1; i >= 0; i--) {
        const {uid, gain} = players[i];
        player = PlayerMgr.getPlayer(uid);
        if(!player){
            continue;
        }
        const num = player.integral + gain < 0 ? -player.integral : gain;
        player.integral += num;
        ret.push({uid: player.uid, integral: player.integral});
    }
    cb(null, ret);
};

/**
 * 改变玩家金币 - 多人
 */
Remote.prototype.changeGoldMulti = function(uids, value, cb) {
    const ret = [];
    let players = [], player;
    // 先过滤一遍
    for (let i = uids.length - 1; i >= 0; i--) {
        player = PlayerMgr.getPlayer(uids[i]);
        if(!player){
            return cb('找不到玩家');
        }
        players.push(player);
    }
    // 然后再执行扣钱
    players.forEach(m => {
        const num = m.gold + value < 0 ? -m.gold : value;
        m.gold += num;
        ret.push({uid: m.uid, gold: m.gold, value: Math.abs(num)});
    });
    cb(null, ret);
};