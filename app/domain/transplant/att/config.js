/**
 * Created by 14060 on 2017/12/29.
 */
'use strict';
//牌型概率
const SuitPatterns = [
    {name: 'AA',probability: 0.18},
    {name: 'AABB',probability: 0.15},
    {name: 'AAA',probability: 0.06},
    {name: 'AB(E)CD',probability: 0.07},
    {name: '(A)BCDE(F)',probability: 0.05},
    {name: '(A)BCD(E)',probability: 0.09},
    {name: '&&&&',probability: 0.13},
    {name: '&&&',probability: 0.12},
    {name: 'ABCD',probability: 0.02},
    {name: 'ABC',probability: 0.13},
]
module.exports = {
    SuitPatterns:SuitPatterns
}