module.exports = function(fw){
    fw.publish('sduser', 'pub-sduser', function(callback){
        var collection = this;
        collection.find({}, {sort : {'age' : -1}}, function(err, items){
            callback(items);
        });
    }, function(){
        fw.log('publish end');
    });
}