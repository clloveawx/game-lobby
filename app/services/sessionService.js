'use strict';

/**
 * session 处理
 */
exports.sessionSet = (session, settings, cb) => {
	for (const k in settings) {
		session.set(k, settings[k])
	}
	session.pushAll(cb || function () {});
};