module.exports = function(fw){

	fw.publish('chatChannelModel', 'pub-chatchannel', function(tag,callback){

		var collection = this;

		collection.find({}, {sort:[['time',-1]]}, function(err, items){
			callback(items);
		 });
	},{
		beforeInsert : function(serverCollection, structData, userinfo, callback){
           
            structData.time = (new Date()).valueOf();           // 以服务器时间为准
           
            callback(structData);
       }
	});   
}