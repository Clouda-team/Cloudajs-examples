/**
 * Created by yunlong on 13-12-17.
 */

Library.bMapUtil = sumeru.Library.create(function(exports){

    var city = "北京";

    exports.initMap = function(mapElement){
        var map = new BMap.Map(mapElement);            // 创建Map实例
        map.centerAndZoom(city,13);                     // 初始化地图,设置中心点坐标和地图级别。
        map.enableScrollWheelZoom();                            //启用滚轮放大缩小
        map.addControl(new BMap.NavigationControl());

        return map;
    };

    exports.keywordLocation = function(map,suggestText,callback){
        var ac = new BMap.Autocomplete( {
                "input" : suggestText,
                "location" : map
            });

        var myValue;

        ac.addEventListener("onconfirm", function(e) {    //鼠标点击下拉列表后的事件
            var _value = e.item.value;
            myValue = _value.province +  _value.city +  _value.district +  _value.street +  _value.business;

            setPlace();
        });

        function setPlace(){
            map.clearOverlays();    //清除地图上所有覆盖物
            function myFun(){
                var pp = local.getResults().getPoi(0).point;    //获取第一个智能搜索的结果
                map.centerAndZoom(pp, 18);
                map.addOverlay(new BMap.Marker(pp));    //添加标注
                callback(pp,myValue);
            }
            var local = new BMap.LocalSearch(map, { //智能搜索
                onSearchComplete: myFun
            });
            local.search(myValue);
        }
    };


    exports.getLocation = function(succCallback,errorCallback,loadingFunc){
        var defaultPositionOptions = {
            enableHighAccuracy:true,
            timeout:5000,
            maximumAge:14000
        }

        var defaultErrorCallback = function(error){
            console.log('location failed ',error);
        };

        var defaultSuccessCallback = function(info){
            console.log('location success ',info);
        }

        errorCallback || (errorCallback = defaultErrorCallback);
        succCallback || (succCallback = defaultSuccessCallback);

        var locCallback = function(pos){
            var status = geolocation.getStatus();
            console.log('location status:',status);
            BMAP_STATUS_SUCCESS == status ? succCallback(pos.point):errorCallback(status);
        }

        /**
         * 端能力，目前只能内部使用，且只能在特定的app内运行
         */
        if(typeof nuwa !== "undefined") {
            clouda.lightapp('UwA5TZnx6P0ktb1RqM71dPIW');
            clouda.mbaas.map.start({
                onsuccess:function(data){
                    clouda.mbaas.map.stop();
                    succCallback(data);
                },
                onfail:errorCallback
            });

            console.log('gps locate!!');
        } else {
            var geolocation = new BMap.Geolocation();
            geolocation.getCurrentPosition(locCallback);
            console.log('Html5 location!!');
        }

        loadingFunc && loadingFunc();

    };

    exports.pointToAddress = function(pt,callback){
        var gc = new BMap.Geocoder();
        gc.getLocation(pt, function(rs){
            var addComp = rs.addressComponents;
            var address = addComp.province + ", " + addComp.city + ", " + addComp.district + ", " + addComp.street + ", " + addComp.streetNumber;
            callback(addComp,address);
        });
    }

    return exports;
});