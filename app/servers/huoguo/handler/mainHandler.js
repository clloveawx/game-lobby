'use strict';

const hotpot = require('../../../domain/games/hotpot');
const memory = hotpot.memory;
const logic = hotpot.logic;
const config = hotpot.config;
const notify = hotpot.notify;
const Robot = hotpot.Robot;
const util = require('../../../utils');
const Logger = require('pomelo-logger').getLogger('log', __filename);

module.exports = function (app) {
    return new Handler(app);
};

function Handler(app) {
    this.app = app;
}

const proto = Handler.prototype;

/**
 * 庄家信息
 * @route: huoguo.mainHandler.dealerInfo
 */
proto.dealerInfo = function (msg, session, next) {
    const uid = session.uid, roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const memoryEnv = isVip ? memory.vip[viper] : memory.system;
    if (roomCode == null) {
        return next(null, {code: 500, error: '不在房间内'});
    }
    const dealer = logic.findDealer(memoryEnv.dealers, roomCode);
    notify.dealerInfo(this.app, dealer, memory.robotDealer).then((dealerInfo) => {
        return next(null, {code: 200, dealer: dealerInfo.dealer, queue: dealerInfo.queue})
    }).catch(err => {
        console.error('庄家信息获取失败', err);
        return next(null, {code: 500, error: '庄家信息获取失败'});
    })
};
/**
 * 房间用户信息
 * @route: huoguo.mainHandler.roomUsers
 */
proto.roomUsers = function (msg, session, next) {
    const uid = session.uid, roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const env = isVip ? viper : "system";
    const moneyType = isVip ? 'integral' : 'gold';
    if (roomCode == null) {
        return next(null, {code: 500, error: '不在房间内'});
    }

    const channel = this.app.channelService.getChannel(env + '_' + roomCode);
    this.app.rpc.hall.playerRemote.getUsersInfo(session, channel.getMembers().filter(m => !m.startsWith('ai')), function (err, usersInfo) {
        if (err) {
            return next(null, {code: 500, msg: '获取房间用户信息失败' + err})
        }
        const aiInfo = Robot.getRobots(channel.getMembers().filter(m => m.startsWith('ai')));
        const result = usersInfo.concat(aiInfo).sort((u1, u2) => u2[moneyType] - u1[moneyType]).map((user, i) => {
            user.ranking = i + 1;
            return user;
        });
        return next(null, {code: 200, users: result});
    });
};
/**
 * 下注区域信息
 * @param msg
 * @route: huoguo.mainHandler.betAreas
 */
proto.betAreas = function (msg, session, next) {
    const uid = session.uid, roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const memoryEnv = isVip ? memory.vip[viper] : memory.system;
    if (roomCode == null) {
        return next(null, {code: 500, error: '不在房间内'});
    }
    const round = logic.findRound(memoryEnv.rounds, roomCode);
    const userBet = memoryEnv.userBets[roomCode][uid];
    next(null, {code: 200, betAreas: logic.userBetAreas(round.betAreas, config.betAreas, userBet)});
};

/**
 * 上庄，或排队
 * @param msg
 * @route: huoguo.mainHandler.onBank
 */
proto.onBank = function (msg, session, next) {
    const uid = session.uid, roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const memoryEnv = isVip ? memory.vip[viper] : memory.system;
    const env = isVip ? viper : 'system';
    if (roomCode == null) {
        return next(null, {code: 500, error: '不在房间内'});
    }
    const dealer = logic.findDealer(memoryEnv.dealers, roomCode);
    if (logic.isDealer(dealer, uid)) {
        return next(null, {code: 500, error: '已经是庄家'});
    }
    const queue = dealer.queue;
    if (logic.inDealerQueue(queue, uid)) {
        return next(null, {code: 500, error: '正在排队中'});
    }
    if (memoryEnv.hasOffBankQueue.indexOf(uid) != -1) {
        return next(null, {code: 500, error: '本回合无法再次上庄'})
    }
    const moneyType = isVip ? 'integral' : 'gold';

    const _this = this;
    this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function (err, player) {
        if (err) {
            return next(null, {code: 500, error: '查询玩家金钱失败 huoguo.mainHandler.onBank'});
        }
        if (player[moneyType] < config.onBankCondition) {
            return next(null, {code: 500, error: "钱数不足,不能上庄"});
        }
        queue.push(uid);
        const roomChannel = _this.app.channelService.getChannel(env + '_' + roomCode);
        //todo 通知庄家上庄
        notify.dealer(_this.app, roomChannel, dealer, memory.robotDealer);
        Logger.error('上庄后的信息', logic.findDealer(memoryEnv.dealers, roomCode));
        return next(null, {code: 200});
    })
};

/**
 * 下庄
 * @param msg
 * @param session
 * @param next
 * @route: huoguo.mainHandler.offBank
 */
proto.offBank = function (msg, session, next) {
    const uid = session.uid, roomCode = session.get('roomCode');
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const memoryEnv = isVip ? memory.vip[viper] : memory.system;
    const env = isVip ? viper : 'system';
    if (roomCode == null) {
        return next(null, {code: 500, error: '不在房间内'});
    }
    logic.offBank({app: this.app, memoryEnv, roomCode, uid, env, robotDealer: memory.robotDealer}, function (err) {
        if (err) {
            return next(null, {code: 500, error: '下庄失败' + err});
        }
        return next(null, {code: 200});
    });
};

/**
 * 下注
 * @param msg bets: {betAreaId: num}
 * @route: huoguo.mainHandler.bet
 */
proto.bet = function (msg, session, next) {
    const uid = session.uid, roomCode = session.get('roomCode');
    const bets = msg.bets;

    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const memoryEnv = isVip ? memory.vip[viper] : memory.system;
    if (roomCode == null) {
        return next(null, {code: 500, error: '不在房间内'});
    }
    const round = logic.findRound(memoryEnv.rounds, roomCode);
    if (!logic.roundCanBet(round)) {
        return next(null, {code: 500, error: '当前不能下注'});
    }
    if (logic.isDealer(memoryEnv.dealers[roomCode], uid)) {
        return next(null, {code: 500, error: '庄家不能下注'});
    }
    //如果该用户还未下注，则初始化为空对象
    if (memoryEnv.userBets[roomCode][uid] == null) {
        memoryEnv.userBets[roomCode][uid] = {};
    }
    //获取玩家目前的下注情况
    const userBet = memoryEnv.userBets[roomCode][uid];
    const betLimit = memory.betLimit;
    let totalBet = 0;
    let errRes = null;
    // 更新总下注额和用户下注
    const updateBets = [];
    for (const areaId in bets) {
        //最大的一次性押注

        if (userBet["maxBetATime"]) {
            if (userBet["maxBetATime"] < bets[areaId]) {
                userBet["maxBetATime"] = bets[areaId];
            }
        } else {
            userBet["maxBetATime"] = bets[areaId];
        }

        if(userBet["maxBetATime"]>100000){
            userBet["maxBetATime"]=100000;
        }

        const betNum = bets[areaId];
        const roundBetArea = logic.findRoundBetArea(round.betAreas, areaId);//{id: {odds, allBet}}
        if (roundBetArea == null) {
            errRes = {code: 500, error: '下注区域不存在'};
            break;
        }
        if (typeof betNum != 'number' || betNum <= 0) {
            errRes = {code: 500, error: '下注金额有误'};
            break;
        }
        if (userBet[areaId] == null) {
            userBet[areaId] = 0;
        }
        if (betNum + userBet[areaId] > betLimit) {
            errRes = {code: 500, msg: '下注金额超限'};
            break;
        }
        totalBet += betNum;
        updateBets.push(() => {
            roundBetArea.allBet += betNum;
            userBet[areaId] += betNum;
        })
    }
    if (errRes != null) {
        return next(null, errRes)
    }
    const _this = this;
    this.app.rpc.hall.playerRemote.getUserInfo(session, uid, function (err, player) {
        if (!player) {
            return next(null, {code: 500, error: '获取玩家信息失败 huoguo.mainHandler.bet'});
        }
        const moneyType = isVip ? 'integral' : 'gold';
        const deductMoney = isVip ? player.integral - totalBet : player.gold - totalBet;
        if (deductMoney < 0) {
            return next(null, {code: 500, error: '玩家金钱不足'});
        }
        //扣钱处理
        _this.app.rpc.hall.playerRemote.updateUser(session, uid, {
            [moneyType]: deductMoney,
            roomProfit: isVip ? player.roomProfit - totalBet : 0
        }, function (err, player) {
            if (err) {
                return next(null, {code: 500, error: '扣钱失败 huoguo.mainHandler.bet'});
            }
            updateBets.forEach(func => func());
            return next(null, {code: 200, userBet});
        })
    })
};

/**
 * 结果历史记录
 * @param msg num 最新的几个
 * @route: huoguo.mainHandler.resultHistory
 */
proto.resultHistory = function (msg, session, next) {
    const num = +msg.num || 9;
    const isVip = session.get('VIP_ENV');
    const roomCode = session.get('roomCode');
    const viper = session.get('viper');
    const memoryEnv = isVip ? memory.vip[viper] : memory.system;
    if (roomCode == null) {
        return next(null, {code: 500, error: '不在房间内'});
    }
    if (memoryEnv.resultHistory[roomCode] == null) {
        memoryEnv.resultHistory[roomCode] = [];
    }
    const lotterys = memoryEnv.resultHistory[roomCode].slice(0, num).map(result => result.lottery);
    next(null, {code: 200, results: lotterys, roundNum: memoryEnv.resultHistory[roomCode].length});
};
/**
 * 上一回合赢钱前列玩家
 * @param msg
 * @route: huoguo.mainHandler.lastRoundHeadWin
 */
proto.lastRoundHeadWin = function (msg, session, next) {
    const isVip = session.get('VIP_ENV');
    const roomCode = session.get('roomCode');
    const viper = session.get('viper');
    const memoryEnv = isVip ? memory.vip[viper] : memory.system;
    const env = isVip ? viper : 'system';
    if (roomCode == null) {
        return next(null, {code: 500, error: '不在房间内'});
    }
    const roomChannel = this.app.channelService.getChannel(env + '_' + roomCode);
    const num = 8;
    let chefList = [];
    const lastRoundResult = memoryEnv.resultHistory[roomCode][0];
    if (lastRoundResult != null) {
        const dealer = util.clone(lastRoundResult.dealer);
        dealer.isDealer = true;
        if (dealer.win < 0) {
            dealer.win = 0;
        }
        chefList = lastRoundResult.others.slice(0, num - 1).concat(dealer)
            .filter(user => roomChannel.getMember(user.id) != null)
            .sort((o1, o2) => o2.win - o1.win)
    }
    this.app.rpc.hall.playerRemote.getUsersInfo(session, chefList.map(user => user.id), function (err, usersInfo) {
        if (err) {
            return next(null, {code: 500, msg: '获取房间用户信息失败' + err})
        }
        return next(null, {
            code: 200, list: usersInfo.map((userInfo, i) => {
                if (chefList[i].isDealer) {
                    userInfo.isDealer = true;
                }
                userInfo.win = chefList[i].win;
                return userInfo;
            })
        })
    });
};

/**
 * 今日总赢
 * @param msg
 * @route: huoguo.mainHandler.todayWin
 */
proto.todayWin = function (msg, session, next) {
    const uid = session.uid;
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const memoryEnv = isVip ? memory.vip[viper] : memory.system;
    if (session.get('game') != '3') {
        return next(null, {code: 500, msg: '不在游戏中'});
    }
    next(null, {code: 200, num: memoryEnv.todayWins[uid].todayTotalWin});
};

/**
 * 上次大奖
 * @route: huoguo.mainHandler.lastBigLottery
 */
proto.lastBigLottery = function ({}, session, next) {
    const isVip = session.get('VIP_ENV');
    const viper = session.get('viper');
    const memoryEnv = isVip ? memory.vip[viper] : memory.system;
    if (session.get('game') != '3') {
        return next(null, {code: 500, msg: '不在游戏中'});
    }
    next(null, {code: 200, big: memoryEnv.lastBigLottery[session.get('roomCode')] || null});
};