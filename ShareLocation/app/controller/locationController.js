/**
 * Created by yunlong on 13-12-5.
 */
sumeru.router.add(
    {
        pattern: '/location',
        action: 'App.location'
    }
);


App.location = sumeru.controller.create(function(env, session){

    var fetchOptions = {};

    var userId = Library.generateId.getUserId();
    var usersInfo = {};
    var historyLocMaxLen = 50;
    var distanceClearThreshold = 2000;
    var userName = localStorage.getItem('userName') || '';
    var groupId;

    var map;
    var roleController = Library.mapOverlay.createRoleController();

    var targetId = "target";

    var locSuccessCallback;
    var isFakeLoc;//有效值为1，2

    var getLocation = function(){

        groupId = session.get('groupId');
        session.get('refresh');

        if("undefined" !== typeof session.get('isFakeLoc')) {
            isFakeLoc = session.get('isFakeLoc');
        }

        if(!groupId || !userName) {
            return;
        }

        fetchOptions.groupId = groupId;

        session.location = env.subscribe('pubLocation', fetchOptions,function(locationCollection){
            locationCollection.getData().forEach(function(item){
                usersInfo[item.userId] = item;
            });

            session.bind('locationLogBlock', {
                data : locationCollection.find(),
                displayLocData : true
            });

            if(!usersInfo[targetId] || sessionStorage.getItem('updateTargetFlag')){
                setTarget();
            }

            if(map) {
                roleController.updateRolesData(locationCollection.getData());
                roleController.run(map);
            }

        });

    };
    env.onload = function(){
        return [getLocation];
    };
    env.onrender = function(doRender){
        doRender("location", ['push','right']);
    };

    env.onready = function(viewRoot){
        //端能力，目前只能内部使用，且只能在特定的app内运行
        andAbsorbEvent('device');
        andAbsorbEvent('barcode');

        map = Library.bMapUtil.initMap(viewRoot.querySelector('#map1'));

        var usernameInput = viewRoot.querySelector("#usernameInput");
        var usernameFirst = viewRoot.querySelector("#username");

        if(userName) {
            $("#inputNameFlow").hide();
        } else {
            usernameFirst.focus();
        }

        //首次设置用户名
        Library.touch.on('#setUsernameBtn','touchend',function(){
            var userNameTemp = usernameFirst.value.trim();
            if(setUserName(userNameTemp)) {
                $("#inputNameFlow").hide();
            }
        });

        //设置 panel
        Library.touch.on('#top_setting',"touchend",function (){
            if(userName) {
                $('#setting').toggle();
                $('#invitation_flow').hide();
                $('#trackLocationData').hide();

                usernameInput.value = userName;
            }
        });

        //邀请 panel
        Library.touch.on('#invitation',"touchend",function(){
            if(userName) {
                $('#invitation_flow').toggle();
                $('#setting').hide();
                $('#trackLocationData').hide();

                if(typeof nuwa == "undefined") {
                    alert("由于不能调用本地设备，请将本页面链接发给好友");
                }
            }

        });

        //修改用户名
        Library.touch.on("#setUsername","touchend",function(){
            var userNameTemp = usernameInput.value.trim();
            if(setUserName(userNameTemp)) {
                $("#setting").hide();
            }
        });

        /**
         * 摇一摇
         * 如果端能力有效，监听vibrator 10s
         * 如果无效，3s后已摇
         */
        Library.touch.on('#shakeMobile',"touchend",function(){
            Library.accelerometer.setCallbackFunc(setRoleStatus);
            if(Library.accelerometer.startListen()){
                setTimeout(Library.accelerometer.stopListen,10000);
            } else {
                setTimeout(setRoleStatus,3000);
            }

            $("#setting").hide();
        });

        //定位数据 panel -debug时用
        Library.touch.on('#displayLocationData',"touchend",function(){
            $('#setting').hide();

            $('#trackLocationData').show();
        });

        //关闭 设置 panel
        Library.touch.on('#settingClose',"touchend",function(){
            if(userName) {
                $('#setting').hide();
            }
        });

        //需要端能力支持
        Library.touch.on('#smsMethod',"touchend",function(){
            //短信分享
            Library.activity.sendMessage('',location.href);
            $('#invitation_flow').hide();
        });

        //需要端能力支持
        Library.touch.on('#erweimaMethod',"touchend",function(){
            //二维码分享
            Library.qrCode.createqrCode('createBlackQRcode',location.href);

        });

        //关闭 邀请 panel
        Library.touch.on('#shareClose',"touchend",function(){
            viewRoot.querySelector('#invitation_flow').style.display = "none";

        });


        function setUserName(userNameVal){
            if('' == userNameVal){
                alert('input your name firstly');
                return false;
            }

            userName = userNameVal;
            localStorage.setItem('userName',userName);
            tryStart();

            return true;
        }


        function tryStart(){
            if(userName) {
                if(!groupId) {
                    session.set('groupId',Library.generateId.getGroupId());
                }
                //新加入者，由于有groupId,设置完userName后，重新fetch数据
                session.set('refresh',1);
                session.commit();
            }
        };

        if(!isFakeLoc) {
            var r = confirm("你的位置没有变化，是否模拟定位数据来看效果？");
            if (r==true) {
                isFakeLoc = 2;
            } else {
                isFakeLoc = false;
            }
        }

        var timeInt= setInterval(function(){
            if(groupId && usersInfo && usersInfo[targetId] && usersInfo[targetId].coordinate) {
                clearInterval(timeInt);
                Library.location.genererateLoction(map,isFakeLoc,locSuccessCallback,'',usersInfo[targetId].coordinate[0]);
            }
        },100);

        tryStart();
    };

    locSuccessCallback = function(position) {
        if(!usersInfo[userId]) {
            var newItem = {
                'userId':userId,
                'groupId':groupId,
                'coordinate':[position],
                'name':userName
            };

            session.location.add(newItem);
        } else{
            //断线前后获取位置两点距离过远，不保留断线前的历史数据
            var currLocLen = usersInfo[userId].coordinate.length;
            if(currLocLen > 0){
                var currentLoc = usersInfo[userId].coordinate[currLocLen - 1];
                if(map.getDistance(currentLoc,position) > distanceClearThreshold){
                    usersInfo[userId].coordinate.splice(0,currLocLen);
                }
            }

            currLocLen = usersInfo[userId].coordinate.length;
            if(historyLocMaxLen <= currLocLen ) {
                usersInfo[userId].coordinate.splice(0,currLocLen - historyLocMaxLen );
            }
            usersInfo[userId].coordinate.push(position);

            session.location.update({'name':userName},{'groupId':groupId,'userId':userId});
        }
        session.location.save();
    }

    //后续添加server验证
    var setTarget = function(){
        sessionStorage.setItem('updateTargetFlag','');

        if(groupId && Library.generateId.isAdministrator(groupId)) {
            var position = {
                lat:sessionStorage.getItem('targetPos-lat'),
                lng:sessionStorage.getItem('targetPos-lng')
            };

            if(!sessionStorage.getItem('targetPos-lat')) {
                alert("终点数据不可用，请重新设置终点！");
                env.redirect('/target');
            } else {
                var targetName = sessionStorage.getItem('targetAddress');

                if(!usersInfo[targetId]) {
                    var newItem = {
                        'userId':targetId,
                        'groupId':groupId,
                        'coordinate':[position],
                        'name':targetName,
                        'roleStatus':''
                    };

                    session.location.add(newItem);
                } else {
                    usersInfo[userId].coordinate = [position];

                    session.location.update({'name':targetName},{'groupId':groupId,'userId':targetId});
                }
                session.location.save();
            }
        }
    }

    var setRoleStatus = function(){
        //目前只支持一种表情，后续可以将字段roleStatus改成array
        var status = 'cry';
        if(usersInfo && usersInfo[userId]) {
            session.location.update({'roleStatus':status},{'groupId':groupId,'userId':userId});
            session.location.save();
            setTimeout(function(){
                session.location.update({'roleStatus':''},{'groupId':groupId,'userId':userId});
                session.location.save();
            },5000);
        }
    }
});
