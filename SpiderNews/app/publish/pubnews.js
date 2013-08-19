/**
 * Created with JetBrains WebStorm.
 * User: yunlong
 * Date: 13-8-17
 * Time: 下午7:06
 * To change this template use File | Settings | File Templates.
 */
module.exports = function(fw){

    fw.publish('news','pubnews',function(callback){

        var collection = this;
        collection.extfind('pubnews',callback);
    });

}