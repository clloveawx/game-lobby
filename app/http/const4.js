
/**
 * Created by 14060 on 2017/12/26.
 */
'use strict';
const Const = module.exports;
Const.url = 'http://wangguan.qianyifu.com:8881/gateway/pay.asp';
Const.ID = '51096';
Const.key = 'agu6cdEsECLF5ryzbdzRnlFFiAnc0OtBzheDAQkF';
// Const.backNotifyUrl = 'http://118.184.66.38:3320/callbackurl4';//测试服务器
// Const.backNotifyUrl = 'http://43.254.219.18:3320/callbackurl4';//正是服务器
// Const.backNotifyUrl = 'http://45.124.115.41:3320/callbackurl4';//vip测试服
Const.backNotifyUrl = 'http://103.246.246.195:3320/callbackurl4';//vip正是服务器
Const.payType={//扫码类型
    1:'zhifubao',//支付宝扫码
    2:'weixin',//微信扫码
    3:'qqsm'//QQ钱包扫码
}
Const.payTypeH5={
    1:'zhifubao-wap',//支付宝H5
    2:'weixin-wap',//微信H5
    3:'qq-wap'//QQ钱包H5
}