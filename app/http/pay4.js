/**
 * Created by 14060 on 2017/12/26.
 */
const Con = require('./const4');
const crypto = require('crypto');
const querystring = require('querystring');
const urlencode = require('urlencode');
const Http = require('http');
const db = require('../utils/db/mongodb');
const pomelo = require('pomelo');
const utils = require('../utils');
const payUtil = require('./payUtil');

//H5支付
const H5 = function (res, data,cb) {
    let userid = Con.ID;//商户在平台系统上的商户ID
    let orderid  = utils.id();//商户系统内生成的订单号码
    let money  = data.payPrice;//交易金额
    let hrefurl  = Con.backNotifyUrl;//同步回调地址
    let url = Con.backNotifyUrl;//异步回调地址
    let bankid = Con.payTypeH5[data.payType];
    let ext = data.field1;//

    let signSource = {
        userid: userid,
        orderid: orderid,
        bankid: bankid,
        keyvalue: Con.key
    }

    // signSource = payUtil.parameterSort3(signSource);//参数排序
    console.log('带签名字符串',signSource);
    let signs = payUtil.signature(signSource);//参数签名
    console.log('名字后符串',signs);

    //序列化请求参数
    let postUrl = Con.url + "?userid=" + userid;
    postUrl += "&orderid=" + orderid;
    postUrl += "&money=" + money;
    postUrl += "&hrefurl=" + hrefurl;
    postUrl += "&url=" + url;
    postUrl += "&bankid=" + bankid;
    postUrl += "&ext=" + ext;
    postUrl += "&sign=" + signs;
    if(res) res.send({postUrl});
    return cb({url:postUrl});

}

//扫码支付
const scanCode = function (res, data,cb) {
    let userid = Con.ID;//商户在平台系统上的商户ID
    let orderid  = utils.id();//商户系统内生成的订单号码
    let money  = data.payPrice;//交易金额
    let hrefurl  = Con.backNotifyUrl;//同步回调地址
    let url = Con.backNotifyUrl;//异步回调地址
    let bankid = Con.payType[data.payType];
    let ext = data.field1;//

    let signSource = {
        userid: userid,
        orderid: orderid,
        bankid: bankid,
        keyvalue: Con.key
    }

    // signSource = payUtil.parameterSort3(signSource);//参数排序
    console.log('带签名字符串',signSource);
    let signs = payUtil.signature(signSource);//参数签名
    console.log('名字后符串',signs);

    //序列化请求参数
    let postUrl = Con.url + "?userid=" + userid;
    postUrl += "&orderid=" + orderid;
    postUrl += "&money=" + money;
    postUrl += "&hrefurl=" + hrefurl;
    postUrl += "&url=" + url;
    postUrl += "&bankid=" + bankid;
    postUrl += "&ext=" + ext;
    postUrl += "&sign=" + signs;

    if(res) res.send({postUrl});
    return cb({url:postUrl});
}


//充值回掉验签
const verifySignature = function (data) {
    console.log('验签字符串0',data);
    let objs = {
        returncode:data.returncode,
        userid:Con.ID,
        orderid:data.orderid,
        money:data.money,
        keyvalue:data.keyvalue
    }

    console.log('验签字符串1',objs);
    let sign = querystring.stringify(objs);
    console.log('验签字符串2',sign);
    sign = urlencode.decode(sign);
    console.log('验签字符串3',sign);
    var md5 = crypto.createHash('md5');
    md5.update(sign);
    let signs = md5.digest('hex');
    console.log('签名',data.sign,signs)
    if(signs == data.sign){//验签成功
        return true;
    }else{
        return false;//验签失败
    }
}

//请求支付
module.exports.sendPay = function (res,data,cb) {
    switch (data.sendPayType){
        case 'H5'://H5支付
            H5(res,data,cb);
            break;
        case 'scanCode'://扫码支付
            console.log('!!!!!!!!!!!!');
            scanCode(res,data,cb)
            break;
    }

}

module.exports.callback = function (res,data) {
    data['keyvalue']=Con.key;
    //验签
    let isVerify = verifySignature(data);
    if(!isVerify){
        console.error('验签失败');
        return;
    }
    if(data.returncode == 1){
        pomelo.app.rpc.hall.payRemote.shopThreePayCallback(null, data, function(result){
            if(result.code === 200 ){
                console.log('充值成功')
            }
              
        });  
    }
    res.send('success');
}