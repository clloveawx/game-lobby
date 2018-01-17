'use strict';

const MessageService = require('../../../services/MessageService');
const HallService = require('../../../services/HallService');
// const JackpotMgr = require('../JackpotMgr');
const utils = require('../../../utils');
const GameUtil = require('../../../utils/GameUtil');

const WAIT_TIME = 6000; // 等待准备时间
const FAHUA_TIME = 10000; // 发话时间

// 一个玩家
class Player {
	constructor (i, opts) {
		this.seat = i;
		this.uid = opts.uid;
		this.headurl = opts.headurl;
		this.nickname = opts.nickname;
		this.sex = opts.sex;
		this.gold = opts.gold;
        this.integral = opts.integral;
		this.isRobot = !opts.sid;// 是否机器人
		this.status = 'NONE';// WAIT.等待 READY.准备 GAME.游戏中

		this.cards = null;// 手牌
		this.cardType = 0;// 牌型 0表示无牛 
		this.holdStatus = 0;// 手牌状态 0.正常 1.看牌 2.弃牌 3.比牌失败
		this.bet = 0;// 下注
		this.isAllin = false;// 是否全下
		this.canliangs = [];// 可以对我亮牌的玩家
	}

	// 准备
	prepare () {
		this.status = 'WAIT';
		this.cards = null;
		this.cardType = 0;
	}

	// 初始游戏信息
	initGame (cards, cardType, betNum, gold,integral) {
		this.status = 'GAME';
		this.cards = cards;
		this.cards.sort((a, b) => b%13 - a%13);
		this.cardType = cardType;
		this.holdStatus = 0;
		this.bet = betNum;
		this.gold = gold;
		this.integral = integral;
		this.isAllin = false;
		this.canliangs = [];
	}

	// 返回手牌
	toHolds () {
		return this.cards && {cards: this.cards, type: this.cardType};
	}

	// 结算信息
	wrapSettlement (winner, sumBet) {
		return {
			uid: this.uid,
			seat: this.seat,
			gains: (this.uid === winner) ? sumBet : -this.bet,
			gold: this.gold,
			integral: this.integral,
			holds: this.toHolds(),
			canliangs: this.canliangs // 可以亮牌的玩家
		};
	}

	// 第一次发牌的数据
	wrapGame () {
		return {
			seat: this.seat,
			gold: this.gold,
			integral: this.integral,
			bet: this.bet,
			holds: null,
			holdStatus: this.holdStatus
		};
	}

	strip () {
		return {
			seat: this.seat,
			uid: this.uid,
			headurl: this.headurl,
			nickname: encodeURI(this.nickname),
			gold: this.gold,
			integral:this.integral,
			sex: this.sex,
			status: this.status,
			holds: null,
			holdStatus: this.holdStatus,
			bet: this.bet,
		};
	}
}


/**
 * 游戏房间
 */
class Room {

	constructor (opts) {
		this.id = opts.id;
		this.players = new Array(opts.maxCount).fill(null);// 玩家列表
		this.channel = opts.channel;
		this.entryCond = opts.entryCond || 0; // 进入条件
		this.lowBet = opts.lowBet || 100;// 底注
		this.capBet = opts.capBet || 2000;// 封顶
		this.capRound = opts.capRound || 8;// 可以全下的回合
		this.allinMaxNum = opts.allinMaxNum || 200000;// 可以全下最大额度
		this.maxRound = opts.maxRound || 100;// 最大回合次数 --- 暂没用
		this.status = 'NONE';// 状态 INWAIT.等待 INGAME.游戏中 END.回合结束
		
		this.roundTimes = 0;// 已经多少轮游戏了
		this.currSumBet = 0;// 当前盘面总押注
		this.betNum = this.lowBet;// 当前下注额度
		this.yetAllinNum = 0;// 当前已全下的额度
		this.randomSeed = 0;// 当前房间的随机种子

		this.currFahuaIdx = -1;// 当前发话的人
		this.lastWinIdx = -1;// 上次赢得玩家
		this.lastWaitTime = 0;// 记录开始等待时候的时间
		this.lastFahuaTime = 0;// 记录开始发话时候的时间
		this.tableJettons = [];// 当前桌面上的筹码列表
		this.inBipai = false;// 是否比牌模式

		this.bigwins = [];// 最大赢钱
        this.isvip = opts.isvip || false;//是否是vip房间
        this.vipRoomoWnerId = opts.vipRoomoWnerId || '';//vip房主uid
	}

	init () {
		this.currFahuaIdx = -1;// 当前发话的人
		this.roundTimes = 0;// 已经多少轮游戏了
		this.currSumBet = 0;// 当前盘面总押注
		this.betNum = this.lowBet;// 当前下注额度
		this.yetAllinNum = 0;//
		this.lastWaitTime = 0;
		this.lastFahuaTime = 0;
		this.tableJettons = [];
		this.inBipai = false;// 是否比牌模式
	}

	// 是否满员
	isFull () {
		return this.players.every(m => !!m);
	}

	// 添加玩家
	addPlayer (player) {
        const idxs = [];
        this.players.forEach((m,i) => !m && idxs.push(i));
        if(idxs.length === 0)
            return -1;
        // 随机一个位置
        const i = idxs[utils.random(0, idxs.length-1)];
        this.players[i] = new Player(i, player);
        // 添加到消息通道
        if(player.sid){
        	console.log('player.sid',player.sid)
            this.channel.add(player.uid, player.sid);
        }
        return i;
	}

	// 获取玩家
	getPlayer (uid) {
		return this.players.find(m => m && m.uid === uid);
	}

	// 删除玩家
	removePlayer (uid) {
		const idx = this.players.findIndex(m => m && m.uid === uid);
		if(idx !== -1){
			this.players[idx] = null;
			const member = this.channel.getMember(uid);
			member && this.channel.leave(member.uid, member.sid);
			// 如果没有玩家了 关闭房间
			if(this.players.every(m => !m)) {
				this.close();
			} else if(this.lastWinIdx === idx) {
				this.lastWinIdx = -1;// 上次赢得玩家走了就改成-1
			}
			return true;
		}
		return false;
	}

	// 有玩家离开
	leave (player) {
		if(!this.removePlayer(player.uid))
			return;
		// 通知其他玩家有人退出
        this.channel.leave(player.uid, player.sid);
		this.channel.pushMessage('onExit', {uid: player.uid});
		// 如果当前正是等待模式 那么检查人员是否都准备 可以开始
		if(this.status === 'INWAIT'){
			this.checkCanDeal();
		}
	}

	// 是否有该玩家
	hasPlayer (uid) {
		return this.players.some(m => m && m.uid === uid);
	}

	// 检查是否可以开始游戏
	checkCanDeal () {
		console.log('检查是否准备好');
		const list = this.players.filter(m => m && m.status !== 'NONE');
		if(list.length >= 2 && list.every(m => m.status === 'READY')){
			this.deal(list);
			return true;
		}
		return false;
	}

	// 获取等待状态的时间
	getWaitTime () {
		if(this.status === 'INWAIT')
			return Math.max(WAIT_TIME - (Date.now() - this.lastWaitTime), 0);
		if(this.status === 'INGAME')
			return Math.max(FAHUA_TIME - (Date.now() - this.lastFahuaTime), 0);
		return 0;
	}

	// 添加最大赢钱
	addBigwin (player, gain) {
		if(gain < 5000)
			return;
		this.bigwins.push({nickname: encodeURI(player.nickname), winNum: gain});
	}

	// 添加筹码
	addSumBet (num, seat) {
		this.currSumBet += num;
		// 记录筹码
		this.tableJettons.push({value: num, seat: seat});
	}

	// 等待玩家准备 
	wait () {
		clearTimeout(this.errorTimeout);
		console.log(this.id, '房间准备开始');
		this.status = 'INWAIT';// 等待玩家准备
		this.init();
		// 检测是否有金币不足的 直接踢出房间
		const paupers = this.players.filter(m => m && m.status !== 'NONE' && this.goldToIntegral(this.isvip,m) < this.entryCond);
		const uids = paupers.map(m => {
			const member = this.channel.getMember(m.uid);
			member && MessageService.pushMessageByUids('onRoomKick', {roomCode:this.id}, member);// 通知他被踢了
			this.removePlayer(m.uid);// 直接踢出出去
			return m.uid;
		});
		if(uids.length > 0){
			this.channel.pushMessage('onExit', {uids: uids});
		}

		// 获取当前房间玩家
		const arr = this.players.filter(m => m && m.status !== 'NONE');
		// 如果只剩一个人的时候或者没有人了 就直接关闭房间
		if(arr.length <= 1){
			this.close();
			this.channel.pushMessage('onWait', {waitTime: 0});
			return ;
		}
		// 通知 所有人开始准备
		this.lastWaitTime = Date.now(); // 这个记录只用于前段请求的时候用
		this.channel.pushMessage('onWait', {waitTime: WAIT_TIME});
		// 等一段时间后强行开始发牌
		clearTimeout(this.waitTimeout);
		this.waitTimeout = setTimeout(() => {
			// 人数超过2个就强行开始 
			const list = this.players.filter(m => m && m.status !== 'NONE');
			if(list.length >= 2){
				this.deal(list);
			} else {// 否则就关闭房间 因为当玩家进来的时候会再次检查
				this.close();
				list.forEach(m => m.status = 'WAIT');// 还原他们的状态
				this.channel.pushMessage('onWait', {waitTime: 0});// 通知还在的人不要准备了 等待其他人来
			}
		}, WAIT_TIME);
	}

	// 发牌
	deal (list) {
		this.status = 'INGAME';// 开始新的一轮游戏
		this.init();
		clearTimeout(this.waitTimeout);
		clearTimeout(this.dealTimeout);
		// 循环扣除每个人的低钱
		HallService.changeGoldMulti(list.map(m => m.uid), -this.betNum, (err, golds) => {
			if(err) {
				console.error('发牌时扣款失败');
				this.close();
				this.channel.pushMessage('onWait', {waitTime: 0});
				this.errorTimeout = setTimeout(() => this.wait(), 2000);
				return;
			}
			// 记录奖池
			const count = list.filter(m => m.isRobot).length;
			// const jackpot = JackpotMgr.addByBipai(this.lowBet, -count*this.betNum);
			// console.log('---------------|'+jackpot);
			// 洗牌
			let pais = GameUtil.shuffle();
			let cards, cardType, isRegulate = false;
			// 给每个人发牌 
			list.sort(() => 0.5 - Math.random());
			list.forEach(m => {
				do {
					cards = pais.splice(0, 5);
					cardType = GameUtil.getCardType(cards);
					if (!m.isRobot || jackpot > 100*this.lowBet || isRegulate) {
						break;
					}
					// 当机器人的盈利 10Y＜X＜100Y时，有调控，机器人反败为胜的概率为40%（玩家的牌在炸弹以下）
					if (jackpot > 10*this.lowBet && cardType >= 4) {
						isRegulate = true;
						break;
					}
					// 当机器人的盈利X＜10Y甚至为负时，有调控，机器人反败为胜的概率为80%（玩家的牌在炸弹以下）
					if (jackpot <= 10*this.lowBet && cardType >= 8) {
						isRegulate = true;
						break;
					}
					pais = pais.concat(cards);
					pais.sort(() => 0.5 - Math.random());
					// console.log('jackpot='+jackpot+', cardType='+cardType);
				} while (true);
				// 
				const temp = golds.find(x => x.uid === m.uid);
				m.initGame(cards, cardType, temp.value, temp.gold,temp.integral);
				this.addSumBet(temp.value, m.seat);
			});
			// 设置随机数种子
			this.randomSeed = Date.now();
			// 通知
			this.channel.pushMessage('onDeal', {
				currSumBet: this.currSumBet,
				randomSeed: this.randomSeed,
				players: list.map(m => m.wrapGame())
			});
			// 上次赢得玩家进行发话 延迟前端的发牌动作
			this.dealTimeout = setTimeout(() => {
				this.zhuangIdx = this.lastWinIdx !== -1 ? this.lastWinIdx : this.players.findIndex(m => m && m.status === 'GAME');
				this.fahua(this.zhuangIdx);
			}, list.length*500 + 200);
		});
	}

	// 发话
	fahua (idx) {
		if(idx === -1){
			console.error('出现错误 发话下标 = -1');
			return this.wait();
		}
		const player = this.players[idx];
		if(!player){ // 找不到玩家 先尝试下一个 不行就重新开房间
			if(this.currFahuaIdx === idx) {
				return this.wait();
			} else {
				this.currFahuaIdx = idx;
				return this.fahua(this.nextFahuaIdx());
			}
		}
		// 记录轮数
		(this.zhuangIdx === idx) && (++this.roundTimes);
		// 看是不是没有钱了 没有了就直接比牌结束 只要不是全下模式就可以
		const num = player.holdStatus === 1 ? this.betNum*2 : this.betNum;
		if(this.goldToIntegral(this.isvip,player) < num && this.yetAllinNum === 0) {
			const list = this.players.filter(m => m && m.status === 'GAME');
			this.joineachotherLiangpais(list);
			return this.settlement(GameUtil.bipai(list));
		}
		// 是否达到最大回合次数 那么强制开启全下 前提是没有开启全下
		// if (this.roundTimes >= this.maxRound && this.yetAllinNum === 0) {
		// 	this.yetAllinNum = this.canAllin();
		// }
		// 可以全下的额度
		const canAllinNum = Math.min(this.yetAllinNum || this.canAllin(), this.goldToIntegral(this.isvip,player));
		// 是否可以看牌 如果还没有看过牌并且超过三轮
		const canKanpai = player.holdStatus !== 1 && this.roundTimes >= 3;
		// 是否可以比牌 --- (如果钱不够了 也是不能比牌的吧 这个到时候考虑加不加 因为会提示金币不足)
		const canBipai = this.betNum > this.lowBet;
		// 记录发话时候的时间
		this.lastFahuaTime = Date.now();
		// 通知 
		this.channel.pushMessage('onFahua', {
			fahuaIdx: idx,
			lastFahuaIdx: this.currFahuaIdx,// 上一个发话的人
			betNum: this.betNum,// 下注额度
			canAllinNum: canAllinNum,// 可以全下的额度
			yetAllinNum: this.yetAllinNum,// 已经全下的额度
			roundTimes: this.roundTimes,// 当前轮数
			canKanpai: canKanpai,// 是否可以看牌
			canBipai: canBipai,// 是否可以比牌 只要加过注 才可以比牌
			fahuaTime: FAHUA_TIME
		});
		// 记录当前发话的人
		this.currFahuaIdx = idx;
		// 时间到了 视为弃牌 下一位继续发话
		this.resetFahuaTime();
	}

	// 跟注
	cingl (player, betNum) {
		// 先关闭定时
		clearTimeout(this.fahuaTimeout);
		if(this.isvip){
            // 先扣除积分
            HallService.changeIntegral(player.uid, -betNum, (integral) => {
                player.integral = integral ;
                // 记录奖池
                // player.isRobot && JackpotMgr.addByBipai(this.lowBet, -betNum);
                //
                player.bet += betNum;
                this.addSumBet(betNum, player.seat);
                // 通知
                this.channel.pushMessage('onOpts', {
                    type: 'cingl',
                    seat: player.seat,
                    integral: player.integral,
                    betNum: betNum, // 下注金额
                    curBetNum: player.bet, // 当前已经下注金额
                    sumBet: this.currSumBet
                });
                // 下一个发话
                this.fahua(this.nextFahuaIdx());
            });
        }else{
            // 先扣除金币
            HallService.changeGold(player.uid, -betNum, (gold) => {
                player.gold = gold;
                // 记录奖池
                // player.isRobot && JackpotMgr.addByBipai(this.lowBet, -betNum);
                //
                player.bet += betNum;
                this.addSumBet(betNum, player.seat);
                // 通知
                this.channel.pushMessage('onOpts', {
                    type: 'cingl',
                    seat: player.seat,
                    gold: player.gold,
                    betNum: betNum, // 下注金额
                    curBetNum: player.bet, // 当前已经下注金额
                    sumBet: this.currSumBet
                });
                // 下一个发话
                this.fahua(this.nextFahuaIdx());
            });
		}

	}

	// 加注
	filling (player, betNum, num) {
		// 先关闭定时
		clearTimeout(this.fahuaTimeout);
		if(this.isvip){
            // 先扣除积分
            HallService.changeIntegral(player.uid, -betNum, (integral) => {
                player.integral = integral;
                // 记录奖池
                // player.isRobot && JackpotMgr.addByBipai(this.lowBet, -betNum);
                //
                player.bet += betNum;
                this.addSumBet(betNum, player.seat);
                // 提升下注额度
                this.betNum = num;
                // 通知
                this.channel.pushMessage('onOpts', {
                    type: 'filling',
                    seat: player.seat,
                    integral: player.integral,
                    betNum: betNum, // 下注金额
                    curBetNum: player.bet, // 当前已经下注金额
                    sumBet: this.currSumBet
                });
                // 下一个发话
                this.fahua(this.nextFahuaIdx());
            });
		}else{
            // 先扣除金币
            HallService.changeGold(player.uid, -betNum, (gold) => {
                player.gold = gold;
                // 记录奖池
                // player.isRobot && JackpotMgr.addByBipai(this.lowBet, -betNum);
                //
                player.bet += betNum;
                this.addSumBet(betNum, player.seat);
                // 提升下注额度
                this.betNum = num;
                // 通知
                this.channel.pushMessage('onOpts', {
                    type: 'filling',
                    seat: player.seat,
                    gold: player.gold,
                    betNum: betNum, // 下注金额
                    curBetNum: player.bet, // 当前已经下注金额
                    sumBet: this.currSumBet
                });
                // 下一个发话
                this.fahua(this.nextFahuaIdx());
            });
		}

	}

	// 全下
	allin (player, betNum) {
		// 先关闭定时
		clearTimeout(this.fahuaTimeout);
		if(this.isvip){
            // 先扣除积分
            HallService.changeIntegral(player.uid, -betNum, (integral) => {
                player.integral = integral;
                // 记录奖池
                // player.isRobot && JackpotMgr.addByBipai(this.lowBet, -betNum);
                //
                player.bet += betNum;
                this.addSumBet(betNum, player.seat);
                // 记录他全下了
                player.isAllin = true;
                // 开启全下模式
                (this.yetAllinNum === 0) && (this.yetAllinNum = betNum);
                // 通知
                this.channel.pushMessage('onOpts', {
                    type: 'allin',
                    seat: player.seat,
                    integral: player.integral,
                    betNum: betNum,
                    curBetNum: player.bet,
                    sumBet: this.currSumBet
                });
                // 是否全部 都全下了 比大小 结算
                const list = this.players.filter(m => m && m.status === 'GAME');
                if(list.every(m => m.isAllin)){
                    // 互相加入到对方可亮牌列表中
                    this.joineachotherLiangpais(list);
                    // 比牌后结算
                    this.settlement(GameUtil.bipai(list));
                } else {// 下一个发话
                    this.fahua(this.nextFahuaIdx());
                }
            });
		}else{
            // 先扣除金币
            HallService.changeGold(player.uid, -betNum, (gold) => {
                player.gold = gold;
                // 记录奖池
                // player.isRobot && JackpotMgr.addByBipai(this.lowBet, -betNum);
                //
                player.bet += betNum;
                this.addSumBet(betNum, player.seat);
                // 记录他全下了
                player.isAllin = true;
                // 开启全下模式
                (this.yetAllinNum === 0) && (this.yetAllinNum = betNum);
                // 通知
                this.channel.pushMessage('onOpts', {
                    type: 'allin',
                    seat: player.seat,
                    gold: player.gold,
                    betNum: betNum,
                    curBetNum: player.bet,
                    sumBet: this.currSumBet
                });
                // 是否全部 都全下了 比大小 结算
                const list = this.players.filter(m => m && m.status === 'GAME');
                if(list.every(m => m.isAllin)){
                    // 互相加入到对方可亮牌列表中
                    this.joineachotherLiangpais(list);
                    // 比牌后结算
                    this.settlement(GameUtil.bipai(list));
                } else {// 下一个发话
                    this.fahua(this.nextFahuaIdx());
                }
            });
		}

	}

	// 看牌
	kanpai (player) {
		// 通知
		this.channel.pushMessage('onOpts', {
			type: 'kanpai', 
			seat: player.seat, 
			fahuaTime: this.resetFahuaTime()
		});
	}

	// 弃牌
	fold (idx) {
		this.players[idx].status = 'WAIT';
		this.players[idx].holdStatus = 2;// 标记弃牌
		// 如果是庄要让给下一个
		(this.zhuangIdx === idx) && this.resetZhuang();
		// 通知
		this.channel.pushMessage('onOpts', {type: 'fold', seat: idx});
		// 检查是否还可以继续
		this.checkHasNextPlayer(idx);
	}

	// 比牌
	bipai (player1, player2, num) {
		this.inBipai = true;
		// 先关闭定时
		clearTimeout(this.fahuaTimeout);
		clearTimeout(this.bipaiTimeout);
		if(this.isvip){
            // 先付钱吧积分
            HallService.changeIntegral(player1.uid, -num, (integral) => {
                player1.integral = integral;
                // 记录奖池
                // player1.isRobot && JackpotMgr.addByBipai(this.lowBet, -num);
                //
                player1.bet += num;
                this.addSumBet(num, player1.seat);
                // 互相加入到对方可亮牌列表中
                this.joineachotherLiangpais([player1, player2]);
                // 比牌
                const winner = GameUtil.bipai([player1, player2]);
                // 失败者
                const failer = winner.uid === player1.uid ? player2 : player1;
                // 先将失败者 弃牌
                failer.status = 'WAIT';
                failer.holdStatus = 3;// 标记比牌失败
                // 如果是庄要让给上一个玩家
                (this.zhuangIdx === failer.seat) && this.resetZhuang();
                // 通知比牌结果
                this.channel.pushMessage('onOpts', {
                    type: 'bipai',
                    seat: player1.seat,
                    integral: player1.integral,
                    betNum: num,
                    curBetNum: player1.bet,
                    sumBet: this.currSumBet,
                    iswin: winner.uid === player1.uid,// 是否胜利
                    other: player2.seat,// 另外一个人
                });
                // 延迟动画时间 然后继续
                this.bipaiTimeout = setTimeout(() => {
                    this.checkHasNextPlayer(player1.seat);
                    this.inBipai = false;
                }, 3500);
            });
		}else{
            // 先付钱吧金币
            HallService.changeGold(player1.uid, -num, (gold) => {
                player1.gold = gold;
                // 记录奖池
                // player1.isRobot && JackpotMgr.addByBipai(this.lowBet, -num);
                //
                player1.bet += num;
                this.addSumBet(num, player1.seat);
                // 互相加入到对方可亮牌列表中
                this.joineachotherLiangpais([player1, player2]);
                // 比牌
                const winner = GameUtil.bipai([player1, player2]);
                // 失败者
                const failer = winner.uid === player1.uid ? player2 : player1;
                // 先将失败者 弃牌
                failer.status = 'WAIT';
                failer.holdStatus = 3;// 标记比牌失败
                // 如果是庄要让给上一个玩家
                (this.zhuangIdx === failer.seat) && this.resetZhuang();
                // 通知比牌结果
                this.channel.pushMessage('onOpts', {
                    type: 'bipai',
                    seat: player1.seat,
                    gold: player1.gold,
                    betNum: num,
                    curBetNum: player1.bet,
                    sumBet: this.currSumBet,
                    iswin: winner.uid === player1.uid,// 是否胜利
                    other: player2.seat,// 另外一个人
                });
                // 延迟动画时间 然后继续
                this.bipaiTimeout = setTimeout(() => {
                    this.checkHasNextPlayer(player1.seat);
                    this.inBipai = false;
                }, 3500);
            });
		}

	}

	// 结算 本回合
	settlement (player) {
		// console.log(this.roundTimes+' 回合结束 winner=' + (player ? player.nickname : '无'));
		// 先停掉房间
		this.status = 'END';
		clearTimeout(this.fahuaTimeout);
		clearTimeout(this.waitTimeout);
		clearTimeout(this.bipaiTimeout);
		clearTimeout(this.settTimeout);
		clearTimeout(this.nextTimeout);
		clearTimeout(this.errorTimeout);
		// 如果没有玩家赢 那说明房间也没有其他人了
		if(!player) {
			return this.wait();
		}
		// 记录最后赢得玩家
		this.lastWinIdx = player.seat;
		// 抽佣 2%
		const winNum = Math.floor(this.currSumBet * 0.98);
		if(this.isvip){
            // 将盘面所有积分给赢得人
            HallService.changeIntegral(player.uid, winNum, (integral) => {
                player.integral = integral;
                // 记录奖池
                // player.isRobot && JackpotMgr.addByBipai(this.lowBet, this.currSumBet);
                // 记录bigwin
                this.addBigwin(player, winNum);
                // 获取当前参与游戏的玩家
                const list = this.players.filter(m => !!m);
                // 延迟后通知某玩家赢了
                this.settTimeout = setTimeout(() => {
                    this.channel.pushMessage('onSettlement', {
                        winner: player.uid,
                        winnerSeat: player.seat,
                        list: list.map(m => m.wrapSettlement(player.uid, winNum))
                    });
                    // 将剩余在游戏的玩家状态自动设置成准备
                    list.forEach(m => m.prepare());
                }, 800);
                // 延迟后进入下一局
                this.nextTimeout = setTimeout(() => this.wait(), 4000);
            });
		}else{
            // 将盘面所有金币给赢得人
            HallService.changeGold(player.uid, winNum, (gold) => {
                player.gold = gold;
                // 记录奖池
                // player.isRobot && JackpotMgr.addByBipai(this.lowBet, this.currSumBet);
                // 记录bigwin
                this.addBigwin(player, winNum);
                // 获取当前参与游戏的玩家
                const list = this.players.filter(m => !!m);
                // 延迟后通知某玩家赢了
                this.settTimeout = setTimeout(() => {
                    this.channel.pushMessage('onSettlement', {
                        winner: player.uid,
                        winnerSeat: player.seat,
                        list: list.map(m => m.wrapSettlement(player.uid, winNum))
                    });
                    // 将剩余在游戏的玩家状态自动设置成准备
                    list.forEach(m => m.prepare());
                }, 800);
                // 延迟后进入下一局
                this.nextTimeout = setTimeout(() => this.wait(), 4000);
            });
		}

	}

	// 检查 是不是还剩最后一个人了 就直接获胜
	checkHasNextPlayer (idx) {
		const list = this.players.filter(m => m && m.status === 'GAME');
		if(list.length <= 1){
			this.settlement(list[0]);// 结算
		} else if(list.every(m => m.isAllin)){// 是否全部 都全下了 比大小 结算
			// 互相加入到对方可亮牌列表中
			this.joineachotherLiangpais(list);
			// 比牌后结算
			this.settlement(GameUtil.bipai(list));
		} else if(idx === this.currFahuaIdx) {// 否则如果是当前发话玩家点击弃牌 那么就要让下一个发话
			this.fahua(this.nextFahuaIdx());
		}
	}

	// 重置发话时间 如果时间到了 就直接跳到下一个发话
	resetFahuaTime () {
		clearTimeout(this.fahuaTimeout);
		this.fahuaTimeout = setTimeout(() => this.fold(this.currFahuaIdx), FAHUA_TIME);
		return FAHUA_TIME;
	}

	// 是否可以开始全下 满足8回合并且只有2个人
	canAllin () {
		if(this.roundTimes < this.capRound)
			return 0;
		// 取出钱最少的
		const arr = this.players.filter(m => m && m.status === 'GAME');
		arr.sort((a, b) => this.goldToIntegral(this.isvip,a) - this.goldToIntegral(this.isvip,b));
		return Math.min(this.goldToIntegral(this.isvip,arr[0]), this.allinMaxNum);
	}

	// 下一个玩家
	nextFahuaIdx () {
		let i = 0, len = this.players.length;
		const next = idx => {
			if(++i > len){
				return -1;
			}
			(idx >= len) && (idx = 0);
			const player = this.players[idx];
			return (player && player.status === 'GAME') ? idx : next(idx+1);
		};
		return next(this.currFahuaIdx+1);
	}

	// 重置庄 让给上一个玩家
	resetZhuang () {
		let i = 0, len = this.players.length;
		const next = idx => {
			(idx < 0) && (idx = len-1);
			const player = this.players[idx];
			if(player && player.status === 'GAME') {
				this.zhuangIdx = idx;
			} else if(++i > len){
				this.zhuangIdx = this.currFahuaIdx;
			} else {
				next(idx-1);
			}
		};
		next(this.zhuangIdx-1);
	}

	// 互相加入到对方可亮牌列表中
	joineachotherLiangpais (players) {
		if(players.length <= 1)
			return;
		for (let i = players.length - 1; i >= 0; i--) {
			const player = players[i]
			players.forEach(m => (m.uid !== player.uid) && player.canliangs.push(m.uid));
		}
	}

	// 暂时关闭房间 - 关闭房间由房间没有忘记发起 所以不清除房间玩家信息
	close () {
		if(this.status === 'NONE')
			return;
		this.status = 'NONE';
		this.init();
		this.lastWinIdx = -1;
		clearTimeout(this.fahuaTimeout);
		clearTimeout(this.waitTimeout);
		clearTimeout(this.bipaiTimeout);
		clearTimeout(this.settTimeout);
		clearTimeout(this.nextTimeout);
		clearTimeout(this.errorTimeout);
		clearTimeout(this.dealTimeout);
		console.log(this.id+' 房间关闭');
	}

	strip () {
		return {
			id: this.id,
			players: this.players.map(m => m && m.strip()),
			status: this.status,
			roundTimes: this.roundTimes,
			currFahuaIdx: this.currFahuaIdx,
			currSumBet: this.currSumBet,
			randomSeed: this.randomSeed,
			tableJettons: this.tableJettons
		};
	}

	//金币转积分
	goldToIntegral(isvip,player){
		if(isvip){
			return player.integral;
		}else{
            return player.gold;
		}
	}
}

module.exports = Room;