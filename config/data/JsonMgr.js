'use strict';

const tables = {};// 所有表


/**
 * 初始化 加载配置文件到内存中
 */
exports.init = function (type, cb = function () {}) {

	const wrap = function (name, datas) {
		tables[name] = {
			datas: datas,
			getById (id) {
				return this.datas.find(m => m.id === id);
			},
			get (key, value){
				return this.datas.filter((m)=> m[key] === value);
			}
		};
	};
	
	if(type === 'server'){// 服务器
		const fs = require('fs');
		const path = require('path');
		const filename = path.join(path.dirname(__dirname).replace('app', ''), 'data/');
		fs.readdir(filename, function(err, files) {
			if(err){
				console.error('加载配置文件出错', err);
				return cb();
			}
			files = files.filter(m => m.endsWith('.json'));// 过滤掉后缀不是json的文件

			for (let i = files.length - 1; i >= 0; i--) {
				const file = path.join(path.dirname(__dirname).replace('app', ''), 'data/'+files[i]);
				const datas = JSON.parse(fs.readFileSync(path.normalize(file)));
				wrap(files[i].replace('.json', ''), datas);
			}
			cb();
		});
	} else { // 客户端
		// cc.loader.loadRes('data', function(err,res){  
		//     if (err) {  
		//         cc.log(err);  
		//     }else{  
		//         let list=res;  
		//         cc.log("loadRes:");  
		//         cc.log("list:"+list.sex);  
		//     }  
		//     cb();
		// });
	}
};

// 获取表
exports.get = tableName => tables[tableName];

exports.getAll = () => tables;