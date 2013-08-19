/**
 * Created with JetBrains WebStorm.
 * User: yunlong
 * Date: 13-8-17
 * Time: 下午5:48
 * To change this template use File | Settings | File Templates.
 */

var $ = require('jquery');
var iconv = require('iconv-lite');
var extpubConfig = {}

extpubConfig['pubnews'] = {

    geturl : function(params){
        return 'http://news.baidu.com/';
    },

    resolve : function(originData){
        decodeData = iconv.decode(originData,'gb2312')

        var $doc = $(decodeData);

        var dataExt = $doc.find(".l-left-col").html();
        var resolved = {
            topnews: dataExt
        }

        return resolved;
    },

    fetchInterval : 60 * 1000,

    buffer : true

}

module.exports = extpubConfig;