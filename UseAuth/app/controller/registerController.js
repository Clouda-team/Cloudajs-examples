/**
 *
 * @author     ganxun
 * @version    1.0
 * @desc
 *
 */

sumeru.router.add(
    {
        pattern: '/register',
        action: 'App.register'
    }
);

App.register = sumeru.controller.create(function(env, session){

    env.onrender = function(doRender){
        doRender("register", ['push','left']);
    };

    var myAuth = sumeru.auth.create(env);
    env.onready = function(){
        document.getElementById('submit').addEventListener('click',userRegister);       
    };

    var userRegister = function(){
        var username = document.getElementById('register_username').value;
        var password = document.getElementById('register_password').value;
        var age = document.getElementById('register_age').value;
        var genderValue = document.getElementsByName("register_gender");
        var gender;
        for(var i=0;i<genderValue.length;i++)
        {
            if(genderValue[i].checked){
                gender=genderValue[i].value;
                break;    
            }              
        }

        myAuth.registerValidate({token:username,age:age},'local',function(err,isUsefull){
            if(isUsefull){
                // 注册信息验证成功，可以进行注册
                myAuth.register(username,password,{age:age,gender:gender},'local',function(err){
                    if(err){
                        // 注册失败
                        alert("zhuceshibai!");
                        return;
                    }
                    env.redirect('/cloudaauth');
                });
            }else{
                // 注册信息验证失败
                //err.code || err.msg
                alert("验证失败，error code:"+err.code+" ,error message："+err.msg);
            }
        });
    };

});
