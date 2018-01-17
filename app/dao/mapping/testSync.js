const redisClient = require('../../utils/db/redis').client;

module.exports = {
    updateTest: (dbclient, value, callback) =>{
        console.error('执行======================')
        const tableName = "sync-test";
        const Dao = dbclient.getDao(tableName);
        Redis.get('name', function(err, value){
            if(err){
                console.error('redis查值失败',err)
            }else{
                Dao.update({name: value},{$set: {name: value}}, {upsert: true}, function(err,res){
                    console.log('更新成功')
                    return callback();
                });
            }

        })
        // Redis.getFromRedis(value.redisKey, needToUpdate => {
        //     if (!needToUpdate) {
        //         return;
        //     }
        //     Dao.update({id: needToUpdate.id}, needToUpdate, {upsert: true}, function (error, data) {
        //     });
        // });
    }
};