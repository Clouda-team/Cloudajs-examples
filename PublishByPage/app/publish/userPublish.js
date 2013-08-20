module.exports = function(fw){
    fw.publishByPage('sduser', 'pub-sduser', function(options,callback){
        var collection = this;
        console.log(options.pagesize);
        collection.find({}, {sort : {'time' : -1}, limit : options.pagesize, skip : (options.page - 1) * options.pagesize}, function(err, items){
            callback(items);
        });
    }, function(){
        fw.log('publish end');
    });

    //发布数据库的大小
    fw.publishPlain('sduser', 'pub-modelCount', function(callback){
        var collection = this;
        collection.count({},function(err, count){
            callback(count);
        });
    });
}