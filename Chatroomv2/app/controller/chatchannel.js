/**
 * 
 * @author     ganxun(ganxun@baidu.com)
 * @version    1.0 
 * @desc       
 */


sumeru.router.add(
	{
		pattern: '/chatchannel',
		action: 'App.chatchannel',
		server_render:false
	}
);

App.chatchannel = sumeru.controller.create(function(env,session){	
	var getMsgs = function(){
		session.messages = env.subscribe('pub-chatchannel', function(msgCollection){
          	session.bind('chatChannel', {
              	data    :   msgCollection.find(),
          	});              
	    });
	}
	
	env.onload = function(){		
		return [getMsgs];
	};
	
	env.onrender = function(doRender){
		doRender('chatchannel',["push","left"]);
	};
	
	env.onready = function(){
		
//		document.getElementById("channel").style.height = document.body.clientHeight - 40 + "px";
//		clearHistory();   
		var event = 'click';		
		session.event('chatChannel', function(){  			                      	       	
        	document.getElementById('channel').addEventListener(event, function(e){
        		var e = e || window.event,
					target = e.target || e.srcElement;
				
				if(target.tagName.toLowerCase() == 'button' && target.hasAttribute('channelName')){
					var channelName = target.getAttribute('channelName');
					if(window.localStorage)
		             {
		             	window.localStorage.setItem("currentChannelName",channelName);			             	
		             }
		             env.redirect("/chatroom",{channel:channelName},true);
				}				
        	});	
        	
        	document.getElementById('back').addEventListener(event, back);
        	document.getElementById('create').addEventListener(event, createChannel);    			    		
	    });
		
	};
	
	var back = function(){
		env.redirect("/login");
	};
	
	var createChannel = function(){
		env.redirect("/createchannel");
	};
		
	var clearHistory = function(){
		session.messages.destroy();
		session.messages.save();
	};
	
});
