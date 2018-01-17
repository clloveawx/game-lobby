'use strict';

/**
 * 邮件
 */
function Mail(opts, uid) {
    return {
        id : opts.id,
        img : opts.img,
        receiverId : uid,
        sender : '系统',
        name : opts.name,
        reason : opts.reason,
        content : opts.content,
        attachment : opts.attachment,
        time : Date.now(),
        isRead : false,
        isdelete : false,
    };
}

module.exports = Mail;