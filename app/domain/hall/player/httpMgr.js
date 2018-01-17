'use strict';

const logger = require('pomelo-logger').getLogger('log', __filename);
const util = require('../../../utils');

const httpCodes = [];  // 当前所有在线玩家
exports.httpCodes = () => httpCodes;
// 添加一个玩家到内存
exports.addHttpCodes = function (httpCode) {
	httpCodes.push(httpCode);

};

// 获取内存中的玩家
exports.atHttpCodes = function (httpCode) {
	return httpCodes.indexOf(httpCode);
};



// 删除内存中的玩家
exports.removeHttpCodes = function (httpCode) {
	var index = httpCodes.indexOf(httpCode);
	if (index > -1) {
        httpCodes.splice(index, 1);
	}
};
