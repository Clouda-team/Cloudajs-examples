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
        pattern : '/createSighting',
        action : 'App.createSighting'
    }
);

App.createSighting = sumeru.controller.create(function(env,session) {
    // subscribing data, save it in session. 
    // no need to bind it to view because we don't show data in this screen.
    var getSighting = function() {
       session.sighting = env.subscribe('pubBirdSighting',function(sightingCollection) {
       });
    }

    // onload: return all obtained data through subscription.
    env.onload = function() {
        return [getSighting];
    };

    // onrender: as always, call doRender() to show view.
    env.onrender = function(doRender) {
        doRender("createSightingView", ['push','left']);
    };

    // onready: add UI interactions
    env.onready = function() {

        //cancel touch
        Library.touch.on('#cancel', 'touchstart', function() {
            document.getElementById('cancel').src = "../assets/res/cancel_down.png";
        });

        Library.touch.on('#cancel', 'touchend', function() {
            document.getElementById('cancel').src = "../assets/res/cancel.png";
            env.redirect("/sightingList");
        });

        //done touch
        Library.touch.on('#done', 'touchstart', function(){
            document.getElementById('done').src = "../assets/res/done_down.png";

        });

        var nameInput = document.getElementById('name_input');
        var locationInput = document.getElementById('location_input');

        Library.touch.on('#done', 'touchend', function(){
            document.getElementById('done').src = "../assets/res/done.png";

            var nameInputVal = nameInput.value.trim();
            var locationInputVal = locationInput.value.trim();

            if (nameInputVal === '' || locationInputVal === '') {
                alert("Input value is empty!");
                return false;
            };

            // save the data model, and commit it to server
            session.sighting.add({name:nameInputVal, location:locationInputVal});
            session.sighting.save();
        });

        session.sighting.onValidation = function(ispass){
            // roll back data when not passed
            if(ispass){
                locationInput.value = "";
                nameInput.value = "";
                env.redirect("/sightingList");
            } else {
                this.rollback();
                alert("Hmm... sorry that's not look like a Bird Name to me. \nPlease try another.");
            }
        }
    };

});
