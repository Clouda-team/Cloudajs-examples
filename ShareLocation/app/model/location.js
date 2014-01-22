/**
 * Created by yunlong on 13-12-5.
 */
Model.location = function(exports){
    exports.config = {
        fields : [
            { name : 'userId', type : 'string'},
            { name : 'name', type : 'string'},
            { name : 'groupId', type : 'string'},
            { name : 'roleStatus', type : 'string'},
            { name : 'coordinate', type : 'array',defaultValue:'[]'}
        ]
    }
}