Model.student = function(exports){
	exports.config = {
		fields : [
			{ name : 'name', type : 'text'},
			{ name : 'age', type : 'int', defaultValue : 0}
		]
	} 
}