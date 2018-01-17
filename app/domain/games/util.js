'use strict';

const util = require('../../utils');
const Promise = require('bluebird');
const systemMgr = require('../../utils/db/dbMgr/systemMgr');

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
const gameWeight = {
  '7': 20, '1': 19, '2': 18, '10': 17, '4': 16, '12': 15, '8': 14,
  '9': 13, '11': 12,'17': 11.5, '3': 11,'13':10,'14':9,'16':15.5,
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
	gameFieldsReturn(games){

		return games.filter(g =>![].includes(g.nid)).map(game => {
			const {nid, heatDegree, roomUserLimit, topicon, name, needBuy,time} = game;
			return {nid, heatDegree, roomUserLimit, topicon, name, needBuy,time};
		})
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
});

// console.log(module.exports.jackpotAllot(10000, 5, 15000000))
// console.log(module.exports.dealOnlineAward(10000, 200001))