/**
 * Created by yunlong on 13-12-11.
 */
Library.location = sumeru.Library.create(function(exports){

    exports.genererateLoction = function(map,isFake,successCallback,errorCallback,targetPos){
        var callBack = {
            error: errorCallback || function(error){
                console.log('locate failed ', error);
            },

            success : successCallback ||function(position){
                console.log('locate ', position);
            }
        }

        this.map = map;

        isFake?fakeGenFunc(isFake,callBack,targetPos):realGenFunc(callBack);
    };

    exports.formatLoction = function(originPoint){
        var formatPot = {};
        if(originPoint.coords) {
            formatPot = {
                lat:originPoint.coords.latitude,
                lng:originPoint.coords.longitude
            };
        } else if(originPoint.point){
            formatPot = {
                lat:originPoint.point.lat,
                lng:originPoint.point.lng
            };

        } else {
            formatPot = {
                lat:originPoint.lat,
                lng:originPoint.lng
            };
        }

        return formatPot;
    };

    var timeInterval = {
        l1:2000,
        l2:5000,
        l3:10000,
        l4:20000,
        l5:40000
    };

    var realGenFunc = function(callback){
        var distanceThreshold = 100;
        var geolocation = new BMap.Geolocation();

        var generateNewLoc = function(){
            Library.bMapUtil.getLocation(succCallback,callback.error);
        };

        function succCallback(pos){
            var currentLoc = exports.currentLoc;
            var position = exports.formatLoction(pos);
            var bPoint = new BMap.Point(position.lng,position.lat);
            if(currentLoc && exports.map.getDistance(currentLoc,bPoint) < distanceThreshold ) {
                console.log("Distance is too short to log it!",exports.map.getDistance(currentLoc,bPoint));
                return false;
            } else {
                exports.currentLoc = bPoint;
                callback.success(position);
            }
        };

        generateNewLoc();
        setInterval(generateNewLoc,timeInterval['l3']);
    };

    var fakeGenFunc = function(strategy,callback,targetPos){
        /**
         * 产生假的的定位点的策略
         * 1：完全随机
         * 2：开始点随机，终点由外界输入，路程上的点由巡路算法算出
         * 3：开始点和终点由外界输入，路程上的点由巡路算法算出 --未完成
         */
         var fakeGenStrategy = {
             1: randomGenFunc,
             2: goTargetWithRandomStartPoint,
             3: goTargetWithRealStartPoint
         }

        strategy || (strategy = 1);

        var baseLoc = {
            lng:116.387428,
            lat:39.90923
        };

        var baseStep = 0.05;

        function generateNewLoc(){
            var newLoc = {};
            var currentLoc = exports.currentLoc;
            if(!currentLoc) {
                newLoc.lat = baseLoc.lat + adjustValue(1);
                newLoc.lng = baseLoc.lng + adjustValue(1);
            } else {
                newLoc.lat = currentLoc.lat + adjustValue();
                newLoc.lng = currentLoc.lng + adjustValue();
            }

            newLoc.time = new Date().getTime();
            exports.currentLoc = newLoc;

            return newLoc;
        };

        function adjustValue(rate){
            if(!rate) {
                rate = 0.005;
            }

            var adjust = Math.random() * baseStep * rate;
            return adjust;
        };

        //完全随机
        function randomGenFunc(){
            var newLoc = generateNewLoc();
            callback.success(newLoc);

            setInterval(function(){
                newLoc = generateNewLoc();
                callback.success(newLoc);
            },timeInterval['l2']);
        }

        //开始点随机，终点由外界输入，路程上的点由巡路算法算出
        function goTargetWithRandomStartPoint(){

            if(!targetPos) return;
            var map = exports.map;

            targetPos = new BMap.Point(targetPos.lng,targetPos.lat);
            var startPos = generateNewLoc();
            startPos = new BMap.Point(startPos.lng,startPos.lat);

            var run = function (){
                var driving = new BMap.DrivingRoute(map);    //驾车实例
                driving.search(startPos, targetPos);
                driving.setSearchCompleteCallback(function(){
                    var pts = driving.getResults().getPlan(0).getRoute(0).getPath();    //通过驾车实例，获得一系列点的数组
                    pts.reverse();//use pop instead of shift

                    var newLoc = pts.pop();
                    if(newLoc) {
                        callback.success(newLoc);

                        var timeInt = setInterval(function(){
                            var newLoc = pts.pop();
                            if(newLoc) {
                                callback.success(newLoc);
                            } else {
                                clearInterval(timeInt);
                            }
                        },timeInterval['l1']);
                    }

                });
            }

            setTimeout(function(){
                run();
            },1500);
            
        }

        //开始点和终点由外界输入，路程上的点由巡路算法算出
        function goTargetWithRealStartPoint(){
            //后续补充
        }


        fakeGenStrategy[strategy]();
    };

    return exports;
});
