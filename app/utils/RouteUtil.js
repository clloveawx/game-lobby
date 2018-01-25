'use strict';
const dispatcher = require('./dispatcher');
/**
 * 无效的路由 如果有个两个以上forntend服务器的时候
 * 就容易出现绕过某个forntend
 */
exports.invalidRoute = function (session, msg, app, cb) {
	cb(new Error('route from gate is invalid'));
};

exports.chat = function(session, msg, app, cb) {
	console.log('msgmsg',session,msg)
	
	var chatServers = app.getServersByType(msg.serverType);
	
	if(!chatServers || chatServers.length === 0) {
		cb(new Error('can not find chat servers.'));
		return;
	}
	
	var res = dispatcher.dispatch(session.get('rid'), chatServers);
	
	cb(null, res.id);
};