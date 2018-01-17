'use strict';
const Const = module.exports;

// MD5密钥，安全检验码，由数字和字母组成的字符串，请登录商户后台查看
Const.key = '389857e4251d48fab09be811c339e063';

//支付密匙
Const.paySecret = 'e6fe6767ad6c4547b1f62ca612299997';

//支付网关服务器域名
Const.domainName = 'www.kvpay.com';

//订单查询地址
Const.orderQuery = "/gateway/scanPay/orderQuery";

// 服务器异步通知页面路径  需http://格式的完整路径，不能加?id=123这类自定义参数，必须外网可以正常访问
// Const.callbackurl = "http://118.184.66.38:3320/callbackurl";//测试服
// Const.callbackurl = "http://43.254.219.18:3320/callbackurl";//正式服
Const.callbackurl = "http://103.246.246.195:3320/callbackurl";//正式服VIP
// Const.callbackurl = "http://45.124.115.41:3320/callbackurl";//vip测试服
// 页面跳转同步通知页面路径
// Const.returnUrl = 'http://118.184.66.38:3320/callbackurl';//测试服
// Const.returnUrl = 'http://43.254.219.18:3320/callbackurl';//正式服
Const.returnUrl = 'http://103.246.246.195:3320/callbackurl';//正式服VIP
// Const.returnUrl = 'http://45.124.115.41:3320/callbackurl';//vip测试服
//扫码支付地址
Const.apiurl = {
    SCAN_CODE:"/gateway/scanPay/payService",//扫码支付 1 支付地址， 订单查询地址
    SHORTCUT_PAY:"/gateway/scanPay/payFast",//快捷支付
    BANK_CARD:"/gateway/scanPay/payEbanks",//网银支付
    H5:'/gateway/scanPay/payH5'//h5支付
};

//网银支付默认支付方式
Const.bankCard = {
    1:'B2BBANK',//（B2B企业网银）
    2:'B2CBANK',//（B2C个人网银）
    3:'B2CDEBITBANK'//（B2C个人网银借记卡）
}


//银行列表
Const.bankList = {
    1:"BOC",//中国银行
    2:"ABC",//中国农业银行
    3:"ICBC",//中国工商银行
    4:"CCB",//中国建设银行
    5:"COMM",//交通银行
    6:"PSBC",//中国邮政储蓄银行
    7:"CMB",//招商银行
    8:"CMBC",//中国民生银行
    9:"CITIC",//中信银行
    10:"CEB",//中国光大银行
    11:"HXB",//华夏银行
    12:"GDB",//广发银行
    13:"CIB",//兴业银行
    14:"SPDB",//上海浦东发展银行
    15:"SPAB",//平安银行
    16:"SHB",//上海银行
    17:"BJB"//北京银行
}

//支付类型
Const.payType = {
    1:'SCAN_ALIPAY',//支付宝扫码
    2:'SCAN_WEIXIN',//微信扫码
    3:'SCAN_QQ',//QQ钱包

    4:'SCAN_FAST',//快捷支付

    5:'SCAN_EBANKS',//网银直连

    6:'SCAN_WEIXIN_H5'//H5
}

//设备类型
Const.osType = {
    PC:0,//0(pc端)
    phone:1//1(移动端)
}

//H5场景类型
Const.sceneType = {
    IOS:0,
    Android:1,
    Wap:2
}



