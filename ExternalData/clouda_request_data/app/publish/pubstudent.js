module.exports = function(fw){

	fw.publish('student', 'pubstudent', function(callback){
		var collection = this;
		collection.find({}, function(err, items){
			callback(items);
		});
	});
	
	
	fw.publish('student', 'pubext', function(callback){

		var collection = this;
		collection.extfind('pubext', callback);

	});
	
}