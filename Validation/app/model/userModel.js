Model.sduser = function(exports){
    exports.config = {
        fields: [
            {name: 'name',  type: 'string', validation:'length[1,20]|unique'},
            {name: 'age',  type: 'int', validation:'length[1,3]|number'},
            {name: 'userid',   type: 'int'}
        ]
    };

};
