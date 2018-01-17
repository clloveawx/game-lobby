//AI等级
const AI = [
	{name:'A',probability:1},
    {name:'B',probability:4},
    {name:'C',probability:10},
]
//AI初始金币和积分
const AIGold = {
    'A':100000,
	'B':20000,
	'C':10000
}
//time
const robotTime = {
    'A':3600000,
    'B':7200000,
    'C':18000000
}
// 机器人配置
module.exports = {
    AI:AI,//AI等级
    AIGold:AIGold,//AI初始金币
    robotTime:robotTime
};