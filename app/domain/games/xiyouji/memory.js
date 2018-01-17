'use strict';

module.exports = {
    
    'record': {
        //uid: {bet, totalWin, totalBet, record:[]}
    },
    'vipRecord': {
        //uid: {bet, totalWin, totalBet, record:[]}
    },
    'system':{
        countQ: {
            // roomCode: {uid: 0}
        },
        scatter: {
            // roomCode: {bet: {uid: []}}
        },
        littleGame: {
            // roomCode: {uid: 0}
        },
    },
    'vip': {
        /*
            countQ: {
                // roomCode: {uid: 0}
            },
            scatter: {
                // roomCode: {bet: {uid: []}}
            },
            littleGame: {
                // roomCode: {uid: 0}
            },
        */
    },
    moneyChange: {
        totalWin: 0,
        totalBet: 0,
    },
};