'use strict';

const ioredis = require("ioredis");
const Redis = module.exports;
let RedisClient;

Redis.init = function (config) {
  RedisClient = new ioredis(config.port, config.host);
  RedisClient.on("error", function(error) {
    console.log("服务器启动 Redis 服务出错，",error.message);
  });
  RedisClient.on('connect', function () {
    console.log("服务器启动 Redis 服务成功");
  });
};

Redis.client = function(){
  return RedisClient;
};

