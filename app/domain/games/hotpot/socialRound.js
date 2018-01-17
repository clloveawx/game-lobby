'use strict';

const messageService = require('../../../services/MessageService');
const Robot = require('./robot/Robot').getRobot;
const PlayerMgr = require("../../hall/player/PlayerMgr");

const BonusQuota = [0, 0, 0, 0, 0, 0];

const status = {
    processing: 'processing',
    settling: 'settling',
};
const Round = {
    status,
    interval: {
        processing: 600,
        settling: 5,
    },
    order: [status.processing, status.settling],
};
Round.interval.total = Round.interval.processing + Round.interval.settling;

// 回合所处的状态 以及距离下一回合的倒计时
const roundStatusAndCountdown = time => {
    let interval = Round.interval;
    let currentStatus, countdown;
    Round.order.reduce((time, status) => {
        const b = time > interval[status];
        if (!b && currentStatus == null) {
            currentStatus = status;
            countdown = interval[status] - time;
        }
        if (b) {
            return -interval[status] + time
        } else {
            return time;
        }
    }, time);
    return {
        status: currentStatus,
        countdown: countdown,
        isFinalCd: countdown <= 1
    };
};

const roundWork = (room, moneyType, app) => {
    let now = 0, firstTimeSettling = true;
    const reset = () => {
        now = 0;
        firstTimeSettling = true;
    };
    return () => {
        //console.log('========',room instanceof Room)

        now += 2;
        room.socialRound.now = now;
        const {status, countdown} = roundStatusAndCountdown(room.socialRound.now);

        room.socialRound.status = status;
        room.socialRound.countdown = countdown;
        const settling = status == Round.status.settling;

        if (countdown && (countdown + 2) % 60 === 0) {
            messageService.pushMessageByUids('huoguo.matchCountdown', countdown, room.users.map(u => {
                return {uid: u.uid, sid: u.sid};
            }))
        }

        if (settling && firstTimeSettling) {
            let realUids = [];
            let robotUids = [];
            room.users.forEach(u => {
                if (u.uid.startsWith("ai")) {
                    robotUids.push(u.uid);
                } else {
                    realUids.push(u.uid);
                }
            });

            let userEarning = PlayerMgr.getPlayers(realUids);

            app.rpc.huoguo.mainRemote.getRobotsByIds(null,robotUids, function (data) {
                if (data.code === 200) {
                    userEarning = userEarning.concat(data.result);
                }

                userEarning.sort((u1, u2) => u2.hotpotGameEarnings - u1.hotpotGameEarnings);
                let settleUser = userEarning.filter(u => u.hotpotGameEarnings > 0);
                let bonusSum = 0;
                const settleResult = [];
                if (settleUser.length > BonusQuota.length) {
                    settleUser = settleUser.slice(0, BonusQuota.length);
                }

                settleUser.forEach((p, i) => {
                    const bonusAward = Math.floor(BonusQuota[i] * room.socialDot);
                    settleResult.push({
                        rank: i + 1,
                        uid: p.uid,
                        nickname: p.nickname,
                        socialDot: p.hotpotGameEarnings,
                        award: bonusAward,
                    });
                    p[moneyType] += bonusAward;
                    p.hotpotGameEarnings = 0;
                    bonusSum += bonusAward;
                });

                room.socialDot -= bonusSum;

                room.matchDot = 0;
                firstTimeSettling = false;

                //推送比赛结果
                messageService.pushMessageByUids('hotpot.matchResult', {settleResult}, settleUser.map(u => {
                    return {uid: u.uid, sid: u.sid};
                }))
            });


        }
        if (now >= Round.interval.total) {
            reset();
            if (room.users.length == 0) {
                room.socialRound.next = false;
            }
        }
    };
};

module.exports = (room, viper, app) => {
    const moneyType = viper ? 'integral' : 'gold';

    const _roundWork = roundWork(room, moneyType, app);
    //启动该回合
    const startRound = () => {
        //每两秒进行一次回合处理
        const baseDelay = 2000;
        const nextTick = (baseDelay, previous) => {
            const now = Date.now();
            //为了防止由于程序执行所需时间导致的误差
            const delay = previous == null ? baseDelay : baseDelay - (now - previous - baseDelay);
            const timer = setTimeout(() => nextTick(baseDelay, now), delay);
            try {
                if (room.socialRound.next) {
                    _roundWork();
                } else {
                    clearTimeout(timer);
                    room.socialRound = null;
                    return;
                }
            } catch (err) {
                console.error('比赛回合处理出错', err);
            }
        };
        nextTick(baseDelay);
    };
    //构造回合
    room.socialRound = {
        now: 0,
        status: Round.status.processing,
        next: true,
    };
    startRound();
};
