/**
 *
 * @author     ganxun
 * @version    1.0
 * @desc
 *
 */

sumeru.router.add({
    pattern    :   '/publishbypage',
    action  :   'App.publishByPage'
});

sumeru.router.setDefault('App.publishByPage');

App.publishByPage = sumeru.controller.create(function(env, session){

    var getUserlist = function(){

        if(!session.get('pageNum')){
            session.set('pageNum',1);
        }

        if(!session.get('pagesize')){
            session.set('pagesize',2);
        }

        var pageOptions = {
            pagesize : session.get('pagesize'), //每页显示的数目
            page : session.get('pageNum'), //当前页
            uniqueField : 'time' //排序的唯一字段
        };

        session.sduser = env.subscribeByPage('pub-sduser',pageOptions,function(sduserCollection,info){
            //manipulate synced collection and bind it to serveral view blocks.
            var page = info.page;

            session.bindByPage('sduserlist', {
                page: page,//返回的当前页数
                data: sduserCollection.find()
            });
        });
    }

    //获取数据库的大小
    var getModelCount = function(){
        env.subscribe('pub-modelCount', function(count){
            session.set('modelCount',count/session.get('pagesize'));  
        });
    }

    //对于每一个loader，自动创建一个闭包。 监听其中session、collection的改变，作为reactive的source
    env.onload = function(){
        return [getUserlist,getModelCount];
    };

    env.onrender = function(doRender){
        doRender('display', ['rotate','left']);
    };

    env.onready = function(doc){
        session.event("sduserlist",function(){
            var event = "click";

            if(!!('ontouchstart' in window)){
                event = 'touchstart';
            }

            if(session.get('pageNum')==1 || session.get('pageNum')<1){
                document.getElementById('pre').disabled = true;
            }else{
                document.getElementById('pre').disabled = false;
            }

            if(session.get('pageNum')==session.get('modelCount') || session.get('pageNum')>session.get('modelCount')){
                document.getElementById('next').disabled = true;
            }else{
                document.getElementById('next').disabled = false;
            }

            //下一页
            document.getElementById('pre').addEventListener(event, function(){
                var pageNum = session.get('pageNum');
                pageNum--;

                session.set('pageNum',pageNum);
                session.commit();
            });

            //上一页
            document.getElementById('next').addEventListener(event, function(){
                var pageNum = session.get('pageNum');
                pageNum++;

                session.set('pageNum',pageNum);
                session.commit();
            });
        });

        //保存
        Library.touch.on('#sdsave', 'touchstart', function(){
            var name = document.getElementById('sdname').value;
            var age = document.getElementById('sdage').value;

            if(!name){
                name = "John";
            }

            if(!age){
                age="27";
            }
            session.sduser.add({"name":name,"age":age})
            session.sduser.save();
        });
    };
});
