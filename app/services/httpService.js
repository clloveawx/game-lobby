'use strict';
const Mails  = require('../domain/hall/mail/mail');
// const playerMgr  = require('../domain/hall/player/playerMgr');
const httpMgr = require('../domain/hall/player/httpMgr');
const db = require('../utils/db/mongodb');
const util = require('../utils');
const msgService = require('./MessageService');
const pomelo = require('pomelo');

/**
 * 将产生的http验证码加入到httpCode里面
 */

exports.getHttpCode = function(data,cb){
	const httpCode = util.id()+data;
	httpMgr.addHttpCodes(httpCode);
	return cb(httpCode);
};


exports.atHttpCodes = function(httpCode){
	let is = httpMgr.atHttpCodes(httpCode);
	return is;
};
