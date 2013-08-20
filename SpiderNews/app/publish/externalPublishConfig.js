/**
 * Created with JetBrains WebStorm.
 * User: yunlong
 * Date: 13-8-17
 * Time: 下午5:48
 * To change this template use File | Settings | File Templates.
 */

var iconv = require('iconv-lite');
var extpubConfig = {}

extpubConfig['pubnews'] = {

    geturl : function(params){
        return 'http://news.baidu.com/';
    },

    resolve : function(originData){
        decodeData = iconv.decode(originData,'gb2312')

        var topnewsRegex = /<ul class="ulist "  >([\W\w]*?)<\/div>/;
        var topnews = decodeData.match(topnewsRegex)[1];

        var resolved = {
            topnews: topnews
        }

        return resolved;
    },

    fetchInterval : 6 * 1000,

    buffer : true

}

module.exports = extpubConfig;