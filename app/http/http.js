const express = require('express');
const app = express.Router();
const pomelo = require('pomelo');
const db = require('../utils/db/mongodb');
const httpService = require('../services/httpService');
const messageService = require('../services/MessageService');
const MailService = require('../services/MailService');
const RongcloudSmsService = require('../services/RongcloudSmsService');
const utils = require('../utils');
const JsonMgr = require('../../config/data/JsonMgr');
const pay = require('./pay');
// const pay2 = require('./pay2');
// const pay3 = require('./pay3');
const pay4 = require('./pay4');
const shopUrl = require('../../config/data/shopUrl.json');

//跨域
app.all('*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept");
	res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
	res.header("X-Powered-By", ' 3.2.1');
	res.header("Content-Type", "application/json;charset=utf-8");
	next();
});
const method = function (res, req, callback) {
	var post = '';
	req.on('data', function (chunk) {
		post += chunk;
		console.log('post', post);
	});
	req.on('end', function () {
		callback(res, post);
	});
}

/*
*  查询该帐号是否在线
*/
app.post("/isOnlin", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		pomelo.app.rpc.hall.httpRemote.isOnlin(null, data, () => {
			res.send({ code: 200 });
		});
	});
});

/*
*  获取httpCode的验证信息
*/
app.post("/getHttpCode", function (req, res) {
	method(res, req, (res, data) => {
		httpService.getHttpCode(data, (data) => {
			res.send({ code: 200, data: data });
		});
	});
});

/*
*  获取所有玩家的信息
*/
app.get("/getPlayers", function (req, res) {
	const dao = db.getDao('player_info');
	const userInfo = db.getDao('user_info');
	const inviteCodeInfo = db.getDao('invite_code_info');
	method(res, req, (res, data) => {
		dao.find({}, {
			'uid': 1,
			'nickname': 1,
			'gold': 1,
			'sex':1,
			'props':1,
			'integral': 1,
			'vipEffectiveTime': 1,
			'vdot': 1,
			'inviteCode': 1,
            'viperId':1,
            'vip':1,
            'isRobot':1,
			'loginTime': 1,
			'createTime': 1,
			'lastLogoutTime': 1,
            'loginCount':1,
		}, function (err, data) {
				pomelo.app.rpc.hall.httpRemote.allPlayersInMemory(null, (players) =>{
			  		userInfo.find({cellPhone:{$exists: true}},function(err,userInfos){
	                	let gameVersion = JsonMgr.get('gameBeat').getById(1).gameVersion;
	                 	if(gameVersion == 2){
	                 		const list = data.map(m=>{
	                 			console.log('m..........',m);
	                 			const temp = data.find(x=>x.uid === m.viperId );
	                 			const temp1 = userInfos.find(x=>x.uid === m.uid);
	                 			const player = players[m.uid];
	                 			return{
	                 				uid:m.uid,
	                 				nickname:m.nickname,
	                 				gold : m.gold,
	                 				sex :m.sex,
	                 				props:m.props,
	                 				integral:m.integral,
	                 				vipEffectiveTime:m.vipEffectiveTime,
	                 				vdot :m.vdot,
	                 				inviteCode :temp? (m.inviteCode +'('+temp.nickname+'-'+temp.uid+')'):'没有房主',
	                 				viperId :m.viperId,
	                 				isRobot :m.isRobot,
	                 				loginTime :player? player.loginTime:m.loginTime,
	                 				createTime : m.createTime,
	                 				lastLogoutTime :m.lastLogoutTime,
	                 				loginCount : m.loginCount,
	                 				cellPhone: temp1? temp1.cellPhone:'没有绑定手机',
	                 				isOnlin: player ? 1 :0,
	                 			}
	                 		});
	                 		res.send({code: 200, data:list});
	                 	}else{
	                 		inviteCodeInfo.find({},function(err,invites){
	                 				const list = data.map(m=>{
	                 					// console.log('m...............',m.inviteCode);
	                 					let inviteCodess;
	                 					if(m.inviteCode){
		                 					const temp = invites.find(x=>x.inviteCode === m.inviteCode);//查找拥有该邀请码的玩家
		                 					// console.log('temp......',temp);
		                 					const temp2 = data.find(x=>x.uid === temp.viper);
		                 					// console.log('temp2......',temp2);
		                 					 inviteCodess =  m.inviteCode +'('+ temp2.nickname +'-'+temp2.uid+')';
	                 					}
	                 					const temp1 = userInfos.find(x=>x.uid === m.uid);
	                 					const player = players[m.uid];
	                 					return {
             								uid:m.uid,
			                 				nickname:m.nickname,
			                 				gold : m.gold,
			                 				sex :m.sex,
			                 				props:m.props,
			                 				inviteCode: (m.inviteCode ? inviteCodess : '没有绑定邀请码'),
			                 				viperId :m.viperId,
			                 				isRobot :m.isRobot,
			                 				loginTime :m.loginTime,
			                 				createTime : m.createTime,
			                 				lastLogoutTime :m.lastLogoutTime,
			                 				loginCount : m.loginCount,
			                 				cellPhone: temp1? temp1.cellPhone:'没有绑定手机',
			                 				isOnlin: player ? 1:0,
	                 					}
	                 				});
	                 			res.send({code: 200, data:list});
	                 		});	
	                 	}
					});
				});
		});
	});
});

/*
*  改变玩家的状态为测试人员
*/
app.post("/changePlayerIsRobot", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const playerInfo = db.getDao('player_info');
		playerInfo.update({uid:data.uid},{$set:{isRobot:data.isRobot}},function(err,result){
			if(!err){
				res.send({code:200,msg:'修改成功'});
			}else{
				res.send({code:500,error:'修改失败'});
			}
		});

	});
});


/*
*  获取所有在线玩家的信息
*/
app.get("/info", function (req, res) {
	pomelo.app.rpc.hall.httpRemote.getPlayers(null, {}, (data) => {
		res.send({ code: 200, data: data });
	});
});

/*
*  获取所有今日创建玩家的信息
*/
app.post("/DayPlayer", function (req, res) {
	method(res, req, (res, data) => {
	data = JSON.parse(data);
	const playerInfo = db.getDao('player_info');
	const playerLoginRecord = db.getDao('player_login_record');
	const payInfo = db.getDao('pay_info');
	const time = utils.zerotime();
	const endTime = time + 24 * 60 * 60 * 1000;
	// const condition = { createTime: { $gt: time, $lt: endTime } }
	// pomelo.app.rpc.hall.httpRemote.getPlayersInfo(null, condition, (data) => {
	// 	res.send({ code: 200, data: data });
	// });
		playerInfo.find({createTime: { $gt: time, $lt: endTime }},{'uid':1,'createTime':1},function(err,data){
			playerLoginRecord.find({loginTime: { $gt: time, $lt: endTime }},function(err,loginPlayers){
				payInfo.find({attach:'gold',time:{ $gt: time, $lt: endTime }},{'id':1,'uid':1,'total_fee':1,'time':1},function(err,pays){
					if(err){
						console.error('获取数据库数据失败');
						res.send({ code: 500, msg: '数据查询失败'});
					}else{
						// return cb(data);
		                let arr = [];
		                let todayNum = data.length;
		                let loginNum = loginPlayers.length;
		                let payDayNum = 0;
		                let payDayMoney = 0;
						for( i=1; i<=24; i++){
							const temp = data.filter(x =>(time+(i-1)*60*60*1000) < x.createTime && x.createTime <= (time+i*60*60*1000));
							const temp1 = loginPlayers.filter(x =>(time+(i-1)*60*60*1000) < x.loginTime && x.loginTime <= (time+i*60*60*1000));
							const temp3 = pays.filter(x =>(time+(i-1)*60*60*1000) < x.time && x.time <= (time+i*60*60*1000));
							let money = 0;
							temp3.forEach(m=>{
								if(!(m.id.length==14 && m.id.slice(13)=="s")){
								 	money += m.total_fee;
								 	payDayNum += 1;
								}
							});
							// console.log('money...',money);
							let hourData ={starTime:time+(i-1)*60*60*1000,endTime:time+i*60*60*1000,createNum:temp.length,
								loginNum:temp1.length,payNum:temp3.length,payMoney:money};
							arr.push(hourData);
							payDayMoney += money;
						}
						let result = {arr:arr,todayNum:todayNum,loginNum:loginNum,payNum:payDayNum,payMoney:payDayMoney};
						// console.log(result);
						res.send({ code: 200, result: result});
					}
				});
			});
		});
	});

});


/*
*  获取所有今日该渠道下面玩家的信息
*/
app.post("/qudaoDayPlayer", function (req, res) {
	method(res, req, (res, data) => {
	data = JSON.parse(data);
	const playerInfo = db.getDao('player_info');
	const playerLoginRecord = db.getDao('player_login_record');
	const payInfo = db.getDao('pay_info');
	const inviteCodeInfo = db.getDao('invite_code_info');
	const time = utils.zerotime();
	const endTime = time + 24 * 60 * 60 * 1000;
	// const condition = { createTime: { $gt: time, $lt: endTime } }
	// pomelo.app.rpc.hall.httpRemote.getPlayersInfo(null, condition, (data) => {
	// 	res.send({ code: 200, data: data });
	// });
		inviteCodeInfo.find({viper:data.uid},function(err,invites){
			let arrPlayes = [];
			invites.forEach(m=>{   
					arrPlayes = arrPlayes.concat(m.inviteRecords); //获取所有该渠道下面的玩家
			});
			playerInfo.find({uid:{$in:arrPlayes},createTime: { $gt: time, $lt: endTime }},{'uid':1,'createTime':1},function(err,data){
				playerLoginRecord.find({uid:{$in:arrPlayes},loginTime: { $gt: time, $lt: endTime }},function(err,loginPlayers){
					payInfo.find({uid:{$in:arrPlayes},attach:'gold',time:{ $gt: time, $lt: endTime }},{'id':1,'uid':1,'total_fee':1,'time':1},function(err,pays){
						if(err){
							console.error('获取数据库数据失败');
							res.send({ code: 500, msg: '数据查询失败'});
						}else{
							// return cb(data);
			                let arr = [];
			                let todayNum = data.length;
			                let loginNum = loginPlayers.length;
			                let payDayNum = 0;
			                let payDayMoney = 0;
							for( i=1; i<=24; i++){
								const temp = data.filter(x =>(time+(i-1)*60*60*1000) < x.createTime && x.createTime <= (time+i*60*60*1000));
								const temp1 = loginPlayers.filter(x =>(time+(i-1)*60*60*1000) < x.loginTime && x.loginTime <= (time+i*60*60*1000));
								const temp3 = pays.filter(x =>(time+(i-1)*60*60*1000) < x.time && x.time <= (time+i*60*60*1000));
								let money = 0;
								temp3.forEach(m=>{
									if(!(m.id.length==14 && m.id.slice(13)=="s")){
									 	money += m.total_fee;
									 	payDayNum += 1;
									}
								});
								// console.log('money...',money);
								let hourData ={starTime:time+(i-1)*60*60*1000,endTime:time+i*60*60*1000,createNum:temp.length,
									loginNum:temp1.length,payNum:temp3.length,payMoney:money};
								arr.push(hourData);
								payDayMoney += money;
							}
							let result = {arr:arr,todayNum:todayNum,loginNum:loginNum,payNum:payDayNum,payMoney:payDayMoney};
							// console.log(result);
							res.send({ code: 200, result: result});
						}
					});
				});
			});
		})
	});
});


/*
*  获取所有该月该渠道下面玩家的信息
*/
app.post("/qudaoMonthPlayer", function (req, res) {
	method(res, req, (res, data) => {
	data = JSON.parse(data);
	const playerInfo = db.getDao('player_info');
	const playerLoginRecord = db.getDao('player_login_record');
	const payInfo = db.getDao('pay_info');
	const inviteCodeInfo = db.getDao('invite_code_info');
	const timeStar = new Date(utils.getMonth()).getTime();
	const timeEnd = new Date(utils.getNextMonth()).getTime();
	const num = parseInt((timeEnd - timeStar)/(24*60*60*1000));

		inviteCodeInfo.find({viper:data.uid},function(err,invites){
				let arrPlayes = [];
				invites.forEach(m=>{   
						arrPlayes = arrPlayes.concat(m.inviteRecords); //获取所有该渠道下面的玩家
				});
			playerInfo.find({uid:{$in:arrPlayes},createTime: { $gt: timeStar, $lt: timeEnd }},{'uid':1,'createTime':1},function(err,data){
				playerLoginRecord.find({uid:{$in:arrPlayes},loginTime: { $gt: timeStar, $lt: timeEnd }},function(err,loginPlayers){
					payInfo.find({uid:{$in:arrPlayes},attach:'gold',time:{ $gt: timeStar, $lt: timeEnd }},{'id':1,'uid':1,'total_fee':1,'time':1},function(err,pays){
						if(err){
							console.error('获取数据库数据失败');
							res.send({ code: 500, msg: '数据查询失败'});
						}else{
							// return cb(data);
							let arr = [];
							let todayNum = data.length;
							let loginNum = loginPlayers.length;
							let payMonthNum = 0;
							let payMonthMoney = 0;
							pays.forEach(m=>{
									if(!(m.id.length==14 && m.id.slice(13)=="s")){
									 	payMonthMoney += m.total_fee;
									 	payMonthNum += 1;
									}
							});
							for( i=1; i<=num; i++){
								const temp = data.filter(x =>(timeStar+(i-1)*24*60*60*1000) < x.createTime && x.createTime < (timeStar+i*24*60*60*1000));
								const temp1 = loginPlayers.filter(x =>(timeStar+(i-1)*24*60*60*1000) < x.loginTime && x.loginTime < (timeStar+i*24*60*60*1000));
								let hourData ={starTime:timeStar+(i-1)*24*60*60*1000,endTime:timeStar+i*24*60*60*1000,createNum:temp.length,loginNum:temp1.length};
								arr.push(hourData);
							}
							let result = {arr:arr,todayNum:todayNum,loginNum:loginNum,payNum:payMonthNum,payMoney:payMonthMoney};
							res.send({ code: 200, result: result});
						}
					});
				});
			});
	    });
	});
});



/*
*  获取所有该月活动玩家的信息
*/
app.post("/MonthPlayer", function (req, res) {
	method(res, req, (res, data) => {
	const playerInfo = db.getDao('player_info');
	const playerLoginRecord = db.getDao('player_login_record');
	const payInfo = db.getDao('pay_info');
	const timeStar = new Date(utils.getMonth()).getTime();
	const timeEnd = new Date(utils.getNextMonth()).getTime();
	const num = parseInt((timeEnd - timeStar)/(24*60*60*1000));
		playerInfo.find({createTime: { $gt: timeStar, $lt: timeEnd }},{'uid':1,'createTime':1},function(err,data){
			playerLoginRecord.find({loginTime: { $gt: timeStar, $lt: timeEnd }},function(err,loginPlayers){
				payInfo.find({attach:'gold',time:{ $gt: timeStar, $lt: timeEnd }},{'id':1,'uid':1,'total_fee':1,'time':1},function(err,pays){
					if(err){
						console.error('获取数据库数据失败');
						res.send({ code: 500, msg: '数据查询失败'});
					}else{
						// return cb(data);
						let arr = [];
						let todayNum = data.length;
						let loginNum = loginPlayers.length;
						let payMonthNum = 0;
						let payMonthMoney = 0;
						pays.forEach(m=>{
								if(!(m.id.length==14 && m.id.slice(13)=="s")){
								 	payMonthMoney += m.total_fee;
								 	payMonthNum += 1;
								}
						});
						for( i=1; i<=num; i++){
							const temp = data.filter(x =>(timeStar+(i-1)*24*60*60*1000) < x.createTime && x.createTime < (timeStar+i*24*60*60*1000));
							const temp1 = loginPlayers.filter(x =>(timeStar+(i-1)*24*60*60*1000) < x.loginTime && x.loginTime < (timeStar+i*24*60*60*1000));
							let hourData ={starTime:timeStar+(i-1)*24*60*60*1000,endTime:timeStar+i*24*60*60*1000,createNum:temp.length,loginNum:temp1.length};
							arr.push(hourData);
						}
						let result = {arr:arr,todayNum:todayNum,loginNum:loginNum,payNum:payMonthNum,payMoney:payMonthMoney};
						res.send({ code: 200, result: result});
					}
				});
			});
		});
	});
});


/*
*  获取所有该年该渠道下面玩家的信息
*/
app.post("/qudaoYearPlayer", function (req, res) {
	method(res, req, (res, data) => {
	data = JSON.parse(data);
	const playerInfo = db.getDao('player_info');
	const playerLoginRecord = db.getDao('player_login_record');
	const payInfo = db.getDao('pay_info');
	const inviteCodeInfo = db.getDao('invite_code_info');
	const timeStar = new Date('2017-01-01').getTime();
	const timeEnd = Date.now();
	const now = new Date();
	const nowYear =  now.getFullYear();
	const nowMonth =  now.getMonth() + 1;
	const num = (nowYear -2017) * 12 + nowMonth;
		inviteCodeInfo.find({viper:data.uid},function(err,invites){
			let arrPlayes = [];
			invites.forEach(m=>{   
					arrPlayes = arrPlayes.concat(m.inviteRecords); //获取所有该渠道下面的玩家
			});
			playerLoginRecord.find({uid:{$in:arrPlayes},loginTime: { $gt: timeStar, $lt: timeEnd }},function(err,loginPlayers){
				playerInfo.find({uid:{$in:arrPlayes},createTime: { $gt: timeStar, $lt: timeEnd }},{'uid':1,'createTime':1},function(err,players){
					payInfo.find({uid:{$in:arrPlayes},attach:'gold',time:{ $gt: timeStar, $lt: timeEnd }},{'id':1,'uid':1,'total_fee':1,'time':1},function(err,pays){
						if(err){
							console.error('获取数据库数据失败');
							res.send({ code: 500, msg: '数据查询失败'});
						}else{
							// return cb(data);
							let arr = [];
							let todayNum = players.length;
							let loginNum = loginPlayers.length;
							let lastTime = 0;
							let starTime = timeStar;
							let payYearNum = 0;
							let payYearMoney = 0;
							pays.forEach(m=>{
									if(!(m.id.length==14 && m.id.slice(13)=="s")){
									 	payYearMoney += m.total_fee;
									 	payYearNum += 1;
									}
							});
							for( i=1; i<=num; i++){
								lastTime = utils.nextMonthZeroTime(starTime);
								const temp = players.filter(x =>timeStar < x.createTime && x.createTime < lastTime);
								const temp1 = loginPlayers.filter(x =>starTime < x.loginTime && x.loginTime < lastTime);
								let hourData ={starTime:starTime,endTime:lastTime,createNum:temp.length,loginNum:temp1.length};
								arr.push(hourData);
								starTime = lastTime;
							}
							let result = {arr:arr,todayNum:todayNum,loginNum:loginNum,payNum:payYearNum,payMoney:payYearMoney};
							res.send({ code: 200, result: result});
						}
					});
				});
			});

		 });	


	});
});


/*
*  获取所有玩家的信息
*/
app.post("/AllPlayer", function (req, res) {
	method(res, req, (res, data) => {
	const playerInfo = db.getDao('player_info');
	const playerLoginRecord = db.getDao('player_login_record');
	const payInfo = db.getDao('pay_info');
	const timeStar = new Date('2017-01-01').getTime();
	const timeEnd = Date.now();
	const now = new Date();
	const nowYear =  now.getFullYear();
	const nowMonth =  now.getMonth() + 1;
	const num = (nowYear -2017) * 12 + nowMonth;
		playerLoginRecord.find({loginTime: { $gt: timeStar, $lt: timeEnd }},function(err,loginPlayers){
			playerInfo.find({createTime: { $gt: timeStar, $lt: timeEnd }},{'uid':1,'createTime':1},function(err,players){
				payInfo.find({attach:'gold',time:{ $gt: timeStar, $lt: timeEnd }},{'id':1,'uid':1,'total_fee':1,'time':1},function(err,pays){
					if(err){
						console.error('获取数据库数据失败');
						res.send({ code: 500, msg: '数据查询失败'});
					}else{
						// return cb(data);
						let arr = [];
						let todayNum = players.length;
						let loginNum = loginPlayers.length;
						let lastTime = 0;
						let starTime = timeStar;
						let payYearNum = 0;
						let payYearMoney = 0;
						pays.forEach(m=>{
								if(!(m.id.length==14 && m.id.slice(13)=="s")){
								 	payYearMoney += m.total_fee;
								 	payYearNum += 1;
								}
						});
						for( i=1; i<=num; i++){
							lastTime = utils.nextMonthZeroTime(starTime);
							const temp = players.filter(x =>timeStar < x.createTime && x.createTime < lastTime);
							const temp1 = loginPlayers.filter(x =>starTime < x.loginTime && x.loginTime < lastTime);
							let hourData ={starTime:starTime,endTime:lastTime,createNum:temp.length,loginNum:temp1.length};
							arr.push(hourData);
							starTime = lastTime;
						}
						let result = {arr:arr,todayNum:todayNum,loginNum:loginNum,payNum:payYearNum,payMoney:payYearMoney};
						res.send({ code: 200, result: result});
					}
				});
			});
		});
	});
});


/*
*  获取玩家统计信息的数据
*/
app.post("/postTimePlayer", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const playerInfo = db.getDao('player_info');
		const playerLoginRecord = db.getDao('player_login_record');
		const payInfo = db.getDao('pay_info');
		const starTime = data.starTime;
		const endTime = data.endTime;
		const num =  parseInt((endTime - starTime)/(60*60*1000));
		playerInfo.find({createTime: { $gt: starTime, $lt: endTime }},function(err,data){
			playerLoginRecord.find({loginTime: { $gt: starTime, $lt: endTime }},function(err,loginPlayers){
				payInfo.find({time: { $gt: starTime, $lt: endTime }},function(err,pays){
					if(err){
						console.error('获取数据库数据失败');
						res.send({ code: 500, msg: '数据查询失败'});
					}else{
						// return cb(data);
						let arr = [];
						let todayNum = data.length;
						let loginNum = loginPlayers.length;
						for( i=1; i<=num; i++){
							const temp = data.filter(x =>(starTime+(i-1)*60*60*1000) < x.createTime && x.createTime < (starTime+i*60*60*1000));
							const temp1 = loginPlayers.filter(x =>(starTime+(i-1)*60*60*1000) < x.loginTime && x.loginTime < (starTime+i*60*60*1000));
							const temp2 = pays.filter(x =>(starTime+(i-1)*60*60*1000) < x.time && x.time < (starTime+i*60*60*1000));
							let  payNum = 0 ;
							temp2.forEach( m =>{
								payNum +=m.total_fee;
							});
							let hourData ={starTime:starTime+(i-1)*60*60*1000,endTime:starTime+i*60*60*1000,createNum:temp.length,loginNum:temp1.length,payNum:payNum};
							arr.push(hourData);
						}
						let result = {arr:arr,todayNum:todayNum,loginNum:loginNum};
						res.send({ code: 200, result: result});
					}
				});
			});
		});

	});
});


/*
*  获取所有VIP玩家的信息
*/
app.get("/VipPlayer", function (req, res) {
	const condition = { 'vip': true }
	pomelo.app.rpc.hall.httpRemote.getVipPlayers(null, condition, (data) => {
		res.send({ code: 200, data: data });
	});
});

/*
*  获取VIP玩家拥有游戏的信息
*/
app.post("/VipGames", function (req, res) {
	method(res, req, (res, data) => {
		const condition = { 'creator.uid': data.id }
		pomelo.app.rpc.hall.httpRemote.getVipGames(null, condition, (data) => {
			res.send({ code: 200, games: data });
		});
	});

});

// /*
// *  获取玩家金币的消费信息
// */
// app.get("/gold", function (req, res) {
// 	const condition = { 'coinType': 'gold' }
// 	pomelo.app.rpc.hall.httpRemote.getRecordCoinData(null, condition, (data) => {
// 		res.send({ code: 200, data: data });
// 	});
// });



// *  获取玩家钻石的消费信息

// app.get("/diamond", function (req, res) {
// 	const condition = { 'coinType': 'diamond' }
// 	pomelo.app.rpc.hall.httpRemote.getRecordCoinData(null, condition, (data) => {
// 		res.send({ code: 200, data: data });
// 	});
// });

/*
*  获取客服消息
*/
app.post("/getCustomer", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		pomelo.app.rpc.hall.httpRemote.getCustomer(null, { type: data.type, search: data.search }, (data) => {
			res.send({ code: 200, data: data });
		});
	});
});

/*
*  处理客服消息
*/
app.post("/setCustomer", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		pomelo.app.rpc.hall.httpRemote.setCustomer(null, data, (err, doc) => {
			if (err) {
				res.send({ code: 500 });
			}
            //检查是否属于某VIP，如果是，直接返回
            if(doc.belongToVip){
                res.send({code:501,vipNickname:doc.vipNickname});
                return;
            }
			//对于代理申请,做审核状态的改变
			if (doc.info.type == 2 && data.pass == true) {

					//先在内存中找该玩家
					pomelo.app.rpc.hall.playerRemote.getUserInfo(null, doc.info.uid, (err, userInfo) => {
						if (userInfo) {   //在内存中找到
						pomelo.app.rpc.hall.playerRemote.updateUser(null, doc.info.uid, {vip: true, vdot: 1, needPlatform: true, vipStartTime: Date.now(), viperId: doc.info.uid}, function(err,player){
								res.send({ code: 200 });
								// console.log('player.......',player.uids());
								// msgService.pushMessageByUids('openVip', { //充值成功过后，对玩家的金币进行增加
								//                     vip:true,//充值的金币
								//                }, player.uids());
							});
						} else {
							//在内存中没找到 去数据库找
						pomelo.app.rpc.hall.playerRemote.updateDBUser(null, doc.info.uid, {vip: true, vdot: 1, needPlatform: true, vipStartTime: Date.now(), viperId: doc.info.uid}, function(err){
								if (err) {
									res.send({ code: 500 });
								}
								res.send({ code: 200 });
							});
						}
					})

			} else {
				res.send({ code: 200 });
			}
		});
	});
});

/*
*  获取玩家游戏情况
*/
app.post("/getGames", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		pomelo.app.rpc.hall.httpRemote.getGames(null, data, (data) => {
			res.send({ code: 200, data: data });
		});
	});
});

/*
*  获取玩家游戏情况
*/
app.post("/getGameRoom", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		pomelo.app.rpc.hall.httpRemote.getGameRoom(null, data, (data) => {
			// console.log('游戏情况............',data);
			res.send({ code: 200, data: data });
		});
	});
});

/*
*  获取玩家所有游戏情况
*/
app.get("/getAllGames", function (req, res) {
	pomelo.app.rpc.hall.httpRemote.getAllGames(null, {}, (data) => {
		// console.log('游戏情况............',data);
		res.send({ code: 200, data: data });
	});
});

/*
*  获取玩家还没有兑换成功的记录
*/
app.get("/getFalseCard", function (req, res) {
	pomelo.app.rpc.hall.httpRemote.getFalseCard(null, {}, (data) => {
		res.send({ code: 200, data: data });
	});
});

/*
*  改变玩家有兑换记录
*/
app.post("/getChangeStatus", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		pomelo.app.rpc.hall.httpRemote.getChangeStatus(null, data, (data) => {
			res.send({ code: 200 });
		});
	});
});

/*
*  发送公告
*/
app.post("/postNotice", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const condition = { route: 'system', content: data.content }
		pomelo.app.rpc.hall.httpRemote.postNotice(null, condition, (data) => {
			res.send({ code: 200 });
		});
	});
});

/*
*  获取邮件  / getMails
*/
app.post("/getMails", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		pomelo.app.rpc.hall.httpRemote.getMails(null, { page: data.page }, (err, { docs, len }) => {
			if (err) {
				res.send({ code: 500, error: '获取邮件失败' + err });
			}
			res.send({ code: 200, data: docs, count: len })
		});
	});
});

/**
 *  获取所有玩家uid,nickname /getUids
*/
app.get("/getUids", function (req, res) {
	const playerModel = db.getDao('player_info');
	const userInfo = db.getDao('user_info');
	playerModel.find({}, { uid: 1, nickname: 1 }, function (err, players) {
		userInfo.find({},{'uid':1,'cellPhone':1},function(err,users){
			let list = players.map(m=>{
				const temp = users.find(x=>x.uid === m.uid);
				return {
					uid:m.uid,
					nickname:m.nickname,
					cellPhone:temp?temp.cellPhone:0,
				}
			});
			res.send({ code: 200, data: list});
		});
	});
});

/**
 * 发送邮件
 * /postMails
 * uids: [uid]
 * mail:{
 	img : opts.img,
	receiverId : uid,
	sender : opts.sender || '系统',
	name : opts.name,
	reason : opts.reason,
	content : opts.content,
	attachment : opts.attachment,
 * }
 */
app.post("/postMails", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		require('../services/MailService').generatorMail(data.mail, data.uids, function (err, mails) {
			if (err) {
				res.send({ code: 500, error: '发送邮件失败' + err });
			}
			res.send({ code: 200});
		});
	});
});


// 微信充值回传
app.post('/shopPayCallback', function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		pomelo.app.rpc.hall.payRemote.shopWeixinPayCallback(null, data, function (msg) {
			res.send(msg);
		});
	});
});

//vip下面的玩家信息
app.post('/vipOfPlayers', function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const playerInfo = db.getDao('player_info');
		playerInfo.find({viperId:data.viperId},function(err,players){
			if(players){
				
					const list = players.map(m => {
							return {
								id: m.uid,
								nickname: m.nickname,
								gold: m.gold,
								integral: m.integral,
								loginTime: m.loginTime,
								createTime:m.createTime,
								inviteCode:m.inviteCode,
								lastLogoutTime:m.lastLogoutTime,
							}
						});
					res.send({code:200, result:list});
			}else if(err){
				res.send({code:500, msg:'查询失败！'});
			}else{
				res.send({code:500, msg:'没有相关数据！'});
			}
		});
	});
});




// vip玩家登录后台管理
app.post('/vipLogin', function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const userInfo = db.getDao('user_info');
		const playerInfo = db.getDao('player_info');
		// console.log(data.cellPhone, data.passWord);
		userInfo.findOne({ cellPhone: data.cellPhone }, function (err, user) {
			if (user) {
				if (user.passWord == data.passWord) {
					playerInfo.findOne({ uid: user.uid }, function (err, player) {
						if (player.vip === true) {
							res.send({ code: 200, name: player.nickname, uid: player.uid });
						} else {
							res.send({ code: 500, msg: '该玩家不是vip不能登入后台管理' });
						}
					});
				} else {
					res.send({ code: 500, msg: '密码不正确！' });
				}
			} else {
				res.send({ code: 500, msg: '帐号不存在！' });
			}
		});
	});
});

//查询该vip玩家下面拥有的玩家
app.post('/vipPlayerIntegral', function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const viperId = data.viperId;
		const starTime = data.starTime;
		const endTime = data.endTime;
		// const viperId = '208816';
		// const starTime = 1500038540183;
		// const endTime = 1520038540183;
		const changeIntegral = db.getDao('change_integral');
		const playerInfo = db.getDao('player_info');

		changeIntegral.aggregate()
			.match({ viperId, time: { '$gt': starTime, '$lt': endTime } })
			.group({ _id: { uid: '$uid', type: '$type', nickname: '$nickname' }, 'sum': { '$sum': '$integral' } })
			.then(function (result) {
				playerInfo.find({ uid: { $in: result.map(m => m._id.uid) } }, function (err, players) {
					// console.error('========result',result);
					const arr = [];
					result.forEach(m => {
						const temp = arr.find(x => x.uid === m._id.uid);
						if (temp) {
							temp[m._id.type] = m.sum;
						} else {
							const player = players.find(x => x.uid === m._id.uid);
							arr.push({
								uid: m._id.uid,
								add: m && m._id.type === 'add' ? m.sum : 0,
								del: m && m._id.type === 'del' ? m.sum : 0,
								nickname: player.nickname, 
								slefIntegral: player ? player.integral : 0
							});
						}
		});
					// console.log(arr);
					res.send({ code: 200, result: arr });
				});
			})
    });
});

/**
 *  获取房主充值列表
*/
app.get("/getAllVip", function(req, res) {
	const playerModel = db.getDao('player_info');
	const changeIntegral = db.getDao('change_integral');
	const platform = db.getDao('platform');
	const customerInfo = db.getDao('customer_info');
	playerModel.find({vip:true},function(err, players){
		playerModel.find({viperId: {$in: players.map(m => m.uid)}},function(err, all){
			changeIntegral.aggregate()
				.group({_id: {viperId:'$viperId', type:'$type'},'sum': {'$sum': '$integral'}}).then(function (vips) {
					platform.find({'creator.uid': {$in: players.map(m => m.uid)}}, function (err, arr) {
						customerInfo.find({uid:{$in: players.map(m => m.uid)},passStatus:1}, function (err, cuntomers) {
							const list = players.map(m => {
								// const temp = arr.find(x => x.creator.uid === m.uid);
								const temp2 = vips.find(x => x._id.viperId === m.uid);
								const temp3 = cuntomers.find(x => x.uid === m.uid);
								const temp4 = all.filter(x => x.viperId === m.uid);
								// console.log('temp4..........',temp4);
								return {
									uid: m.uid,
									nickname: m.nickname,
									vipEffectiveTime: m.vipEffectiveTime,
									vdot: m.vdot,
									addRmb: m.addRmb,
									members: temp4.length,
									add: temp2 && temp2._id.type === 'add' ? temp2.sum : 0,
									del: temp2 && temp2._id.type === 'del' ? temp2.sum : 0,
									tester:temp3.passType,
									remark:temp3.remark,
								}
							});
							// console.log(list);
							res.send({code:200, result:list});
					    });
					});
			});
		});
	});
});

/**
 *  获取房主的机器列表
*/
app.get("/getAllVipGames", function(req, res) {
	const playerModel = db.getDao('player_info');
	const platform = db.getDao('platform');
	const customerInfo = db.getDao('customer_info');
		playerModel.find({vip:true},function(err, players){
				if(players){
					platform.find({'creator.uid': {$in: players.map(m => m.uid)}}, function (err, arr) {
						customerInfo.find({uid:{$in: players.map(m => m.uid)},passStatus:1}, function (err, cuntomers) {
								const list = players.filter(p => !p.needPlatform).map(m=>{
									const temp = arr.find(x =>x.creator.uid === m.uid);
									const temp3 = cuntomers.find(x => x.uid === m.uid);
										// console.log(m.uid,temp);
										let rooms = 0;
										for(var i =0;i<temp.games.length;i++){
											rooms += temp.games[i].rooms.length;
										}
											return{
													uid:m.uid,
													nickname:m.nickname,
													games:temp.games,
													rooms: rooms,
													tester:temp3.passType,
													remark:temp3.remark,
											}

								});
							res.send({code:200, result:list});
						});
					});
				}else{
					res.send({code:500,msg:'查询失败'});
				}
		});
	});

/**
 *  创建推广人的ID
*/
app.post('/addPromoter', function(req, res){
	method(res, req, (res,data) => {
			data = JSON.parse(data);
			// console.log(db.getDao('promoter_info'));
			const promoterInfo = db.getDao('promoter_info');
			const promoterId = utils.randomId(6);
			const userName = data.userName;
			const passWord = data.passWord;
            const promoterType=data.promoterType;
            const remark=data.remark;

			promoterInfo.findOne({promoterId:promoterId},function(err,data){
				if(!data){
					promoterInfo.findOne({userName:userName},function(err,player){
						if(!player){
							const info ={
								promoterId:utils.randomId(6),
								userName: userName,
								passWord:passWord,
                                promoterType:promoterType,
                                remark:remark
							}
							promoterInfo.create(info,function(err,user){
								if (!err || user) {
									res.send({code:200});
								} 
							});
						}else{
							res.send({code:500,msg:'帐号已存在请重新输入'});
						}
					});
				}
			});
	});
});


/**
 *  获取推广人的ID
*/

app.get("/getAllPromoterId", function(req, res) {
	const promoterInfo = db.getDao('promoter_info');
	const inviteCodeInfo = db.getDao('invite_code_info');
	promoterInfo.find({},function(err,promoter){
		if(!err||promoter){
			// console.log('获取推广人。。。',promoter);
			 inviteCodeInfo.find({ promoterId: {$in: promoter.map(m => m.promoterId)}},function(err,arr){
			 	// console.log('arr////',arr);
			 	const list = promoter.map(m=>{
						const temp = arr.filter(x =>x.promoterId === m.promoterId);
						let userNum = 0;
						// console.log(m.promoterId,temp);
						if(temp === undefined){
							userNum = 0;
						}else{
							userNum = temp.length;
						}
							return{
									promoterId:m.promoterId,
									userName:m.userName,
									passWord:m.passWord,
									userNum: userNum,
                                    promoterType:m.promoterType,
                                    remark:m.remark
								}
					});
				// console.log(list);
				res.send({code:200, result:list});
			 });
		}else{
			res.send({code:500,msg:'查询失败'});
		}
	});
});


/**
 *  绑定房主推广人的ID
*/
app.post('/bindPromoter', function(req, res){
	method(res, req, (res,data) => {
			data = JSON.parse(data);
			const inviteCodeInfo = db.getDao('invite_code_info');
			const uid = data.uid;
			const promoterId = data.promoterId;
			inviteCodeInfo.aggregate()
			.match({uid, promoterId})
			.then(function(result){
				// console.log('result.........',result);
				if(utils.isVoid(result)){
					pomelo.app.rpc.hall.httpRemote.setInviteCode(null,{uid: uid,promoterId:promoterId},(data) =>{
						// console.log('data..............',data);
							if(data.code === 200){
								res.send({code:200,msg:'配置成功'});
							}else{
								res.send({code:500,msg:'配置失败: '+ data.error});
							}
					});
				}else{
					res.send({code:500,msg:'该推广人已经绑定了该房主！'});
				}
			});
    });
});

/**
 *  获取推广人下面的房主信息
*/
app.post('/getPromoterOfViper', function(req, res){
	method(res, req, (res,data) => {
		data = JSON.parse(data);
		const inviteCodeInfo = db.getDao('invite_code_info');
		const platform = db.getDao('platform');
        const playerInfo=db.getDao("player_info");

		const  promoterId = data.promoterId;
		inviteCodeInfo.find({promoterId:promoterId},function(err,vipers){
			if(vipers){
                playerInfo.find({"uid":{$in:vipers.map(m=>m.uid)}},{"uid":1,"nickname":1},function(err,result){
                    if(err){
                        console.log("getPromoterOfViper查询player_info表失败",err);
                        res.send({code:500});
                    }
                    for(let i in result){
                        for(let j in vipers){
                            if(result[i].uid===vipers[j].uid){
                                vipers[j]._doc.nickname=result[i].nickname;//??
                                continue;
                            }
                        }
                    }
                    // console.log(vipers)
                    res.send({code:200,result:vipers});
                });
			}
		});

    });
});

/**
 *  获取推广人下面邀请码的玩家信息
*/
app.post('/getPromoterOfplayers', function(req, res){
	method(res, req, (res,data) => {   
		data = JSON.parse(data);
		const changeIntegral = db.getDao('change_integral');
		const playerInfo = db.getDao('player_info');
		const  inviteCode = data.inviteCode;
		changeIntegral.aggregate()
		.match({inviteCode})
		.group({_id: {uid:'$uid',type:'$type'},'sum': {'$sum': '$integral'}})
		.then(function(result){
			if(result){
				console.log('result....',result);
				playerInfo.find({uid: {$in: result.map(m => m._id.uid)}},function(err, players){
						const arr = [];
						result.forEach(m => {
						const temp = arr.find(x => x.uid === m._id.uid);
						if (temp) {
							temp[m._id.type] = m.sum;
						} else {
							const player = players.find(x => x.uid === m._id.uid);
							arr.push({
								uid: m._id.uid,
								add: m && m._id.type === 'add' ? m.sum : 0,
								del: m && m._id.type === 'del' ? m.sum : 0,
								nickname: player.nickname, 
								slefIntegral: player ? player.integral : 0
							});
						}
					});
					res.send({code:200,result:arr});
				});	
			}else{
				res.send({code:500,msg:'查询失败'});
			}
		})

	});
});



/**
 * 充值v点-1、金币-2、积分-3  {uid,type,num}
 */
app.post('/addMoney', function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		if (![1, 2, 3, 4].includes(data.type)) {
			res.send({ error: '充值类型错误' })
		}
		pomelo.app.rpc.hall.playerRemote.addMoney(null, { uid: data.uid, type: data.type, num: data.num }, function (msg) {
			res.send({ code: 200 });
		});
	});
})

/**
 *  获取所有的金币/V点充值记录
*/
app.post("/getPayInfo", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const payInfo = db.getDao('pay_info');
		const playerInfo = db.getDao('player_info');
		playerInfo.find({},{'nickname':1,'uid':1},function(err,players){
			payInfo.find({ attach: data.attach }, function (err, pays) {
					let arr = pays.filter(x=>x.id.slice(13)!="s")
					const list = arr.map(m=>{
						const temp = players.find(x=>x.uid ===m.uid);
							return {
								uid:m.uid,
								id:m.id,
								nickname:temp ? temp.nickname:'没有该玩家',
								time : m.time,
								total_fee:m.total_fee,
								remark:m.remark,
							}
					});
					res.send({code:200,result:list});
			});
		});
	});
});


/**
 *  修改所有的金币/V点充值记录
*/
app.post("/changePayInfo", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const payInfo = db.getDao('pay_info');
		payInfo.update({id:data.id},{$set:{remark:data.remark}},function(err,sss){
			if(!err){
				res.send({code:200,msg:'修改成功'});
			}else{
				res.send({code:200,error:'修改失败'});
			}
		});
	});
});


/**
 * 推广人登录
 */
app.post("/promoterLogin", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const promoterInfo = db.getDao('promoter_info');
		promoterInfo.findOne({"userName": data.userName}, function (err, promoterInfo) {
			if (err) {
				res.send({ code: 500, error: '查找失败'});
			}
			if(!promoterInfo){
				res.send({code: 500, error:'昵称不存在'});
				return;
			}
			if(promoterInfo.passWord != data.passWord){
				res.send({code: 500, error:'密码错误'});
				return;
			}
			res.send({code: 200, promoterId: promoterInfo.promoterId});
		});
	});
});

/**
 * 修改房主备注
 */
app.post("/changeAgencyRemark",function(req,res){
   method(res,req,(res,data)=>{
       data=JSON.parse(data);
       const customerInfo = db.getDao('customer_info');
       const remark=data.remark;
       const uid=data.uid;
       customerInfo.update({uid:uid}, {$set: {remark:remark}},  function(err, result) {
           if(err){
               console.error("changeAgencyRemark",error);
               res.send({code:500});
           }
           res.send({code:200,result:result});
       });
   });
});
/**
 * 关闭游戏
 */

app.get("/getClosegames", function(req, res) {
	 let games = JsonMgr.get('games');
	 const closeGame = db.getDao('close_game');
	 let datas = games.datas;
	 closeGame.find({},function(err,gameStatus){
	 	if(!err){
			 // console.log('games.....',datas,gameStatus);
			res.send({code :200,allGames:datas,gameStatus:gameStatus})
	 	}
	 });

});

/**
 * 设置游戏关闭 true 为开放 false 为关闭
 */
app.post("/setCloseGame", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const closeGame = db.getDao('close_game');
		closeGame.update({nid:data.nid},{$set: {closeTime:Date.now(),status: data.status}},{upsert:true},function(err,games){
			if(!err){
				pomelo.app.rpc.hall.httpRemote.closeGame(null, data, (data) => {	
					res.send({code: 200});
				});
			}
		});
	});
});

// /**
//  * 设置金币充值的返利比例 三级返利二级
//  */
// app.post("/setBackAddGold", function(req, res){
// 	method(res, req, (res, data) => {
// 		data = JSON.parse(data);
// 		const addGoldRebates = db.getDao('add_gold_rebates');
// 		const info ={
// 			rebateId :'123456', // 充值金币的Id
// 	        time: Date.now(),
// 	        rebate: data.rebate, // 交易结束时间
// 		}
// 		addGoldRebates.create(info,function(err,result){
// 			if(!err){
// 				res.send({code: 200,msg:'保存成功'});
// 			}else{
// 				res.send({code: 500,error:'保存失败'});
// 			}
// 		});
// 	});
// });


// *
//  * 设置金币充值的返利比例 三级返利一级
 
// app.post("/setOneBackAddGold", function(req, res){
// 	method(res, req, (res, data) => {
// 		data = JSON.parse(data);
// 		const addGoldRebates = db.getDao('add_gold_rebates');
// 		const info ={
// 			rebateId :'234567', // 充值金币的Id
// 	        time: Date.now(),
// 	        rebate: data.rebate, // 交易结束时间
// 		}
// 		addGoldRebates.create(info,function(err,result){
// 			if(!err){
// 				res.send({code: 200,msg:'保存成功'});
// 			}else{
// 				res.send({code: 500,error:'保存失败'});
// 			}
// 		});
// 	});
// });



/**
 * 获取金币充值的返利比例
 */
app.post("/getBackAddGold", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const addGoldRebates = db.getDao('add_gold_rebates');
		addGoldRebates.find({rebateId :data.rebateId },function(err,result){
			if(!err){
				res.send({code: 200,result:result});
			}else{
				res.send({code: 500,error:'获取失败'});
			}
		});
	});
});

/**
 * 改变金币充值的返利比例
 */
app.post("/changeBackAddGold", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const addGoldRebates = db.getDao('add_gold_rebates');
		addGoldRebates.update({rebateId:data.rebateId},{$set: {time:Date.now(),rebate: data.rebate}},{upsert:true},function(err,result){
			if(!err){
				res.send({code: 200,msg:'保存成功'});
			}else{
				res.send({code: 500,error:'保存失败'});
			}
		});
	});
});

/**
 * 获取玩家的兑换信息getCardRecord
 */
app.post("/getCardRecord", function(req, res){
	method(res, req, (res, data) => {  //1为审核中 2为已发货 3 为确认收货
		data = JSON.parse(data);
		const cardRecord = db.getDao('card_record');
		const  playerInfo = db.getDao('player_info');
		playerInfo.find({},function(err,players){
				cardRecord.find({},function(err,result){
					const list = result.map(m=>{
					   	const temp = players.find(x =>x.uid === m.uid);
							return{
									uid:m.uid,
									nickname:temp?temp.nickname:'xxxx',
									recordId:m.recordId,
									id: m.id,
                                    cardNum:m.cardNum,
                                    name:m.name,
                                    time :m.time,
                                    status:m.status,
                                    cardNo:m.cardNo,
                                    remark:m.remark,
								}
					});
					res.send({code:200, result:list});
				});
		});
	});
});

/**
 * 修改玩家的兑换信息
 */
app.post("/changeCardRecordStatus", function(req, res){
	method(res, req, (res, data) => {  //1为审核中 2为已发货 3 为确认收货
		data = JSON.parse(data);
		const cardRecord = db.getDao('card_record');
		let content ;
		if(data.status == 2){
			content = {status: data.status,remark:data.remark};
		}else{
			content = {status: data.status};
		}
			cardRecord.update({recordId:data.recordId},{$set: content},{new:true},function(err,result){
				if(!err){
					res.send({code: 200,msg:'修改成功！'});
				}else{
					res.send({code: 500,error:'获取失败'});
				}
			});
		});
});

/**
 * 获取玩家绑定手机信息getUserInfo
 */
// app.get("/getUserInfo", function(req, res){
// 	const  userInfo = db.getDao('user_info');
// 	userInfo.find({},function(err,result){
// 		if(!err|| result){
// 			res.send({code: 200,result:result});
// 		}else{
// 			res.send({code: 500,error:'获取数据库数据失败'});
// 		}
// 	});

//  });
app.post("/getUserInfo", function(req, res){
	method(res, req, (res, data) => {  
		data = JSON.parse(data);
		const  userInfo = db.getDao('user_info');
		const  playerInfo = db.getDao('player_info');
		userInfo.find({},{'uid':1,'cellPhone':1,'passWord':1},function(err,users){
			playerInfo.find({},{'uid':1,'nickname':1,'createTime':1},function(err,players){
				let list = players.map(m=>{
					const temp = users.find(x=>x.uid ===m.uid);
					return{
						  uid:m.uid,
						  nickname:m.nickname,
						  cellPhone:temp ? temp.cellPhone : 0,
						  passWord :temp ? temp.passWord:0,
						  createTime : m.createTime,
						}

				});
				res.send({code: 200,result:list});
			});
		});
	});
});


/**
 * 修改玩家绑定手机信息
 */
app.post("/changeUserInfo", function(req, res){
	method(res, req, (res, data) => {  
		data = JSON.parse(data);
		const  userInfo = db.getDao('user_info');
			userInfo.update({uid:data.uid},{$set: {cellPhone: data.cellPhone,passWord:data.passWord}},{new:true},function(err,result){
				if(!err){
					res.send({code: 200,msg:'修改成功！'});
				}else{
					res.send({code: 500,error:'修改失败！'});
				}
			});
		});
});


/**
 * 开通渠道
 */
app.post("/isOpenAgency", function(req, res){
	method(res, req, (res, data) => {  
		data = JSON.parse(data);
		const  userInfo = db.getDao('user_info');
		const  playerInfo = db.getDao('player_info');
			userInfo.findOne({uid:data.uid},function(err,users){
				if(users.cellPhone){
					userInfo.update({uid:data.uid},{$set:{isOpenAgency:true,remark:data.remark,type:0,openTime:Date.now()}},{new:true},function(err,result){
						if(!err){
							playerInfo.update({uid:data.uid},{$set: {sex: 1}},{new:true},function(err,datas){
								if(!err){
									res.send({code: 200,msg:'开通代理成功'});
								}
							});
						}else{
							res.send({code: 500,error:'开通代理失败'});
						}
					});
				}else{
					res.send({code: 500,error:'请绑定手机号才能开通'});
				}
			});
		})
});
/**
 * 登入代理
 */
app.post("/agencyEnter", function(req, res){
	method(res, req, (res, data) => {  
		data = JSON.parse(data);
		const  userInfo = db.getDao('user_info');
		const  playerInfo = db.getDao('player_info');
			userInfo.findOne({cellPhone:data.cellPhone},function(err,result){
				if(result){
					if(result.passWord == data.passWord && result.isOpenAgency){
						playerInfo.findOne({uid:result.uid},function(err,player){
							if(player){
								res.send({code: 200,result:result,nickname:player.uid,sex:player.sex});
							}else{
								res.send({code: 500,error:'密码错误或者不是代理'});
							}
						});
					}
				}else{
					res.send({code: 500,error:'密码错误或者不是代理'});
				}
			});
		});
});

/**
 * 获取渠道
 */
app.get("/getAgency", function(req, res){
		const  userInfo = db.getDao('user_info');
			userInfo.find({isOpenAgency:true},function(err,result){
				if(result){
				let list = [];
					result.forEach(m=>{
						let user = {};
						if(m.type !=1 ||m.type === undefined ){
							user.uid = m.uid;
							user.remark = m.remark;
							user.cellPhone = m.cellPhone;
							list.push(user);
						}
					});
				// console.log('list......',list);	
				res.send({code: 200,result:list});	
				}else{
					res.send({code: 500,error:'获取数据失败'});
				}
			});
});


/**
 * 获取所有渠道的详细信息
 */
app.post("/allqudaoxinxi", function(req, res){
	method(res, req, (res, data) => {  
		data = JSON.parse(data);
		const  userInfo = db.getDao('user_info');
		const  playerInfo = db.getDao('player_info');
		const  dailiAddMoney = db.getDao('daili_add_money');
		const  inviteCodeInfo = db.getDao('invite_code_info'); 
		userInfo.find({isOpenAgency:true,type:0},function(err,result){
				let arr =[];
				result.forEach(m=>{
					arr.push(m.uid)
				});
			dailiAddMoney.find({uid:{$in: arr}},function(err,moneys){
				playerInfo.find({uid:{$in: arr}},{'uid':1,'nickname':1},function(err,players){
					inviteCodeInfo.find({},function(err,invites){
						const list = result.map(m=>{
						 	 const temp = invites.find(x=>x.uid === m.uid);
						 	 const temp1 = invites.filter(x=>x.viper === m.uid);
						 	 const temp2 = players.find(x=>x.uid === m.uid);
						 	 const temp3 = moneys.find(x=>x.uid === m.uid);
						 	   let length = 0;
						 	   temp1.forEach(s=>{
						 	    	length += s.inviteRecords.length;
						 	   });
						 	return {
						 	 	remark : m.remark,
						 	 	uid:m.uid,
						 	 	nickname : temp2.nickname,
						 	 	openTime  : m.openTime? m.openTime:'没记录开渠道日期',
						 	 	inviteCode : temp? temp.inviteCode:'该渠道没有邀请码',
						 	 	onePeople : temp ? temp.inviteRecords.length:0,
						 	 	allPeople : length,
						 	 	allMoney : temp3? temp3.money:0,
						 	 	cellPhone: m.cellPhone,
						 	}
						});
						res.send({code:200,result:list});
					});
				});
			});
		});	
	});
});





/**
 * 根据渠道获取一级代理下面的相关数据总和
 */
app.post("/agencyOfData", function(req, res){
	method(res, req, (res, data) => {  
		data = JSON.parse(data);
		pomelo.app.rpc.hall.httpRemote.agencyOfData(null, {uid: data.uid}, (data) => {
			res.send(data);
		});  
	});
});





/**
 * 开通渠道下面的一级代理
 */
app.post("/isOpenAgencyOfDown", function(req, res){
	method(res, req, (res, data) => {  
		data = JSON.parse(data);
		const  userInfo = db.getDao('user_info');
		const  playerInfo = db.getDao('player_info');
			userInfo.findOne({uid:data.uid},function(err,users){
				if(users.cellPhone){
					userInfo.update({uid:data.uid},{$set: {isOpenAgency: true,remark:data.remark,type:1}},{new:true},function(err,result){
						if(!err){
							playerInfo.update({uid:data.uid},{$set: {sex: 2}},{new:true},function(err,datas){
								if(!err){
									res.send({code: 200,msg:'开通代理成功'});
								}
							});
						}else{
							res.send({code: 500,error:'开通代理失败'});
						}
					});
				}else{
					res.send({code: 500,error:'请绑定手机号才能开通'});
				}
			});
	})
});

/**
 * 修改一级代理的备注信息
 */
app.post("/changeDailiRemark", function(req, res){
	method(res, req, (res, data) => {  
		data = JSON.parse(data);
		const  userInfo = db.getDao('user_info');
		userInfo.update({uid:data.uid},{$set: {remark:data.remark}},{new:true},function(err,result){
			if(!err){
				res.send({code: 200,msg:'修改成功'});
			}else{
				res.send({code: 500,error:'修改失败'});
			}
		})
	})
});



/**
 * 获取一级代理下面所有玩家的充值
 */
app.post("/getDailiPlayers", function(req, res){
	method(res, req, (res, data) => {  
		data = JSON.parse(data);
		pomelo.app.rpc.hall.httpRemote.getDailiPlayers(null, {uid: data.uid}, (data) => {
			res.send(data);
		}); 
	})
});





/**
 * 根据代理获取代理下面的充值信息

 */
app.post("/agencyOfDataChongzhi", function(req, res){
	method(res, req, (res, data) => {  
		data = JSON.parse(data);
		const  playerInfo = db.getDao('player_info');
		const  inviteCodeInfo = db.getDao('invite_code_info');
		const  payInfo = db.getDao('pay_info');
		// const  goldBackRecord = db.getDao('gold_back_record');
		let arr =[];
		// let results = [];
		let secondlength = 0;
		inviteCodeInfo.find({viper:data.uid},function(err,invitePlayers){ //获取该渠道下面所有的玩家
			  		invitePlayers.forEach( m =>{
					  	arr = arr.concat(m.inviteRecords);
					});
			playerInfo.find({uid:{$in:arr}},function(err,playerInfos){ //获取所有玩家的信息
				// console.log('playerInfos......',playerInfos);
				if(playerInfos.length !=0){
					inviteCodeInfo.findOne({uid:data.uid},function(err,invites){
						if(invites){
						  const invite  = invites.inviteRecords;//获取二级代理的uid
							// invitePlayers.filter();
							// console.log('invite......',invite)
							let results=[];
						    invite.forEach(m => {
								let result ={};
								const temp3 = playerInfos.find(x => x.uid === m);
								const temp  = invitePlayers.filter(x => x.secondViper === m);
								let arrss = [];
								let allMoney = 0;
								// console.log('temp.....',temp);
								temp.forEach(m=>{
									arrss = arrss.concat(m.inviteRecords);  //将一级代理下面所有的玩家进行组成数组
								});
								// console.log('arrss.....',arrss);
								arrss.forEach(m=>{
									const temp2  = playerInfos.find(x => x.uid === m);
									allMoney +=temp2.addRmb;
								});
								// console.log('allMoney.....',allMoney);
									result.uid = temp3 ? temp3.uid :0,
									result.nickname = temp3 ? temp3.nickname :0,
									result.allMoney = allMoney,
									results.push(result);

							});
							// console.log('result......',results);
							res.send({code:200,result:results});
						}else{
							res.send({code:500,error:'该渠道没有相关数据'});
						}
						console.log();
					});
					
				}else{
					res.send({code:500,error:'该渠道没有相关数据'});
				}
			});	
		});	
	});
});

/**
 * 存储兑换物品信息
 */

app.post("/saveCardThings", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const  saveCardThings = db.getDao('save_card_things');
		const info = {
			  cardId : utils.id(),
			  id: data.id,
			  cardName : data.name,
			  cardNo : data.cardNo,
			  cardPassWord :data.cardPassWord,
			  status : 0,
			  createTime : Date.now(),
		}
		saveCardThings.findOne({cardNo:data.cardNo},function(err,card){
			if(card){
				res.send({code: 500,error:'输入的卡号重复'});
			}else{
				saveCardThings.create(info,function(err,result){
					if(!err){
						res.send({code: 200,msg:'保存成功'});
					}else{
						res.send({code: 500,error:'保存失败'});
					}
				});
			}
		})
	});
});

/**
 * 批量存储兑换物品信息
 */

app.post("/saveBatchCardThings", function (req, res) {
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const saveCardThings = db.getDao('save_card_things');
		let promiseArr = [];
		let insertData = [];
		for (let i in data) {
			insertData.push({
				cardId: utils.id(),
				id: data[i][3],
				cardName: data[i][0],
				cardNo: data[i][1],
				cardPassWord: data[i][2],
				status: 0,
				createTime: Date.now(),
			});
			promiseArr.push(new Promise(function (resolve, reject) {
				saveCardThings.findOne({ cardNo: data[i][1] }, function (err, card) {
					if (card) {
						reject("卡号重复");
					} else {
						resolve("卡号未重复");
					}
				});
			}));

		}
		Promise.all(promiseArr).then(function (results) {
			saveCardThings.insertMany(insertData,function(err,returnData){
				if(err){
					return res.send({
						code:500
					});
				}
				return res.send({
					code:200
				});
			});
		}).catch(function (reason) {
			return res.send({
				code: 400,
				msg: reason
			})
		});
	});
});

/**
 * 获取配置表的物品信息
 */

app.post("/getCardThings", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		let shopchange = JsonMgr.get('shopchange').datas;
		const list = shopchange.map(m=>{
				return {
						id: m.id,
						name: m.name,
					}
			});
		res.send({code:200,result:list});


	});
});

/**
 * 获取数据库中保存的物品信息
 */
app.post("/getMongdbCardThings", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const  saveCardThings = db.getDao('save_card_things');
		const  cardRecord = db.getDao('card_record');
		const  playerInfo = db.getDao('player_info');
		playerInfo.find({},{'uid':1,'nickname':1},function(err,players){
			cardRecord.find({},{'cardNo':1,'time':1,'uid':1},function(err,records){
				saveCardThings.find({},function(err,cards){
					// if(cards){
					// 	res.send({code:200,result:cards});
					// }else{
					// 	res.send({code:500,error:'获取数据失败'});x.time === m.recordTime
					// }
					const list = cards.map(m=>{
						const temp = records.find(x=>x.time === m.recordTime);
						let nickname ;
						if(temp){
							const temp1 = players.find(x=>x.uid === temp.uid);
							 nickname = temp1 ? temp1.nickname:'没有姓名';
						}
						return{
							cardId:m.cardId,
							cardName:m.cardName,
							cardNo:m.cardNo,
							cardPassWord:m.cardPassWord,
							status:m.status,
							createTime:m.createTime,
							nickname:nickname?nickname:'没有名字',
							recordTime : m.recordTime,
						}
					});
					res.send({code:200,result:list});
				});
			});	
		});
	});
});


/**
 * 改变兑换物品的状态
 */
app.post("/changeCardThings", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const  saveCardThings = db.getDao('save_card_things');
		saveCardThings.update({cardId:data.cardId},{$set: {status:data.status}},{new:true},function(err,data){
			if(!err){
				res.send({code:200,msg:'修改成功'});
			}else{
				res.send({code:500,error:'修改失败'});
			}
		});

	});
});

/**
 * 获取该渠道下面的玩家
 */
app.post("/getAgencyAllDate", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		pomelo.app.rpc.hall.httpRemote.getAgencyAllDate(null, {uid: data.uid}, (data) => {
			res.send(data);
		});  
	});
});

/**
 * 查询该渠道下面的兑卡记录
 */
app.post("/getAgencyCardRecord", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const cardRecord = db.getDao('card_record');
		const  inviteCodeInfo = db.getDao('invite_code_info');
		const  playerInfo = db.getDao('player_info');
		let  arr = [];
			inviteCodeInfo.find({viper:data.uid},function(err,invites){
				if(invites){
					invites.forEach( m =>{
						  	arr = arr.concat(m.inviteRecords);
					});
					arr.push(data.uid);
					// console.log('arr......',arr);
				playerInfo.find({uid:{$in:arr}},{'nickname':1,'uid':1},function(err,players){
					cardRecord.find({uid:{$in:arr}},function(err,cardRecords){
						if(cardRecords){
						const list = cardRecords.map(m=>{
								const temp = players.find(x=>x.uid === m.uid);
								return{
									uid:m.uid,
									nickname : temp?temp.nickname:'该玩家没名字',
									recordId : m.recordId,
									name:m.name,
									cardNum:m.cardNum,
									cardNo:m.cardNo,
									time:m.time,
									allGold:m.allGold,
									remark:m.remark,
									status:m.status,
								}


						});
							res.send({code:200,data:list});
						}else{
							res.send({code:500,error:'该渠道还没有二维码以及相关数据'});
						}
					});
				});	
				}else{
					res.send({code:500,error:'该渠道还没有二维码以及相关数据'});
				}
			});
	});
});

/**
 * 某一个玩家在游戏当中的记录
 */
app.post("/getGameRecords", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const gameRecord = db.getDao('game_record');
		gameRecord.find({uid:data.uid,gname:data.gname,createTime: {$gt: data.startTime, $lt: data.endTime}})
			.sort('-createTime').exec(function(err,result){
				if(result){
					res.send({code:200,result:result});
				}else{
					res.send({code:500,error:'查询失败'});
				}
		});
	});
});



/**
 * 所有玩家折线图统计
 .match({ viperId, time: { '$gt': starTime, '$lt': endTime } })
 */
app.post("/getGameAllPeopleBackRate", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const gameRecord = db.getDao('game_record');
		const startTime = data.startTime;
		const endTime  = data.endTime;
		gameRecord.find({gname:data.gname,createTime:{'$gt':startTime,'$lt':endTime}, playStatus:{'$in': [null, 1]}})
			.sort('createTime').exec(function(err,records){
				if(records){
					res.send({code: 200,result:records});
				}else{
					res.send({code: 500,error:'查询失败'});
				}
		});
	});
});	


/**
 * 某一个玩家则线图统计
 .match({ viperId, time: { '$gt': starTime, '$lt': endTime } })
 */
app.post("/getGamePeopleBackRate", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const gameRecord = db.getDao('game_record');
		const startTime = data.startTime;
		const endTime  = data.endTime;
		gameRecord.find({uid:data.uid,gname:data.gname,createTime:{'$gt':startTime,'$lt':endTime},playStatus:{'$in': [null, 1]}})
		   .sort('createTime').exec(function(err,records){
			if(records){
				res.send({code: 200,result:records});
			}else{
				 res.send({code: 500,error:'查询失败'});
			}
		});
	});
});	
/**
 * 手动添加玩家的充值金额
 */
app.post("/addMoneyRecord", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		console.log('data........',data);
		pomelo.app.rpc.hall.payRemote.shopPayCallback(null, data, (data) => {
			res.send({code:200,data:data});
		}); 

	});
});

/**
 * 渠道打开的游戏
 */
app.post("/setqudaoForGame", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		let games = JsonMgr.get('games');
		let datas = games.datas;
		const inviteCodeInfo = db.getDao('invite_code_info');
		inviteCodeInfo.update({uid:data.uid},{$set: {games:data.games}},{new:true},function(err,data){
				if(!err){
        			res.send({code: 200,msg:'保存成功'});
        		}else{
        			 res.send({code: 500,error:'保存失败'});
        		}
        })

	});
});


/**
 * 获取渠道打开的游戏
 */
app.post("/getqudaoForGame", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		let games = JsonMgr.get('games');
		let datas = games.datas;
		const inviteCodeInfo = db.getDao('invite_code_info');
		inviteCodeInfo.findOne({uid:data.uid},function(err,data){
				if(data){
        			res.send({code: 200,games:data.games,allgames:datas});
        		}else{
        			 res.send({code: 500,error:'获取数据失败'});
        		}
        })

	});
});

/**
 * 获取该玩家的邀请码
 */
app.post("/getPlayerInviteCode", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const inviteCodeInfo = db.getDao('invite_code_info');
		inviteCodeInfo.findOne({uid:data.uid},function(err,invite){
			if(invite){
				res.send({code:200,inviteCode:invite.inviteCode})
			}else{
				res.send({code:500,error:'该玩家还没有邀请码'});
			}
		});
	});
});

// /**
//  * 关闭支付通道
//  */
// app.post("/closePay", function(req, res){
// 	method(res, req, (res, data) => {
// 		data = JSON.parse(data);
// 		const closePay = db.getDao('close_pay');
// 		closePay.update({id:'123456'},{$set: {isOpen:data.isOpen}},{upsert:true},function(err,data){
// 			if(!err){
// 				res.send({code:200,msg:'关闭支付通道成功'})
// 			}else{
// 				res.send({code:500,error:'关闭失败'});
// 			}
// 		});
// 	});
// });


/**
 * 获取支付通道
 */
app.post("/getclosePay", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const closePay = db.getDao('close_pay');
		closePay.findOne({id:'123456'},function(err,data){
			if(data){
				res.send({code:200,data:data})
			}else{
				res.send({code:500,error:'关闭失败'});
			}
		});
	});
});

/**
 * 关闭兑卡通道
 */
app.post("/closeCard", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const closeCard = db.getDao('close_card');
		closeCard.update({id:'123456'},{$set: {isOpen:data.isOpen}},{upsert:true},function(err,data){
			if(!err){
				res.send({code:200,msg:'关闭兑卡通道成功'})
			}else{
				res.send({code:500,error:'关闭失败'});
			}
		});
	});
});


/**
 * 获取兑卡通道
 */
app.post("/getcloseCard", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const closeCard = db.getDao('close_card');
		closeCard.findOne({id:'123456'},function(err,data){
			if(data){
				res.send({code:200,data:data})
			}else{
				res.send({code:500,error:'关闭失败'});
			}
		});
	});
});

/**
 * 获取兑卡的警报值倍数
 */
app.post("/getCardWarn", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const warnValue = db.getDao('warn_value');
		warnValue.findOne({},function(err,data){
			if(data){
				// let num = data.warn[3] ? data.warn[3] : 0;
				res.send({code:200,data:data})
			}else{
				res.send({code:500,error:'暂时没有数据'});
			}
		});
	});
});


/**
 * 改变兑卡的警报值倍数
 */
app.post("/changeCardWarn", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const warnValue = db.getDao('warn_value');
		warnValue.update({},{$set: {warn:data.warn,money:data.money,moneyTimes:data.moneyTimes}},{upsert:true},function(err,data){
			if(!err){
				res.send({code:200,msg:'改变成功'})
			}else{
				res.send({code:500,error:'关闭失败'});
			}
		});
	});
});



/**
 * 获取该排行版发放的记录
 */
app.post("/getRankingRecord", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const rankingRecord = db.getDao('ranking_record');
			rankingRecord.find({},function(err,result){
				if(result){
				    res.send({code:200,result:result})
				}else{
					res.send({code:200,error:'没有相关数据'})
				}
			});
		});
});

/**
 * 审核通过过后发放兑换奖品
 */
app.post("/passRecordCard", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		console.log('data',data);
		const userInfo = db.getDao('user_info');
		const saveCardThings = db.getDao('save_card_things');
		const cardRecord = db.getDao('card_record');
		const cardNo = data.cardNo;
		saveCardThings.find({id:data.id,status:0},(error,cards)=>{
			userInfo.findOne({uid:data.uid},function(err,user){
				if(user.cellPhone){
					const cellPhone = user.cellPhone;
					cardNo.forEach(m=>{
						RongcloudSmsService.remindExchange(data.uid,data.name,m.cardNo,cards.length);
						RongcloudSmsService.remindExchange1(cellPhone,data.name,m.cardNo,m.cardPassWord);
						  //发送邮件
		                let opts = {
		                    name:'['+data.name+']兑换成功',
		                    content : '恭喜您成功'+data.name+'。'+'卡号['+m.cardNo+'] 卡密['+m.cardPassWord+'] '+'闲置专让['+shopUrl.url+']'
		                }
		                MailService.generatorMail(opts,data.uid, function(err, mailDocs){//给玩家发邮件
		                    if(err){
		                        return next(null, {code: 500, error: '系统生成邮件'});
		                    }
		                });
					})

					cardRecord.update({recordId:data.recordId},{$set: {status:1,remark:data.remark}},{new:true},function(err,card){
						 if(!err){
						 	res.send({code:200,msg:'发送成功'});
						 }else{
						 	res.send({code:500,msg:'发送失败'});
						 }

					});
				}else{
					res.send({code:500,msg:'发送失败'});
				}
			})
		})	
	});
});


/**
 * 获取所有绑定了手机的玩家信息
 */
app.post("/getCellPhonePlayers", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const  playerInfo = db.getDao('player_info');
		const  userInfo = db.getDao('user_info');
		userInfo.find({cellPhone:{$exists:true}},function(err,users){
			let arr =[];
			users.forEach(m=>{
				arr.push(m.uid)
			});
			playerInfo.find({uid:{$in: arr}},{'nickname':1,'uid':1},function(err,players){
				const list = users.map(m=>{
					const temp = players.find(x=>x.uid === m.uid);
					 return{
					 		uid:m.uid,
					 		cellPhone:m.cellPhone,
					 		id:m.id,
					 		nickname:temp.nickname,
					 	}
				});
				res.send({code:200,result:list});
			});
		});

	});
});

/**
 * 获取Vip申请VIP的记录
 */
app.post("/applyVipRecord", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const applyVipRecord = db.getDao('apply_vip_record');
		applyVipRecord.find({},function(err,result){
			if(result){
				res.send({code:200,result:result});
			}else{
				res.send({code:500,error:'暂时没有数据'});
			}
		});

	});
});

/**
 * 修改Vip申请VIP的记录
 */
app.post("/changeApplyVipRecord", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const applyVipRecord = db.getDao('apply_vip_record');
		let content;
		if(data.status && !data.remark){
			content = {status:data.status};
		}else if (data.remark && !data.status){
			content = {remark:data.remark};
		}else if(data.status && data.remark ){
			content = {status:data.status,remark:data.remark};
		}
		console.log('content..',content);
		applyVipRecord.update({id:data.id},{$set:content},{new:true},function(err,result){
			if(!err){
				res.send({code:200,msg:'修改成功'});
			}else{
				res.send({code:500,error:'修改失败'});
			}
		});

	});
});

/**
 * 管理后台发送大喇叭
 */
app.post("/postBigNotice", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
	const route = 'bigNotice';
	const nickname = data.nickname;
	const content = data.content;
    const bigPostNotice = db.getDao('big_post_notice');
	messageService.notice({route,nickname,content}, (err) =>{
	        if(err != null){
	            console.error('发送系统公告出错');
	            res.send(null, {code: 500,error:'发送失败'});
	        }
	    const info ={
	        id : utils.id(),
	        nickname : nickname,
	        content :content,
	        uid : data.uid,
	        time :Date.now(),
	    }
	    bigPostNotice.create(info,function(err,result){
	        if(err){
	            console.error('大喇叭保存失败');
	            res.send({code:200,msg:'发送大喇叭成功'});
	        }else{
	        	res.send({code:200,msg:'发送大喇叭失败'});
	        }
	    });
    });

	});
});

/**
 *  支付列表
 */
app.post("/getPayType", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const payType = db.getDao('pay_type');
		payType.find({},function(err,results){
			let games = JsonMgr.get('payType');
			let datas = games.datas;
			const list = datas.map(m=>{
				const temp = results.find(x=>x.id == m.id);
				return  {
					id :  m.id,
					name : m.name,
					isOpen : temp ? temp.isOpen : false,
					shanghu : m.shanghu,
				}
			});
			res.send({code:200,result: list});
		});

	});
});

/**
 *  改变支付列表
 */
app.post("/changePayType", function(req, res){
	method(res, req, (res, data) => {
		data = JSON.parse(data);
		const payType = db.getDao('pay_type');
		payType.update({id:data.id},{$set:{name:data.name,isOpen:data.isOpen}},{upsert:true},function(err,result){
			if(!err){
				res.send({code:200,msg:'修改成功'});
			}else{
				res.send({code:500,error:'修改失败'});
			}
		});




	});
});

//youyin支付
app.get('/youyinPay', function(req, res) {
    console.log("youyin支付转发");
    let data = req.query;
    console.log(data)
    // method(res,req, (data) => {
	switch (data.type){
		case 'SCAN_CODE'://扫码支付
            pay.sendPay1(res,data,()=>{});
			break;
        case 'SHORTCUT_PAY'://快捷支付
            pay.sendPay2(res,data,()=>{});
            break;
        case 'BANK_CARD'://网银支付
            pay.sendPay3(res,data,()=>{});
            break;
		case  'H5'://扫码支付
            pay.sendPay4(res,data,()=>{});
            break;
		case 'kuaijie':
			pay4.sendPay(res,data,()=>{});
            break;
	}

    // });

})

//第三方支付异步回传
app.get('/callbackurl',function(req,res){
    let data = req.query;
    pay.callback(res,data);
    console.log("异步回传");
})

app.get('/callbackurl4',function(req,res){
    let data = req.query;
    console.log("异步回传",data);
    pay4.callback(res,data);

})

module.exports = app;