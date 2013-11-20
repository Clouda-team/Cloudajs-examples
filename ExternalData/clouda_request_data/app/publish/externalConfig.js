/**
 *	三方数据POST请求信息，由开发者自定义
 */
function runnable(){
	var config = {};
    var host = sumeru.config.get("dataServerHost");

	config['pubext'] = {
		
		uniqueColumn : "name",

        //获取取数据可以使用get/post,默认为get方式，
        //method : "post",

        /**
         * 获取数据的服务器url
         * 一定要定义 即使仅仅是想用post来修改数据而不是获取数据
         * 因为使用post修改完数据后，会自动从fetchUrl内返回的url发出请求，重新获取新数据
         */
		fetchUrl : function(){
			return "http://" + host;
		},
		
		resolve : function(originData){

            resolved = {};
            try{
                var j = JSON.parse(originData);
                var resolved = j;
            } catch(e) {
                console.log("fetch data server error",e);
            }

			
			return resolved;
		},

		fetchInterval : 60 * 1000,
        //如果需要转码，buffer设为true， 默认为false
		//buffer : true,

        /**
         *  notice：
         *  获取post请求的数据有两种方式
         *  1.onInsert, onUpdate, onDelete 和对应的 insertUrl，updateUrl，deleteUrl
         *  2.定义函数prepare和postUrl
         *  本例选择了第二种方式
         */

        /*
		deleteUrl : function(){
			return {
				host : host,
				path : '/delete'
			}
		},

		insertUrl : function(){
			return {
				host : host,
				path : '/insert'
			}
		},

		updateUrl : function(){
			return {
				host : host,
				path : '/update'
			}
		},

		onInsert : function(data){
			var prepareData = {};
			prepareData.name = data.name;
			prepareData.age = data.age;
			return prepareData;
		},

		onUpdate : function(data){
			var prepareData = {}; 
			prepareData.name = data.name;
			prepareData.age = data.age;
			return prepareData;
		},

		onDelete : function(data){
			var prepareData = {}
			prepareData.name = data.name;
			return prepareData;
		},
        */

		postUrl : function(type /** arg1, arg2, arg3... */){

			var options = {
				host : host,
				path : '/' + type
			}

			return options;

		},

        //POST请求的数据
        //type为增量操作，值为'delete', 'insert', 'update'其一;
        //data为增量数据，如：{ name : 'user1', age : 26 }。
        //处理增量数据作为post参数。
        prepare : function(type, data){
            var prepareData = {};  //prepareData为需要post的data
            if(type === "delete"){
                prepareData.name = data.name;
            }else if(type === "insert"){
                prepareData.name = data.name;
                prepareData.age = data.age;
            }else{
                prepareData.name = data.name;
                prepareData.age = data.age;
            }

            return prepareData;
        }
	}

	return {
		type : 'external',
		config : config
	}

}

module.exports = runnable;