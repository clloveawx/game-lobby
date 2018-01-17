'use strict';

// 平台
class Platform {

	constructor (opts) {
		this.id = opts.id;
		this.creator = opts.creator;  // 平台创建者
		this.games = [];              // 平台下的游戏列表
		this.invitationCode = opts.invitationCode || '';     // 邀请码
		this.members = opts.members || [];            // 当前平台下的用户列表
		this.envMembers = opts.envMembers || [];      //当前正处于该平台环境下的玩家列表
		

		this.vipModel = opts.vipModel;                  //平台当前的模式
		this.afterModel = opts.afterModel;              //平台切换的模式
		this.modelEffectTime = opts.modelEffectTime;    //当前模式的失效时间

		this.concatWay = opts.concatWay;
		this.concater = opts.concater;

        this.gameMembers = opts.gameMembers || {};
	}
	
	//更新模式
	updateModel ({model, auto}) {
		if(!['common', 'discount', 'monthly'].includes(model)){
			return {error: '参数错误' + model};
		}
		if(auto){
			this.vipModel = model;
			this.modelEffectTime = require('../../utils').zerotime(Date.now() + 1000 * 60 * 60 * 24 * 30);
		}else{
			this.afterModel = model;
		}
	}

	// 初始化
	initInvitationCode (code) {
		this.invitationCode = code;
	}

	addGame (game) {
		this.games.push(game);
	}

	getGame (nid) {
		return this.games.find(game => game.nid === nid);
	}

	addMember (user){
		this.members.push(user);
	}

	addEnvMembers (user){
		this.envMembers.push(user);
	}

	removeMember(uid){
		const index = this.members.findIndex(m => m.uid == uid);
		if(index != -1){
			this.members.splice(index, 1);
		}
	}

	removeEnvMember(uid){
		const index = this.envMembers.findIndex(m => m.uid == uid);
		if(index != -1){
			this.envMembers.splice(index, 1);
		}
	}
    addGameMember(nid, uid){
        if(!this.gameMembers[nid]){
            this.gameMembers[nid] = [];
        }
        this.gameMembers[nid].push(uid);
    }
    removeGameMember(nid, uid){
        const index = this.gameMembers[nid].findIndex(m => m === uid);
        this.gameMembers[nid].splice(index,1);
    }
}

module.exports = Platform;