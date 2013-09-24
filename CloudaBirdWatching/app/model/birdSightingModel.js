Model.birdSightingModel = function(exports) {
    exports.config = {
        fields : [
            {name : 'name', type : 'string', validation:"birdName"},
            {name : 'location', type : 'string'},
            {name : 'date', type : 'datetime', defaultValue : 'now()'}
        ]
    };
};
