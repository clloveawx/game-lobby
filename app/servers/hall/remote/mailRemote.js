'use strict';

const MessageService = require('../../../services/MessageService');
const PlayerMgr = require('../../../domain/hall/player/PlayerMgr');
const utils = require('../../../utils');
const gconf ={GOLD_NID:1000};
const MailService = require('../../../services/MailService');
const CARDTYPE_STR = {0:'无牛', 1: '牛一', 2: '牛二', 3: '牛三', 4: '牛四', 5: '牛五', 6: '牛六', 7: '牛七', 8: '牛八', 9: '牛九', 10: '牛牛', 11: '五花牛', 12: '五花牛', 13: '四炸'};
module.exports = function(app) {
	return new Remote(app);
};

var Remote = function(app) {
	this.app = app;
};

/**
 * 批量发送邮件
 */
const sendMail = function(uids, title, content, props) {
	let opts={
        name:title,
        content:content
	}
	if(props.length && props[0].value) opts['attachment'] = {gold:props[0].value};
	console.log('邮件内容：',opts);
	MailService.generatorMail(opts,uids, function(err, mailDocs){//给玩家发邮件
		if(err){
			return next(null, {code: 500, error: '系统生成邮件'});
		}
	});
};

/**
 * 游戏中断 - 欢乐牛牛
 */
Remote.prototype.changeGoldsByMail = function(game, players, cb) {
	// console.log(players.length);
	let props = null, player = null;
	for (let i = players.length - 1; i >= 0; i--) {
		const {uid, gain, sumBet, bets} = players[i];
		if(sumBet === 0 || gain === 0){
			continue;
		}
		const isZhuang = sumBet === -1;
		const gainStr = (gain > 0 ? '+':'')+gain;
		props = null;
		player = PlayerMgr.getPlayer(uid);
		if(player) { // 在线直接更新金币 并通知
			player.gold = Math.max(player.gold + gain, 0);
			// 通知前端
			MessageService.pushMessageByUids('onGameSettlement', {content: '您在['+game.name+']游戏中中途退出，收益'+gainStr+'，请到邮件查看详情。', gold: player.gold}, player.uids());
		} else { // 不在线的话 就更改数据库
			if(gain < 0) {
				PlayerMgr.search({uid: uid}, function (err, res) {
					if(res) {
						res.gold = Math.max(res.gold + gain, 0);
						PlayerMgr.updatePlayerToDB({uid: uid}, {gold: res.gold});
					}
				});
			} else if(gain > 0) {
				props = [{nid: gconf.GOLD_NID, value: gain}];
			}
		}
		const iswin0 = game.regions[0].isWin;
		const iswin1 = game.regions[1].isWin;
		const iswin2 = game.regions[2].isWin;
		const iswin3 = game.regions[3].isWin;

		const num0 = isZhuang ? game.regions[0].sumBet : bets[0];
		const num1 = isZhuang ? game.regions[1].sumBet : bets[1];
		const num2 = isZhuang ? game.regions[2].sumBet : bets[2];
		const num3 = isZhuang ? game.regions[3].sumBet : bets[3];

		const s0 = num0 > 0 ? ((iswin0 ? '+' : '-') + (game.regions[0].multiple * num0)) : 0;
		const s1 = num1 > 0 ? ((iswin1 ? '+' : '-') + (game.regions[1].multiple * num1)) : 0;
		const s2 = num2 > 0 ? ((iswin2 ? '+' : '-') + (game.regions[2].multiple * num2)) : 0;
		const s3 = num3 > 0 ? ((iswin3 ? '+' : '-') + (game.regions[3].multiple * num3)) : 0;
		// 发一封详细信息邮件
		const content = '由于断线/退出游戏，您在['+game.name+']游戏中'+(isZhuang ? '当庄' : ('押注'+utils.simplifyMoney(sumBet)))+ '已自动结算' +
		'\n庄：'+CARDTYPE_STR[game.zhuangResult.cardType] +
		'\n天：'+CARDTYPE_STR[game.regions[0].cardType]+'('+(iswin0 ? '赢':'输') + ' ' + num0 + 'x' + game.regions[0].multiple + ')  ' + s0 +
		'\n地：'+CARDTYPE_STR[game.regions[1].cardType]+'('+(iswin1 ? '赢':'输') + ' ' + num1 + 'x' + game.regions[1].multiple + ')  ' + s1 +
		'\n玄：'+CARDTYPE_STR[game.regions[2].cardType]+'('+(iswin2 ? '赢':'输') + ' ' + num2 + 'x' + game.regions[2].multiple + ')  ' + s2 +
		'\n黄：'+CARDTYPE_STR[game.regions[3].cardType]+'('+(iswin3 ? '赢':'输') + ' ' + num3 + 'x' + game.regions[3].multiple + ')  ' + s3 +
		'\n总收益为'+gainStr+'。' + (player ? '(已发放)':(gain < 0?'(已扣除)':''));
		sendMail(uid, '游戏中断', content, props || []);
	}
	cb(null);
};

/**
 * 游戏中断 - 百家乐
 */
Remote.prototype.changeGoldsByMail2 = function(game, players, cb) {
	let props = null, player = null, sumBet = 0;
	for (let i = players.length - 1; i >= 0; i--) {
		const {uid, gain, bets} = players[i];
		if(gain === 0){
			continue;
		}
		sumBet = 0;
		for (let key in bets) {
			sumBet += bets[key].bet;
		}
		const gainStr = (gain > 0 ? '+':'')+gain;
		props = [{nid: gconf.GOLD_NID, value: gain}];
		// 发一封详细信息邮件
		const content = '由于断线/退出游戏，您在['+game.name+']游戏中押注'+utils.simplifyMoney(sumBet)+ '已自动结算' +
		'\n闲：'+game.regions[0].cardType+'   庄：'+game.regions[1].cardType +
		'\n[小：'+bets.small.bet+'-'+bets.small.gain+'] [闲对：'+bets.pair0.bet+'-'+bets.pair0.gain+'] [庄对：'+bets.pair1.bet+'-'+bets.pair1.gain+'] [大：'+bets.big.bet+'-'+bets.big.gain+']' +
		'\n[闲：'+bets.play.bet+'-'+bets.play.gain+'] [和：'+bets.draw.bet+'-'+bets.draw.gain+'] [庄：'+bets.bank.bet+'-'+bets.bank.gain+']' +
		'\n总收益为'+gainStr+'。';
		console.log('22222222222222');
		sendMail(uid, '游戏中断', content, props);
	}
	cb(null);
};

/**
 * 游戏中断 - ATT
 */
Remote.prototype.changeGoldsByMail3 = function(game, player, cb) {
	const content = '由于断线/退出游戏，您在['+game.name+']游戏中押注'+utils.simplifyMoney(player.sumBet)+ '筹码已自动结算' +
	'\n赢得'+utils.simplifyMoney(player.gain)+'筹码。';
	sendMail(player.uid, '游戏中断', content, [{nid: gconf.GOLD_NID, value: player.gain}]);
	cb(null);
};

/**
 * 游戏中断 - 21点
 */
Remote.prototype.changeGoldsByMail4 = function(game, player, cb) {
    let content = '尊敬的玩家:'+player.nickname+'，你好，你在'+utils.cDate()+'进行的'+game.name+
		'游戏因为掉线已自动结算，你当局共获得'+player.gain+'金币';
    content += player.gain?',已发送到你的邮箱。':'。';
    sendMail(player.uid, '游戏中断', content, [{nid: gconf.GOLD_NID, value: player.gain}]);
    cb(null);
};