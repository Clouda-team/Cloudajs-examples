Model.todosModel = function(exports){
	
	exports.config = {
		fields: [
			{name:'task', type:'string',defaultValue:''},
			{name:'completed', type:'boolean',defaultValue:'false'},
			{name:'time', type:'datetime',defaultValue:'now()'}
		]
	};	
};
