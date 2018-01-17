"use strict";

/** filter中记录输入和输出的当前处理量，
 * 判断当前有多少个api的handler被调用，
 * 设定高低阀值。超过高阀值，则只把next回调函数在queue中存起来，
 * 等到低阀值以后再取一定数量的请求调用next进行处理。
 */

module.exports = function () {
    return new RequestQueueFilter();
};

let RequestQueueFilter = function () {
    this.requestQueue = []
};

let msgTotalInCount = 0; //总共消息进入总数
let msgTotalOutCount = 0; //总共消息退出总数
let apiFilterWaitCount = 0; //总共等待调用的接口数量
let apiFilterWaitCountHighLimit = 100; //等待调用的接口上限阈值
let apiFilterWaitCountLowLimit = 30; //等待调用的接口的下限阈值

RequestQueueFilter.prototype.before = function (msg, session, next) {
    // console.log("msgTotalInCount=%s", msgTotalInCount++);
    if (this.requestQueue.length > 0) {
        //push to queue
        this.requestQueuePush({next: next});
    } else {
        if (apiFilterWaitCount < apiFilterWaitCountHighLimit) {
            //push to api
            apiFilterWaitCount++;
            // console.log("[direct]apiFilterWaitCount++ : %s", apiFilterWaitCount);
            next();
            return
        } else {
            //push to queue
            this.requestQueuePush({next: next});
        }
    }

    if (apiFilterWaitCount < apiFilterWaitCountLowLimit) {
        // console.log("[BeforeCallQueue]");
        this.handlerQueue();
    }
};

RequestQueueFilter.prototype.after = function (err, msg, session, resp, next) {
    apiFilterWaitCount--;
    // console.log("apiFilterWaitCount-- : %s", apiFilterWaitCount);
    // console.log("msgTotalOutCount=%s", msgTotalOutCount++);
    if (apiFilterWaitCount < apiFilterWaitCountLowLimit) {
        // console.log("[AfterCallQueue]");
        this.handlerQueue();
    }
    return next(err, msg);
};

RequestQueueFilter.prototype.handlerQueue = function () {
    let handlerQueueCount = apiFilterWaitCountLowLimit - apiFilterWaitCount;
    // console.log("[doHandlerQueue]lowLimit : %s,waitCount : %s,queueCount : %s", apiFilterWaitCountLowLimit, apiFilterWaitCount, handlerQueueCount);
    for (let i = 0; i < handlerQueueCount && i < this.requestQueue.length; i++) {
        let handlerNextItem = this.requestQueue.shift();
        // console.log("[queue]pop : %s", this.requestQueue.length);
        apiFilterWaitCount++;
        // console.log("[queue]apiFilterWaitCount++ : %s", apiFilterWaitCount);
        process.nextTick(function () {
            handlerNextItem.next();
        })
    }
};

RequestQueueFilter.prototype.requestQueuePush = function (queueItem) {
    this.requestQueue.push(queueItem);
    // console.log("[queue]push : %s", this.requestQueue.length);
};