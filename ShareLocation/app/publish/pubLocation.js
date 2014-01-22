/**
 * Created by yunlong on 13-12-5.
 */

module.exports = function(fw) {
    fw.publish('location', 'pubLocation', function(options,callback) {
        var collection = this;
        collection.find({groupId:options.groupId}, function(err, items) {
            callback(items);
        });
    })
};