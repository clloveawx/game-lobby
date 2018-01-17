'use strict';
const pay = require('../../../http/pay');
const pay4 = require('../../../http/pay4');
const Con = require('../../../http/const');
const db = require('../../../utils/db/mongodb');
const utils = require('../../../utils');
module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
};

//发起支付请求
//路由 hall.payHandler.payRequest
//parameter {type,price,payType,osType,pay_type,bankName,sceneType}
Handler.prototype.payRequest = function ({currencyType, type, price, payType, osType, pay_type, bankName, sceneType}, session, next) {
    const payRecord = db.getDao('pay_record');
    const info = {
        id: utils.id(),
        createTime: Date.now(),
        uid: session.uid,
    };

    payRecord.create(info, function (err, res) {
        if (err || !res) {
            return next({code: 500});
        }
        let uid = session.uid;
        if (!uid) {
            return next(null, {code: 500, error: '参数错误'});
        }
        let data = {
            productName: 'gold',//商品描述信息
            payPrice: price,//付款金额
            payType: payType,//扫码类型
            osType: osType,//设备类型
            field1: currencyType + '-' + uid,//业务扩展信息
            type: type
        }
        console.log('datadatadata', data);
        //选择支付类型
        switch (type) {
            //重庆菜豆网络快一付支付渠道
            case 'SCAN_CODE'://扫码支付

                pay.sendPay1(null, data, (re) => {
                    if (re.statusCode == '00') {
                        return next(null, {code: 200, payURL: re.payURL});
                    } else {
                        return next(null, {code: 500, error: '支付繁忙，请稍后再试'});
                    }
                });
                break;
            case 'SHORTCUT_PAY'://快捷支付
                pay.sendPay2(null, data, (re) => {
                    return next(null, {code: 200, payURL: re.url});
                });
                break;
            case 'BANK_CARD'://银联支付
                data['pay_type'] = pay_type;//默认支付方式
                data['bankName'] = bankName;//默认银行
                pay.sendPay3(null, data, (re) => {
                    return next(null, {code: 200, payURL: re.url});
                });
                break;
            case 'H5'://微信H5
                data['sceneType'] = sceneType;
                data['wapUrl'] = '111';
                data['wapName'] = '111';
                pay.sendPay4(null, data, (re) => {
                    console.log('rererere', re);
                    return next(null, {code: 200, payURL: 'http://'+re.url});
                });
                break;

            //仟易商户支付渠道
            case 'SCAN_CODE_QIANYI'://扫码支付
                data['sendPayType'] = 'scanCode';
                pay4.sendPay(null, data, (re) => {
                    return next(null, {code: 200, payURL: re.url});
                });
                break;
            case 'H5_QIANYI'://H5
                data['sendPayType'] = 'H5';
                pay4.sendPay(null, data, (re) => {
                    return next(null, {code: 200, payURL: re.url});
                });
                break;
        }
    });

}