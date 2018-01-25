'use strict';

const Logger = require('pomelo-logger').getLogger('log', __filename);
const gutils = require('../../../domain/games/util');
const util = require('../../../utils');
const db = require('../../../utils/db/mongodb');
const msgService = require('../../../services/MessageService');
const async = require('async');

const {playerMgr, platformMgr, systemMgr} = require('../../../utils/db/dbMgr');

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

/**
 * created by CL
 * vip玩家激活游戏
 * @param: {nid, roomNum}
 * @route: hall.platformHandler.buyGame
 */
Handler.prototype.buyGame = ({nid, dayNum}, session, next) =>{
	if(nid == null){
		return next(null, {code: 200, error: '请选择机器'});
	}
	const {uid, isVip, viper} = gutils.sessionInfo(session);
	
	async.waterfall([
	  //获取玩家和游戏以及平台
		cb =>{
			playerMgr.getPlayer({uid}, function(err, player){
				if(err){
					return next(null, err);
				}
				if(!player){
					return next(null, {code: 500, error: `玩家不存在: ${uid}`});
				}
				if(!isVip || !player.vip){
					return next(null, {code: 500, error: '玩家未在VIP环境 或 玩家不是vip'});
				}
				systemMgr.getGame({nid}, function(err, game){
					if(err){
						return next(null, err);
					}
					platformMgr.getPlatform({viper: uid}, function(err, platform) {
						if (err) {
							return next(null, err);
						}
						if(!['common', 'discount', 'monthly'].includes(platform.vipModel)){
							return next(null, {code: 500, error:'请配置经营模式'});
						}
						return cb(null, player, game, platform);
					});
				});
			});
		},
		// 完成扣款 和 实例化平台游戏
		(player, game, platform, cb) =>{
			const consumeVdot = game.price * (dayNum / 30);
			if(player.vdot <= consumeVdot){
				return next(null, {code: 500, error:'玩家您的v点数不够，请充值！'});
			}
			player.vdot -= consumeVdot;
			
			//添加购买记录(扣款就应该添加)
			db.getDao('purchase_record').add(function(){},{
				uid,
				consume: consumeVdot,
				zname: game.zname,
			});
			
			//查看平台是否已经拥有该游戏
			platformMgr.getPlatformGame({viper, nid}, function(err, pgame){
				if(err){
					return next(null, err);
				}
				const exists = !util.isVoid(pgame);
				if(exists){
					//判断如果时间到期了进行再激活的时候重新记录时间和保存开通时间
					if(pgame.gameStartTime + pgame.gameHaveTime < Date.now()){
						pgame.gameStartTime = util.zerotime();
						pgame.gameHaveTime = dayNum * 24 * 60 * 60 *1000;
					}else{
						//判断时间没有到期进行续约的时候进行时间加长
						pgame.gameHaveTime += dayNum * 24 * 60 * 60 *1000;
					}
					//保存修改
					platformMgr.udtPlatformGame(pgame).then(() =>{

						platformMgr.getPlatformGames({viper}, function(err, games){
							if(err){
								console.error(`查找平台${viper}下的所有游戏数据失败`, err);
							}
							return cb(null, player, games, pgame);
						});
					}).catch(err =>{
						console.error(`保存平台${viper}的游戏${nid}数据失败`, err);
						return next(null, {code: 500, error: `保存平台${viper}的游戏${nid}数据失败`});
					});
				}else{
					//平台不存在该游戏则需要新实例化一个
					const newPGame = platformMgr.instancePlatformGame({
						viper,
						nid,
						name: game.name,
						zname: game.zname,
						sname: game.sname,
						roomUserLimit: game.roomUserLimit,
						gameStartTime: util.zerotime(),
						gameHaveTime: dayNum * 24 * 60 * 60 *1000,
					});
					//保存新创建的游戏
					platformMgr.udtPlatformGame(newPGame).then(() =>{
						//创建房间
						for(let i = 0; i < game.minRoom; i++){
							const newPRoom = platformMgr.instancePlatformRoom({
								viper,
								nid,
								roomCode: util.pad(i + 1, 3),
							});
							//保存创建的房间
							platformMgr.udtPlatformGameRoom(newPRoom).then(() =>{});
						}
						
						//通知在该vip环境下的玩家新增了游戏
						platformMgr.getPlatformGames({viper}, function(err, games){
							if(err){
								console.error(`查找平台${viper}下的所有游戏数据失败`, err);
							}
							msgService.pushMessageByUids('addGame', {
								games: gutils.gamesWeightSort(games),
							}, platform.envMembers.filter(user => user.uid != uid));
							
							return cb(null, player, games, pgame);
						});
					}).catch(err =>{
						console.error(`保存新创建的平台${viper}的游戏${nid}数据失败`, err);
						return next(null, {code: 500, error: `保存新创建的平台${viper}的游戏${nid}数据失败`});
					});
				}
			});
		},
  ], function(err, player, games, pgame){
		
		//保存玩家信息修改
		playerMgr.updatePlayer(player, function(err){
			if(err){
				console.error(`保存玩家${uid}的修改失败`, err);
			}
		});
		
		const nowTime = Date.now();
		const endTime = Date.now() + pgame.gameHaveTime;
		const rgames = gutils.gameFieldsReturn(games, true);
		gutils.pGameNeedBuy(rgames).then(gs =>{
			return next(null, {
				code: 200,
				games: gutils.gameFieldsReturn(gs),
				vdot: player.vdot,
				endTime,
			});
		});
  });
};

/**
 * created by CL
 * 同意运营协议
 * @route: hall.platformHandler.agreeProtocol
 */
Handler.prototype.agreeProtocol = ({}, session, next) =>{
	
	const {uid, isVip} = gutils.sessionInfo(session);
	playerMgr.getPlayer({uid}, function(err, player) {
		if (err) {
			return next(null, err);
		}
		if(!player) {
			return next(null, {code: 500, error: `玩家不存在: ${uid}`});
		}
		if(!isVip || !player.vip){
			return next(null, {code: 500, error: '玩家未在VIP环境 或 玩家不是vip'});
		}
		if(player.agreeProtocol){
			return next(null, {code: 500, error: '已同意,无需重复操作'});
		}
		player.protocolAgree = true;
		//保存修改
		playerMgr.updatePlayer(player, function(err){
			if(err){
				console.error(`保存玩家${uid}的修改失败`, err);
			}
		});
		return next(null, {code: 200});
	});
};

/**
* created by CL
* 保存联系方式 联系方
* @param {concatWay, cancater}
* @route: hall.platformHandler.saveConcat
*/
Handler.prototype.saveConcat = function({concatWay, cancater}, session, next){

  const uid = session.uid;
	playerMgr.getPlayer({uid}, function(err, player) {
		if (err) {
			return next(null, err);
		}
		if (!player) {
			return next(null, {code: 500, error: `玩家不存在: ${uid}`});
		}
		if(!player || !player.vip){
			return next(null, {code: 500, error: '玩家不是vip'});
		}
		platformMgr.getPlatform({viper: uid}, function(err, platform) {
			if (err) {
				return next(null, err);
			}
			platform.concatWay = concatWay;
			platform.concater = cancater;
			//保存平台的修改
			platformMgr.platformIntoRedis(platform).then(()=>{}).catch(err =>{
				console.error(`保存平台${uid}的修改失败`, err);
			});
			return next(null, {code: 200});
		});
	});
};

/**
* created by CL
* 获取联系方式 联系方
* @route: hall.platformHandler.getConcat
*/
Handler.prototype.getConcat = function({}, session, next){

  const viper = session.get('viper');
  if(!viper){
      return next(null, {code: 500, error: '玩家未在VIP环境,未找到房主'})
  }
	platformMgr.getPlatform({viper}, function(err, platform) {
		if (err) {
			return next(null, err);
		}
		return next(null, {
			code: 200,
			concatWay: platform.concatWay || '',
			cancater: platform.concater || '',
		});
	});
};