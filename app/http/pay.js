const Con = require('./const');
const crypto = require('crypto');
const querystring = require('querystring');
const urlencode = require('urlencode');
const Http = require('http');
const db = require('../utils/db/mongodb');
const pomelo = require('pomelo');
const utils = require('../utils');
//发送支付请求
const sendHttp = function (postUrl,cb) {
    // const resend = function () {
        var opt = {
            method: "GET",
            host: Con.domainName,
            path: postUrl
        };
        var req = Http.request(opt, function (serverFeedback) {
            serverFeedback.setEncoding('utf8');
            if (serverFeedback.statusCode == 200) {
                var body = "";
                serverFeedback.on('data', function (data) {
                    body += data;
                }).on('end', function () {
                    body = JSON.parse(body);
                    return cb(body);
                });
            }else {
                return cb({statusCode:'02',error:'请求失败,状态码错误'});
            }
        });
        req.on('error', (e) => {
            console.error(`请求遇到问题: ${e.message}`,'重新发送');
            return cb({statusCode:'03',error:'支付繁忙，请稍后再试'});
            // return resend();
        });
        req.end();
    // }
    // resend();
}

//签名参数排序
const parameterSort = function (obj) {
    let arr = [];
    let objs = {};
    for(let i in obj){
        if(i != 'paySecret' && i != 'sign'){
            arr.push(i);
        }
    }
    arr.sort(function(a,b){
        var aa;
        var bb;
        var n = 0;
        aa = a[0].charCodeAt();
        bb = b[0].charCodeAt();
        while(aa == bb){
            n++;
            aa = a[n].charCodeAt();
            bb = b[n].charCodeAt();
        }
        return aa - bb;
    });
    arr.forEach(m=>{
        objs[m] = obj[m];
    });
    objs['paySecret'] = obj.paySecret;
    return objs;
}

//签名
const  signature = function (signSource) {
    let sign = querystring.stringify(signSource);
    sign = urlencode.decode(sign);
    var md5 = crypto.createHash('md5');
    md5.update(sign);
    let signs = md5.digest('hex').toUpperCase();
    return signs
}

//异步回传验证签名
const verifySignature = function (data) {
    let str = parameterSort(data);
    let sign = querystring.stringify(str);
    sign = urlencode.decode(sign);
    var md5 = crypto.createHash('md5');
    md5.update(sign);
    let signs = md5.digest('hex').toUpperCase();
    if(signs == data.sign){//验签成功
        return true;
    }else{
        return false;//验签失败
    }
}

//记录支付订单号
const recordOrder = function (field) {
    field['time'] = new Date().getTime();
    let order = db.getDao('pay_order');
    order.create(field,()=>{});
}

//生成支付请求参数（扫码支付）
module.exports.sendPay1 = function(res, data,cb) {
    let orderNo = utils.id(); //用户订单号（必须唯一）
    let productName = data.productName;//商品描述信息
    let orderPeriod = 12;//订单过期时间
    let orderPrice = data.payPrice;//付款金额
    let payWayCode = Con.payType[data.payType];//扫码类型
    let osType = Con.osType[data.osType];//支付设备系统类型
    let notifyUrl = Con.callbackurl;//服务器异步通知页面路径
    let payKey = Con.key;//支付key
    let field1 = data.field1;//业务扩展信息
    let paySecret = Con.paySecret;//支付密匙

    let signSource = {
        field1: field1,
        notifyUrl: notifyUrl,
        orderNo: orderNo,
        orderPeriod: orderPeriod,
        orderPrice: orderPrice,
        osType:osType,
        payKey:payKey,
        payWayCode:payWayCode,
        productName:productName,
        paySecret:paySecret
    }


    signSource = parameterSort(signSource);//参数排序
    let signs = signature(signSource);//参数签名
    console.log('signs', signs);

    let postUrl = Con.apiurl[data.type] + "?orderNo=" + orderNo;
    postUrl += "&productName=" + productName;
    postUrl += "&orderPeriod=" + orderPeriod;
    postUrl += "&orderPrice=" + orderPrice;
    postUrl += "&payWayCode=" + payWayCode;
    postUrl += "&osType=" + osType;
    postUrl += "&notifyUrl=" + notifyUrl;
    postUrl += "&payKey=" + payKey;
    postUrl += "&field1=" + field1;
    postUrl += "&sign=" + signs;

    console.log('postUrl:',Con.domainName+postUrl);
    sendHttp(postUrl,(re)=>{
        if(re.error){
            console.error(re.error);
        }
        if(re.statusCode == '00'){
            //记录订单号
            re['msg'] = '发起支付请求成功';
        }else{
            re['msg'] = '发起支付请求失败';
        }
        console.log('2222222222222',re);
        // recordOrder(re);
        if(res)res.send(re);
        return cb(re);



    });

}

//生成支付请求参数（快捷支付）
module.exports.sendPay2 = function (res, data,cb) {
    let orderNo = utils.id(); //用户订单号（必须唯一）
    let productName = data.productName;//商品描述信息
    let orderPeriod = 12;//订单过期时间
    let orderPrice = data.payPrice;//付款金额
    let payWayCode = Con.payType[data.payType];//扫码类型
    let osType = Con.osType[data.osType];//支付设备系统类型
    let notifyUrl = Con.callbackurl;//服务器异步通知页面路径
    let returnUrl = Con.returnUrl;//页面跳转同步通知页面路径
    let payKey = Con.key;//支付key
    let paySecret = Con.paySecret;//支付密匙
    let field1 = data.field1;//业务扩展信息

    let signSource = {
        field1: field1,
        notifyUrl: notifyUrl,
        returnUrl:returnUrl,
        orderNo: orderNo,
        orderPeriod: orderPeriod,
        orderPrice: orderPrice,
        osType:osType,
        payKey:payKey,
        payWayCode:payWayCode,
        productName:productName,
        paySecret:paySecret
    }

    signSource = parameterSort(signSource);//签名参数排序
    let signs = signature(signSource);//参数签名

    let postUrl = Con.apiurl[data.type] + "?orderNo=" + orderNo;
    postUrl += "&productName=" + productName;
    postUrl += "&orderPeriod=" + orderPeriod;
    postUrl += "&orderPrice=" + orderPrice;
    postUrl += "&payWayCode=" + payWayCode;
    postUrl += "&osType=" + osType;
    postUrl += "&notifyUrl=" + notifyUrl;
    postUrl += "&returnUrl=" + returnUrl;
    postUrl += "&payKey=" + payKey;
    postUrl += "&field1=" + field1;
    postUrl += "&sign=" + signs;

    console.log('postUrl:',Con.domainName+postUrl);
    if(res) res.send(Con.domainName+postUrl);
    return cb({url:Con.domainName+postUrl});
}

//生成支付请求参数（网银直连）
module.exports.sendPay3 = function (res, data,cb) {
    let orderNo = utils.id(); //用户订单号（必须唯一）
    let productName = data.productName;//商品描述信息
    let orderPeriod = 12;//订单过期时间
    let orderPrice = data.payPrice;//付款金额
    let payWayCode = Con.payType[data.payType];//扫码类型
    let osType = Con.osType[data.osType];//支付设备系统类型
    let notifyUrl = Con.callbackurl;//服务器异步通知页面路径
    let returnUrl = Con.returnUrl;//页面跳转同步通知页面路径
    let payKey = Con.key;//支付key
    let paySecret = Con.paySecret;//支付密匙
    let field1 = data.field1;//业务扩展信息
    let pay_type = Con.bankCard[data.pay_type];//默认支付方式
    let bankName = Con.bankList[data.bankName];//默认银行
    let signSource = {
        field1: field1,
        notifyUrl: notifyUrl,
        returnUrl:returnUrl,
        orderNo: orderNo,
        orderPeriod: orderPeriod,
        orderPrice: orderPrice,
        osType:osType,
        payKey:payKey,
        payWayCode:payWayCode,
        productName:productName,
        paySecret:paySecret,
        bankName:bankName,
        pay_type:pay_type
    }

    signSource = parameterSort(signSource);//参数排序
    let signs = signature(signSource);//参数签名

    let postUrl = Con.apiurl[data.type] + "?orderNo=" + orderNo;
    postUrl += "&productName=" + productName;
    postUrl += "&orderPeriod=" + orderPeriod;
    postUrl += "&orderPrice=" + orderPrice;
    postUrl += "&payWayCode=" + payWayCode;
    postUrl += "&osType=" + osType;
    postUrl += "&notifyUrl=" + notifyUrl;
    postUrl += "&returnUrl=" + returnUrl;
    postUrl += "&payKey=" + payKey;
    postUrl += "&field1=" + field1;
    postUrl += "&pay_type=" + pay_type;
    postUrl += "&bankName=" + bankName;
    postUrl += "&sign=" + signs;


    if(res) res.send(Con.domainName+postUrl);
    return cb({url:Con.domainName+postUrl});
}

//生成支付请求参数（H5）
module.exports.sendPay4 = function (res, data,cb) {
    let orderNo = utils.id(); //用户订单号（必须唯一）
    let productName = data.productName;//商品描述信息
    let orderPeriod = 12;//订单过期时间
    let orderPrice = data.payPrice;//付款金额
    let payWayCode = Con.payType[data.payType];//扫码类型
    let osType = Con.osType[data.osType];//支付设备系统类型
    let notifyUrl = Con.callbackurl;//服务器异步通知页面路径
    let sceneType = Con.sceneType[data.sceneType];//场景类型
    let appName = data.appName;//APP名称,场景类型sceneType=0、1时必填 例如：王者荣耀
    let bundleId = data.bundleId;//绑定ID,场景类型sceneType=0时必填例如：com.tencent.wzryIOS
    let packageName = data.packageName;//包名,场景类型sceneType=1时必填例如：com.tencent.tmgp.sgame
    let wapUrl = data.wapUrl;//WAP网站URL,场景类型sceneType=2时必填 例如：https://pay.qq.com
    let wapName = data.wapName;//WAP网站名,场景类型sceneType=1时必填 例如：腾讯充值
    let payKey = Con.key;//支付key
    let field1 = data.field1;//业务扩展信息
    let paySecret = Con.paySecret;//支付密匙

    let signSource = {
        field1: field1,
        notifyUrl: notifyUrl,
        orderNo: orderNo,
        orderPeriod: orderPeriod,
        orderPrice: orderPrice,
        osType:osType,
        payKey:payKey,
        payWayCode:payWayCode,
        productName:productName,
        sceneType:sceneType,
        wapName:wapName,
        wapUrl:wapUrl,
        paySecret:paySecret
    }

    signSource = parameterSort(signSource);//参数排序
    // console.log('带签名字符串',signSource);
    let signs = signature(signSource);//参数签名
    // console.log('名字后符串',signs);
    let postUrl = Con.apiurl[data.type] + "?orderNo=" + orderNo;
    postUrl += "&productName=" + productName;
    postUrl += "&orderPeriod=" + orderPeriod;
    postUrl += "&orderPrice=" + orderPrice;
    postUrl += "&payWayCode=" + payWayCode;
    postUrl += "&osType=" + osType;
    postUrl += "&notifyUrl=" + notifyUrl;
    postUrl += "&sceneType=" + sceneType;
    postUrl += "&payKey=" + payKey;
    postUrl += "&field1=" + field1;
        postUrl += "&wapUrl=" + wapUrl;
        postUrl += "&wapName=" + wapName;

    postUrl += "&sign=" + signs;

    if(res) res.send(Con.domainName+postUrl);

    return cb({url:Con.domainName+postUrl});
}


//支付回传处理
module.exports.callback = function (res,data) {
    console.log('回传参数',data);
    //验签
    data['paySecret'] = Con.paySecret;//添加商户密钥
    let isVerify = verifySignature(data);
    if(!isVerify){
        console.error('验签失败，回传参数有误');
        return;
    }

    if(data.statusCode == '00'){//查询成功
        switch (data.tradeStatus){
            case 'SUCCESS'://交易成功，不能再次进行交易
                console.log('交易成功');
                pomelo.app.rpc.hall.payRemote.shopPayCallback(null, data, function(result){
                        // res.send(msg);
                        if(result.code === 200 ){
                            console.log('充值成功')
                            // break;
                        }
                      
                });
                break;
            case 'CANCELED'://交易撤销
                console.log('交易撤销');
                break;
            case 'WAITING_PAYMENT'://交易创建，等待买家付款。
                console.log('交易创建');
                break;
            case 'FAILED'://失败
                console.log('交易失败');
                break;
        }
        res.send('success');
    }else{
        console.error('查询失败');
    }
}


