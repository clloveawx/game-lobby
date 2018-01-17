'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const MongoClient = require('mongodb').MongoClient;
mongoose.Promise = require('bluebird');

// 数据库中所有的集合
const tables = new Set([
  'user_info',        //玩家基本信息
  'player_info',      //玩家详细信息
  'system_games',     //系统游戏状态信息
  'system_rooms',     //系统游戏的所有房间

  'platform',         //vip平台基础信息
  'platform_games',   //vip平台所有的游戏
  'platform_rooms',   //vip平台所有的房间

	'change_integral',  //玩家积分增减记录
	'purchase_record',  //vip游戏购买记录
  'vip_apply',        //vip申请

  'mails',            //邮件
  'customer_info',    //客服相关
  'record_coin',      //游戏消费记录
  'integral_record',  //积分记录
  'indianaWins',      //太空夺宝的游戏结果集
  'pharaoh',          //埃及夺宝的游戏结果集
  'game_record',      //金币场游戏记录
  'card_record',      //充值卡记录
  'invite_code_info', //邀请码记录
  'pay_info',         //充值记录


  'promoter_info',
  'player_login_record',
  'pay_image',
  'close_game',
  'add_gold_rebates',
  'gold_back_record',
  'big_post_notice',
    'save_card_things',
    'warn_value',
    'roulette_record',   //轮盘开奖记录
    'daily_indiana',     //每日夺宝
    'daili_add_money',
    'close_pay',
    'pay_record',
    'add_gold_record',
    'ai_add_money_recoed',
    'close_card',
    'ranking_record',
    'starting_gold',     //启动金活动
    'indiana_record',    //夺宝游戏内存记录
    'slots_record',      //slots游戏内存记录
    'ATT_data',
]);
// 模型
const mongoModel = {};

/**
 * 初始化数据库
 */
exports.init = function(config) {
  mongoose.connection.on('connected', function(err) {
    if (err) {
      console.error('mongodb connection failure');
    } else {
      console.log('mongodb connection succeed');
    }
  });

  mongoose.connection.on('error', function(err) {
    console.error('mongodb error ' + err);
  });

  let uri = "mongodb://" + config.host + ":" + config.port + "/" + config.name;
  if (config.user) {
    uri = 'mongodb://' + config.user + ':' + config.pwd + '@' + config.host + ":" + config.port + "/" + config.name;
  }
  mongoose.connect(uri, {
    useMongoClient: true
  });
};

/**
 * 获取model
 */
exports.getDao = function(table_name) {
  if (!table_name || !tables.has(table_name)){
    console.error('No table structure ', {table_name});
    return null;
  }
  let model = mongoModel[table_name];
  if (!model){
    model = require('./collections/'+table_name+'.js').model;
    mongoModel[table_name] = model;
  }
  return model;
};