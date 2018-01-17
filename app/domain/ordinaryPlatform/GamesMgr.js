'use strict';

const db = require('../../utils/db/mongodb');
const logger = require('pomelo-logger').getLogger('log', __filename);
const util = require('../../utils');
const Rooms = require('./Rooms');//有赢游戏房间
const Games = []; // 当前系统所有游戏

const gameWeight = {'11':20,'8':19,'1':18,'4':17,'3':16,'10':15,'7':14,'16':13,'12':12,'2':11,'9':10,'13':9,'14':8};
exports.Games = () => {
    return Games.sort((g1, g2) => gameWeight[g2.nid] - gameWeight[g1.nid]);
};

// 添加一个游戏到内存
exports.addGame = function (game) {
	Games.push(game);
};

// 在指定的游戏中新增房间
exports.addRoom = function (nid){
    const game =  Games.find(game => game.nid == nid);
    // 房间实例
    const room =  new Rooms({nid:nid,id: util.id(), roomCode: util.pad(game.rooms.length + 1, 3)});
    game.addRoom(room);
};

// 获取内存中的指定游戏
exports.getGame = nid => Games.find(game => game.nid == nid);

// 定时更新数据库
exports.updateDB = function () {
    const dao = db.getDao('system_games');
    const games = util.clone(Games);
    games.forEach(game =>{
        game.rooms.forEach(room =>{
            room.users = [];
        });
        dao.update({nid: game.nid}, {$set: {
            "heatDegree": game.heatDegree,
			"rooms": game.rooms,
        }}, {upsert: true}, function(err, res) {
            if(err){
                winston.db_error('system_games', '同步更新', err)
            }
        });
    });
};