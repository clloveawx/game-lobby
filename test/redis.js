const ioredis = require("ioredis");
const bluebird = require('bluebird');
const Redis = module.exports;
let RedisClient;


RedisClient = new ioredis(6379, '127.0.0.1');
RedisClient.on("error", function(error) {
	console.log("服务器启动 Redis 服务出错，",error.message);
});
RedisClient.on('connect', function () {
	console.log("服务器启动 Redis 服务成功");
});

const rr =() =>{
	return RedisClient.sadd('p::::', '123');
}
console.log(rr());

// const obj = {
// 	'viper1:games': {
// 		'1': {
// 			name: '777',
// 			heart: 50,
// 		},
// 		'2': {
// 			name: '777+',
// 			heart: 50,
// 		}
// 	},
// 	'viper2:games': {
// 		'1': {
// 			name: '888',
// 			heart: 500,
// 		},
// 		'2': {
// 			name: '888+',
// 			heart: 500,
// 		}
// 	},
// }
//
// RedisClient.hmset('viper1:games', JSON.stringify(obj['viper1:games'])).then(result =>{
// 	console.log('==========',result);
// 	RedisClient.hget('viper1:games', '1').then(result =>{
// 		console.log(JSON.parse(result))
//
// 	})
// }).catch(err =>{
// 	console.error(err)
// });