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
        pattern : '/sightingList',
        action : 'App.sightingList'
    }
);

App.sightingList = sumeru.controller.create(function(env,session) {
    // subscribing data, save it in session, and bind it to view
    var getSightings = function() {
        session.sightings = env.subscribe('pubBirdSighting', function(sightingsCollection) {
            session.bind('sighting_list', {
                 data:sightingsCollection.find()
            });
        });
    };

    // onload: return all obtained data through subscription
    env.onload = function() {
        return [getSightings];
    };

    // onrender: must call doRender to show the html view 
    env.onrender = function(doRender) {
        doRender("sightingListView",['push','left']);
    }

    // onready: add UI interactions, such as creating DOM event listeners
    env.onready = function(doc) {
        session.event('sighting_list',function() {
            var links = doc.querySelectorAll("li");
            for (var i= 0, len=links.length; i<len; i++ ) {
                links[i].addEventListener("touchstart",function(e) {
                    this.style.backgroundColor = "#83bff1";

                });
                links[i].addEventListener("touchend",function(e) {
                    var tag = this.getAttribute('data-id');
                    this.style.backgroundColor = "#ffffff";
                    env.redirect("/sightingDetail",{id:tag});
                });
            }
        })

        //create touch
        Library.touch.on('#create', 'touchstart', function() {
            document.getElementById('create').src = "../assets/res/add_down.png";
        });
        Library.touch.on('#create', 'touchend', function() {
            document.getElementById('create').src = "../assets/res/add.png";
            env.redirect("/createSighting");
        });
    }

});
