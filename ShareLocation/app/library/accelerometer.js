/**
 * Created by yunlong on 13-12-21.
 */

Library.accelerometer = sumeru.Library.create(function(exports){

    var steps;

    var s = {};
    var s1 = {};
    var flag=0;
    var flag1=0;
    var step=0;
    var i1=0;
    var callbackFunc;
    var detectSteps = function (sen) {
        var x = sen.x;
        var y = sen.y;
        var z = sen.z;

//        console.log("Accel JS " + x + ", " + y + "," + z);

        for(var i = 1 ; i < 60 ; i++) {
            s1[i-1] = s[i] ;
        }

        s1[59]=y;

        if (s1[0]!==0)
        {
            flag1=1;
        }
        if(flag1==1)
        {

//            console.log("Accel JS s1[30]" + s1[30]);
            for(i=1;i<10;i++){
                if(s1[30]>s1[30-i])
                    if(s1[30]>11)
                        i1++;
            }
            for(i=1;i<10;i++){
                if(s1[30]>s1[30+i])
                    if(s1[30]>11)
                        i1++;
            }
//            console.log("Accel JS i1: " + i1);
            if (i1>=15)
                step++;
            console.log("@@#",step);
                if(step > 1) {
                    step = 0;
                    console.log("@@@#!!",'cry now!');
                    callbackFunc();
                }

        }
//        console.log("Accel JS steps:" + step);
//        document.getElementById('step').innerText = step;
        i1=0;
        for(i = 0 ; i < 200 ; i++) {
            s[i] = s1[i] ;
        }
    }

    var options = {
        onsuccess:successCallback,
        onfail:errorCallback

    }

    var acceleration_id;
    exports.get = function(){
//        clouda.lightapp('UwA5TZnx6P0ktb1RqM71dPIW');


    };

    exports.setCallbackFunc = function(func){
        callbackFunc = func;
    }


    exports.startListen = function(){
        if(typeof nuwa == "undefined") {
            console.log('不能调起加速器');
            return false;
        };

        step = 0;
        var device = nuwa.require('device');
        ID = device.accelerometer.watchAcceleration(options.onsuccess,options.onfail, {frequency: 100});
        acceleration_id = ID;
        return true;
    };


    exports.stopListen = function(){
        if(typeof nuwa == "undefined") return;

        var device = nuwa.require('device');
        device.accelerometer.clearWatch(acceleration_id);
    };

    function successCallback(ret) {
        console.log('@@',ret);

        detectSteps(ret);
    };

    function errorCallback(code) {
        console.log('!@@',ret);
    }

    return exports;
});
