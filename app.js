'use strict';
const express = require('express');
const apps = express();
const pomelo = require('pomelo');
const sync = require('pomelo-sync-plugin');
const RouteUtil = require('./app/utils/RouteUtil');
const init = require('./init');
const http = require('./app/http/http');
const RequestQueueFilter = require('./app/services/requestQueueFilter');

/**
 * Init app for client.
 */
const app = pomelo.createApp();
app.set('name', '0801-server');

//增加访问控制过滤器
app.configure('production|development', function() {
	app.filter(RequestQueueFilter());
});

//系统管理模块
app.configure('production|development', function() {
  app.enable('systemMonitor');
  const onlineUser = require('./app/modules/onlineUser');
  app.registerAdmin(onlineUser, {app});
});

// 初始化数据库
app.configure('production|development', function() {
  app.loadConfig('mongo', app.getBase() + '/config/db/mongo.json');
  require('./app/utils/db/mongodb').init(app.get('mongo'));
	app.loadConfig('redis', app.getBase() + '/config/db/redis.json');
  require('./app/utils/db/redis').init(app.get('redis'));
	app.use(sync, {sync: {path: __dirname + '/app/dao/mapping', dbclient: {}}});
});

// 网关服务器
app.configure('production|development', 'gate', function() {
  app.set('connectorConfig', {
    connector: pomelo.connectors.hybridconnector,
    //heartbeat: 10,
    useDict: true,
    useProtobuf: true
  });
  app.route('hall', RouteUtil.invalidRoute);
});

// 连接器
app.configure('production|development', 'connector', function() {
  app.set('connectorConfig', {
    connector: pomelo.connectors.hybridconnector,
    heartbeat : 30,
    useDict: true,
    useProtobuf: true,
    handshake : function(msg, cb){
        cb(null, {});
    }
  });
  init.connector(app);
});

// hall
app.configure('production|development', 'hall', function() {
	app.event.on(pomelo.events.START_ALL, function() {
		init.hall(app);
		console.log('大厅服务器启动成功');
	})
});

// slots777服务器
app.configure('production|development', 'slots777', function() {
	app.event.on(pomelo.events.START_ALL, function() {
    init.slots777(app);
		console.log('777服务器启动成功');
	})
});

//埃及服务器
app.configure('production|development', 'pharaoh', function() {
  app.event.on(pomelo.events.START_ALL, function() {
    init.pharaoh(app);
    console.log('埃及服务器启动成功');
  })
});


// 游戏服务器
// app.configure('production|development', 'games', function() {
// 	app.event.on(pomelo.events.START_ALL, function() {
// 		//init.games(app);
// 		console.log('游戏服务器启动成功');
//   })
// });



// 定时器服务器  -（用来处理一些密集型的定时器任务）
app.configure('production|development', 'scheduleJobs', function() {
  app.event.on(pomelo.events.START_ALL, function() {
    //init.scheduleJobs(app);
    console.log('定时器任务服务器启动成功');
  })
});

app.configure('production|development', 'gate|hall|connector', function() {
  switch (app.serverType) {
    case 'gate':
      apps.use('/', http);
      apps.listen(3310, function() {
        console.log("应用实例，访问地址为 3003");
      });
      break;
    case 'hall':
      apps.use('/', http);
      apps.listen(3320, function() {
        console.log("应用实例，访问地址为 3004");
      });
      break;
    case 'connector':
      apps.use('/', http);
      apps.listen(3330, function() {
        console.log("应用实例，访问地址为 3006");
      });
      break;
  }
});

// start app
app.start();

process.on('uncaughtException', function(err) {
  console.error(' Caught exception: ' + err.stack);
});