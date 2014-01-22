/**
 * Created by yunlong on 13-12-11.
 */
Library.generateId = sumeru.Library.create(function(exports){
    exports.generateUserId = function(){
        return sumeru.clientId;
    };

    exports.getUserId = function(){
        if(!this.userId) {
            this.userId = this.generateUserId();
        }

        return this.userId;
    };

    //未加密
    exports.generateGroupId = function(){
        return this.getUserId() + '_' + new Date().getTime();
    };

    exports.getGroupId = function(){
        if(!this.groupId) {
            this.groupId = this.generateGroupId();
        }

        return this.groupId;
    };

    exports.isAdministrator = function(groupId){
        var arr = groupId.split('_');
        arr.pop();
        return this.getUserId() === arr.join('_');
    }

    return exports;
});
