/**
 * Created by yunlong on 13-12-5.
 */



sumeru.router.add(
    {
        pattern: '/home',
        action: 'App.home'
    }
);

sumeru.router.setDefault('App.home');

App.home = sumeru.controller.create(function(env, session){

    env.onrender = function(doRender){
        doRender("home", ['push','left']);
    };

    env.onready = function(viewRoot){
        var status = sumeru.reachability.getStatus();

        console.log("network_status:"+status);
        Library.bMapUtil.getLocation(function(){},function(){});

        session.event('setTarget',function(){
            Library.touch.on("#setTarget","touchend", function(){
                env.redirect('/target');
            });
        });
    }

});
