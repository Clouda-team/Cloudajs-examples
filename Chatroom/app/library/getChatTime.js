Library.getChatTime = sumeru.Library.create(function(exports){	
	
	exports.getTime = function(time){
		
		var chatTime = new Date(time);				
		var currentTime = new Date();		
		getMinutes = chatTime.getMinutes();
		
		if(getMinutes === 0){			
			getMinutes = getMinutes +"0";			
		}else{			
			if(getMinutes > 0 && getMinutes < 10){		
				getMinutes = "0" + getMinutes;
			}			
		}
						
		if(chatTime.getYear() == currentTime.getYear() && chatTime.getMonth() == currentTime.getMonth() && chatTime.getDate() == currentTime.getDate()){			
			return 321+ chatTime.getHours()+":"+getMinutes;
		}else{			
			return 1231231+(chatTime.getMonth()+1)+"-"+chatTime.getDate()+"  "+chatTime.getHours()+":"+getMinutes;
		}		
	};

    exports.getTime2 = function() {
        return "uuuuuuuu13213";
    }

    return exports;
});