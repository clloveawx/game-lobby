'use strict';

const db = require('../../../utils/db/mongodb');
const logger = require('pomelo-logger').getLogger('log', __filename);

const propsAll = [];// 当前所有的道具信息

exports.propsAll = () => propsAll;


// 添加一个道具信息到内存
exports.addProps = function (props) {
	propsAll.push(props);
};

// 获取道具信息
exports.getProps= function () {
	return propsAll;
};

//根据邀请码来查找
exports.getPropsforinviteCode = function (inviteCode,uid) {
	const  props = propsAll.filter(ele =>ele.inviteCode == inviteCode);
  	const  selfProps =  props.filter(ele =>ele.sellerId == uid);
  	const  otherProps = props.filter(ele =>ele.sellerId != uid);
  	 	selfProps.sort(function(a, b){  
		    return a.creatTime < b.creatTime ? 1 : -1;  
		});

		otherProps.sort(function(a, b){  
		    return a.creatTime < b.creatTime ? 1 : -1;  
		});
	const	isProps =  selfProps.concat(otherProps);
	console.log(isProps);

	return isProps;
};


//根据id来查找
exports.getPropsforId = function (id) {
	return propsAll.find(ele =>ele.id == id);
};

//根据sellerId来查找所有的
exports.getPropsforSellerId= function (inviteCode,sellerId) {
	const  props = propsAll.filter(ele =>ele.inviteCode == inviteCode);
	return props.filter(ele =>ele.sellerId == sellerId);
};


// 删除内存中的道具信息
exports.removeProps = function (id) {
	const index =  propsAll.findIndex(props => props.id == id);
	propsAll.splice(index, 1);
};

// 定时更新数据库
// exports.updateDB = function () {
// 	const dao = db.getDao('props_info');
// 	for (let key in propsAll) {
// 		(function (props) {
// 			dao.update({id: props.id}, {$set: props.wrapDatebase()}, function(err, res) {
// 				err && logger.error(props.id, '保存数据库失败');
// 			});
// 		})(propsAll[key]);
// 	}
// };