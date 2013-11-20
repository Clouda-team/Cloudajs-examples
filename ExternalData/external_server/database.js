// 数据库配置信息
var db_name = 'ceaszXllQwajxKgPiDuU';                  // 数据库名，从云平台获取
//var db_name = 'test';								   //local

var db_host =  process.env.BAE_ENV_ADDR_MONGO_IP || '127.0.0.1';      // 数据库地址
var db_port =  +process.env.BAE_ENV_ADDR_MONGO_PORT || '27017';   // 数据库端口
var username = process.env.BAE_ENV_AK;                 // 用户名
var password = process.env.BAE_ENV_SK;

//mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]

function getDbPath (){
	
	var path = 'mongodb://';
	if(username){ path += username + ':'; }
	if(password){ path += password + '@'; }
	
	path += db_host + ':';
	path += db_port + '/';
	path += db_name + '/';
	
	return path;
	
}

module.exports = {
	getDbPath : getDbPath
};