sumeru.router.add(
	{
		pattern: '/chatroom',
		action: 'App.chatroom',
		server_render:false
	}
);

App.chatroom = sumeru.controller.create(function(env, session){	
	var getMsgs = function(){ 		
		//user OAuth 2.0 get username
		if(window.localStorage){						
			if(window.localStorage.getItem("tag")=="baiduer"){				
				baidu.require('connect', function(connect){
		       		connect.init( 'ajD7G3MvCAff4hHSd6B7VM6U',{
		            	status:true
		       		});
		       		
		       		access_token = window.localStorage.getItem("access_token");		       		
		       		connect.getLoginStatus(function(info){
		       			connect.api({
						 	url: 'passport/users/getLoggedInUser',
						    onsuccess: function(info){
					             user_name = info.uname;
					             user_id = info.uid;
					             
					             if(window.localStorage)
					             {
					             	window.localStorage.setItem("currentUserName",user_name);
					             	window.localStorage.setItem("currentUserId",user_id);
					             	channelname = window.localStorage.getItem("currentChannelName");			             	
					             }
					             					             					             
					            session.chatMessages = env.subscribe('pub-chatRoom',channelname, function(msgCollection){			
									//manipulate synced collection and bind it to serveral view blocks.
						          	session.bind('chatroom_container', {
						              		data    :   msgCollection.find(),
						          	});              						
							    });									             
					        },
					       	onnotlogin: function(){
					        	window.location.href = "http://openapi.baidu.com/oauth/2.0/authorize?response_type=token&" +
                                                                                                    "client_id= &" +
                                                                                                    "redirect_uri= &" +
                                                                                                    "scope=basic&" +
                                                                                                    "display=mobile";
					       	},
					       	params:{
					         	 "access_token": access_token	
					       	}
					 	});
		       		});		       		     		
		 		});								
			}else{				
				if(window.localStorage)
				{
             		//	window.localStorage.setItem("currentUserName","visitor");
             		channelname = window.localStorage.getItem("currentChannelName");			             	
				}

				session.chatMessages = env.subscribe('pub-chatRoom',channelname, function(msgCollection){
					//manipulate synced collection and bind it to serveral view blocks.
		          	session.bind('chatroom_container', {
		              		data    :   msgCollection.find(),
		          	});              						
				});
			}
		}		
	};
	
	//onload is respond for handle all data subscription
	env.onload = function(){            
		return [getMsgs];            
	};
	
	//sceneRender is respond for handle view render and transition
	env.onrender = function(doRender){
		doRender('chatRoom', ['push', 'left']);
	};
	
	//onready is respond for event binding and data manipulate
	env.onready = function(){		
//		clearHistory();	
	
		var event = 'click';
		var keyboardMap = {
        	'enter' : 13
        };
			
		session.event('chatroom_container', function(){
			
        //back
        document.getElementById('roomBackTochannel').addEventListener(event, roomBackTochannel);
        
        //logout 
		document.getElementById("logout").addEventListener(event,logout); 
			
			document.getElementById("messages").style.height = document.body.clientHeight - 80 + "px";
			document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
			                                                
	   	});
	   
	   	window.onresize = function(){
	   		document.getElementById("messages").style.height = document.body.clientHeight - 80 + "px";
			document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
	   	};
	    
		session.eventMap('#inputMessage', {
            'keydown' : function(e){
                if(e.keyCode == keyboardMap.enter){
                    sendMessage();
                }   
            },
            
            'focus' : function(e){
            },
            
            'blur' : function(e){
                if (this.value.trim() == '') {
                };    
            }
    	});
    	    	
        //send message
        document.getElementById("send").addEventListener(event,sendMessage);
	    
	};
	
	var sendMessage = function(){
		var input = document.getElementById('inputMessage'),
	        inputVal = input.value.trim();
	
	  	if (inputVal == '') {
	  		return false; 
	  	};
	  		  	
	  	if(window.localStorage){
	  		username = window.localStorage.getItem("currentUserName");
	        tag = window.localStorage.getItem("tag");
	        channelname = window.localStorage.getItem("currentChannelName");
	    }
	
	  	session.chatMessages.add({
		  	username: username,
		  	content : inputVal, 
		  	time : (new Date()).valueOf() ,
		  	tag: tag ,
		  	channelname: channelname  
	  	});
	
	  	session.chatMessages.save();
	  	input.value = '';
	  	input.focus();	  	
//	  	 session.chatMessages.releaseHold();        
	};
	
	var clearHistory = function(){
		session.chatMessages.destroy();
		session.chatMessages.save();
	};
	
	var roomBackTochannel = function(){
		env.redirect("/chatchannel",{},true);
	};
	
	var logout = function(){				
    	if(window.localStorage){   	
	    	if(window.localStorage.getItem("tag") == "baiduer"){  		
	    		//use connect.js(OAuth2.0 js SDK), logout
	            baidu.require('connect', function(connect){
		       		connect.init( 'ajD7G3MvCAff4hHSd6B7VM6U',{
		            	status:true
		       		});
		       				       		
		       		connect.getLoginStatus(function(info){		       			 
						connect.logout(function(info){
							if(window.localStorage){
								window.localStorage.removeItem("currentUserName");
								window.localStorage.removeItem("currentUserId");
							}							
							env.redirect("/login");
						});
		       		});
		       	});		       	 
	    	}else{					
				if(window.localStorage){
					window.localStorage.removeItem("currentUserName");
					window.localStorage.removeItem("currentUserId");
				}				
				env.redirect("/login");
	    	}
	    }
	};
	
});

