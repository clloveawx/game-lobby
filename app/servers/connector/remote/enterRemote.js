'use strict';

const isOnline = require('../../../http/isOnline');

module.exports = function(app) {
	return new Remote(app);
};

var Remote = function(app) {
	this.app = app;
};

Remote.prototype.isOnline = function(uid, cb) {
	isOnline.addLeave({uid: uid, cb: cb});
	this.app.get('sessionService').kick(uid, () => {
		console.log('强制掉线');
		return	cb();
	});
};