const repl = require('repl')
require('./pomelo-cocos2d-js');
let isExecuting = false

repl.start({prompt: 'ST Roobot::Runing >>>', eval: main})

function main(cmd) {

	cmd = cmd.trim().toString();
	console.log('当前cmd:',cmd)

	if(isExecuting){
		console.log('正在执行',cmd);
		return;
	}else{
		console.log('执行完毕')
		isExecuting = true;
	}
	if(cmd === 'login'){
		pomelo.init({host:'localhost', port:'3010'}, function() {
			// pomelo.request('gate.mainHandler.guest',{}, function(guestData){
			// 	console.log('游客信息',guestData);
				pomelo.request('gate.mainHandler.login', {id: '15161709559519804'}, function(data) {
					pomelo.disconnect();
					pomelo.init({host:'localhost', port: data.server.port}, function() {
						pomelo.request('connector.entryHandler.entry',{uid:data.uid, token:data.token}, function(entryData){
							console.log('进入游戏大厅',entryData);
							isExecuting = false;
						})
					})
				})
			// })
		})
	}else if(cmd == 'vipapply'){
		pomelo.request('hall.userHandler.vipApply', {}, function(data){
			console.log('vip申请成功',data)
		})
	}else if(cmd === '限时领取'){
		console.log('开始领取');
		pomelo.request('hall.timeReceiveHandler.timereceiveInfo',{}, function(info) {
			console.log('限时领取信息', info);
			pomelo.request('hall.timeReceiveHandler.timereceiveGet',{}, function(entryData) {
				console.log('限时领取信息', entryData);
				isExecuting = false;
			})
		})
	}else if(cmd === 'vp'){
		pomelo.request('hall.platformHandler.viperPlat',{}, function(data){
			console.log('获取平台及房主信息',data);
			isExecuting = false;
		});
	}else if(cmd.startsWith('cm')){
		const type = Number(cmd[2]);
		pomelo.request('hall.platformHandler.changeModel',{type}, function(data){
			console.log('切换vip经营模式',data);
			isExecuting = false;
		});
	}else if(cmd == 'aiadd'){
		pomelo.request('hall.userHandler.addMoney',{}, function(data){
			console.log('jiaqina',data);
			isExecuting = false;
		});
	}else if(cmd === 'xxl'){
		pomelo.request('games.indianaHandler.start',{}, function(data){
			console.log('消消乐游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'qh'){
		pomelo.request('hall.mainHandler.changeEnv',{}, function(data){
			console.log('切换环境',data);
			isExecuting = false;
		});
	}else if(cmd === 'enterXXL'){
		pomelo.request('hall.mainHandler.enterGame',{nid:'4'}, function(data){
			console.log('进入消消乐房间列表',data);
			pomelo.request('hall.gameHandler.enterRoom',{roomCode:'001'}, function(data){
				console.log('加入房间',data);
				isExecuting = false;
			});
		});
	}else if(cmd === 'enterXXL2'){
		pomelo.request('hall.mainHandler.enterGame',{nid:'4'}, function(data){
			console.log('进入消消乐房间列表',data);
			pomelo.request('hall.gameHandler.enterRoom',{roomCode:'003'}, function(data){
				console.log('加入房间',data);
				isExecuting = false;
			});
		});
	}else if(cmd === 'leave'){
		pomelo.request('hall.gameHandler.leaveRoom',{saveProfit: true}, function(data){
			console.log('离开房间列表',data);
			isExecuting = false;
		});
	}else if(cmd === 'lg'){
		pomelo.request('hall.gameHandler.leaveGame',{}, function(data){
			console.log('离开游戏列表',data);
			isExecuting = false;
		});
	}else if(cmd === 'start'){
		pomelo.request('games.indianaHandler.start',{betNum:5, betOdd:2}, function(data){
			console.log('开始游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'shovel'){
		pomelo.request('games.indianaHandler.initGame',{}, function(data){
			console.log('铲子数量',data);
			isExecuting = false;
		});
	}else if(cmd === 'xyx'){
		pomelo.request('games.indianaHandler.littleGame',{}, function(data){
			console.log('小游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'click'){
		pomelo.request('games.indianaHandler.click',{position: [3,2]}, function(data){
			console.log('小游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'click1'){
		pomelo.request('games.indianaHandler.click',{position: [1,2]}, function(data){
			console.log('小游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'click2'){
		pomelo.request('games.indianaHandler.click',{position: [0,3]}, function(data){
			console.log('小游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'click3'){
		pomelo.request('games.indianaHandler.click',{position: [2,4]}, function(data){
			console.log('小游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'click4'){
		pomelo.request('games.indianaHandler.click',{position: [1,4]}, function(data){
			console.log('小游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'click5'){
		pomelo.request('games.indianaHandler.click',{position: [1,1]}, function(data){
			console.log('小游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'leaveXXL'){
		pomelo.request('hall.gameHandler.leaveRoom',{saveProfit: true}, function(data){
			console.log('离开消消乐',data);
			isExecuting = false;
		});
	}else if(cmd === 'enter777'){
		pomelo.request('hall.mainHandler.enterGame',{nid:'1'}, function(data){
			console.log('进入777房间列表',data);
			// pomelo.request('hall.gameHandler.enterRoom',{roomCode:'001'}, function(data){
			// 	console.log('加入房间',data);
			// 	pomelo.request('games.slots777Handler.start',{lineNum: 20, bet: 50}, function(data){
			// 		console.log('开始游戏',data);
			// 		isExecuting = false;
			// 	});
			// });
		});
	}else if(cmd === 'xiyouji'){
		pomelo.request('hall.mainHandler.enterGame',{nid:'7'}, function(data){
			console.log('进入西游记房间列表',data);
			pomelo.request('hall.gameHandler.enterRoom',{roomCode:'001'}, function(data){
				console.log('加入房间',data);
				pomelo.request('games.xiyoujiHandler.gainedScatter',{}, function(data){
					console.log('已获得的图标',data);
					pomelo.request('games.xiyoujiHandler.start',{lineNum: 25, bet: 50}, function(data){
						console.log('开始xiyouji游戏',data);
						isExecuting = false;
					});
				});
			});
		});
	}else if(cmd === 'startxiyouji'){
		pomelo.request('games.xiyoujiHandler.start',{lineNum: 15, bet: 50}, function(data){
			console.log('开始游戏',data);
			if(data.result.canFreespin){
				console.log('freespin=====',data.result.freespins)
			}
			isExecuting = false;
		});
	}else if(cmd === 'xyjlg'){
		pomelo.request('games.xiyoujiHandler.littleGame',{totalBet: 45, over: true}, function(data){
			console.log('放弃西游记小游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'xyjlg2'){
		pomelo.request('games.xiyoujiHandler.littleGame',{totalBet: 45, over: false}, function(data){
			console.log('进行西游记小游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'icode'){
		pomelo.request('hall.inviteCodeHandler.refreshInviteCode',{}, function(data){
			console.log('刷新邀请码',data);
			pomelo.request('hall.inviteCodeHandler.configureInviteCode',{inviteCode: data.inviteCode, integral: 10, rebate: 1,}, function(data){
				console.log('设置邀请码',data);
				isExecuting = false;
			});
		});
	}else if(cmd === 's777'){
		pomelo.request('games.slots777Handler.start',{lineNum: 25, bet: 100}, function(data){
			console.log('开始游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'buy777'){
		pomelo.request('hall.platformHandler.buyGame',{nid : '1', dayNum : 30}, function(data){
			console.log('购买777',data);
			isExecuting = false;
		});
	}else if(cmd === 'buyindiana'){
		pomelo.request('hall.platformHandler.buyGame',{nid : '4', roomNum : 4}, function(data){
			console.log('购买 夺宝',data);
			isExecuting = false;
		});
	}else if(cmd === 'buyhuoguo'){
		pomelo.request('hall.platformHandler.buyGame',{nid : '3', roomNum : 4}, function(data){
			console.log('购买 火锅',data);
			isExecuting = false;
		});
	}else if(cmd === 'buyxiyouji'){
		pomelo.request('hall.platformHandler.buyGame',{nid : '7', roomNum : 8}, function(data){
			console.log('购买 西游记',data);
			isExecuting = false;
		});
	}else if(cmd === 'buyvip'){
		pomelo.request('hall.shopHandler.buyVip',{vipId: 300}, function(data){
			console.log('购买vip',data);
			isExecuting = false;
		});
	}else if(cmd === 'codeToVip'){
		pomelo.request('hall.mainHandler.changeEnvByCode',{inviteCode: 'MPKP'}, function(data){
			console.log('切换到vip环境',data);
			isExecuting = false;
		});
	}else if(cmd === 'login2'){
		pomelo.init({host:'192.168.1.113', port:'3010'}, function() {
			pomelo.request('gate.mainHandler.login', {id: "15087304794034905"}, function(data) {
				console.log('登录');
				pomelo.disconnect();
				pomelo.init({host:'192.168.1.113', port:'3020'}, function() {
					pomelo.request('connector.entryHandler.entry',{uid:data.uid, token:data.token}, function(entryData){
						console.log('进入游戏大厅',entryData);
						isExecuting = false;
					})
				})
			})
		})
	}else if(cmd === 'login3'){
		pomelo.init({host:'localhost', port:'3010'}, function() {
			pomelo.request('gate.mainHandler.login', {id: '15040089237085159'}, function(data) {
				console.log('登录');
				pomelo.disconnect();
				pomelo.init({host:'localhost', port:'3020'}, function() {
					pomelo.request('connector.entryHandler.entry',{uid:data.uid, token:data.token}, function(entryData){
						console.log('进入游戏大厅',entryData);
						isExecuting = false;
					})
				})
			})
		})
	}else if(cmd === 'login4'){
		pomelo.init({host:'localhost', port:'3010'}, function() {
			pomelo.request('gate.mainHandler.login', {id: '25040089237885159'}, function(data) {
				console.log('登录');
				pomelo.disconnect();
				pomelo.init({host:'localhost', port:'3020'}, function() {
					pomelo.request('connector.entryHandler.entry',{uid:data.uid, token:data.token}, function(entryData){
						console.log('进入游戏大厅',entryData);
						isExecuting = false;
					})
				})
			})
		})
	}else if(cmd === 'inlick'){
		pomelo.request('hall.mainHandler.integralClick',{}, function(data){
			console.log('积分记录',data);
			isExecuting = false;
		});
	}else if(cmd === 'settle'){
		pomelo.request('hall.mainHandler.settleIntegral',{}, function(data){
			console.log('跟新积分记录',data);
			isExecuting = false;
		});
	}else if(cmd === 'initWin'){
		pomelo.request('games.slots777Handler.initWindow',{}, function(data){
			console.log('初始化窗口',data);
			isExecuting = false;
		});
	}else if(cmd === 'hanbao'){
		pomelo.request('hall.mainHandler.enterGame',{nid:'2'}, function(data){
			console.log('进入消消乐房间列表',data);
			pomelo.request('hall.gameHandler.enterRoom',{roomCode:'002'}, function(data){
				console.log('加入房间',data);
				pomelo.request('games.hamburgerHandler.start',{lineNum:25, bet:5}, function(data){
					console.log('开始游戏',data);
					isExecuting = false;
				});
			});
		});
	}else if(cmd === 'hb'){
		pomelo.request('games.hamburgerHandler.start',{lineNum:25, bet:5}, function(data){
			console.log('开始游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'huoguo'){
		pomelo.request('hall.mainHandler.enterGame',{nid:'3'}, function(data){
			console.log('进入火锅房间列表',data);
			pomelo.request('hall.gameHandler.enterRoom',{roomCode:'001'}, function(data){
				console.log('加入火锅房间',data);
				isExecuting = false;
			});
		});
	}else if(cmd === 'grecord'){
		pomelo.request('hall.mainHandler.findGameRecord',{uid:'26777572'}, function(data){
			console.log('游戏记录',data);
			isExecuting = false;
		});
	}else if(cmd === 'inviteMgr'){
		pomelo.request('hall.mainHandler.inviteCodeMgr',{}, function(data){
			console.log('邀请码管理',data);
			isExecuting = false;
		});
	}else if(cmd === 'hbet'){
		pomelo.request('huoguo.mainHandler.bet',{bets:{'l1':10,"r2":20,"s1":20}}, function(data){
			console.log('火锅押注',data);
			isExecuting = false;
		});
	}else if(cmd === 'hbetArea'){
		pomelo.request('huoguo.mainHandler.betAreas',{}, function(data){
			console.log('火锅押注区域',data);
			isExecuting = false;
		});
	}else if(cmd === 'honbank'){
		pomelo.request('huoguo.mainHandler.onBank',{}, function(data){
			console.log('火锅上庄',data);
			isExecuting = false;
		});
	}else if(cmd === 'hoffbank'){
		pomelo.request('huoguo.mainHandler.offBank',{}, function(data){
			console.log('火锅下庄',data);
			isExecuting = false;
		});
	}else if(cmd === 'hdInfo'){
		pomelo.request('huoguo.mainHandler.dealerInfo',{}, function(data){
			console.log('火锅庄家信息',data);
			isExecuting = false;
		});
	}else if(cmd === 'hRoomusers'){
		pomelo.request('huoguo.mainHandler.roomUsers',{}, function(data){
			console.log('火锅房间玩家信息',data);
			isExecuting = false;
		});
	}else if(cmd === 'hH'){
		pomelo.request('huoguo.mainHandler.resultHistory',{}, function(data){
			console.log('火锅结果历史记录',data);
			isExecuting = false;
		});
	}else if(cmd === 'hR'){
		pomelo.request('huoguo.mainHandler.lastRoundHeadWin',{}, function(data){
			console.log('火锅上一回合赢钱前列玩家',data);
			isExecuting = false;
		});
	}else if(cmd === 'hT'){
		pomelo.request('huoguo.mainHandler.todayWin',{}, function(data){
			console.log('火锅今日总赢',data);
			isExecuting = false;
		});
	}else if(cmd === 'LBL'){
		pomelo.request('huoguo.mainHandler.lastBigLottery',{}, function(data){
			console.log('火锅上次大奖',data);
			isExecuting = false;
		});
	}else if(cmd === 'KGZ'){
		pomelo.request('kgz.mainHandler.enterGame',{nid: '20'}, function(data){
			console.log('进入扛杠子游戏',data);
			isExecuting = false;
		});
	}else if(cmd === 'mE'){
		pomelo.request('kgz.mainHandler.enterRoom',{roomCode: '001',position:'east'}, function(data){
			console.log('东 进入扛杠子房间1号',data);
			isExecuting = false;
		});
	}else if(cmd === 'mS'){
		pomelo.request('kgz.mainHandler.enterRoom',{roomCode: '001',position:'south'}, function(data){
			console.log('南 进入扛杠子房间1号',data);
			isExecuting = false;
		});
	}else if(cmd === 'mW'){
		pomelo.request('kgz.mainHandler.enterRoom',{roomCode: '001',position:'west'}, function(data){
			console.log('西 进入扛杠子房间1号',data);
			isExecuting = false;
		});
	}else if(cmd === 'mN'){
		pomelo.request('kgz.mainHandler.enterRoom',{roomCode: '001',position:'north'}, function(data){
			console.log('北 进入扛杠子房间1号',data);
			isExecuting = false;
		});
	}else if(cmd === 'status'){
		pomelo.request('kgz.mainHandler.status',{}, function(data){
			console.log('扛杠子游戏状态',data);
			isExecuting = false;
		});
	}else if(cmd.startsWith('cards')){
		const position = cmd[5] == 'w' ? 'west' : cmd[5] == 's' ? 'south' : cmd[5] == 'e' ? 'east' : 'north'
		pomelo.request('kgz.mainHandler.cards',{position}, function(data){
			console.log('扛杠子游戏状态',data);
			isExecuting = false;
		});
	}else{
		if(cmd[0] == 'p'){
			const arg = cmd.split('-');
			const position = arg[1], 
			first = eval(arg[2]),
			ids = [Number(arg[3]), Number(arg[4])],
			isReturnCard = eval(arg[5]);
			pomelo.request('kgz.mainHandler.pickCard',{position, first, ids, isReturnCard}, function(data){
				console.log(position,'出牌',data);
				isExecuting = false;
			});
		}else if(cmd[0] == 'd'){
			const arg = cmd.split('-');
			const position = arg[1];
			pomelo.request('kgz.mainHandler.discard',{position}, function(data){
				console.log('弃牌',data);
				isExecuting = false;
			});
		}else {
			isExecuting = false;
		}
	}
}