/**
 * Created by yunlong on 13-12-25.
 */

Library.qrCode = sumeru.Library.create(function(exports){
    var plg;

    exports.createqrCode = function(createFunc,uri){
        if(typeof nuwa == "undefined") {
            alert('请先安装baidu run time');
            return false;
        } else {
            plg = nuwa.require('barcode');
            eval(createFunc + '(  uri  )');
        }

        return true;
    }

    function createBlackQRcode(uri) {
        if (plg === null) {
            alert('Please Wait Module Load');
            return;
        }
        var opt = new plg.QRcodeOptions(0, 'jpeg', '');
        plg.createQRcode(function (result) {
                var img = document.getElementById('image');
                img.src = "data:image/jpeg;base64," + result;
            },
            function (error) {
                alert('error: ' + JSON.stringify(error));
            },
            uri, opt);
    }

    function createColorQRcode(uri) {
        if (plg === null) {
            alert('Please Wait Module Load');
            return;
        }
        var opt = new plg.QRcodeOptions(1, 'jpeg', '');
        plg.createQRcode(function (result) {
                var img = document.getElementById('image');
                img.src = "data:image/jpeg;base64," + result;
            },
            function (error) {
                alert('error: ' + JSON.stringify(error));
            },
            uri, opt);
    }

    function createDynamicQRcode(uri) {
        if (plg === null) {
            alert('Please Wait Module Load');
            return;
        }
        var opt = new plg.QRcodeOptions(2, 'gif', '');
        plg.createQRcode(function (result) {
                var img = document.getElementById('image');
                img.src = "data:image/gif;base64," + result;
            },
            function (error) {
                alert('error: ' + JSON.stringify(error));
            },
            uri, opt);
    }

    return exports;
});
