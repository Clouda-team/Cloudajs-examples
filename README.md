clouda-examples
===============


## 如何使用Demo：

* 将clone代码放入应用工程app目录中

* 修改app/server_config/bae.js，将在BAE上申请的mongodb的dbname和域名填入



## Todolist

Demo介绍：演示Clouda的实时性，云端统一编程

在线演示：<http://sumerutodolist.duapp.com>



## Chatroom

Demo介绍：如何使用Clouda实现聊天室

在线演示：<http://cloudachatroom.duapp.com>


## Chatroomv2

Demo介绍：Chatroom的升级版，演示如何在Clouda中调用第三方的SDK和API，本实例调用百度帐号登陆，获取用户名等信息。

在线演示：<http://cloudachatroomv2.duapp.com>

注意：

* 修改app/controller/login.js 第44/45行

	填入client_id(BAE上的API Key)和redirect_uri

* 修改app/controller/chatRoomController.js 第43/44行

	填入client_id和redirect_uri
	
	
## Validation

Demo介绍：演示如何使用Clouda的validation（验证）

在线演示：<http://cloudavalidation.duapp.com>

	
## SpiderNews

Demo介绍：演示如何使用Clouda抓取第三方数据

在线演示：<http://cloudaspidernews.duapp.com/>
注意：

* 由于抓取的源文件编码格式是gb2312，所以使用第三发模块iconv-lite来转码。使用本demo前，将SpiderNews内的app和node_modules文件夹覆盖新建的工程内同名文件夹即可。

## PublishByPage

Demo介绍：演示在Clouda中如何使用publishByPage和subscribeByPage进行分页显示，并使用publishPlain获取数据库数据的大小

在线演示：<http://cloudapublishbypage.duapp.com/>
