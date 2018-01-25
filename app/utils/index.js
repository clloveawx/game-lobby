'use strict';

const R = require('ramda');
const async = require('async');

/**
 * 数组删除
 * @param  key 需要比较的键 null 表示没有
 * @param  value 需要比较的值
 * @return removeObj
 */
Object.defineProperty(Array.prototype, 'remove', {
	value: function (key, value) {
		let i = value ? this.findIndex(m => m[key] === value) : this.indexOf(key);
		return i === -1 ? null : this.splice(i, 1)[0];
	},
	enumerable: false
});

/**
 * 随机ID
 * @param len 可指定长度
 */
const randomId = exports.randomId = len => Math.random().toString().substr(2, len);

/**
 * 唯一ID
 * 根据时间戳生产
 */
exports.id = () => (Date.now() + randomId(4)).toString();

/**
 * 将数字取整
 */
exports.Int = (num) => Math.floor(num);

/**
 * 根据session获取客户端ip
 * @param session
 */
exports.ip = session => session.__session__.__socket__.remoteAddress.ip.replace('::ffff:', '');

/**
 * 随机一个整数 包括min和max
 * @param  min [最小值]
 * @param  max [最大值]
 * @return {[Number]}
 */
const random = exports.random = function (min, max) {
	let count = Math.max(max - min, 0) + 1;
	return Math.floor(Math.random() * count) + min;
};

// 时间配置
const time = exports.time = {};
time.minute = 60 * 1000;// 分
time.hour = time.minute * 60;// 时
time.day = time.hour * 24;// 天

/**
 * 根据时间戳获取当前00点的时间
 * @param  timestamp [时间戳 不填就是当天]
 * @return {[Number]}
 */
exports.zerotime = function (timestamp) {
	let date = timestamp ? new Date(timestamp) : new Date();
	date.setHours(0, 0, 0, 0);
	return date.getTime();
};

/*
 * 数字 字符串补0
 * 根据长度补出前面差的0
 */
const pad = exports.pad = function () {
	let tbl = [];
	return function (number, length = 2) {
		let len = length - number.toString().length;
		if (len <= 0)
			return number;
		if (!tbl[len])
			tbl[len] = (new Array(len + 1)).join('0');
		return tbl[len] + number;
	};
}();
/*
 * 
 * 随机获取玩家头像信息
 */
exports.getHead = function () {
	let headAll = ['head1', 'head2', 'head3', 'head4', 'head5', 'head6'];
	let head = random(0, headAll.length - 1);
	return headAll[head];
};

/**
 * [{key,value}]
 * 通过Math.random()随机的数判断选择的元素
 */
const selectElement = exports.selectElement = function (proTable) {
	if (Object.prototype.toString.call(proTable) != '[object Array]') {
		throw new Error('传入参数必须为数组');
	}
	const weightSum = proTable.reduce((num, table) => {
		return num + table.value
	}, 0);
	const proDist = {};
	proTable.forEach((table, i) => {
		proDist[table.key] = proTable.slice(0, i + 1).reduce((num, table) => {
			return num + table.value
		}, 0);
	});
	const random = Math.random() * weightSum;
	let resultEle;
	Object.keys(proDist).map(dis => {
		return {
			key: dis,
			value: proDist[dis]
		}
	}).reduce((value, ele) => {
		if (resultEle) {
			return 0;
		}
		if (value > ele.value) {
			return value
		} else {
			resultEle = ele.key;
		}
	}, random);
	return resultEle;
};

/**
 * [{key: value}]
 * 通过Math.random()随机的数判断选择的元素
 */
const selectEle = exports.selectEle = (proTable) => {
	if (Object.prototype.toString.call(proTable) != '[object Array]') {
		throw new Error('传入参数必须为数组');
	}
	const weightSum = proTable.reduce((num, table) => {
		return num + R.values(table)[0];
	}, 0);
	const proDist = [];
	proTable.forEach((table, i) => {
		const e = {
			[Object.keys(table)[0]]: proTable.slice(0, i + 1).reduce((num, table) => {
				return num + table[Object.keys(table)[0]]
			}, 0)
		};
		proDist.push(e);
	});
	const random = Math.random() * weightSum;
	let resultEle;
	proDist.reduce((value, ele) => {
		if (resultEle) {
			return 0;
		}
		if (value > R.values(ele)[0]) {
			return value
		} else {
			resultEle = Object.keys(ele)[0];
		}
	}, random);
	return resultEle;
};

/**
 * 深拷贝
 */
exports.clone = R.clone;

/**
 * 返回第一个成员以外的所有成员组成的新数组
 */
exports.tail = R.tail;

/**
 * 所有成员都满足指定函数时，返回true，否则返回false
 */
exports.all = R.all;

/**
 * 返回最后一个成员以外的所有成员组成的新数组
 */
exports.init = R.init;

/**
 * 返回列表或字符串的最后一个元素
 */
exports.last = R.last;

/**
 *  判断是否为空,包括 null,undefined,{},'',[],
 */
const isVoid = exports.isVoid = (value) => R.isEmpty(value) ? true : R.isNil(value) ? true : false;

/**
 *  生成邀请码
 *  产生任意长度随机字母数字组合
 * randomFlag-是否任意长度 min-任意长度最小位[固定位数] max-任意长度最大位
 */
exports.randomCode = ({ randomFlag, min, max }, callback) => {
	let str = "",
		range = min,
		arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
			'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
		];
	if (max == null) {
		max = min;
	}
	// 随机产生
	if (randomFlag) {
		range = Math.round(Math.random() * (max - min)) + min;
	}

	const uniqueCode = function (cb) {
		let code = '';
		for (let i = 0; i < range; i++) {
			let pos = Math.round(Math.random() * (arr.length - 1));
			code += arr[pos];
		}
		require('./db/mongodb').getDao('player_info').find({ inviteCode: code }, function (err, player) {
			if (err) {
				console.error('查找玩家失败');
			}
			if (!isVoid(player)) {
				uniqueCode(cb);
			} else {
				//去内存查找
				if (require('../domain/hall/player/PlayerMgr').getPlayerByCode(code)) {
					uniqueCode(cb);
				} else {
					return cb(code);
				}
			}
		})
	};
	async.waterfall([
		cb => {
			uniqueCode(function (code) {
				return cb(null, code);
			});
		}
	], function (err, res) {
		return callback(res);
	});
};
/**
 * 返回对象自身的属性的属性值组成的数组。
 */
const values = exports.values = R.values;
/** 
 *  按照给定的一组函数，进行多重排序
 */
exports.sortWith = R.sortWith;

exports.difference = R.difference;

exports.filter = R.filter;

exports.findLastIndex = R.findLastIndex;

exports.sum = (values, toInt = false) =>{
	const type = Object.prototype.toString.call(values);
	if(type == '[object Array]'){
		return toInt ? Math.floor(R.sum(values)) : R.sum(values);
	}else if(type == '[object Object]'){
		return toInt ? Math.floor(R.sum(R.values(values))) : R.sum(R.values(values));
	}else if(type == '[object Number]'){
		return valuers;
	}
};

//将多参数的函数，转换成单参数的形式
exports.curry = R.curry;

/**
 *将数字转换为String （上万加‘W’） 
 */
exports.moneyToString = function (money) {
	let value = Math.abs(money);
	if (value >= 100000000) {
		return (money / 100000000).toFixed(2) + '亿';
	}
	if (value >= 10000) {
		return (money / 10000).toFixed(2) + '万';
	}
	return money;
};

/**
 * 根据当前时间生成 年月日时分秒的键
 * eg 2017-8-28-10-03-59  => 20170828
 */
exports.dateKey = (date) => {
	const now = date ? date : new Date();
	return now.getFullYear().toString() + pad(now.getMonth() + 1, 2) + pad(now.getDate(), 2);
};

/**
 * 根据当前月
 * 
 */
exports.getMonth = () => {
	const now = new Date();
	return now.getFullYear() + '-' + pad(now.getMonth() + 1, 2);
};

/**
 * 根据下个月
 * 
 */
exports.getNextMonth = () => {
	const now = new Date();
	let month = now.getMonth() + 2;
	let year = now.getFullYear();
	if (month === 13) {
		year += 1;
		month = 1;
	}
	return year + '-' + pad(month, 2);
};

/**
 * 获取下个月1号0点的时间戳
 */
exports.nextMonthZeroTime = (time) => {
	const now = new Date(time) || new Date();
	return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
};
exports.simplifyMoney = function (money, num = 10000) {
	const value = Math.abs(money);
	if (value >= 100000000 && value >= num) {
		return parseFloat((money / 100000000).toFixed(2)) + '亿';
	} else if (value >= 10000 && value >= num) {
		return parseFloat((money / 10000).toFixed(2)) + '万';
	} else if (value >= 1000 && value >= num) {
		return parseFloat((money / 1000).toFixed(2)) + '千';
	}
	return money;
};

/**
 * 随机一个下标出来
 * @param  {[Number]} len    [数组长度]
 * @param  {[Number]} count  [需要随机的个数](可不填)
 * @param  {[Number]} ignore [需要忽略的下标](可不填)
 * @return {[Number|Array]}  [如果count大于1 则返回count长度的数组下标 不重复]
 */
exports.randomIndex = function (len, count, ignore) {
	if (len === 0) {
		return -1;
	}
	let indexs = [], _count = count;
	ignore = Array.isArray(ignore) ? ignore : [ignore];
	_count = _count || 1;
	_count = _count > len ? len : _count;
	for (let i = 0; i < len; i++) {
		if (ignore.indexOf(i) !== -1)
			continue;
		indexs.push(i);
	}
	let ret = [];
	for (let i = 0; i < _count; i++) {
		let idx = random(0, indexs.length - 1);
		ret.push(indexs.splice(idx, 1)[0]);
	}
	if (ret.length === 0)
		return -1;
	return count === 1 ? ret[0] : ret;
};

//时间戳转换标准时间
exports.cDate = function (g_times) {
	var time;
	if (g_times == undefined) {
		time = new Date();
	} else {
		time = new Date(g_times);
	}

	var year = time.getFullYear();
	var month = (time.getMonth() + 1) >= 10 ? (time.getMonth() + 1) : ("0" + parseInt(time.getMonth() + 1));
	var day = time.getDate() >= 10 ? time.getDate() : "0" + parseInt(time.getDate());
	var hh = time.getHours() >= 10 ? time.getHours() : "0" + time.getHours();
	var mm = time.getMinutes() >= 10 ? time.getMinutes() : "0" + time.getMinutes();
	var getSeconds = time.getSeconds() >= 10 ? time.getSeconds() : "0" + parseInt(time.getSeconds());
	var gettime = year + "-" + month + "-" + day + ' ' + hh + ":" + mm + ":" + getSeconds;
	return gettime;
}

//根据权重配置随机出其中一个
exports.sortProbability = function (random, _arr) {
	let allweight = 0;
	let section = 0;//区间临时变量
	let arr = _arr.map(m => {
		const obj = {};
		for (let key in m) {
			obj[key] = m[key];
		}
		return obj;
	});
	//排序
	arr.sort((a, b) => {
		return a.probability - b.probability;
	});
	//计算总权重
	for (let i = 0; i < arr.length; i++) {
		allweight += Number(arr[i].probability);
	}

	//获取概率区间
	for (let i = 0; i < arr.length; i++) {
		if (i == 0) {
			let right = (arr[i].probability / allweight);
			arr[i]['section'] = [0, right];
			section = right;
		} else {
			let right = (arr[i].probability / allweight) + section;
			arr[i]['section'] = [section, right];
			section = right;
		}

	}

	for (let i = 0; i < arr.length; i++) {
		if (random >= arr[i].section[0] && random < arr[i].section[1]) {
			return arr[i];
		}
	}
}

//根据长度补充零
//{_string,strLength}字符串，最终字符串长度
exports.supplementZero = function (_string, strLength) {
	let string = _string + '';
	if (string.length > strLength) {
		console.error('传入字符串有误');
		return string;
	}
	let num = strLength - string.length;
	let newStr = '';
	for (let i = 0; i < num; i++) {
		newStr += '0';
	}
	newStr += string;
	return newStr;
}

//求和 1+2+...+n
exports.gsSum = (n) => {
	n = parseInt(n);
	let sum = 0;
	for (let i = 1; i <= n; i++) {
		sum += i;
	}
	return sum;
}

//求平方和
exports.squaresSum = (n) => {
	n = parseInt(n);
	let sum = 0;
	for (let i = 1; i <= n; i++) {
		sum += Math.pow(i, 2);
	}
	return sum;
};

//打乱数组顺序
exports.disorganizeArr = function (arr) {
	let arr_ = [];
	let newArr = [];
	for (let i = 0; i < arr.length; i++) {
		let ob = {};
		ob['name'] = i;
		ob['probability'] = 1;
		arr_.push(ob);
	}

	while (arr_.length) {
		let index = exports.sortProbability(Math.random(), arr_);//随机出一个数组下标
		newArr.push(arr[index.name]);
		for (let i = 0; i < arr_.length; i++) {
			if (arr_[i].name == index.name) {
				arr_.splice(i, 1);
				break;
			}

		}

	}
	return newArr;
}

//查询出最近一条数据
exports.queryRecently = function (db,condition,sortField,cb) {
    db.find(condition,(err,data)=>{
		return cb(data[0]);
	}).sort({[sortField]:-1}).limit(1);
}

//从原始对象中取出目标对象存在的键，赋值
exports.objAssignment = (target, origin) =>{
	for(let i in target){
		if(origin[i]){
			target[i] = origin[i];
		}
	}	
};

//当前时间到指定时间的间隔 targetTime  (默认正序)
exports.timeInterval = (targetTime, order = true) =>{
	let now = Date.now();
	if(!order){
		[now, targetTime] = [targetTime, now];
	}
	if(now >= targetTime){
		return {days: 0, hours: 0, minutes: 0};
	}else{
		const interval = targetTime - now;
		const days = parseInt(interval / time.day);
		const hours = parseInt((interval % time.day) / time.hour);
		const minutes = parseInt((interval % time.hour) / time.minute);
		return {days, hours, minutes};
	}
};

