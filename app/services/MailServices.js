
const nodemailer = require('nodemailer');
const nodeSmtpTransport = require('nodemailer-smtp-transport');

/**
 * 邮件服务
 */
// 支持的服务列表
// '1und1',
// 'AOL',
// 'DebugMail.io',
// 'DynectEmail',
// 'FastMail',
// 'GandiMail',
// 'Gmail',
// 'Godaddy',
// 'GodaddyAsia',
// 'GodaddyEurope',
// 'hot.ee',
// 'Hotmail',
// 'iCloud',
// 'mail.ee',
// 'Mail.ru',
// 'Mailgun',
// 'Mailjet',
// 'Mandrill',
// 'Naver',
// 'OpenMailBox',
// 'Postmark',
// 'QQ',
// 'QQex',
// 'SendCloud',
// 'SendGrid',
// 'SES',
// 'SES-US-EAST-1',
// 'SES-US-WEST-1',
// 'SES-EU-WEST-1',
// 'Sparkpost',
// 'Yahoo',
// 'Yandex',
// 'Zoho'

const smtpTransport = nodemailer.createTransport(nodeSmtpTransport({
	service: 'QQ',// 服务
	auth: {
		user: '121535512@qq.com',// 发送者邮箱
		pass: 'sawtezdueaavbiie'// 发送者邮箱密码
	}
}));

/**
 * @param {String} recipient 收件人
 * @param {String} subject 发送的主题
 * @param {String} html 发送的html内容
 */
exports.sendMail = function (recipient, subject, html) {
	smtpTransport.sendMail({
		from: '121535512@qq.com',
		to: recipient,
		subject: subject,
		html: html
	}, function (error, response) {
		if (error) {
			return console.error(error);
		}
		console.log('发送邮件成功!');
	});
};

// this.sendMail('1125105123@qq.com', '店铺sid过期', '<h2>店铺sid已过期，请前往牛牛后台管理重新设置 <a href="http://120.77.48.203:5003/nnmanager">点击这里</a></h2>');