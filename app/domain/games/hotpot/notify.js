'use strict';

const huoguo = require('./index');
const util = require('../../../utils');
const logic = require('./logic');

/**
 * 获取庄家和队列信息
 * @param app
 * @param dealer
 * @param robotDealer 机器人庄家配置
 */

const dealerInfo = exports.dealerInfo = util.curry((app, dealer, robotDealer) => {
	const dealerUid = dealer.uid;
	
	const userIds = dealer.queue.slice(0);
	const isRobotDealer = logic.isRobotDealer(robotDealer, dealer);
	if (!isRobotDealer) {
		userIds.unshift(dealerUid);
	}
    return new Promise((resolve, reject) =>{
        app.rpc.hall.playerRemote.getUsersInfo(null, userIds, function(err, usersInfo){
            let constructDealer;
            if(isRobotDealer){
                constructDealer = {nickname: robotDealer.name};
            }else{
                constructDealer = usersInfo.shift();
            }
            constructDealer.willOff = dealer.willOff;
            constructDealer.isRobot = isRobotDealer;
            constructDealer.remainRound = dealer.remainRound;
            return resolve({dealer: constructDealer, queue: usersInfo});
        })
    });
});

/**
 * dealer 通知
 * @param app
 * @param channel
 * @param dealer
 * @param robotDealer
 */
exports.dealer = (app, channel, dealer, robotDealer) => {
	dealerInfo(app, dealer, robotDealer).then((dealerInfo) =>{
		channel.pushMessage('huoguo.dealer', {
			dealer: dealerInfo.dealer,
			queue: dealerInfo.queue
		})
    }).catch(err =>{
        console.error('通知庄家失败',err)
    });
};

/**
 * win notify
 */
exports.win = (uid, msg, channel, channelService) => {
	channelService.pushMessageByUids('huoguo.win', msg, [channel.getMember(uid)]);
};
