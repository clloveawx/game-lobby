'use strict';

const util = require('../../utils');
const Promise = require('bluebird');
const systemMgr = require('../../utils/db/dbMgr/systemMgr');
const platformMgr = require('../../utils/db/dbMgr/platformMgr');
const db = require('../../utils/db/mongodb');
const util = require('../../utils');

//奖池分配调控   (分配人数 参与分配的钱)
const allotRegulation = util.curry((counts, money) =>{
  return new Array(counts).fill(Math.PI).reduce((allots, _, i) =>{
    let academicAddJackpot = Math.floor(util.random(85, 115) * 0.01 * money * Math.pow(counts - i, 2) /         util.squaresSum(counts));
      allots[0].push(academicAddJackpot);
      allots[1] += academicAddJackpot;
      return allots;
  }, [[], 0]);
});

//游戏权重
const gameWeight = {'11': 20, '9': 19, '8': 18, '17': 17, '16' :16, '1': 15,
	'7': 14, '2': 13, '10': 12, '12': 11, '4': 10, '3': 9, '15': 8, '18': 7,
};

Object.assign(module.exports, {

  /**
   * 奖池分配方案
   * @param {totalMoney(参与分配总金钱), totalCounts(参与分配总房间数), selfJackpot(当前房间奖池数)}
   */
  jackpotAllot(totalMoney, totalCounts, selfJackpot){
    let allots = [];    //分配结果,第一个元素为当前房间分得的金钱
    let onlineAwards = 0;    //联机大奖分配
    let profitAwards = 0;    //盈利池分配
    if(totalCounts == 1){
      allots.push(totalMoney);
    }else{
      const lossMoneyAllot = allotRegulation(totalCounts - 1);
      let selfAllot, allotDistribute;
      if(selfJackpot < 1000000){
        selfAllot = totalMoney;
      }else if(selfJackpot >= 1000000 && selfJackpot < 2000000){
        allotDistribute = lossMoneyAllot(totalMoney * 0.05);
        onlineAwards = Math.floor(totalMoney * 0.05);
      }else if(selfJackpot >= 2000000 && selfJackpot < 5000000){
        allotDistribute = lossMoneyAllot(totalMoney * 0.3);
        onlineAwards = Math.floor(totalMoney * 0.1);
      }else if(selfJackpot >= 5000000 && selfJackpot < 10000000){
        allotDistribute = lossMoneyAllot(totalMoney * 0.65);
        onlineAwards = Math.floor(totalMoney * 0.15);
      }else if(selfJackpot >= 10000000){
        allotDistribute = lossMoneyAllot(totalMoney * 0.8 * 1 / 9);
        onlineAwards = Math.floor(totalMoney * 4 / 9);
        profitAwards = Math.floor(totalMoney * 4 / 9);
      }
      if(selfAllot == null){
        selfAllot = totalMoney - allotDistribute[1] - onlineAwards - profitAwards;
      }
      allots.push(selfAllot);
      if(allotDistribute != null){
        allots = allots.concat(allotDistribute[0]);
      }
    }
    // console.log(util.sum(allots)+onlineAwards+profitAwards)
    return {allots, onlineAwards, profitAwards};
  },

    /**
     * 添加游戏记录
     */
    gameRecord(record, update){
      const gameRecordModel = require('../../utils/db/mongodb').getDao('game_record');
      if(update){
		    gameRecordModel.update({playStatus: 0, gname: record.gname, uid: record.uid}, {$inc: {
	        profit: record.profit,
	        playStatus: 1,
        }}, function(err){
          if(err){
            winston.error('更新小游戏记录失败',err);
          }
        })
      }else{
        gameRecordModel.create(record, function(err, data) {
          if(err){
            console.error('添加游戏记录出错', record.gname, err);
          }
        });
      }
    },

    /**
     * 选择游戏轮盘
     * @parama cur -上一局使用的轮盘
     */
    selectRoulette(cur) {
      if(cur == '1'){
        return Math.random() < 0.0417 ? '2' : '1';
      }else if(cur == '2'){
        return Math.random() < 0.0667 ? '3' : '2';
      }else if(cur == '3'){
        return Math.random() < 0.0909 ? '1' : '3';
      }else{
        return '2';
      }
    },

    /**
     * 从session中提取信息
     */
    sessionInfo(session){
      return {
        uid: session.uid,
        viper: session.get('viper'),
        isVip: session.get('VIP_ENV'),
        nid: session.get('game'),
        roomCode: session.get('roomCode'),
        sid: session.frontendId,
      }
    },

    /**
     *  totalBet-玩家总押注  onlineAwards-联机大奖奖池
     */
    dealOnlineAward(totalBet, onlineAwards){
      if(!totalBet || !onlineAwards){
        return false;
      }
      if(onlineAwards > util.random(200000, 500000)){
        if(Math.random() < totalBet / onlineAwards){
            return true;
        }
      }
      return false;
    },

	/**
   * 游戏权重控制
	 */
	gamesWeightSort(games){
    if(util.isVoid(games)){
      return games;
    }
		return games.sort((g1, g2) => gameWeight[g2.nid] - gameWeight[g1.nid]);
  },

	/**
   *游戏返回字段控制
	 */
	gameFieldsReturn(games, isPlatform = false){
		if(isPlatform){
			return games.map(g =>{
				return {
					nid: g.nid,
					heatDegree: g.heatDegree,
					roomUserLimit: g.roomUserLimit,
					topicon: g.topicon,
					name: g.name,
					time: g.gameStartTime + g.gameHaveTime - Date.now(),
				}
			})
		}else{
			return games.filter(g =>![].includes(g.nid)).map(game => {
				const {nid, heatDegree, roomUserLimit, topicon, name, needBuy, time} = game;
				return {nid, heatDegree, roomUserLimit, topicon, name, needBuy, time};
			})
		}
	},

	//平台游戏显示 未购买的游戏
	pGameNeedBuy(pGames){
		const _this = this;
		//获取平台显示的需要购买的游戏列表
		return systemMgr.allGames().then(function(allGames){
			//未购买的游戏列表
			const addGames = allGames.filter(game => !pGames.map(g => g.nid).includes(game.nid));
			addGames.forEach(g =>{
				g.needBuy = true;
			});
			return Promise.resolve(_this.gamesWeightSort(pGames).concat(addGames));
		}).catch(err =>{
			return Promise.reject({code:500, error: '获取所有的系统游戏失败' + err});
		});
	},
	
	/**
	 * 根据游戏判断环境并修改
	 */
	udtGameByEnv(gameInfo){
		if(gameInfo.viper){
			platformMgr.udtPlatformGame(gameInfo).then(() =>{
				return Promise.resolve();
			}).catch(err =>{
				console.error('更新平台${gameInfo.viper}游戏${nid}失败', err);
			});
		}else{
			systemMgr.udtGame(gameInfo.nid, gameInfo).then(() =>{
				return Promise.resolve();
			}).catch(err =>{
				console.error('更新系统游戏${gameInfo.nid}失败', err);
			});
		}
	},
	
	/**
	 * 根据房间判断环境并修改
	 */
	udtRoomByEnv(roomInfo){
		if(roomInfo.viper){
			platformMgr.udtPlatformGameRoom(roomInfo).then(() =>{
				return Promise.resolve();
			}).catch(err =>{
				console.error('更新平台${roomInfo.viper}游戏${roomInfo.nid}房间${roomInfo.roomCode}失败', err);
			});
		}else{
			systemMgr.udtGameRoom(roomInfo.nid, roomInfo.roomCode, roomInfo).then(() =>{
				return Promise.resolve();
			}).catch(err =>{
				console.error('更新系统游戏${roomInfo.nid}房间${roomInfo.roomCode}失败', err);
			});
		}
	},
	
	/**
	 * 渠道游戏开关控制显示的游戏列表
	 */
	channelGameSwich({player, games, gameVersion}){
		if(gameVersion == 2){
			return Promise.resolve(games);
		}else{
			const inviteCodeModel = db.getDao('invite_code_info');
			//根据渠道下面的游戏开放 对渠道下的玩家显示
			if(player.inviteCode){
				inviteCodeModel.findOne({inviteCode: player.inviteCode}, function(err, codeInfo){
					//查找顶级
					const viper = codeInfo.viper;
					inviteCodeModel.findOne({uid: viper},function(err, viperCodeInfo){
						const  inviteGames = viperCodeInfo.games;
						
						if(!util.isVoid((inviteGames))){
							return Promise.resolve(games.filter(game =>{
								return inviteGames.find(ig => ig.nid == game.nid && ig.status === true);
							}));
						}else{
							//这个是渠道下面的玩家,然后该渠道没有设置哪些游戏是否开放
							return Promise.resolve(games);
						}
					});
				});
			}else{
				//判断玩家是不是渠道
				inviteCodeModel.findOne({uid: player.uid}, function(err, codeInfo){
					if(codeInfo && !util.isVoid(codeInfo.games)){
						const  inviteGames = codeInfo.games;
						return Promise.resolve(games.filter(game =>{
							return inviteGames.find(ig => ig.nid == game.nid && ig.status === true);
						}));
					}else{
						return Promise.resolve(games);
					}
				});
			}
		}
	},
	
	/**
	 * 根据环境获取指定游戏房间
	 */
	getRoomByEnv({viper, nid, roomCode}){
		if(viper){
			platformMgr.getPlatformGameRoom({viper, nid, roomCode}).then(room =>{
				return Promise.resolve(room);
			}).catch(err =>{
				return Promise.reject('获取平台${viper}游戏${nid}房间${roomCode}失败'+err);
			});
		}else{
			systemMgr.getGameRoom({nid, roomCode}, function(err, room){
				if(err){
					return Promise.reject('获取系统游戏${nid}房间${roomCode}失败'+err);
				}
				return Promise.resolve(room);
			});
		}
	},
	
	/**
	 * 根据环境获取指定游戏
	 */
	getGameByEnv({viper, nid}){
		if(viper){
			platformMgr.getPlatformGame({viper, nid}, function(err, game){
				if(err){
					return Promise.reject('获取平台${viper}游戏${nid}失败'+err);
				}
				return Promise.resolve(game);
			});
		}else{
			systemMgr.getGame({nid}, function(err, game){
				if(err){
					return Promise.reject('获取系统游戏${nid}失败'+err);
				}
				return Promise.resolve(game);
			});
		}
	},
	
});

// console.log(module.exports.jackpotAllot(10000, 5, 15000000))
// console.log(module.exports.dealOnlineAward(10000, 200001))