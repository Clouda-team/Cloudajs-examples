module.exports = function(fw){
	fw.publish('todosModel', 'pub-todos', function(tag,callback){
        var collection = this;

        if(tag=="all"){
            collection.find({}, {}, function(err, items){
                callback(items);
            });
        }else if(tag=="active"){
            collection.find({"completed":false}, {}, function(err, items){
                callback(items);
            });
        }else if(tag=="completed"){
            collection.find({"completed":true}, {}, function(err, items){
                callback(items);
            });
        }
	});
}