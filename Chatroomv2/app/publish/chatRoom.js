module.exports = function(fw){

	fw.publish('chatRoomModel', 'pub-chatRoom', function(channelName,callback){

		var collection = this;
				
		collection.find({'channelname':channelName}, {sort:[['time',1]]}, function(err, items){
			callback(items);
		 });
	},{
		beforeInsert : function(serverCollection, structData, userinfo, callback){
           
            structData.time = (new Date()).valueOf();           // 以服务器时间为准
           
            callback(structData);
            
      	}
	});   
}
