/**
 * Created by 14060 on 2017/12/25.
 */
'use strict';
const urlencode = require('urlencode');
const querystring = require('querystring');
const crypto = require('crypto');
const Http = require('http');
//发送支付请求
module.exports.sendHttp = function ({postUrl,domainName,port},cb) {
    var opt = {
        method: "GET",
        host: domainName,
        path: postUrl,
        port:port
    };
    console.log('opt',opt);
    var req = Http.request(opt, function (serverFeedback) {
        serverFeedback.setEncoding('utf8');
        console.log('STATUS: ' + serverFeedback.statusCode);
        console.log('HEADERS: ' + JSON.stringify(serverFeedback.headers));
        console.log('serverFeedback.statusCode',serverFeedback.statusCode);
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
    });
    req.end();
}

module.exports.sendHttpPost = function (postUrl,cb) {
    console.log('postUrlpostUrl',postUrl);
    const options = {
        host: '60.28.24.164',
        port: 8102,
        path: postUrl,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postUrl)
        }
    };

    const req = http.request(options, (res) => {
        console.log(`状态码: ${res.statusCode}`);
        console.log(`响应头: ${JSON.stringify(res.headers)}`);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            console.log(`响应主体: ${chunk}`);
        });
        res.on('end', () => {
            return cb();
            console.log('响应中已无数据。');
        });
    });

    req.on('error', (e) => {
        console.error(`请求遇到问题: ${e.message}`);
    });

// 写入数据到请求主体
    req.write(postUrl);
    req.end();
}

//签名参数排序
module.exports.parameterSort = function (obj) {
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

//签名参数排序
module.exports.parameterSortNew = function (obj) {
    let arr = [];
    let objs = {};
    for(let i in obj){
        arr.push(i);

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
    return objs;
}

//签名
module.exports.signature = function (signSource) {
    let sign = querystring.stringify(signSource);
    sign = urlencode.decode(sign);
    console.log('签名字符串',sign);
    var md5 = crypto.createHash('md5');
    md5.update(sign);
    let signs = md5.digest('hex');
    return signs
}
