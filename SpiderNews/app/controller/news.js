/**
 * Created with JetBrains WebStorm.
 * User: yunlong
 * Date: 13-8-17
 * Time: 下午5:52
 * To change this template use File | Settings | File Templates.
 */
sumeru.router.add(

    {
        pattern: '/news',
        action: 'App.news'
    }

);

sumeru.router.setDefault('App.news');

App.news = sumeru.controller.create(function(env, session){

    var view = 'news';

    var getNews = function(){

        session.news = env.subscribe('pubnews', function(newsCollection){

            var obj = newsCollection.getData()[0];

            session.bind('newsBlock', {
                'topNews' : obj['topnews']
            });
        });
    };


    env.onload = function(){
        return [getNews];
    }

    env.onrender = function(doRender){
        doRender(view, ['push','left']);
    };

});