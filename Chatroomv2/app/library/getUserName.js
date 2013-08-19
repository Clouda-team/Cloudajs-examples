Library.getUsername = sumeru.Library.create(function(exports){	
	
	exports.getUsername = function(){
		
		if(window.localStorage.getItem("currentUserName")){
			return window.localStorage.getItem("currentUserName");
		}else{
			
		}
		
	};
	
	return exports;
});