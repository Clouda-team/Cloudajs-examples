Model.chatroomModel = function(exports){
	
	exports.config = {
		fields: [
			{name:'username', type:'string'},
			{name:'message', type:'string'},
			{name:'time', type:'datetime',defaultValue:'now()'}
		]
	};	
};
