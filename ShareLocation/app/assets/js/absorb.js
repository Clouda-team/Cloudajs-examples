var plg = {};
var face = null;
var test_plugin = null;
var display = 'pluginsDownload';
function andAbsorbEvent(pluginsname) {
    document.addEventListener('runtimeready',
        function () {
            nuwa.pm.bindAk('wTk7LUNhzrRpTYlcRK3Ltk8f');
            nuwa.pm.absorb(pluginsname,
                function (inst) {
                    inst.on('error',
                        function (err) {
                            console.log(pluginsname + '下载安装失败，错误代码：' , err);
//                            document.getElementById(display).innerText = pluginsname + '下载安装失败，错误代码：' + err;
//                            document.getElementById(display).setAttribute('style', 'color:red');
                        });

                    inst.on('complete',
                        function () {
                            console.log(pluginsname ,'安装成功!');
//                            document.getElementById(display).innerText = pluginsname + '安装成功！';
//                            document.getElementById(display).setAttribute('style', 'color:green');
                              plg[pluginsname] = nuwa.require(pluginsname);
                            if (plg == null) {
                                console.log(pluginsname + '安装失败：不能获取插件JS对象!');
//                                document.getElementById(display).innerText = pluginsname + '安装失败：不能获取插件JS对象!';
//                                document.getElementById(display).setAttribute('style', 'color:red');
                                return;
                            }
                            if (pluginsname === 'facerecognition') {
                                face = new (plg[pluginsname]).FaceRecognition('123456');
                            }
                            if (pluginsname === 'voice') {
                                setStatusChangeListener();
                            }
                            if (pluginsname === 'runtimetest') {
                                test_plugin = nuwa.require(pluginsname);
                            }
                        });

                    inst.on('progress',
                        function (percentage) {
                            console.log(pluginsname , '下载中...');
//                            document.getElementById(display).innerText = pluginsname + '下载进度：' + percentage + '%';
//                            if (percentage === '100') {
//                                document.getElementById(display).innerText = pluginsname + ' 安装中...';
//                            }
//                            document.getElementById(display).setAttribute('style', 'color:green');
                            console.log(pluginsname + ' percentage = ' + percentage);
                        });
                });
        });
}

