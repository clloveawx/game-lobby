
const promise = require('bluebird');


const ss = (uid, cb) =>{
	setTimeout(function(){
		cb('111111111111111')
	}, 3000)
}
promise.promisify(ss).then((result) =>{
	console.log(result)
}).catch(err =>{
	console.log(err)
})