/**
 *
 * @author     ganxun
 * @version    1.0
 * @desc
 *
 */

sumeru.router.add(

	{
		pattern: '/cloudaauth',
		action: 'App.cloudaAuth'
	}

);

//sumeru.router.setDefault('App.itworks');


App.cloudaAuth = sumeru.controller.create(function(env, session){

	env.onrender = function(doRender){
		doRender("cloudaAuth", ['push','left']);
	};

	var myAuth = sumeru.auth.create(env);

	env.onready = function(){
		document.getElementById('login').addEventListener('click',login); 
		document.getElementById('register').addEventListener('click',goToRegister); 
		document.getElementById('logout').addEventListener('click',logout);

		//定义用户事件，这是一个全局的事件
		var statusChangeHandle = function(err,status){
		    if(err){
		        // err.code | err.msg
		        alert("登录失败！错误信息："+err.msg+"  ----"+status);
		        return;
		    };

		    switch(status){
		        case "not_login" :
		            // 未登录
		            break;
		        case "logined" :
		            // 已登录
		            document.getElementById('popup').style.display = "none";
		            userInfo = myAuth.getUserInfo();
		          	document.getElementById('show_userinfo').innerHTML = "username:"+userInfo.token+"  gender:"+userInfo.info.gender+"  userid:"+userInfo.userId;
		            break;
		        case "doing_login" :
		            // 登录中
		            document.getElementById('popup').style.display = "block";
		            break;
		        default:
		            // do something
		    }
		}
		//增加用户时间监听器，包括已登录、未登录、登录中等等，执行后就会根据当前的状态触发一次绑定用户事件
		myAuth.on('statusChange',statusChangeHandle);
	};
	//跳转到注册页面
	var goToRegister = function(){
		env.redirect('/register');
	};

	var logout = function(){
		myAuth.logout();
		document.getElementById('show_userinfo').innerHTML = "";
		alert("退出成功！");
	};

	//完成登陆验证
	var login = function(){
		var username = document.getElementById('username').value;
        var password = document.getElementById('password').value;
        var age = document.getElementById('age').value;
        var userInfo;

		//登录，登陆过程中每一次状态改变都会触发用户“statusChange”
		myAuth.login(username,password,{age:age},'local');

	};

});