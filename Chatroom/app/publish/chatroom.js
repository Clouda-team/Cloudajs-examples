module.exports = function(fw){
	fw.publish('chatroomModel', 'pub-chatRoom', function(callback){
		var collection = this;
		console.log('publish run.......');		
		collection.find({}, {sort:[['time',1]]}, function(err, items){
			callback(items);
		 });
	},{
		beforeInsert : function(serverCollection, structData, userinfo, callback){
            structData.time = (new Date()).valueOf();           // 以服务器时间为准           
            callback(structData);           
      	}
	});   
}
