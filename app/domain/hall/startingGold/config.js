'use strict';

let activation = true;
let limit = 100;  
let day = 1;  //第几天
let info ={};
class ACTIVE {
    constructor(){
        this.activation = true;
        this.limit = 100;
        this.day = 1;
    }
    grade(i){   //第i天可领取的数量
        return 2000 + 500 * (i - 1);
    }
    reset(){
        this.activation = false;
        this.day = 1;
        return this;
    }
    update(opts){
        this.activation = opts.activation || true;
        this.day = opts.day || 1;
    }
}
const active = new ACTIVE(); 

Object.assign(module.exports, {
    init(){
        return active;
    },
});