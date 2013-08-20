/**
 *
 * @author     ganxun
 * @version    1.0
 * @desc
 *
 */


sumeru.router.add({
    pattern    :   '/savewithvalidation',
    action  :   'App.saveWithValidation'
});

sumeru.router.setDefault('App.saveWithValidation');

App.saveWithValidation = sumeru.controller.create(function(env, session){

    var g = function(id){
        return document.getElementById(id);
    }

    var getUserlist = function(){
        session.sduser = env.subscribe('pub-sduser', function(sduserCollection){
            //manipulate synced collection and bind it to serveral view blocks.
            session.bind('sduserlist', {
                data    :   sduserCollection
            });
        });
    }

    //对于每一个loader，自动创建一个闭包。 监听其中session、collection的改变，作为reactive的source
    env.onload = function(){
        return [getUserlist];
    };
    var none = function(){
        sumeru.log('onload nothing');
    }

    env.onerror = function(){
        sumeru.log('App.saveWithValidation error.');
    };

    env.onrender = function(doRender){
        doRender('saveWithValidation', ['rotate','left']);
    };

    env.onready = function(doc){
        var clearError = function(){
            g('sdnameerror').innerHTML = '&nbsp;';
            g('sdageerror').innerHTML = '&nbsp;';
        }
        session.sduser.onValidation = function(ispass, runat, validationResult){

            //清除原有的错误信息
            if(ispass){clearError();}

            //显示验证结果
            g('sdvalidation').innerHTML = (runat=='client'?'客户端':'服务端')+(ispass==true?'验证通过':'验证失败')+'<br/>';

            //显示详细验证结果
            for(var i = validationResult.length-1; i>=0; i--){
                g('sd'+validationResult[i].key+'error').innerHTML +=  (runat=='client'?'客户端':'服务端')+'验证结果：'+validationResult[i].msg;
            }

            //回滚数据
            if(!ispass){
                this.rollback();
            }

            //ensureSave() 服务端验证通过 后需要 重新渲染一次数据
            //save() 服务端验证失败 后需要 重新渲染一次数据
            if(runat=='server'){
                if((ispass&&this.isEnsureSave())
                    ||(!ispass&&!this.isEnsureSave())){
                    this.render();
                }
            }

        };

        /**
         * ensureSave  与 save 的不同之处在于：
         * save: 在向server端发数据的时候就已经进行了render，所以如果服务端验证失败就需要回滚数据并且重新render。
         * ensureSave : 在save的过程中，Clouda不做render。开发者如果想早点render可以在onvalidation处理server返回的pass信息时进行render。ensureSave在收到server返回的failed信息时也需要回滚数据。
         */
        Library.touch.on('#sdsave', 'touchstart', function(){
            clearError();
            var name = g('sdname').value;
            var age = g('sdage').value;

            session.sduser.add({"name":name,"age":age})
            session.sduser.save();

        });

        Library.touch.on('#sdensuresave', 'touchstart', function(){
            clearError();
            var name = g('sdname').value;
            var age = g('sdage').value;

            session.sduser.add({"name":name,"age":age})
            session.sduser.ensureSave();

        });
    };

});
