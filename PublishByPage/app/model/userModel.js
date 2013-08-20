Model.sduser = function(exports){
    exports.config = {
        fields: [
            {name: 'name',  type: 'string', defaultValue: 'John'},
            {name: 'age',  type: 'int', defaultValue: '26'},
            {name:'time', type:'datetime',defaultValue:'now()'}
        ]
    };
};