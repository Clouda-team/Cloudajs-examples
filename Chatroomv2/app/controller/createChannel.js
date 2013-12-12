sumeru.router.add(
	{
		pattern: '/createchannel',
		action: 'App.createchannel'
	}
);

App.createchannel = sumeru.controller.create(function(env,session){	
	var getMsgs = function(){		
		session.messages = env.subscribe('pub-chatchannel', function(msgCollection){
			msgCollection.addSorters("time","DESC");
			//manipulate synced collection and bind it to serveral view blocks.
          	session.bind('createChannel', {
              	data    :   msgCollection.find(),
          	});              
	    });
	}
	
	env.onload = function(){		
		return [getMsgs];
	};
	
	env.onrender = function(doRender){
		doRender('createchannel',["push","left"]);
	};
	
	env.onready = function(){		
		document.getElementById("messages").style.height = document.body.clientHeight - 40 + "px";
		var event = 'click';
		var keyboardMap = {
            'enter' : 13
        };
        
		session.event('createChannel', function(){					
			session.eventMap('#inputChannelName', {     			
     				//enter on pcs, return on mobile
				'keydown' : function(e){
                    if(e.keyCode == keyboardMap.enter){
                        createChannel();
                    }   
                },
                
                'focus' : function(e){
                    session.messages.hold();
                },
                
                'blur' : function(e){
                    if (this.value.trim() == '') {
                        session.messages.releaseHold();  
                    };    
                }
            });
						                
        	document.getElementById('backTochannel').addEventListener(event, backTochannel);
        	document.getElementById('ok').addEventListener(event, createChannel);	    			    		
	    });
		
	};
	
	var backTochannel = function(){
		env.redirect("/chatchannel");
	};
	
	var createChannel = function(){
		var input = document.getElementById('inputChannelName'),
	        inputVal = input.value.trim();
	
	  	if (inputVal == '') {
	  		return false; 
	  	};
	
	  	session.messages.add({
		  	channelname: inputVal, 
		  	time : (new Date()).valueOf() ,
		  	describe : '',
	  	});
	
	  	session.messages.save();
	  	input.value = '';   
	  	
	  	session.messages.releaseHold(); 		
		env.redirect("/chatchannel");
	};	
});
