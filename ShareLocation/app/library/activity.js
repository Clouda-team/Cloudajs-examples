/**
 * Created by yunlong on 13-12-24.
 */


Library.activity = sumeru.Library.create(function(exports){
    exports.sendMessage = function (address,smsBody) {

        if(typeof nuwa == "undefined") {
            alert('请先安装baidu run time');
            return false;
        };

        var successCallback = function (contact) {
            console.log('success start activity:' ,contact);
        };

        var errorCallback = function (code) {
            console.log("error, errcode : " + code);
        };

        var device = nuwa.require('device');

        var intent = {
            action: "android.intent.action.VIEW",
            type: "vnd.android-dir/mms-sms",
            uri: "smsto:",
            extra: {
                address: address,
                sms_body: smsBody
            }
        };

        device.activity.startActivity(successCallback, errorCallback, intent);
    }

    return exports;
});

