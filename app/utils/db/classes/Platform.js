'use strict';

// 平台基础信息
class Platform {

	constructor (opts) {

		this.creator = opts.creator;  // 平台创建者
		this.members = opts.members || [];            // 当前平台下的用户列表
		this.envMembers = opts.envMembers || [];      //当前正处于该平台环境下的玩家列表

		this.vipModel = opts.vipModel;                  //平台当前的模式
		this.afterModel = opts.afterModel;              //平台切换的模式
		this.modelEffectTime = opts.modelEffectTime;    //当前模式的失效时间

		this.concatWay = opts.concatWay;                //联系方式
		this.concater = opts.concater;                  //联系方

		this.gameMembers = opts.gameMembers || {};      //当前该平台每个游戏的玩家列表
	}

	addMember (uid){
		this.members.push(uid);
	}

	addEnvMembers ({uid, sid}){
		this.envMembers.push({uid, sid});
	}

	removeMember(uid){
		const index = this.members.findIndex(u => u == uid);
		if(index != -1){
			this.members.splice(index, 1);
		}
	}

	removeEnvMember(uid){
		const index = this.envMembers.findIndex(u => u.uid == uid);
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
		if(!this.gameMembers[nid]){
			return;
		}
		const index = this.gameMembers[nid].findIndex(u => u === uid);
		this.gameMembers[nid].splice(index, 1);
	}
}

module.exports = Platform;