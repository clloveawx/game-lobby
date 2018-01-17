'use strict';

const config = require('./config');
const logic = require('./logic');
const memory = require('./memory');
const notify = require('./notify');
const runRound = require('./runRound');
const Robot = require('./robot/Robot');

module.exports = {
    config,
    logic,
    memory,
    runRound,
    notify,
    Robot,
};