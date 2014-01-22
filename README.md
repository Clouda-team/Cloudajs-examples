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

## ExternalData

Demo介绍：演示在clouda中如何使用get/post获取和修改数据

在线演示：<http://requestexternaldata.duapp.com/>

注意：

* ExternalData/clouda_request_data: 使用clouda获取并处理第三方数据demo

* ExternalData/external_server: 一个简单的第三方数据server


## UseAuth

Demo介绍：演示如何在Clouda中使用Register和Auth完成注册和登录的功能


## ShareLocation

Demo介绍：演示在clouda中如何集成百度地图服务，利用clouda的多端同步优势，实时和好友分享当前位置。

在线演示：<http://gogotogether.duapp.com/>

注意 由于本地设配能力还未对外开放，目前需要在特定环境下才能使用，所以demo中一些功能反应较慢或不能使用

* 在设定目的地界面 设定目的地->当前位置为目的地 时，由于未能调起Gps定位，所以定位很慢，建议使用地图选点或者输入目的地

* 在定位界面 设置->摇一摇 功能，模拟实现

* 在定位界面 邀请->短信邀请/二维码邀请，不可用
