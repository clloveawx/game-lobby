'use strict';
/**
 * 融云 短信服务
 */

const http = require('http');
const sha1 = require('sha1');
const querystring = require('querystring');
const async = require('async');
const db = require('../utils/db/mongodb'); 
const shopUrl = require('../../config/data/shopUrl.json');


const appkey = "n19jmcy5ndvg9";
const secret = "tnDTQy8tIT0";// 密钥
const templateId = '4vw3tW9lAOz8odnn374s7f';// 短信验证模板ID
const notification = {
    1:'0qEQ8VZQkb-9pxomXkob8n',//发卡通知（玩家）
    2:'cJ1vg0PF4BE8WM56NEIJIb',//发卡通知（客服）
    3:'3_TG79k34FrblN50G7UWsg'//警告通知
};
const notUrl = 'http://api.sms.ronghub.com/sendNotify.json';//发送通知类短信方法
const phoneNumber = require('../../config/data/phoneNumber.json');

const httpRequest = function (path, content, cb) {
	const NONCE = parseInt(Math.random() * 0xffffff);
	const TIMESTAMP = Date.parse(new Date()) / 1000;
	const SIGNATURE = sha1(secret + NONCE + TIMESTAMP);
	const resend = function () {
        const options = {
            host: 'api.sms.ronghub.com',
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'App-Key': appkey,
                'Nonce': NONCE,
                'Timestamp': TIMESTAMP,
                'Signature': SIGNATURE,
                "Content-Length": content.length
            }
        };
        let req = http.request(options, function(res) {
            let data = '';
            res.on('data', function(chunk) {
                data += chunk;
            });
            res.on('end', function () {
                return cb(JSON.parse(data));
            });
        });
        req.on('error', (e) => {
            console.error(`请求遇到问题: ${e.message}`,'重新发起');
            //重新请求
			return resend();
        });
        req.write(content);
        req.end();
    }
    resend();
};

/**
 * 获取验证码
 */
exports.getAuthcode = function (phone, cb = function() {}) {
	// 检查是否合法手机号
    if (isNaN(phone)){
    	return cb(null, {code: 500, error: '请输入正确的手机号'});
    }
	if (phone.length !== 11){
		return cb(null, {code: 500, error: '请输入正确的手机号'});
	}
	if(!(/^1[3-9][0-9]\d{4,8}$/.test(phone))){ 
		return cb(null, {code: 500, error: '请输入正确的手机号'});
	}
	// console.log(phone);
	const content = querystring.stringify({
		mobile: phone,
		templateId: templateId,
		region: 86
	});
	httpRequest('http://api.sms.ronghub.com/sendCode.json', content, function (data) {
		// console.log(data);
		cb(null, data);
	});
};

/**
 * 验证
 */
exports.auth = function (sessionId, code, cb = function () {}) {
	const content = querystring.stringify({
		sessionId: sessionId,
		code: code
	});
	httpRequest('http://api.sms.ronghub.com/verifyCode.json', content, function (data) {
		// console.log(data);
		cb(null, data);
	});
};

//短信通知
const sendNotification = function ({phone,p1,p2,p3,sendType},cb) {
    let ob = {
        mobile: phone,
        templateId: notification[sendType],
        region: 86,
        p1:p1,
        p2:p2
    }
    if(p3){
        ob['p3'] = p3;
    }
    const content = querystring.stringify(ob);
    httpRequest(notUrl, content, function (data) {
        cb(data);
    });
}

//提醒业务人员兑奖
exports.remindExchange = function (userId,prizeName,cardNo,residue) {
    let player = '';
    async.waterfall([
        (cb) =>{//查询玩家信息
            const player_info = db.getDao('player_info');//玩家数据库
            player_info.findOne({uid:userId},(error,data)=>{

                if(error){
                    return cb('player_info数据库查询失败');
                }
                player = data;
                if(!data.inviteCode){
                    return cb('没有邀请码');
                }
                return cb(null);
            })
        },
        (cb)=>{//查询渠道信息
            let invite_code_info = db.getDao('invite_code_info');//渠道数据库
            invite_code_info.findOne({inviteCode:player.inviteCode},function(err,invite){
                if(err){
                    return cb('invite_code_info数据库查询失败');
                }
                if(invite.viper){
                    return cb(null,invite.viper);
                }
                return cb('有邀请码，没有找到渠道');
            });
        },
        (arg1,cb)=>{//查询渠道名称
            let user_info = db.getDao('user_info');//玩家数据库
            user_info.findOne({uid:arg1},(err,user)=>{
                if(err){
                    return cb('user_info数据库查询失败');
                }
                if(user.remark){
                    return cb(null,user.remark);
                }
                return cb('有渠道ID，没有找到渠道名称');
            });
        },
        ],
        (error,result)=>{
            let ditchName = '';
            if(error){
                console.error(error);
            }else{
                ditchName = result;
            }

            let p1 = '【'+player.nickname+'】'+' ID:'+'【'+player.uid+'】';
            let p2 = '【'+prizeName+'】' + '  卡号：【' + cardNo + '】 库存剩余：【' +residue+'】';
            let p3 =  '所属渠道：【'+ditchName+'】'
            phoneNumber.forEach(m=>{
                sendNotification({phone:m.phone,p1:p1,p2:p2,p3:p3,sendType:2},(data)=>{
                    if(data.code != 200){
                        console.log(data);
                        console.error('短信通知发送失败给发奖人员');
                    }else{
                        console.log('发送给发奖人员成功');
                    }
                });
            });
        });

}

//兑奖成功发送短信给玩家
exports.remindExchange1 = function (phone,prizeName,cardCode,cardPasswode) {
    let phoneArr = [phone];
    let p1 = ' 奖品：【'+prizeName+'】，卡号：【'+cardCode+'】，卡密：【'+cardPasswode+'】';
    let p2 = shopUrl.url
    phoneArr.forEach(m=>{
        sendNotification({phone:m,p1:p1,p2:p2,sendType:1},(data)=>{
            if(data.code != 200){
                console.log(data);
                console.error('短信通知发送失败给玩家');
            }else{
                console.log('发送给玩家成功');
            }

        });
    });
}

//发送短信通知值班人员审核
exports.sendWarn = function (player,cardName,allMoney) {
    phoneNumber.forEach(m=>{
        let p1 = '#兑奖审核提醒#玩家:'+player.nickname+'(ID:'+player.uid+')发起兑奖：';
        let p2 = cardName+'。累计兑奖:'+allMoney+'元，累计充值：'+player.addRmb+'元，';
        let p3 = '请留意。';
        sendNotification({phone:m.phone,p1:p1,p2:p2,p3:p3,sendType:3},(data)=>{
            if(data.code != 200){
                console.log(data);
                console.error('发送警告短信失败');
            }else{
                console.log('发送警告短信成功');
            }
        });
    });
}
