'use strict';

const logger = require('pomelo-logger').getLogger('log', __filename);
const util = require('../../../utils');
const Mail = require('./mail');

const mails = {}; // 当前所有生成的邮件

// 添加一封邮件到内存
exports.addMail = function (opts, receiverUids) {
    opts.id = util.id();
    if(!receiverUids || receiverUids.length == 0){
        return;
    }
    receiverUids.forEach(uid =>{
        if(mails[uid] == null){
            mails[uid] = {};
        }
        mails[uid][opts.id] = util.clone(Mail(opts));
    });
};

//获取某人的所有邮件
exports.getMail = (uid) => mails[uid];
