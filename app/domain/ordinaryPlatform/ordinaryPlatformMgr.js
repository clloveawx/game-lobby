'use strict';

const ordinaryEnvPlayers = [];

exports.ordinaryEnvPlayers = ()=> ordinaryEnvPlayers;

exports.addPlayer = (player) =>{
    ordinaryEnvPlayers.push(player);
};

exports.removePlayer = (uid) =>{
    const userIndex = ordinaryEnvPlayers.findIndex(user => user.uid == uid);
    ordinaryEnvPlayers.splice(userIndex, 1);
};