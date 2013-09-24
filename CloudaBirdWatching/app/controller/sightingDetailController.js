/**
 * Copyright (c) 2013 Oliver Luan (luanyanqiang01@baidu.com) Gan Xun (ganxun@baidu.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

sumeru.router.add(
    {
        pattern : '/sightingDetail',
        action : 'App.sightingDetail'
    }
);

App.sightingDetail = sumeru.controller.create(function(env,seesion){
    // subscribing data, save it in session. 
    // expecting a single model by matching the 'id' passed from previous screen
    var getSightingDetail = function(){
        session.sightings = env.subscribe('pubBirdSightingDetail',session.get('id'),function(sightingsDetailCollection){
            session.bind('sighting_details',{
                data:sightingsDetailCollection.find()
            });
        });
    };

    // onload: return all obtained data through subscription
    env.onload = function() {
        return [getSightingDetail];
    };

    // onrender: as always, call doRender() to show view
    env.onrender = function(doRender) {
        doRender("sightingDetailView", ['push', 'left']);
    }

    // onready: add UI interactions
    env.onready = function() {
        //back touch
        Library.touch.on('#back', 'touchstart', function(){
            document.getElementById('back').src = "../assets/res/BS_down.png";
        });
        Library.touch.on('#back', 'touchend', function(){
            document.getElementById('back').src = "../assets/res/BS.png";
            env.redirect("/sightingList");
        });
        //delete touch
        Library.touch.on('#delete', 'touchstart', function(){
            document.getElementById('delete').src = "../assets/res/delete_down.png";
        });
        Library.touch.on('#delete', 'touchend', function(){
            document.getElementById('delete').src = "../assets/res/delete.png";
            var create_time = parseInt(session.get('id'));
            //delete record
            session.sightings.destroy({date: create_time});
            session.sightings.save();
            env.redirect("/sightingList");
        });
    };
});
