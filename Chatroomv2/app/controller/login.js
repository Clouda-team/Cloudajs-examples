/**
 * 
 * @author     ganxun
 * @version    1.0 
 * @desc       在这个Controller中包含了两种登陆方法：1.使用百度帐号登陆
 * 						     2.无账号登陆
 */

sumeru.router.add(
	{
		pattern: '/login',
		action: 'App.login'
	}
);

sumeru.router.setDefault('App.login');

App.login = sumeru.controller.create(function(env,session){	
	env.onload = function(){		
		return [function(){}];
	};
	
	env.onrender = function(doRender){
		doRender('loading',["push","left"]);
	};
	
	env.onready = function(){		
		var event = 'click';
		//与view中的标签进行绑定
		session.event('login_page', function(){                
        	document.getElementById('loginBaidu').addEventListener(event, linkBaidu);
        	document.getElementById('loginVisitor').addEventListener(event, loginWithVisitor);	    			    		
	    });
		
	};
		
	var linkBaidu = function(){		
	   if(window.localStorage)
	     {
	     	window.localStorage.setItem("tag","baiduer");			             	
	     }
		//通过调用百度帐号登陆
		window.location.href = "http://openapi.baidu.com/oauth/2.0/authorize?response_type=token&" +
                                                                            "client_id= &" +
                                                                            "redirect_uri= &" +
                                                                            "scope=basic&" +
                                                                            "display=mobile";
	};
	
	var loginWithVisitor = function(){		
		var now = new Date();
		
		if(window.localStorage)
	     {
	     	window.localStorage.setItem("tag","visitor");
	     	//使用登陆的时间作为用户的唯一标识	
	     	window.localStorage.setItem("currentUserName",now.getTime());		             	
	     }
	     
		env.redirect("/chatchannel");		
	};
	
});
