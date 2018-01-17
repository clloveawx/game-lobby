'use strict';

const logic = require('../../../domain/games/pirate/logic');
module.exports = function(app) {
    return new Remote(app);
};

var Remote = function(app) {
    this.app = app;
};

//玩家强行离开海盗
Remote.prototype.leave = function (uid,isVip,cb) {
    console.log('-------------------------------');
    logic.addGoldRecord({isAdd:'leave',uid,isVip},null);
    return cb(null);
}