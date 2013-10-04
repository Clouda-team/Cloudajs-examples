;//Debug开关, 发布时删除
var SUMERU_APP_FW_DEBUG=false;

(function(global,rootName) {
    /**
     * 包结构的自管理方法.提供添加包空间的addSubPackage及添加取得方法的getter,setter方法 所有自管理方法
     * 均会在页面载入完成后被自动清理掉.
     */
    var NS = 'NAMESPACE';
    var interName = 'sumeru_AppFW';
    
    /**
     *  记录所有包结构的全名及对应的包对像
     */
    var tables = {};
    var old = false;
    
    /*
     *  internal function
     */
    var require = function(path,callback){
        Library.net.get({
            url : path,
            callback:function(data){
                var exports = {};
                (new Function('exports',data)).call(null,exports);
                callback && callback(exports);
            }
        });
    };
    
    /**  
     *  根据给定的全名创建一个名称空间.
     *  方法利用创建出空间对像的prototype做为所创建名称空间的公共资源池，
     *  直接除加于空间对像的资源被认为是private，
     *  最终seal时候，替换空间对像为该对像的prototype达到隐藏的private资源的目的.
     *  
     *  @param fullName {string} 当前命名空间的全名.
     *  @returns {Object}  
     */
    var createSpace = function(fullName){
        var space , _prot = {};
        
        if(Object.create){
            space = Object.create(_prot);
        }else{
            /*
             * 如果存在Object.create 则js实现版本为1.85以上. 
             * 如果不存在，则同时不存在getPrototypeOf等方法. 对于个别低版本浏览器同时不存在__proto__属性，如Opera 10.5等
             * 所以在这里需要补充一个可以获取到得prototype的方法，
             */
            function fn(){};
            fn.prototype = _prot;
            space = new fn();
            
            space.__getPrototypeof = function(){
                return _prot;
            };
        }
        
        
        /*
         * 添加私有成员、方法
         */
        
        space.__namespace = NS;     // 是否是一个命名空间
        space.__isSeal = false;     // 是否已经执行seal处理
        
        space.__require = function(path,callback,name){
            require(path,function(exports){
                
                callback && callback(exports);
                
                if(name){
                    space.__reg(name,exports);
                }
            });
        };
        
        /**
         * 触发当前空间下对某个资源所设的所有陷阱
         * @param name {string} 资源名称
         */
        space.__runTraps = function(name){
            var list = tables[fullName].traps[name];
            if(list && list.length > 0){
                list.forEach(function(item){
                    item(space[name]);
                });
            }
        };
        
        /**
         * 同步注册一个资源
         * @param namej {string} 资源名称
         * @param resource {Any} 将注册到该名称空间上的资源
         * @param isPrivate {Boolean} 是否注册为私有
         * @returns {any} 返回注册的resource
         */
        space.__reg = function(name, resource, isPrivate){
            if(isPrivate){
                space[name] = resource;
            }else{
                _prot[name] = resource;
            }
            // 尝试触发trap队列
            space.__runTraps(name);
            
            return resource;
        };
        
        /**
         * 异步注册一个资源
         * @param namej {string} 资源名称
         * @param isPrivate {Boolean} 是否注册为私有
         * @returns {function callback(resource){}} 回调方法，resource将被注册到该名称空间下. 
         * 如果重复调用这个callback方法，则可反复覆盖修改资源.
         */
        space.__regAsync = function(name, isPrivate){
            // return callback fun...
            return function(resource){
                if(isPrivate){
                    space[name] = resource;
                }else{
                    _prot[name] = resource;
                }
                //  尝试触发trap队列
                space.__runTraps(name);
            };
        };
        
        /**
         * 获取一个已注册的资源.
         * @param name {string} 目标获取的资源名称.
         * @returns {any} 目标资源，如果没有返回undefined.
         */
        space.__load = function(name){
            return space[name];
        };
        
        /**
         * 异步获取一个资源.当这个资源被注册、修改时，将自动触发callback所指定的方法.
         * @param name {string} 目标获取的资源名称.;
         * @param callback {function} 回调方法,
         *         当调用之个方法时，如果目标资源已存在，则自动执行一次callback.
         *         如果获到一个未被注册的资源，创建一个trap，直到目标资源被注册时，自动调用一次;
         */
        space.__loadAsync = function(name,callback){
            var traps;
            // 是否已有陷阱队列,没有则创建
            if(!(tables[fullName].traps[name])){
                // 此处使用array ，便于对一个资源，使用多个trap.
                traps = tables[fullName].traps[name] = [];
            }else{
                traps = tables[fullName].traps[name];
            }
            
            /*
             * FIXME:
             * 此处不检测是否callback被重复注册，
             * 目前情况下，如果重复注册callback会导到traps队列中存在多个相同callback，
             * 在资源改变时将导至callback可能被执行多次，是否FIX视最终使用情况反馈决定.
             */
            traps.push(callback);
            
            // 如果资源存在，则自动执行一次
            if(space[name] !== undefined){
                // 资源被注册时，自动执行一次当前注册的trap
                callback(space[name]);
            }
            
        };
        
        /**
         * 在当前空间下添加子空间
         * @param name {string} 子空间名称
         * @returns {Object} 子空间对像
         */
        space.addSubPackage = function(name){
            var sfn = fullName + "." + name;  //package full name
            if(tables[fullName].isSeal){
                throw 'package ["' + fullName + '"] has sealed.';
            }else if(!tables[sfn]){
                // 创建包空间
                _prot[name] = createSpace(sfn);
                /*
                 * 记录包结构
                 * {
                 *      package:包结构对像,
                 *      isSeal : 是否执行过清理方法
                 *      traps: 资源陷阱，用于存放资源获的回调
                 * }
                 */ 
                tables[sfn] = {'spaceObj':space[name],'isSeal':false,traps:{}};
                
                return _prot[name];
            }else{
                throw 'package ["' + sfn + '"] already exists';
            }
        };
        
        /**
         * 清理当前命名空间下的子空间
         */
        space.__clear = function(){
            var ns;
            
            // 清理过的内容，不再执行清
            if(tables[fullName].isSeal){
                return;
            }
            
            // 清理子空间
            for(var key in _prot){
                ns = _prot[key];
                if(ns.__namespace === NS){
                    ns.__clear();
                    if(Object.getPrototypeOf){
                        _prot[key] = Object.getPrototypeOf(ns);
                    }else{
                        _prot[key] = ns.__getPrototypeof();
                    }
                    /*
                     * 利用prototype的求值检索顺序，在完整的空间对像间建立引用，
                     * 保证在清理方法调用之前，已经对空间对像所做的引用仍然可以访问private资源。
                     */
                    space[key] = ns;
                }
            }
            
            // 标记清理完成
            tables[fullName].isSeal = true;
        };
        
        return space;
    };
    
    /**
     * 如果目标空间存在，则将当前包空间上的对像，copy到新的包对像上用作public
     */
    old = global[rootName];
    global[rootName] =  createSpace(interName);
    tables[interName] =  {'spaceObj':global[rootName],'isSeal':false,traps:{}};
    
    if(old){
        for(var key in old){
            global[rootName].__reg([key],old[key]);
        }
    }
    
    
    /**
     * 隐藏根命名空间下的私有成员.
     */
    global[rootName].clear = function(){
        global[rootName].__clear();
        
        global[rootName].seal = undefined;
        delete global[rootName].seal;
        
        global[rootName] = Object.getPrototypeOf(global[rootName]);
    };
    

    if(typeof module !='undefined' && module.exports){
        module.exports = function(){
            return global[rootName];
        };
    }
    
    if(SUMERU_APP_FW_DEBUG){
        // DEBUG, 暴露当前所有包结构的映射
        global.DEBUG_PKG_MAPPING = tables;
        
        // 同时绑定debug开关到根结点上，此操作用于在server端区分debug状态.
        global[rootName].__reg("SUMERU_APP_FW_DEBUG", true);
    }
    
    
})(this,'sumeru');

var Run_UnitTest_PKG = function(){
 var root = sumeru; // 引用最初的FW对像，
 // simple unit testing....
 a = fw.addSubPackage('a');
 b = a.addSubPackage('b');

 // async resource trap...
 a.__loadAsync('name',function(name){
     console.log('fire trap...fw.a.name : ' + name);
 });

 b.__loadAsync('name',function(name){
     console.log('fire trap...fw.b.name : ' + name);
 });

 // sync __reg , async __load
 fw.a.b.__reg('age',100,true);
 
 b.__loadAsync('age',function(age){
     console.log('fire trap...fw.b.age : ' + age);
 });

 var f0 = a.__regAsync('name');
 var f1 = fw.a.b.__regAsync('name');

 // async reg delay.
 setTimeout(function(){
     f0('package fw.a');
     f1('package fw.a.b');
     
     for(var i = 100;i<110;i++){
         f1('name _ ' + i);  // fire trap. 10 times
     }
     
     console.log(a.b.age);         // 100;
     console.log(fw.a.b.age);      // undefined;
     console.log('async done...');
 }, 1000);

 fw.clear();

 console.log(fw.a.b.age === undefined); // true
 console.log(root.a.b.age === 100);     // true
 console.log(fw.addSubPackage === undefined); // true
 console.log(fw.a.addSubPackage === undefined); // true
 console.log(fw.a.b.addSubPackage === undefined); //true

 console.log(a.addSubPackage === undefined); // false
 console.log(b.addSubPackage === undefined); // false
};
;
var _log = function(){
	console && console.log.apply(this, arguments);
}

var runnable = function(sumeru){
    
    var log_level = sumeru.SUMERU_APP_FW_DEBUG || false;
    
    var log = {
        
        log : function(){
            _log.apply(console, arguments);
        },
        
        dev : function(){
            if(log_level !== false){
                _log.apply(console, arguments);
            }
        }
    };
    
    sumeru.__reg('log', log.log);
    sumeru.__reg('dev', log.dev);
    
    return log;
};

if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
}
;var runnable = function(fw){
    
    var utils = fw.addSubPackage('utils'); 
	
    //========== inner function =================//
    var arrSplice = Array.prototype.splice;
    var arrConcat = Array.prototype.concat;
    
    var callArrSpl = function(arr/*,...args*/){
        return arrSplice.apply(arr,arrSplice.call(arguments,1));
    };
    
    var oKeys = Object.keys;
    
    var callArrConcat = function(arr){
        return arrConcat.apply(callArrSpl(arr,0),callArrSpl(arguments,1));
    };
    
    function _cpp(source){
        oKeys(source).forEach(function(key){
            this[key] = source[key];
        },this);
    };
    
    //====== below publish  =======//
    
    /**
     * copy对像的属性及方法到指定的目标上.
     * @param target {Object} 目标对像
     * @param ...args {...Object} 源对像
     */
    var cpp = utils.__reg('cpp',function(target/*,...args*/){
        var objs = callArrSpl(arguments,1);
        objs.forEach(_cpp,target);
        return target;
    });
    
    
    var extendFrom = utils.__reg('extendFrom',function(_base,_exts){
        var rv = null , fun=function(){};
        if(Object.create){
            rv = Object.create(_base);
        }else{
            fun.prototype = _base;
            rv = new fun();
        }
        return cpp(rv,_exts);
    });

    /**
     * 创建一个对像的代理对像，用于隐藏原始对像上的部份方法与全部属性
     */
    var getProxy = utils.__reg('getProxy',function(obj,nameList){
        var proxy = {};
        
        nameList.forEach(function(key){
            var me = this;
            proxy[key] = function(){
                if(me[key] instanceof Function){
                    return me[key].apply(me,arguments);
                }else{
                    throw  key + ' is not a function';
                }
            };
        },obj);
        
        return proxy;
    });
    
    /**
     * 销毁一个对像上的引用
     */
    var cleanObj = utils.__reg('cleanObj',function(obj,each){
        var keys = Object.keys(obj);
        keys.forEach(function(key){
            try{
                if(key != 'isDestroy'){
                    
                    each && each(this[key]);
                    
                    if(typeof(this[key]) == 'array' ){
                        this[key].length = 0;
                    }
                    delete this[key];
                }
            }catch (e) {}
        },obj);
    });
    
    /**
     * 对传入字符进行完整符合RFC3986的URI编码.
     * @param str {string}将进行编码的字符串
     * @returns {string}
     */
    var encodeURIComponentFull = utils.__reg('encodeURIComponentFull',function(str){
        var result = encodeURIComponent(str);
        
        // 处理encodeURIComponent不编码的特殊字符
        result = result.replace(/!/g , '%21');      // .  %2E
        result = result.replace(/\*/g , '%2A');      // .  %2E
        result = result.replace(/'/g , '%27');      // .  %2E
        result = result.replace(/\(/g , '%28');      // .  %2E
        result = result.replace(/\)/g , '%29');      // .  %2E
        result = result.replace(/\./g , '%2E');      // .  %2E
        result = result.replace(/\-/g , '%2D');      // .  %2E
        result = result.replace(/\_/g , '%5F');      // .  %2E
        result = result.replace(/\~/g , '%7E');      // .  %2E
        
        return result;
    });
    
    /**
     * 将URI参数还原为map结构
     * @param str {String} 可解码的uri参数
     * @returns {Object} 解码后的map对像
     */
    var uriParamToMap = utils.__reg('uriParamToMap',function (str){
        var rv = {};
        
        // 如果str为空串,null,undefined,则直接返回空字符串
        if(!str){
            return rv;
        }
        
        var params = str.split('&');
        
        params.forEach(function(item){
            var parts = item.split('=');
            // 仅处理正常的key,value, 非正常则忽略
            if(parts[0]){
                this[parts[0]] = decodeURIComponent(parts[1]);
            }
        },rv);
        
        return rv;
    });
    
    var joinArrayAndEncodeURI = function(arr,separator){
        var rv = [];
        arr.forEach(function(item){
            rv.push(encodeURIComponentFull(item));
        });
        return rv.join(separator);
    };
    
    var mapToUriParam = utils.__reg('mapToUriParam',function(map){
        var rv = [],keys = null;
        
        // 非对像类型，不进行处理
        if(typeof(map) != 'object' || Array.isArray(map)){
            return '';
        }
        
        keys = Object.keys(map);
        keys.forEach(function(key){
            var value = map[key];
            switch(typeof(value)){
                case "string":
                case "number":
                case "boolean":
                    rv.push(key + "=" + encodeURIComponentFull(value)); 
                case "object":
                    if(Array.isArray(value)){
                        rv.push(key + "=" + joinArrayAndEncodeURI(value));
                    }
                default:
                    return;
            }
        });
        
        return rv.join("&");
    });
    
    var randomInt = utils.__reg('randomInt',function (min,max){
        return Math.floor(Math.random() * (max - min + 1) + min);
    });
    
    var randomStr_str = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ';
    var randomStr_len = randomStr_str.length - 1;
    utils.__reg('randomStr',function randomStr(max){
        var rv = '';
        for(var i=0;i<max;i++){
            rv += randomStr_str[randomInt(0,randomStr_len)];
        }
        return rv;
    });
    
    /**
     * 解析JSON，相比JSON.parse能忽略一些错误，如JSON.parse不能解析单引号等。但有被注入的风险。
     * 所以在方法中屏蔽了对window,document,sumeru,XMLHttpRequest等对像的直接引用。
     */
    var parseJSON = utils.__reg('parseJSON',function(str){
        //使用Function的方式parse JSON字符串,并隐藏 window,document,sumeru,XMLHttpRequest等对像,防止注入
        return (new Function('window','document','sumeru','XMLHttpRequest','return ' + str + ';')).call({},undefined,undefined,undefined,undefined);
    });
    
    
    var isSimpleType = utils.__reg('isSimpleType',function(value){
        switch(typeof(value)){
            case "string":
            case "number":
            case "boolean":
                return true;
        }
        return false;
    });
    
    var setStyles = utils.__reg('setStyles',function setStyles(element,propertys){
        var sty = element.style , val = "";
        var reg = /^(left|top|bottom|right|width|height)$/i;
        for(var key in propertys){
            val = propertys[key];
            
            if(typeof(propertys[key]) == 'number' && reg.test(key)){
                val += "px";
            }
            
            sty[key] = val;
        }
        return element;
    });
    
    /**
     * 实现方法链，即一个方法的传出是后一个方法的传入,
     * 
     * function的建议写法为
     * 
     *  function(param1,param2,....,onerror,){
     *      .... // 处理过程
     *          onerror();  // 处理失败通知
     *          return;
     *      .... // 处理过程
     *          onsuccess(param1,param2,....,onerror);      //处理成功通知执行下一个
     *  }
     * 
     *  其中
     *    param1... 在调用run的时候传入,将自动做为function的参数在调用时被传入
     *    onerror   在调用run时做为最后一个参数传入.如果不传则不会接收到异常中止的通知。因为错误控制不属于chain处理中的必要内容，所以不自动传入。
     *    onsuccess 为自动传入，调用时请将除onsuccess以外的参数，处理后原顺序传入。
     *  
     * 此实现支持异步处理，即方法最后一个参数补充传入一个callback用于执行下一个方法。
     * 同步实现请自己去写循环....
     * 
     * @param chainItems {Array}    链上的组成方法，每个元素为一个function.
     * @param finalCallback {function} 当执行完成整条方法链时，最终被调用的通知方法。
     * @returns {function} 一个可执行的方法，用于启动方法链，该方法只能执行一次, 执行后，该方法的参数将做为每一个chainItem的参数被传入。
     */
    
    fw.utils.__reg('chain',function(chainItems,finalCallback){
        // 确保接收到的是一整组可执行的并且参数数量一至的方法
        if(!Array.isArray(chainItems)){
            return false;
        }
        var arrlen = chainItems[0].length;
        if(!chainItems.every(function(item){
            return item instanceof Function && item.length === arrlen;
        })){
            return false;
        }
        
        var i = 0;
        var runNext = null;
        
        runNext = function(){
            var item = chainItems[i++];
            if(item !== undefined){
                var args = callArrConcat(arguments,runNext);
                item.apply(this,args);  // 如果上层方法使用call和apply执行，则有this，否则没有
            }else{
                finalCallback.apply(this,callArrSpl(arguments,0));
            }
        };
        
        return runNext;
    });
    
    //========默认的getTimeStamp方法，获取本地时间。当连接服务器后，此方法将会被覆盖为获得云端时间的方法 =======//
    fw.utils.__reg('getTimeStamp', function(){
        return (new Date()).valueOf();
    });
    
    //========= 以下为旧的未整理过的代码，wangsu  ==========//
    
	var __randomMap = {};
	fw.__random = function(len) {
        len = len || 10;
        
        var chars = "qwertyuiopasdfghjklzxcvbnm1234567890",
            charsLen = chars.length,
            len2 = len,
            rand = "";
            
        while (len2--) {
            rand += chars.charAt(Math.floor(Math.random() * charsLen));
        }
        
        if (__randomMap[rand]) {
            return random(len);
        }
        
        __randomMap[rand] = 1;
        return rand;
    };

    //========= 以下为用到的工具代码，huangxin03  ==========//

    //深度克隆
    var clone = function(item){

        if (!item) { return item; } // null, undefined values check

        var types = [ Number, String, Boolean ], 
            result;

        // normalizing primitives if someone did new String('aaa'), or new Number('444');
        types.forEach(function(type) {
            if (item instanceof type) {
                result = type( item );
            }
        });

        if (typeof result == "undefined") {
            if (Object.prototype.toString.call( item ) === "[object Array]") {
                result = [];
                item.forEach(function(child, index, array) { 
                    result[index] = clone( child );
                });
            } else if (typeof item == "object") {
                // testing that this is DOM
                if (item.nodeType && typeof item.cloneNode == "function") {
                    var result = item.cloneNode( true );    
                } else if (!item.prototype) { // check that this is a literal
                    if (item instanceof Date) {
                        result = new Date(item);
                    } else {
                        // it is an object literal
                        result = {};
                        for (var i in item) {
                            result[i] = clone( item[i] );
                        }
                    }
                } else {
                    // depending what you would like here,
                    // just keep the reference, or create new object
                    if (false && item.constructor) {
                        // would not advice to do that, reason? Read below
                        result = new item.constructor();
                    } else {
                        result = item;
                    }
                }
            } else {
                result = item;
            }
        }

        return result;

    }

    fw.utils.__reg('deepClone', clone);

    //merge two object, append b to a
    var merge = function(a, b){

        var copy = clone(a);

        for(x in b){
            typeof copy[x] !== 'undefined' ? false :copy[x] = b[x];
        }
        return copy;
    }

    fw.utils.__reg('merge', merge);
	
};

if(typeof module !='undefined' && module.exports){
	module.exports = runnable;
}else{
    runnable(sumeru);
}


;var runnable = function(fw){
	
	fw.event = fw.event || {};
	
	fw.event.domReady = function(callback){
		if (/complete|loaded|interactive/.test(document.readyState)) {
			callback();
		} else {
			document.addEventListener('DOMContentLoaded', function(){
				callback();
			}, false);
		}
	};
	
	fw.event.onload = function(callback){
        if (/complete/.test(document.readyState)) {
            callback();            
        } else {
            window.onload = function(){
                callback();
            }
        }
	};
	
	fw.event.mapEvent = function(selector, map){
	    var ele = document.querySelector(selector);
	    if (!ele) {
	        return;
	    };
	    
	    for (var key in map){
	        if (typeof map[key] != 'function') {
	            continue;
	        };
	        //支持逗号分割同时绑定多个事件到一个callback
	        key = key.split(',');
	        key.forEach(function(eventName){
	            ele.addEventListener(eventName.trim(), map[key]);
	        });
	    }
	    
	}
	
}
if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{//这里是前端
    runnable(sumeru);
}
;// Copyright (c) 2005  Tom Wu
// All Rights Reserved.
// See "LICENSE" for details.

// Basic JavaScript BN library - subset useful for RSA encryption.

// Bits per digit
var dbits;

// JavaScript engine analysis
var canary = 0xdeadbeefcafe;
var j_lm = ((canary&0xffffff)==0xefcafe);

// (public) Constructor
function BigInteger(a,b,c) {
  if(a != null)
    if("number" == typeof a) this.fromNumber(a,b,c);
    else if(b == null && "string" != typeof a) this.fromString(a,256);
    else this.fromString(a,b);
}

// return new, unset BigInteger
function nbi() { return new BigInteger(null); }

// am: Compute w_j += (x*this_i), propagate carries,
// c is initial carry, returns final carry.
// c < 3*dvalue, x < 2*dvalue, this_i < dvalue
// We need to select the fastest one that works in this environment.

// am1: use a single mult and divide to get the high bits,
// max digit bits should be 26 because
// max internal value = 2*dvalue^2-2*dvalue (< 2^53)
function am1(i,x,w,j,c,n) {
  while(--n >= 0) {
    var v = x*this[i++]+w[j]+c;
    c = Math.floor(v/0x4000000);
    w[j++] = v&0x3ffffff;
  }
  return c;
}
// am2 avoids a big mult-and-extract completely.
// Max digit bits should be <= 30 because we do bitwise ops
// on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
function am2(i,x,w,j,c,n) {
  var xl = x&0x7fff, xh = x>>15;
  while(--n >= 0) {
    var l = this[i]&0x7fff;
    var h = this[i++]>>15;
    var m = xh*l+h*xl;
    l = xl*l+((m&0x7fff)<<15)+w[j]+(c&0x3fffffff);
    c = (l>>>30)+(m>>>15)+xh*h+(c>>>30);
    w[j++] = l&0x3fffffff;
  }
  return c;
}
// Alternately, set max digit bits to 28 since some
// browsers slow down when dealing with 32-bit numbers.
function am3(i,x,w,j,c,n) {
  var xl = x&0x3fff, xh = x>>14;
  while(--n >= 0) {
    var l = this[i]&0x3fff;
    var h = this[i++]>>14;
    var m = xh*l+h*xl;
    l = xl*l+((m&0x3fff)<<14)+w[j]+c;
    c = (l>>28)+(m>>14)+xh*h;
    w[j++] = l&0xfffffff;
  }
  return c;
}
if(0 && j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
  BigInteger.prototype.am = am2;
  dbits = 30;
}
else if(0 && j_lm && (navigator.appName != "Netscape")) {
  BigInteger.prototype.am = am1;
  dbits = 26;
}
else { // Mozilla/Netscape seems to prefer am3
  BigInteger.prototype.am = am3;
  dbits = 28;
}

BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = ((1<<dbits)-1);
BigInteger.prototype.DV = (1<<dbits);

var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2,BI_FP);
BigInteger.prototype.F1 = BI_FP-dbits;
BigInteger.prototype.F2 = 2*dbits-BI_FP;

// Digit conversions
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr,vv;
rr = "0".charCodeAt(0);
for(vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
rr = "a".charCodeAt(0);
for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
rr = "A".charCodeAt(0);
for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;

function int2char(n) { return BI_RM.charAt(n); }
function intAt(s,i) {
  var c = BI_RC[s.charCodeAt(i)];
  return (c==null)?-1:c;
}

// (protected) copy this to r
function bnpCopyTo(r) {
  for(var i = this.t-1; i >= 0; --i) r[i] = this[i];
  r.t = this.t;
  r.s = this.s;
}

// (protected) set from integer value x, -DV <= x < DV
function bnpFromInt(x) {
  this.t = 1;
  this.s = (x<0)?-1:0;
  if(x > 0) this[0] = x;
  else if(x < -1) this[0] = x+DV;
  else this.t = 0;
}

// return bigint initialized to value
function nbv(i) { var r = nbi(); r.fromInt(i); return r; }

// (protected) set from string and radix
function bnpFromString(s,b) {
  var k;
  if(b == 16) k = 4;
  else if(b == 8) k = 3;
  else if(b == 256) k = 8; // byte array
  else if(b == 2) k = 1;
  else if(b == 32) k = 5;
  else if(b == 4) k = 2;
  else { this.fromRadix(s,b); return; }
  this.t = 0;
  this.s = 0;
  var i = s.length, mi = false, sh = 0;
  while(--i >= 0) {
    var x = (k==8)?s[i]&0xff:intAt(s,i);
    if(x < 0) {
      if(s.charAt(i) == "-") mi = true;
      continue;
    }
    mi = false;
    if(sh == 0)
      this[this.t++] = x;
    else if(sh+k > this.DB) {
      this[this.t-1] |= (x&((1<<(this.DB-sh))-1))<<sh;
      this[this.t++] = (x>>(this.DB-sh));
    }
    else
      this[this.t-1] |= x<<sh;
    sh += k;
    if(sh >= this.DB) sh -= this.DB;
  }
  if(k == 8 && (s[0]&0x80) != 0) {
    this.s = -1;
    if(sh > 0) this[this.t-1] |= ((1<<(this.DB-sh))-1)<<sh;
  }
  this.clamp();
  if(mi) BigInteger.ZERO.subTo(this,this);
}

// (protected) clamp off excess high words
function bnpClamp() {
  var c = this.s&this.DM;
  while(this.t > 0 && this[this.t-1] == c) --this.t;
}

// (public) return string representation in given radix
function bnToString(b) {
  if(this.s < 0) return "-"+this.negate().toString(b);
  var k;
  if(b == 16) k = 4;
  else if(b == 8) k = 3;
  else if(b == 2) k = 1;
  else if(b == 32) k = 5;
  else if(b == 4) k = 2;
  else return this.toRadix(b);
  var km = (1<<k)-1, d, m = false, r = "", i = this.t;
  var p = this.DB-(i*this.DB)%k;
  if(i-- > 0) {
    if(p < this.DB && (d = this[i]>>p) > 0) { m = true; r = int2char(d); }
    while(i >= 0) {
      if(p < k) {
        d = (this[i]&((1<<p)-1))<<(k-p);
        d |= this[--i]>>(p+=this.DB-k);
      }
      else {
        d = (this[i]>>(p-=k))&km;
        if(p <= 0) { p += this.DB; --i; }
      }
      if(d > 0) m = true;
      if(m) r += int2char(d);
    }
  }
  return m?r:"0";
}

// (public) -this
function bnNegate() { var r = nbi(); BigInteger.ZERO.subTo(this,r); return r; }

// (public) |this|
function bnAbs() { return (this.s<0)?this.negate():this; }

// (public) return + if this > a, - if this < a, 0 if equal
function bnCompareTo(a) {
  var r = this.s-a.s;
  if(r != 0) return r;
  var i = this.t;
  r = i-a.t;
  if(r != 0) return (this.s<0)?-r:r;
  while(--i >= 0) if((r=this[i]-a[i]) != 0) return r;
  return 0;
}

// returns bit length of the integer x
function nbits(x) {
  var r = 1, t;
  if((t=x>>>16) != 0) { x = t; r += 16; }
  if((t=x>>8) != 0) { x = t; r += 8; }
  if((t=x>>4) != 0) { x = t; r += 4; }
  if((t=x>>2) != 0) { x = t; r += 2; }
  if((t=x>>1) != 0) { x = t; r += 1; }
  return r;
}

// (public) return the number of bits in "this"
function bnBitLength() {
  if(this.t <= 0) return 0;
  return this.DB*(this.t-1)+nbits(this[this.t-1]^(this.s&this.DM));
}

// (protected) r = this << n*DB
function bnpDLShiftTo(n,r) {
  var i;
  for(i = this.t-1; i >= 0; --i) r[i+n] = this[i];
  for(i = n-1; i >= 0; --i) r[i] = 0;
  r.t = this.t+n;
  r.s = this.s;
}

// (protected) r = this >> n*DB
function bnpDRShiftTo(n,r) {
  for(var i = n; i < this.t; ++i) r[i-n] = this[i];
  r.t = Math.max(this.t-n,0);
  r.s = this.s;
}

// (protected) r = this << n
function bnpLShiftTo(n,r) {
  var bs = n%this.DB;
  var cbs = this.DB-bs;
  var bm = (1<<cbs)-1;
  var ds = Math.floor(n/this.DB), c = (this.s<<bs)&this.DM, i;
  for(i = this.t-1; i >= 0; --i) {
    r[i+ds+1] = (this[i]>>cbs)|c;
    c = (this[i]&bm)<<bs;
  }
  for(i = ds-1; i >= 0; --i) r[i] = 0;
  r[ds] = c;
  r.t = this.t+ds+1;
  r.s = this.s;
  r.clamp();
}

// (protected) r = this >> n
function bnpRShiftTo(n,r) {
  r.s = this.s;
  var ds = Math.floor(n/this.DB);
  if(ds >= this.t) { r.t = 0; return; }
  var bs = n%this.DB;
  var cbs = this.DB-bs;
  var bm = (1<<bs)-1;
  r[0] = this[ds]>>bs;
  for(var i = ds+1; i < this.t; ++i) {
    r[i-ds-1] |= (this[i]&bm)<<cbs;
    r[i-ds] = this[i]>>bs;
  }
  if(bs > 0) r[this.t-ds-1] |= (this.s&bm)<<cbs;
  r.t = this.t-ds;
  r.clamp();
}

// (protected) r = this - a
function bnpSubTo(a,r) {
  var i = 0, c = 0, m = Math.min(a.t,this.t);
  while(i < m) {
    c += this[i]-a[i];
    r[i++] = c&this.DM;
    c >>= this.DB;
  }
  if(a.t < this.t) {
    c -= a.s;
    while(i < this.t) {
      c += this[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c += this.s;
  }
  else {
    c += this.s;
    while(i < a.t) {
      c -= a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c -= a.s;
  }
  r.s = (c<0)?-1:0;
  if(c < -1) r[i++] = this.DV+c;
  else if(c > 0) r[i++] = c;
  r.t = i;
  r.clamp();
}

// (protected) r = this * a, r != this,a (HAC 14.12)
// "this" should be the larger one if appropriate.
function bnpMultiplyTo(a,r) {
  var x = this.abs(), y = a.abs();
  var i = x.t;
  r.t = i+y.t;
  while(--i >= 0) r[i] = 0;
  for(i = 0; i < y.t; ++i) r[i+x.t] = x.am(0,y[i],r,i,0,x.t);
  r.s = 0;
  r.clamp();
  if(this.s != a.s) BigInteger.ZERO.subTo(r,r);
}

// (protected) r = this^2, r != this (HAC 14.16)
function bnpSquareTo(r) {
  var x = this.abs();
  var i = r.t = 2*x.t;
  while(--i >= 0) r[i] = 0;
  for(i = 0; i < x.t-1; ++i) {
    var c = x.am(i,x[i],r,2*i,0,1);
    if((r[i+x.t]+=x.am(i+1,2*x[i],r,2*i+1,c,x.t-i-1)) >= x.DV) {
      r[i+x.t] -= x.DV;
      r[i+x.t+1] = 1;
    }
  }
  if(r.t > 0) r[r.t-1] += x.am(i,x[i],r,2*i,0,1);
  r.s = 0;
  r.clamp();
}

// (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
// r != q, this != m.  q or r may be null.
function bnpDivRemTo(m,q,r) {
  var pm = m.abs();
  if(pm.t <= 0) return;
  var pt = this.abs();
  if(pt.t < pm.t) {
    if(q != null) q.fromInt(0);
    if(r != null) this.copyTo(r);
    return;
  }
  if(r == null) r = nbi();
  var y = nbi(), ts = this.s, ms = m.s;
  var nsh = this.DB-nbits(pm[pm.t-1]);	// normalize modulus
  if(nsh > 0) { pm.lShiftTo(nsh,y); pt.lShiftTo(nsh,r); }
  else { pm.copyTo(y); pt.copyTo(r); }
  var ys = y.t;
  var y0 = y[ys-1];
  if(y0 == 0) return;
  var yt = y0*(1<<this.F1)+((ys>1)?y[ys-2]>>this.F2:0);
  var d1 = this.FV/yt, d2 = (1<<this.F1)/yt, e = 1<<this.F2;
  var i = r.t, j = i-ys, t = (q==null)?nbi():q;
  y.dlShiftTo(j,t);
  if(r.compareTo(t) >= 0) {
    r[r.t++] = 1;
    r.subTo(t,r);
  }
  BigInteger.ONE.dlShiftTo(ys,t);
  t.subTo(y,y);	// "negative" y so we can replace sub with am later
  while(y.t < ys) y[y.t++] = 0;
  while(--j >= 0) {
    // Estimate quotient digit
    var qd = (r[--i]==y0)?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);
    if((r[i]+=y.am(0,qd,r,j,0,ys)) < qd) {	// Try it out
      y.dlShiftTo(j,t);
      r.subTo(t,r);
      while(r[i] < --qd) r.subTo(t,r);
    }
  }
  if(q != null) {
    r.drShiftTo(ys,q);
    if(ts != ms) BigInteger.ZERO.subTo(q,q);
  }
  r.t = ys;
  r.clamp();
  if(nsh > 0) r.rShiftTo(nsh,r);	// Denormalize remainder
  if(ts < 0) BigInteger.ZERO.subTo(r,r);
}

// (public) this mod a
function bnMod(a) {
  var r = nbi();
  this.abs().divRemTo(a,null,r);
  if(this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r,r);
  return r;
}

// Modular reduction using "classic" algorithm
function Classic(m) { this.m = m; }
function cConvert(x) {
  if(x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
  else return x;
}
function cRevert(x) { return x; }
function cReduce(x) { x.divRemTo(this.m,null,x); }
function cMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
function cSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

Classic.prototype.convert = cConvert;
Classic.prototype.revert = cRevert;
Classic.prototype.reduce = cReduce;
Classic.prototype.mulTo = cMulTo;
Classic.prototype.sqrTo = cSqrTo;

// (protected) return "-1/this % 2^DB"; useful for Mont. reduction
// justification:
//         xy == 1 (mod m)
//         xy =  1+km
//   xy(2-xy) = (1+km)(1-km)
// x[y(2-xy)] = 1-k^2m^2
// x[y(2-xy)] == 1 (mod m^2)
// if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
// should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
// JS multiply "overflows" differently from C/C++, so care is needed here.
function bnpInvDigit() {
  if(this.t < 1) return 0;
  var x = this[0];
  if((x&1) == 0) return 0;
  var y = x&3;		// y == 1/x mod 2^2
  y = (y*(2-(x&0xf)*y))&0xf;	// y == 1/x mod 2^4
  y = (y*(2-(x&0xff)*y))&0xff;	// y == 1/x mod 2^8
  y = (y*(2-(((x&0xffff)*y)&0xffff)))&0xffff;	// y == 1/x mod 2^16
  // last step - calculate inverse mod DV directly;
  // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
  y = (y*(2-x*y%this.DV))%this.DV;		// y == 1/x mod 2^dbits
  // we really want the negative inverse, and -DV < y < DV
  return (y>0)?this.DV-y:-y;
}

// Montgomery reduction
function Montgomery(m) {
  this.m = m;
  this.mp = m.invDigit();
  this.mpl = this.mp&0x7fff;
  this.mph = this.mp>>15;
  this.um = (1<<(m.DB-15))-1;
  this.mt2 = 2*m.t;
}

// xR mod m
function montConvert(x) {
  var r = nbi();
  x.abs().dlShiftTo(this.m.t,r);
  r.divRemTo(this.m,null,r);
  if(x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r,r);
  return r;
}

// x/R mod m
function montRevert(x) {
  var r = nbi();
  x.copyTo(r);
  this.reduce(r);
  return r;
}

// x = x/R mod m (HAC 14.32)
function montReduce(x) {
  while(x.t <= this.mt2)	// pad x so am has enough room later
    x[x.t++] = 0;
  for(var i = 0; i < this.m.t; ++i) {
    // faster way of calculating u0 = x[i]*mp mod DV
    var j = x[i]&0x7fff;
    var u0 = (j*this.mpl+(((j*this.mph+(x[i]>>15)*this.mpl)&this.um)<<15))&x.DM;
    // use am to combine the multiply-shift-add into one call
    j = i+this.m.t;
    x[j] += this.m.am(0,u0,x,i,0,this.m.t);
    // propagate carry
    while(x[j] >= x.DV) { x[j] -= x.DV; x[++j]++; }
  }
  x.clamp();
  x.drShiftTo(this.m.t,x);
  if(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
}

// r = "x^2/R mod m"; x != r
function montSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

// r = "xy/R mod m"; x,y != r
function montMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }

Montgomery.prototype.convert = montConvert;
Montgomery.prototype.revert = montRevert;
Montgomery.prototype.reduce = montReduce;
Montgomery.prototype.mulTo = montMulTo;
Montgomery.prototype.sqrTo = montSqrTo;

// (protected) true iff this is even
function bnpIsEven() { return ((this.t>0)?(this[0]&1):this.s) == 0; }

// (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
function bnpExp(e,z) {
  if(e > 0xffffffff || e < 1) return BigInteger.ONE;
  var r = nbi(), r2 = nbi(), g = z.convert(this), i = nbits(e)-1;
  g.copyTo(r);
  while(--i >= 0) {
    z.sqrTo(r,r2);
    if((e&(1<<i)) > 0) z.mulTo(r2,g,r);
    else { var t = r; r = r2; r2 = t; }
  }
  return z.revert(r);
}

// (public) this^e % m, 0 <= e < 2^32
function bnModPowInt(e,m) {
  var z;
  if(e < 256 || m.isEven()) z = new Classic(m); else z = new Montgomery(m);
  return this.exp(e,z);
}

// protected
BigInteger.prototype.copyTo = bnpCopyTo;
BigInteger.prototype.fromInt = bnpFromInt;
BigInteger.prototype.fromString = bnpFromString;
BigInteger.prototype.clamp = bnpClamp;
BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
BigInteger.prototype.drShiftTo = bnpDRShiftTo;
BigInteger.prototype.lShiftTo = bnpLShiftTo;
BigInteger.prototype.rShiftTo = bnpRShiftTo;
BigInteger.prototype.subTo = bnpSubTo;
BigInteger.prototype.multiplyTo = bnpMultiplyTo;
BigInteger.prototype.squareTo = bnpSquareTo;
BigInteger.prototype.divRemTo = bnpDivRemTo;
BigInteger.prototype.invDigit = bnpInvDigit;
BigInteger.prototype.isEven = bnpIsEven;
BigInteger.prototype.exp = bnpExp;

// public
BigInteger.prototype.toString = bnToString;
BigInteger.prototype.negate = bnNegate;
BigInteger.prototype.abs = bnAbs;
BigInteger.prototype.compareTo = bnCompareTo;
BigInteger.prototype.bitLength = bnBitLength;
BigInteger.prototype.mod = bnMod;
BigInteger.prototype.modPowInt = bnModPowInt;

// "constants"
BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);
// prng4.js - uses Arcfour as a PRNG

function Arcfour() {
  this.i = 0;
  this.j = 0;
  this.S = new Array();
}

// Initialize arcfour context from key, an array of ints, each from [0..255]
function ARC4init(key) {
  var i, j, t;
  for(i = 0; i < 256; ++i)
    this.S[i] = i;
  j = 0;
  for(i = 0; i < 256; ++i) {
    j = (j + this.S[i] + key[i % key.length]) & 255;
    t = this.S[i];
    this.S[i] = this.S[j];
    this.S[j] = t;
  }
  this.i = 0;
  this.j = 0;
}

function ARC4next() {
  var t;
  this.i = (this.i + 1) & 255;
  this.j = (this.j + this.S[this.i]) & 255;
  t = this.S[this.i];
  this.S[this.i] = this.S[this.j];
  this.S[this.j] = t;
  return this.S[(t + this.S[this.i]) & 255];
}

Arcfour.prototype.init = ARC4init;
Arcfour.prototype.next = ARC4next;

// Plug in your RNG constructor here
function prng_newstate() {
  return new Arcfour();
}

// Pool size must be a multiple of 4 and greater than 32.
// An array of bytes the size of the pool will be passed to init()
var rng_psize = 256;
// Random number generator - requires a PRNG backend, e.g. prng4.js

// For best results, put code like
// <body onClick='rng_seed_time();' onKeyPress='rng_seed_time();'>
// in your main HTML document.

var rng_state;
var rng_pool;
var rng_pptr;

// Mix in a 32-bit integer into the pool
function rng_seed_int(x) {
  rng_pool[rng_pptr++] ^= x & 255;
  rng_pool[rng_pptr++] ^= (x >> 8) & 255;
  rng_pool[rng_pptr++] ^= (x >> 16) & 255;
  rng_pool[rng_pptr++] ^= (x >> 24) & 255;
  if(rng_pptr >= rng_psize) rng_pptr -= rng_psize;
}

// Mix in the current time (w/milliseconds) into the pool
function rng_seed_time() {
  rng_seed_int(new Date().getTime());
}

// Initialize the pool with junk if needed.
if(rng_pool == null) {
  rng_pool = new Array();
  rng_pptr = 0;
  var t;
  if(0 && navigator.appName == "Netscape" && navigator.appVersion < "5" && window.crypto) {
    // Extract entropy (256 bits) from NS4 RNG if available
    var z = window.crypto.random(32);
    for(t = 0; t < z.length; ++t)
      rng_pool[rng_pptr++] = z.charCodeAt(t) & 255;
  }  
  while(rng_pptr < rng_psize) {  // extract some randomness from Math.random()
    t = Math.floor(65536 * Math.random());
    rng_pool[rng_pptr++] = t >>> 8;
    rng_pool[rng_pptr++] = t & 255;
  }
  rng_pptr = 0;
  rng_seed_time();
  //rng_seed_int(window.screenX);
  //rng_seed_int(window.screenY);
}

function rng_get_byte() {
  if(rng_state == null) {
    rng_seed_time();
    rng_state = prng_newstate();
    rng_state.init(rng_pool);
    for(rng_pptr = 0; rng_pptr < rng_pool.length; ++rng_pptr)
      rng_pool[rng_pptr] = 0;
    rng_pptr = 0;
    //rng_pool = null;
  }
  // TODO: allow reseeding after first request
  return rng_state.next();
}

function rng_get_bytes(ba) {
  var i;
  for(i = 0; i < ba.length; ++i) ba[i] = rng_get_byte();
}

function SecureRandom() {}

SecureRandom.prototype.nextBytes = rng_get_bytes;
// Depends on jsbn.js and rng.js

// Version 1.1: support utf-8 encoding in pkcs1pad2

// convert a (hex) string to a bignum object
function parseBigInt(str,r) {
  return new BigInteger(str,r);
}

function linebrk(s,n) {
  var ret = "";
  var i = 0;
  while(i + n < s.length) {
    ret += s.substring(i,i+n) + "\n";
    i += n;
  }
  return ret + s.substring(i,s.length);
}

function byte2Hex(b) {
  if(b < 0x10)
    return "0" + b.toString(16);
  else
    return b.toString(16);
}

// PKCS#1 (type 2, random) pad input string s to n bytes, and return a bigint
function pkcs1pad2(s,n) {
  if(n < s.length + 11) { // TODO: fix for utf-8
    console.log("Message too long for RSA");
    return null;
  }
  var ba = new Array();
  var i = s.length - 1;
  while(i >= 0 && n > 0) {
    var c = s.charCodeAt(i--);
    if(c < 128) { // encode using utf-8
      ba[--n] = c;
    }
    else if((c > 127) && (c < 2048)) {
      ba[--n] = (c & 63) | 128;
      ba[--n] = (c >> 6) | 192;
    }
    else {
      ba[--n] = (c & 63) | 128;
      ba[--n] = ((c >> 6) & 63) | 128;
      ba[--n] = (c >> 12) | 224;
    }
  }
  ba[--n] = 0;
  var rng = new SecureRandom();
  var x = new Array();
  while(n > 2) { // random non-zero pad
    x[0] = 0;
    while(x[0] == 0) rng.nextBytes(x);
    ba[--n] = x[0];
  }
  ba[--n] = 2;
  ba[--n] = 0;
  return new BigInteger(ba);
}

// "empty" RSA key constructor
function RSAKey() {
  this.n = null;
  this.e = 0;
  this.d = null;
  this.p = null;
  this.q = null;
  this.dmp1 = null;
  this.dmq1 = null;
  this.coeff = null;
}

// Set the public key fields N and e from hex strings
function RSASetPublic(N,E) {
  if(N != null && E != null && N.length > 0 && E.length > 0) {
    this.n = parseBigInt(N,16);
    this.e = parseInt(E,16);
  }
  else
    console.log("Invalid RSA public key");
}

// Perform raw public operation on "x": return x^e (mod n)
function RSADoPublic(x) {
  return x.modPowInt(this.e, this.n);
}

// Return the PKCS#1 RSA encryption of "text" as an even-length hex string
function RSAEncrypt(text) {
  var m = pkcs1pad2(text,(this.n.bitLength()+7)>>3);
  if(m == null) return null;
  var c = this.doPublic(m);
  if(c == null) return null;
  var h = c.toString(16);
  if((h.length & 1) == 0) return h; else return "0" + h;
}

// Return the PKCS#1 RSA encryption of "text" as a Base64-encoded string
//function RSAEncryptB64(text) {
//  var h = this.encrypt(text);
//  if(h) return hex2b64(h); else return null;
//}

// protected
RSAKey.prototype.doPublic = RSADoPublic;

// public
RSAKey.prototype.setPublic = RSASetPublic;
RSAKey.prototype.encrypt = RSAEncrypt;
//RSAKey.prototype.encrypt_b64 = RSAEncryptB64;
// Copyright (c) 2005-2009  Tom Wu
// All Rights Reserved.
// See "LICENSE" for details.

// Extended JavaScript BN functions, required for RSA private ops.

// Version 1.1: new BigInteger("0", 10) returns "proper" zero
// Version 1.2: square() API, isProbablePrime fix

// (public)
function bnClone() { var r = nbi(); this.copyTo(r); return r; }

// (public) return value as integer
function bnIntValue() {
  if(this.s < 0) {
    if(this.t == 1) return this[0]-this.DV;
    else if(this.t == 0) return -1;
  }
  else if(this.t == 1) return this[0];
  else if(this.t == 0) return 0;
  // assumes 16 < DB < 32
  return ((this[1]&((1<<(32-this.DB))-1))<<this.DB)|this[0];
}

// (public) return value as byte
function bnByteValue() { return (this.t==0)?this.s:(this[0]<<24)>>24; }

// (public) return value as short (assumes DB>=16)
function bnShortValue() { return (this.t==0)?this.s:(this[0]<<16)>>16; }

// (protected) return x s.t. r^x < DV
function bnpChunkSize(r) { return Math.floor(Math.LN2*this.DB/Math.log(r)); }

// (public) 0 if this == 0, 1 if this > 0
function bnSigNum() {
  if(this.s < 0) return -1;
  else if(this.t <= 0 || (this.t == 1 && this[0] <= 0)) return 0;
  else return 1;
}

// (protected) convert to radix string
function bnpToRadix(b) {
  if(b == null) b = 10;
  if(this.signum() == 0 || b < 2 || b > 36) return "0";
  var cs = this.chunkSize(b);
  var a = Math.pow(b,cs);
  var d = nbv(a), y = nbi(), z = nbi(), r = "";
  this.divRemTo(d,y,z);
  while(y.signum() > 0) {
    r = (a+z.intValue()).toString(b).substr(1) + r;
    y.divRemTo(d,y,z);
  }
  return z.intValue().toString(b) + r;
}

// (protected) convert from radix string
function bnpFromRadix(s,b) {
  this.fromInt(0);
  if(b == null) b = 10;
  var cs = this.chunkSize(b);
  var d = Math.pow(b,cs), mi = false, j = 0, w = 0;
  for(var i = 0; i < s.length; ++i) {
    var x = intAt(s,i);
    if(x < 0) {
      if(s.charAt(i) == "-" && this.signum() == 0) mi = true;
      continue;
    }
    w = b*w+x;
    if(++j >= cs) {
      this.dMultiply(d);
      this.dAddOffset(w,0);
      j = 0;
      w = 0;
    }
  }
  if(j > 0) {
    this.dMultiply(Math.pow(b,j));
    this.dAddOffset(w,0);
  }
  if(mi) BigInteger.ZERO.subTo(this,this);
}

// (protected) alternate constructor
function bnpFromNumber(a,b,c) {
  if("number" == typeof b) {
    // new BigInteger(int,int,RNG)
    if(a < 2) this.fromInt(1);
    else {
      this.fromNumber(a,c);
      if(!this.testBit(a-1))	// force MSB set
        this.bitwiseTo(BigInteger.ONE.shiftLeft(a-1),op_or,this);
      if(this.isEven()) this.dAddOffset(1,0); // force odd
      while(!this.isProbablePrime(b)) {
        this.dAddOffset(2,0);
        if(this.bitLength() > a) this.subTo(BigInteger.ONE.shiftLeft(a-1),this);
      }
    }
  }
  else {
    // new BigInteger(int,RNG)
    var x = new Array(), t = a&7;
    x.length = (a>>3)+1;
    b.nextBytes(x);
    if(t > 0) x[0] &= ((1<<t)-1); else x[0] = 0;
    this.fromString(x,256);
  }
}

// (public) convert to bigendian byte array
function bnToByteArray() {
  var i = this.t, r = new Array();
  r[0] = this.s;
  var p = this.DB-(i*this.DB)%8, d, k = 0;
  if(i-- > 0) {
    if(p < this.DB && (d = this[i]>>p) != (this.s&this.DM)>>p)
      r[k++] = d|(this.s<<(this.DB-p));
    while(i >= 0) {
      if(p < 8) {
        d = (this[i]&((1<<p)-1))<<(8-p);
        d |= this[--i]>>(p+=this.DB-8);
      }
      else {
        d = (this[i]>>(p-=8))&0xff;
        if(p <= 0) { p += this.DB; --i; }
      }
      if((d&0x80) != 0) d |= -256;
      if(k == 0 && (this.s&0x80) != (d&0x80)) ++k;
      if(k > 0 || d != this.s) r[k++] = d;
    }
  }
  return r;
}

function bnEquals(a) { return(this.compareTo(a)==0); }
function bnMin(a) { return(this.compareTo(a)<0)?this:a; }
function bnMax(a) { return(this.compareTo(a)>0)?this:a; }

// (protected) r = this op a (bitwise)
function bnpBitwiseTo(a,op,r) {
  var i, f, m = Math.min(a.t,this.t);
  for(i = 0; i < m; ++i) r[i] = op(this[i],a[i]);
  if(a.t < this.t) {
    f = a.s&this.DM;
    for(i = m; i < this.t; ++i) r[i] = op(this[i],f);
    r.t = this.t;
  }
  else {
    f = this.s&this.DM;
    for(i = m; i < a.t; ++i) r[i] = op(f,a[i]);
    r.t = a.t;
  }
  r.s = op(this.s,a.s);
  r.clamp();
}

// (public) this & a
function op_and(x,y) { return x&y; }
function bnAnd(a) { var r = nbi(); this.bitwiseTo(a,op_and,r); return r; }

// (public) this | a
function op_or(x,y) { return x|y; }
function bnOr(a) { var r = nbi(); this.bitwiseTo(a,op_or,r); return r; }

// (public) this ^ a
function op_xor(x,y) { return x^y; }
function bnXor(a) { var r = nbi(); this.bitwiseTo(a,op_xor,r); return r; }

// (public) this & ~a
function op_andnot(x,y) { return x&~y; }
function bnAndNot(a) { var r = nbi(); this.bitwiseTo(a,op_andnot,r); return r; }

// (public) ~this
function bnNot() {
  var r = nbi();
  for(var i = 0; i < this.t; ++i) r[i] = this.DM&~this[i];
  r.t = this.t;
  r.s = ~this.s;
  return r;
}

// (public) this << n
function bnShiftLeft(n) {
  var r = nbi();
  if(n < 0) this.rShiftTo(-n,r); else this.lShiftTo(n,r);
  return r;
}

// (public) this >> n
function bnShiftRight(n) {
  var r = nbi();
  if(n < 0) this.lShiftTo(-n,r); else this.rShiftTo(n,r);
  return r;
}

// return index of lowest 1-bit in x, x < 2^31
function lbit(x) {
  if(x == 0) return -1;
  var r = 0;
  if((x&0xffff) == 0) { x >>= 16; r += 16; }
  if((x&0xff) == 0) { x >>= 8; r += 8; }
  if((x&0xf) == 0) { x >>= 4; r += 4; }
  if((x&3) == 0) { x >>= 2; r += 2; }
  if((x&1) == 0) ++r;
  return r;
}

// (public) returns index of lowest 1-bit (or -1 if none)
function bnGetLowestSetBit() {
  for(var i = 0; i < this.t; ++i)
    if(this[i] != 0) return i*this.DB+lbit(this[i]);
  if(this.s < 0) return this.t*this.DB;
  return -1;
}

// return number of 1 bits in x
function cbit(x) {
  var r = 0;
  while(x != 0) { x &= x-1; ++r; }
  return r;
}

// (public) return number of set bits
function bnBitCount() {
  var r = 0, x = this.s&this.DM;
  for(var i = 0; i < this.t; ++i) r += cbit(this[i]^x);
  return r;
}

// (public) true iff nth bit is set
function bnTestBit(n) {
  var j = Math.floor(n/this.DB);
  if(j >= this.t) return(this.s!=0);
  return((this[j]&(1<<(n%this.DB)))!=0);
}

// (protected) this op (1<<n)
function bnpChangeBit(n,op) {
  var r = BigInteger.ONE.shiftLeft(n);
  this.bitwiseTo(r,op,r);
  return r;
}

// (public) this | (1<<n)
function bnSetBit(n) { return this.changeBit(n,op_or); }

// (public) this & ~(1<<n)
function bnClearBit(n) { return this.changeBit(n,op_andnot); }

// (public) this ^ (1<<n)
function bnFlipBit(n) { return this.changeBit(n,op_xor); }

// (protected) r = this + a
function bnpAddTo(a,r) {
  var i = 0, c = 0, m = Math.min(a.t,this.t);
  while(i < m) {
    c += this[i]+a[i];
    r[i++] = c&this.DM;
    c >>= this.DB;
  }
  if(a.t < this.t) {
    c += a.s;
    while(i < this.t) {
      c += this[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c += this.s;
  }
  else {
    c += this.s;
    while(i < a.t) {
      c += a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c += a.s;
  }
  r.s = (c<0)?-1:0;
  if(c > 0) r[i++] = c;
  else if(c < -1) r[i++] = this.DV+c;
  r.t = i;
  r.clamp();
}

// (public) this + a
function bnAdd(a) { var r = nbi(); this.addTo(a,r); return r; }

// (public) this - a
function bnSubtract(a) { var r = nbi(); this.subTo(a,r); return r; }

// (public) this * a
function bnMultiply(a) { var r = nbi(); this.multiplyTo(a,r); return r; }

// (public) this^2
function bnSquare() { var r = nbi(); this.squareTo(r); return r; }

// (public) this / a
function bnDivide(a) { var r = nbi(); this.divRemTo(a,r,null); return r; }

// (public) this % a
function bnRemainder(a) { var r = nbi(); this.divRemTo(a,null,r); return r; }

// (public) [this/a,this%a]
function bnDivideAndRemainder(a) {
  var q = nbi(), r = nbi();
  this.divRemTo(a,q,r);
  return new Array(q,r);
}

// (protected) this *= n, this >= 0, 1 < n < DV
function bnpDMultiply(n) {
  this[this.t] = this.am(0,n-1,this,0,0,this.t);
  ++this.t;
  this.clamp();
}

// (protected) this += n << w words, this >= 0
function bnpDAddOffset(n,w) {
  if(n == 0) return;
  while(this.t <= w) this[this.t++] = 0;
  this[w] += n;
  while(this[w] >= this.DV) {
    this[w] -= this.DV;
    if(++w >= this.t) this[this.t++] = 0;
    ++this[w];
  }
}

// A "null" reducer
function NullExp() {}
function nNop(x) { return x; }
function nMulTo(x,y,r) { x.multiplyTo(y,r); }
function nSqrTo(x,r) { x.squareTo(r); }

NullExp.prototype.convert = nNop;
NullExp.prototype.revert = nNop;
NullExp.prototype.mulTo = nMulTo;
NullExp.prototype.sqrTo = nSqrTo;

// (public) this^e
function bnPow(e) { return this.exp(e,new NullExp()); }

// (protected) r = lower n words of "this * a", a.t <= n
// "this" should be the larger one if appropriate.
function bnpMultiplyLowerTo(a,n,r) {
  var i = Math.min(this.t+a.t,n);
  r.s = 0; // assumes a,this >= 0
  r.t = i;
  while(i > 0) r[--i] = 0;
  var j;
  for(j = r.t-this.t; i < j; ++i) r[i+this.t] = this.am(0,a[i],r,i,0,this.t);
  for(j = Math.min(a.t,n); i < j; ++i) this.am(0,a[i],r,i,0,n-i);
  r.clamp();
}

// (protected) r = "this * a" without lower n words, n > 0
// "this" should be the larger one if appropriate.
function bnpMultiplyUpperTo(a,n,r) {
  --n;
  var i = r.t = this.t+a.t-n;
  r.s = 0; // assumes a,this >= 0
  while(--i >= 0) r[i] = 0;
  for(i = Math.max(n-this.t,0); i < a.t; ++i)
    r[this.t+i-n] = this.am(n-i,a[i],r,0,0,this.t+i-n);
  r.clamp();
  r.drShiftTo(1,r);
}

// Barrett modular reduction
function Barrett(m) {
  // setup Barrett
  this.r2 = nbi();
  this.q3 = nbi();
  BigInteger.ONE.dlShiftTo(2*m.t,this.r2);
  this.mu = this.r2.divide(m);
  this.m = m;
}

function barrettConvert(x) {
  if(x.s < 0 || x.t > 2*this.m.t) return x.mod(this.m);
  else if(x.compareTo(this.m) < 0) return x;
  else { var r = nbi(); x.copyTo(r); this.reduce(r); return r; }
}

function barrettRevert(x) { return x; }

// x = x mod m (HAC 14.42)
function barrettReduce(x) {
  x.drShiftTo(this.m.t-1,this.r2);
  if(x.t > this.m.t+1) { x.t = this.m.t+1; x.clamp(); }
  this.mu.multiplyUpperTo(this.r2,this.m.t+1,this.q3);
  this.m.multiplyLowerTo(this.q3,this.m.t+1,this.r2);
  while(x.compareTo(this.r2) < 0) x.dAddOffset(1,this.m.t+1);
  x.subTo(this.r2,x);
  while(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
}

// r = x^2 mod m; x != r
function barrettSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

// r = x*y mod m; x,y != r
function barrettMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }

Barrett.prototype.convert = barrettConvert;
Barrett.prototype.revert = barrettRevert;
Barrett.prototype.reduce = barrettReduce;
Barrett.prototype.mulTo = barrettMulTo;
Barrett.prototype.sqrTo = barrettSqrTo;

// (public) this^e % m (HAC 14.85)
function bnModPow(e,m) {
  var i = e.bitLength(), k, r = nbv(1), z;
  if(i <= 0) return r;
  else if(i < 18) k = 1;
  else if(i < 48) k = 3;
  else if(i < 144) k = 4;
  else if(i < 768) k = 5;
  else k = 6;
  if(i < 8)
    z = new Classic(m);
  else if(m.isEven())
    z = new Barrett(m);
  else
    z = new Montgomery(m);

  // precomputation
  var g = new Array(), n = 3, k1 = k-1, km = (1<<k)-1;
  g[1] = z.convert(this);
  if(k > 1) {
    var g2 = nbi();
    z.sqrTo(g[1],g2);
    while(n <= km) {
      g[n] = nbi();
      z.mulTo(g2,g[n-2],g[n]);
      n += 2;
    }
  }

  var j = e.t-1, w, is1 = true, r2 = nbi(), t;
  i = nbits(e[j])-1;
  while(j >= 0) {
    if(i >= k1) w = (e[j]>>(i-k1))&km;
    else {
      w = (e[j]&((1<<(i+1))-1))<<(k1-i);
      if(j > 0) w |= e[j-1]>>(this.DB+i-k1);
    }

    n = k;
    while((w&1) == 0) { w >>= 1; --n; }
    if((i -= n) < 0) { i += this.DB; --j; }
    if(is1) {	// ret == 1, don't bother squaring or multiplying it
      g[w].copyTo(r);
      is1 = false;
    }
    else {
      while(n > 1) { z.sqrTo(r,r2); z.sqrTo(r2,r); n -= 2; }
      if(n > 0) z.sqrTo(r,r2); else { t = r; r = r2; r2 = t; }
      z.mulTo(r2,g[w],r);
    }

    while(j >= 0 && (e[j]&(1<<i)) == 0) {
      z.sqrTo(r,r2); t = r; r = r2; r2 = t;
      if(--i < 0) { i = this.DB-1; --j; }
    }
  }
  return z.revert(r);
}

// (public) gcd(this,a) (HAC 14.54)
function bnGCD(a) {
  var x = (this.s<0)?this.negate():this.clone();
  var y = (a.s<0)?a.negate():a.clone();
  if(x.compareTo(y) < 0) { var t = x; x = y; y = t; }
  var i = x.getLowestSetBit(), g = y.getLowestSetBit();
  if(g < 0) return x;
  if(i < g) g = i;
  if(g > 0) {
    x.rShiftTo(g,x);
    y.rShiftTo(g,y);
  }
  while(x.signum() > 0) {
    if((i = x.getLowestSetBit()) > 0) x.rShiftTo(i,x);
    if((i = y.getLowestSetBit()) > 0) y.rShiftTo(i,y);
    if(x.compareTo(y) >= 0) {
      x.subTo(y,x);
      x.rShiftTo(1,x);
    }
    else {
      y.subTo(x,y);
      y.rShiftTo(1,y);
    }
  }
  if(g > 0) y.lShiftTo(g,y);
  return y;
}

// (protected) this % n, n < 2^26
function bnpModInt(n) {
  if(n <= 0) return 0;
  var d = this.DV%n, r = (this.s<0)?n-1:0;
  if(this.t > 0)
    if(d == 0) r = this[0]%n;
    else for(var i = this.t-1; i >= 0; --i) r = (d*r+this[i])%n;
  return r;
}

// (public) 1/this % m (HAC 14.61)
function bnModInverse(m) {
  var ac = m.isEven();
  if((this.isEven() && ac) || m.signum() == 0) return BigInteger.ZERO;
  var u = m.clone(), v = this.clone();
  var a = nbv(1), b = nbv(0), c = nbv(0), d = nbv(1);
  while(u.signum() != 0) {
    while(u.isEven()) {
      u.rShiftTo(1,u);
      if(ac) {
        if(!a.isEven() || !b.isEven()) { a.addTo(this,a); b.subTo(m,b); }
        a.rShiftTo(1,a);
      }
      else if(!b.isEven()) b.subTo(m,b);
      b.rShiftTo(1,b);
    }
    while(v.isEven()) {
      v.rShiftTo(1,v);
      if(ac) {
        if(!c.isEven() || !d.isEven()) { c.addTo(this,c); d.subTo(m,d); }
        c.rShiftTo(1,c);
      }
      else if(!d.isEven()) d.subTo(m,d);
      d.rShiftTo(1,d);
    }
    if(u.compareTo(v) >= 0) {
      u.subTo(v,u);
      if(ac) a.subTo(c,a);
      b.subTo(d,b);
    }
    else {
      v.subTo(u,v);
      if(ac) c.subTo(a,c);
      d.subTo(b,d);
    }
  }
  if(v.compareTo(BigInteger.ONE) != 0) return BigInteger.ZERO;
  if(d.compareTo(m) >= 0) return d.subtract(m);
  if(d.signum() < 0) d.addTo(m,d); else return d;
  if(d.signum() < 0) return d.add(m); else return d;
}

var lowprimes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997];
var lplim = (1<<26)/lowprimes[lowprimes.length-1];

// (public) test primality with certainty >= 1-.5^t
function bnIsProbablePrime(t) {
  var i, x = this.abs();
  if(x.t == 1 && x[0] <= lowprimes[lowprimes.length-1]) {
    for(i = 0; i < lowprimes.length; ++i)
      if(x[0] == lowprimes[i]) return true;
    return false;
  }
  if(x.isEven()) return false;
  i = 1;
  while(i < lowprimes.length) {
    var m = lowprimes[i], j = i+1;
    while(j < lowprimes.length && m < lplim) m *= lowprimes[j++];
    m = x.modInt(m);
    while(i < j) if(m%lowprimes[i++] == 0) return false;
  }
  return x.millerRabin(t);
}

// (protected) true if probably prime (HAC 4.24, Miller-Rabin)
function bnpMillerRabin(t) {
  var n1 = this.subtract(BigInteger.ONE);
  var k = n1.getLowestSetBit();
  if(k <= 0) return false;
  var r = n1.shiftRight(k);
  t = (t+1)>>1;
  if(t > lowprimes.length) t = lowprimes.length;
  var a = nbi();
  for(var i = 0; i < t; ++i) {
    //Pick bases at random, instead of starting at 2
    a.fromInt(lowprimes[Math.floor(Math.random()*lowprimes.length)]);
    var y = a.modPow(r,this);
    if(y.compareTo(BigInteger.ONE) != 0 && y.compareTo(n1) != 0) {
      var j = 1;
      while(j++ < k && y.compareTo(n1) != 0) {
        y = y.modPowInt(2,this);
        if(y.compareTo(BigInteger.ONE) == 0) return false;
      }
      if(y.compareTo(n1) != 0) return false;
    }
  }
  return true;
}

// protected
BigInteger.prototype.chunkSize = bnpChunkSize;
BigInteger.prototype.toRadix = bnpToRadix;
BigInteger.prototype.fromRadix = bnpFromRadix;
BigInteger.prototype.fromNumber = bnpFromNumber;
BigInteger.prototype.bitwiseTo = bnpBitwiseTo;
BigInteger.prototype.changeBit = bnpChangeBit;
BigInteger.prototype.addTo = bnpAddTo;
BigInteger.prototype.dMultiply = bnpDMultiply;
BigInteger.prototype.dAddOffset = bnpDAddOffset;
BigInteger.prototype.multiplyLowerTo = bnpMultiplyLowerTo;
BigInteger.prototype.multiplyUpperTo = bnpMultiplyUpperTo;
BigInteger.prototype.modInt = bnpModInt;
BigInteger.prototype.millerRabin = bnpMillerRabin;

// public
BigInteger.prototype.clone = bnClone;
BigInteger.prototype.intValue = bnIntValue;
BigInteger.prototype.byteValue = bnByteValue;
BigInteger.prototype.shortValue = bnShortValue;
BigInteger.prototype.signum = bnSigNum;
BigInteger.prototype.toByteArray = bnToByteArray;
BigInteger.prototype.equals = bnEquals;
BigInteger.prototype.min = bnMin;
BigInteger.prototype.max = bnMax;
BigInteger.prototype.and = bnAnd;
BigInteger.prototype.or = bnOr;
BigInteger.prototype.xor = bnXor;
BigInteger.prototype.andNot = bnAndNot;
BigInteger.prototype.not = bnNot;
BigInteger.prototype.shiftLeft = bnShiftLeft;
BigInteger.prototype.shiftRight = bnShiftRight;
BigInteger.prototype.getLowestSetBit = bnGetLowestSetBit;
BigInteger.prototype.bitCount = bnBitCount;
BigInteger.prototype.testBit = bnTestBit;
BigInteger.prototype.setBit = bnSetBit;
BigInteger.prototype.clearBit = bnClearBit;
BigInteger.prototype.flipBit = bnFlipBit;
BigInteger.prototype.add = bnAdd;
BigInteger.prototype.subtract = bnSubtract;
BigInteger.prototype.multiply = bnMultiply;
BigInteger.prototype.divide = bnDivide;
BigInteger.prototype.remainder = bnRemainder;
BigInteger.prototype.divideAndRemainder = bnDivideAndRemainder;
BigInteger.prototype.modPow = bnModPow;
BigInteger.prototype.modInverse = bnModInverse;
BigInteger.prototype.pow = bnPow;
BigInteger.prototype.gcd = bnGCD;
BigInteger.prototype.isProbablePrime = bnIsProbablePrime;

// JSBN-specific extension
BigInteger.prototype.square = bnSquare;

// BigInteger interfaces not implemented in jsbn:

// BigInteger(int signum, byte[] magnitude)
// double doubleValue()
// float floatValue()
// int hashCode()
// long longValue()
// static BigInteger valueOf(long val)
// Depends on rsa.js and jsbn2.js

// Version 1.1: support utf-8 decoding in pkcs1unpad2

// Undo PKCS#1 (type 2, random) padding and, if valid, return the plaintext
function pkcs1unpad2(d,n) {
  var b = d.toByteArray();
  var i = 0;
  while(i < b.length && b[i] == 0) ++i;
  if(b.length-i != n-1 || b[i] != 2)
    return null;
  ++i;
  while(b[i] != 0)
    if(++i >= b.length) return null;
  var ret = "";
  while(++i < b.length) {
    var c = b[i] & 255;
    if(c < 128) { // utf-8 decode
      ret += String.fromCharCode(c);
    }
    else if((c > 191) && (c < 224)) {
      ret += String.fromCharCode(((c & 31) << 6) | (b[i+1] & 63));
      ++i;
    }
    else {
      ret += String.fromCharCode(((c & 15) << 12) | ((b[i+1] & 63) << 6) | (b[i+2] & 63));
      i += 2;
    }
  }
  return ret;
}

// Set the private key fields N, e, and d from hex strings
function RSASetPrivate(N,E,D) {
  if(N != null && E != null && N.length > 0 && E.length > 0) {
    this.n = parseBigInt(N,16);
    this.e = parseInt(E,16);
    this.d = parseBigInt(D,16);
  }
  else
    console.log("Invalid RSA private key");
}

// Set the private key fields N, e, d and CRT params from hex strings
function RSASetPrivateEx(N,E,D,P,Q,DP,DQ,C) {
  if(N != null && E != null && N.length > 0 && E.length > 0) {
    this.n = parseBigInt(N,16);
    this.e = parseInt(E,16);
    this.d = parseBigInt(D,16);
    this.p = parseBigInt(P,16);
    this.q = parseBigInt(Q,16);
    this.dmp1 = parseBigInt(DP,16);
    this.dmq1 = parseBigInt(DQ,16);
    this.coeff = parseBigInt(C,16);
  }
  else
    console.log("Invalid RSA private key");
}

// Generate a new random private key B bits long, using public expt E
function RSAGenerate(B,E) {
  var rng = new SecureRandom();
  var qs = B>>1;
  this.e = parseInt(E,16);
  var ee = new BigInteger(E,16);
  for(;;) {
    for(;;) {
      this.p = new BigInteger(B-qs,1,rng);
      if(this.p.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && this.p.isProbablePrime(10)) break;
    }
    for(;;) {
      this.q = new BigInteger(qs,1,rng);
      if(this.q.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && this.q.isProbablePrime(10)) break;
    }
    if(this.p.compareTo(this.q) <= 0) {
      var t = this.p;
      this.p = this.q;
      this.q = t;
    }
    var p1 = this.p.subtract(BigInteger.ONE);
    var q1 = this.q.subtract(BigInteger.ONE);
    var phi = p1.multiply(q1);
    if(phi.gcd(ee).compareTo(BigInteger.ONE) == 0) {
      this.n = this.p.multiply(this.q);
      this.d = ee.modInverse(phi);
      this.dmp1 = this.d.mod(p1);
      this.dmq1 = this.d.mod(q1);
      this.coeff = this.q.modInverse(this.p);
      break;
    }
  }
}

// Perform raw private operation on "x": return x^d (mod n)
function RSADoPrivate(x) {
  if(this.p == null || this.q == null)
    return x.modPow(this.d, this.n);

  // TODO: re-calculate any missing CRT params
  var xp = x.mod(this.p).modPow(this.dmp1, this.p);
  var xq = x.mod(this.q).modPow(this.dmq1, this.q);

  while(xp.compareTo(xq) < 0)
    xp = xp.add(this.p);
  return xp.subtract(xq).multiply(this.coeff).mod(this.p).multiply(this.q).add(xq);
}

// Return the PKCS#1 RSA decryption of "ctext".
// "ctext" is an even-length hex string and the output is a plain string.
function RSADecrypt(ctext) {
  var c = parseBigInt(ctext, 16);
  var m = this.doPrivate(c);
  if(m == null) return null;
  return pkcs1unpad2(m, (this.n.bitLength()+7)>>3);
}

// Return the PKCS#1 RSA decryption of "ctext".
// "ctext" is a Base64-encoded string and the output is a plain string.
//function RSAB64Decrypt(ctext) {
//  var h = b64tohex(ctext);
//  if(h) return this.decrypt(h); else return null;
//}

// protected
RSAKey.prototype.doPrivate = RSADoPrivate;

// public
RSAKey.prototype.setPrivate = RSASetPrivate;
RSAKey.prototype.setPrivateEx = RSASetPrivateEx;
RSAKey.prototype.generate = RSAGenerate;
RSAKey.prototype.decrypt = RSADecrypt;
//RSAKey.prototype.b64_decrypt = RSAB64Decrypt;

//hack utf-8
// var UTF8 = {
    // encode: function($input) {
        // // $input = $input.replace(/\r\n/g,"\n");
        // var $output = "";
        // for (var $n = 0; $n < $input.length; $n++) {
            // var $c = $input.charCodeAt($n);
            // if ($c < 128) {
                // $output += String.fromCharCode($c);
            // } else if (($c > 127) && ($c < 2048)) {
                // $output += String.fromCharCode(($c >> 6) | 192);
                // $output += String.fromCharCode(($c & 63) | 128);
            // } else {
                // $output += String.fromCharCode(($c >> 12) | 224);
                // $output += String.fromCharCode((($c >> 6) & 63) | 128);
                // $output += String.fromCharCode(($c & 63) | 128);
            // }
        // }
        // return $output;
    // },
    // decode: function($input) {
        // var $output = "";
        // var $i = 0;
        // var $c = $c1 = $c2 = 0;
        // while ( $i < $input.length ) {
            // $c = $input.charCodeAt($i);
            // if ($c < 128) {
                // $output += String.fromCharCode($c);
                // $i++;
            // } else if(($c > 191) && ($c < 224)) {
                // $c2 = $input.charCodeAt($i+1);
                // $output += String.fromCharCode((($c & 31) << 6) | ($c2 & 63));
                // $i += 2;
            // } else {
                // $c2 = $input.charCodeAt($i+1);
                // $c3 = $input.charCodeAt($i+2);
                // $output += String.fromCharCode((($c & 15) << 12) | (($c2 & 63) << 6) | ($c3 & 63));
                // $i += 3;
            // }
        // }
        // return $output;
    // }
// };

var runnable =function(fw, getDbCollectionHandler,ObjectId){
    var rsa_options = {
        e : "3",//public
    };
    
    
    fw.addSubPackage('myrsa');
    
    
    //rsa加密
    var _encrypt = function(string,pk2){//对string进行rsa加密
        //public-key2,用对方的public-key进行加密
        var rsa = new RSAKey();
        var result = '';
        rsa.setPublic(pk2, rsa_options.e);
        
        var res = rsa.encrypt(string);
        if (res) {
            res = linebrk(res, 64);
        }
        return res;
    };
    
    //rsa解密
    var _decrypt = function(string){//对string进行rsa解密
      //解密就按照自己的sk进行解密就可以了，因为都是对方用自己的pk进行的加密
      var rsa = new RSAKey();
      if(string.length == 0) {
        return string;
      }
      rsa.setPrivateEx(rsa_options.n, rsa_options.e, rsa_options.d, rsa_options.p, rsa_options.q, rsa_options.dmp1, rsa_options.dmq1, rsa_options.coeff);
      var res = rsa.decrypt(string);
      if(res) {
        res = res;
      }
      return res;
    };
    
    var encrypt = function(string,withpk) {
        if (typeof string !=='string' || !enableRsa()) {
            console.log("RSA encrypt canceled",string)
            return string;
        }
        if (!rsa_options.pk2 && typeof withpk === 'undefined') {
            console.log("pk2 没传入，rsa加密不启用");
            return string;
        }
        withpk = (typeof withpk === 'string')? withpk : rsa_options.pk2;
        var tmp = [];
        for (var i=0,len = string.length; i < len ; i += 5 ) {
            tmp.push(_encrypt(string.substr(i,5),withpk));
        }
        return tmp.join("|");
    }
    var decrypt = function(string) {
        if (typeof string !=='string' || !enableRsa()) {
            console.log("RSA decrypt canceled",string)
            return string;
        }
        
        var str = '';
        var tmp = string.split("|");//分段分别decode
        
        for (var i=0,len = tmp.length; i < len ; i ++ ) {
            str += _decrypt(tmp[i]);
        }
        // str = UTF8.decode(str);
        
        return str;
    }
    //生成rsa密钥
    var generate = function(bits){
        var rsa = new RSAKey();
        rsa_options.bits = typeof bits === 'number' ? bits : 128;
        rsa.generate(parseInt(rsa_options.bits), rsa_options.e);
        rsa_options.n = linebrk(rsa.n.toString(16), 64);
        rsa_options.d = linebrk(rsa.d.toString(16), 64);
        rsa_options.p = linebrk(rsa.p.toString(16), 64);
        rsa_options.q = linebrk(rsa.q.toString(16), 64);
        rsa_options.dmp1 = linebrk(rsa.dmp1.toString(16), 64);
        rsa_options.dmq1 = linebrk(rsa.dmq1.toString(16), 64);
        rsa_options.coeff = linebrk(rsa.coeff.toString(16), 64); 
        return rsa_options;
    };
    var getPk = function() {
        return rsa_options.n;
    };
    var setPk2 = function(pk2) {
        rsa_options.pk2 = pk2;
    };
    var enableRsa = function(){
        return fw.config.get("rsa_enable");
    }
    var getPk2  = function() {
        return rsa_options.pk2;
    }
    
    if (typeof getDbCollectionHandler !=='undefined') {//server read
        // if (!rsaSk && fw.config.get("rsa_enable")) {
            // throw new Error("rsa sk not found,read error!","00");
        // }
        // rsa_options = rsaSk;
        generate();//server生成
    }
    
    // fw.myrsa.__reg('enableRsa', enableRsa, 'private');
    fw.myrsa.__reg('encrypt', encrypt, 'private');
    fw.myrsa.__reg('decrypt', decrypt, 'private');
    fw.myrsa.__reg('generate', generate, 'private');
    fw.myrsa.__reg('getPk', getPk, 'private');
    fw.myrsa.__reg('setPk2', setPk2, 'private');
    fw.myrsa.__reg('getPk2', getPk2, 'private');
    
    
    //我要存储server的密钥
    
    //我要每个session生成client的密钥
    
};

if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{//这里是前端
    runnable(sumeru);
}
;/**
 * 对传入及传出的网络消息进行包装及派发
 * 
 * 消息从发送端到接收端的顺序为
 * [原始消息] -> [messageWrapper打包方法] -> [发送至目的端(websocket???)] -> [messageWrapper拆包] -> [根据number调用派发回调]
 * 
 * 消息格式为
 * 
 * msgStr = {
 *     number:xxx,
 *     type:"json|simple",
 *     target:'',
 *     content:{
 *         
 *     }
 * }
 * 
 * default number : handleName  
 *            "0" : "onLocalMessage",         // 随便什么鬼地方去接收，但不从网络进行派发,当前由于client端存在这种使用情况.所以在此预留
 *          "100" : "onError",                // 两侧通用为处理错误消息
 *          "200" : "onMessage",              // 两侧能用为处理数据消息
 *          "300" : "onGlobalError",          // to client only, 两端都存在，但只有client端目前存在使用场景
 *          "400" : "onGlobalMessage",        // to client only, 两端都存在，但只有client端目前存在使用场景
 *          "500" : "onLogMessage",           // one-way , client to server, 记录日志,开发时向server发送log. 线上可以不接收
 *          "600" : "onS2SMessage"
 * 
 * 以上为默认处理，如需扩展，使用setACL(number , handleName) 进行添加,
 * 未在列表中记录的codenumber将被默认丢弃,记录但未找到处理handle的，将触发一个错误.
 * 
 * 如果handleName指明的处理方法明确返回false将被认为消息未被派送成功. 
 *      如果当前运行环境在client端，将会尝试将消息发往onGlobalxxxx进行处理，如果再无法处理，则丢弃消息
 * 
 * type :
 *       json    类型将被当做json字符串被解析并传入
 *       simple  认为只是一个简单的值，首次被解析的类型即被传出，
 *               由于端与端之间的传输格式均为json，所以首次被解析出的值，可以是任何数据类型,但被限制为number,boolean,string等.
 *
 * target : 
 *       用于缩短派发路径的分类标识,收到消息时，对消息中携带的标签进行比对，并派发送至匹配的接收者.
 * 
 * content : 根据type变化，可能是不同内容，当type为json时，为字符串值，simple为简单值
 * 
 */

var runnable = function(fw){
    
    /**
     * 如果存在当前包空间，则直接跳出，防止重复创建对像
     */
    if(fw.netMessage){
        fw.dev('netMessage already existed.');
        return;
    }
    
    var msgWrapper = fw.addSubPackage('netMessage');
    
    var Default_Message_ACL = {
              "0" : "onLocalMessage",
            "100" : "onError",
            "200" : "onMessage",
            "300" : "onGlobalError",            // to client only
            "400" : "onGlobalMessage",          // to client only
            "500" : "onLogMessage"              // one-way , client to server
            //"600" : "onS2SMessage"            // server only, auto add on , when isServer === true
    };
    var arrSplice = Array.prototype.splice;
    var isServer = fw.IS_SUMERU_SERVER;
    var currentACL = Object.create(Default_Message_ACL);
    var receiver = null;
    var output = null;
    var inited_OutHandle = false;
    
    var outputToServer = null;
    
	var inFilter = [] , inFilterRun = [];
    var outFilter = [] , outFilterRun = [];
    
    var filterToArray = function(filterArr){
      var rv = [];
      filterArr.forEach(function(item){
          rv.push(item.filter);
      });
      return rv;
    };
    
    /**
     * 从消息串还原为messageData并进行验证
     */
    var decodeMessage = function(msgStr){
        // 解密并还原json对像
        var message = fw.utils.parseJSON(msgStr);
        // 如有结构丢失，则返回false
        if(message.number === undefined || message.type === undefined || message.content === undefined){
            return false;
        }
        return message;
    };
    
    /**
     * 创建一个消息对像
     * number 消息类型的编码
     * data 消息内容
     */
    var encodeMessage = function(data,number,target){
        
        var message = {number:(number + ""), type:null, target: (target + ""), content:null};
        
        // 自动识别type
        if(fw.utils.isSimpleType(data)){
            message.type = 'simple';
            message.content = data;
        }else{
            message.type = 'json';
            message.content = (number !== '0' ? JSON.stringify(data) : data);
        }
        return message;
    };
    
    /**
     * 输出消息
     */
    var send = function(msg){
        var __out = null;
        
        if(msg.number === "0" ){                         // 本地派发
            return dispatch(msg);
        }
        
        if(isServer === true && msg.number === "600"){  // server to server
            __out = outputToServer;
        }else{
            __out = output;
        }
        
        // 如果不是本地派发，并且没有派送方法直接抛出异常
        if(__out === null){
            throw 'no output';
        }
        
        // 序列化msg对像为json字符串并进行加密
        Array.prototype.splice.call(arguments,0,1, JSON.stringify(msg));
        
        //始终携带发送消息时的参数
        return __out.apply({},arguments);
    };
    
    /**
     * 创建外发方法的代理方法
     *  
     *  访法返回的代理方法，用于向外发送消息。携带参数为
     *      data     :   外发的数据对像。
     *      target   :   对方的接收目标。
     *      ....     :   可选的用于实际send方法(setOutput时设置的方法)的控制参数。
     *      onerror  :   当发送失败时的通知方法，该方法可由实际的send方法或过滤器触发。
     *      onSuccess:   当发送成功时的通知方法，该方法由实际send方法触发。
     *  @param number 代理消息的类型
     *  @returns {function} 创建的可执行方法
     */
    var createHandle = function(number){
        return function(data,target/*,.....,onError,onSuccess*/){
            var msg = encodeMessage(data,number,target);
            
            //取出传出方法的调用参数
            var params = arrSplice.call(arguments,0);
            
            // 过滤器停止过滤时，执行的错误通知方法
            var _onerror = params[params.length -2];
            
            if(outFilterRun.length !== 0){
                // 过滤chain
                var run = fw.utils.chain(outFilterRun,function(msg){
                    //替换消息对像,并删除target参数，然后传入send方法
                    params.splice(0,2,msg);
                    //始终携带发送消息时的参数,从用户调用sendXXXX方法至output应该是透明的，所有参数必须原样携带过去,仅对消息内容进行封装
                    send.apply({},params);
                });
                // 过滤器只需要传入msg对像及一个派发失败的方法，过滤器所接收的onsuccess方法，为chain自动传入。
                run(msg, _onerror instanceof Function ? _onerror : function(){});
            }else{
                //替换消息对像,并删除target参数，然后传入send方法
                params.splice(0,2,msg);
                //始终携带发送消息时的参数,从用户调用sendXXXX方法至output应该是透明的，所有参数必须原样携带过去,仅对消息内容进行封装
                send.apply({},params);
            }
            
//            var item;
//            for(var index in outFilter){
//                try{
//                    item = outFilter[index];
//                    msg = item.filter(msg);
//                }catch(e){
//                    // 明确抛出die，则停止消息传输及派发
//                    if(e == 'die'){ 
//                        return false;
//                    }
//                }
//            }
            
//            //替换消息对像,并删除target参数，然后传入send方法
//            Array.prototype.splice.call(arguments,0,2,msg);
//            
//            //始终携带发送消息时的参数,从用户调用sendXXXX方法至output应该是透明的，所有参数必须原样携带过去,仅对消息内容进行封装
//            return send.apply({},arguments);
        };
    };
    
    /**
     * 创建消息派发方法
     */
    var makeOutHandle = function(){
        var handleName;
        for(var number in currentACL){
            handleName = currentACL[number];
            handleName = 'send' + handleName.substr(2);
            msgWrapper.__reg(handleName,createHandle(number));
        }
        inited_OutHandle = true;
    };
    
    var shortFilter = function(a,b){
        return a.order < b.order;
    };
    
    
    /**
     * 传入过滤器，
     * 
     * 与传出过滤器不同的是，由于传入消息的发起者不在同一端上，所以不需要onerror对像通知调用者，对于失败的消息，不执行onsuccess即可停止派发过程.
     * 
     * @param fun {function(msg,onsuccess){}}  
     *          方法增加至消息接收时执行的过滤器链上，过滤器接收二个参数 
     *              msg        为传出消息
     *              onsuccess  当前过滤器处理成功，可以执行下一个过滤器时，执行该方法;
     * @order {number} 指定过滤器执行的优先级别，数字越大越优先执行默认将放在最后
     */
    msgWrapper.__reg("addInFilter",function(fun,order){
        
        // FIXME 为兼容之前同步过滤的写法，这里在对只接受一个参数的过滤器，做一层代理方法。自动调用回调,
        // 如果最终统一使用异步写法，此处的处理可以省略。
        var filter = fun.length == 2 ? function(msg,conn,onsuccess){
            var rv = null;
            try{
                rv = fun(msg,conn);
            }catch(e){
                fw.log(e);
                return ;
            }
            onsuccess(rv,conn);
        } :  fun;
        
        inFilter.push({'filter':filter,'order':order === undefined ? Number.MIN_VALUE : order});
        inFilter.sort(shortFilter);
        inFilterRun = filterToArray(inFilter);
    },false);
    
    
    /**
     * 传出过滤器，
     * 
     * @param fun {function(msg,onerror,onsuccess){}}  
     *          方法增加至消息发送时执行的过滤器链上，过滤器接收三个参数 
     *              msg 为传出消息
     *              onerror    过滤器处理失败时通知方法，实际执行对像为调用sendXXXXX时的onerror方法.
     *              onsuccess  当前过滤器处理成功，可以执行下一个过滤器时，执行该方法;
     * @order {number} 指定过滤器执行的优先级别，数字越大越优先执行默认将放在最后
     *  
     */
    msgWrapper.__reg("addOutFilter",function(fun,order){
        
        // FIXME 为兼容之前同步过滤的写法，这里在对只接受一个参数的过滤器，做一层代理方法。自动调用回调;
        // 如果最终统一使用异步写法，此处的处理可以省略。
        var filter = fun.length == 1 ? function(msg,onerror,onsuccess){
            var rv = null;
            try{
                rv = fun(msg);
            }catch(e){
                onerror(e);
            }
            onsuccess(rv,onerror);
        } : fun;
        
        outFilter.push({'filter':filter,'order':order === undefined ? Number.MIN_VALUE : order});
        outFilter.sort(shortFilter);
        outFilterRun = filterToArray(outFilter);
    },false);
    
    /**
     * 接收数据并派发
     * @param msgStr 数据内容
     * @param conn 连接对像, 运行于server端时会使用这个参数携带连接实例
     */
    // var onData = 
    msgWrapper.__reg("onData",function(msgStr,conn){
        var message = decodeMessage(msgStr);
        if(isServer && fw.SUMERU_APP_FW_DEBUG === false){
            try {
                dispatch(message, conn);
            } catch (e) {
                // TODO: handle exception
                console.error(e);
            }
        }else{
            dispatch(message, conn);
        }
    },false);
    
    // var setACL = 
    msgWrapper.__reg("addACL",function(number,handleName){
        var __name = handleName;
        
        if(handleName.indexOf("on") !== 0){
            __name = "on" + handleName.substr(0,1).toUpperCase() + handleName.substr(1);
        }
        
        // 防止默认ACL被覆盖
        if(Default_Message_ACL[number] === undefined){
            currentACL[number] = __name;
            makeOutHandle();
        }
    },false);
    
  
    /**
     * 设置发送消息出口
     */
    //var setOutput = 
    msgWrapper.__reg("setOutput",function(__output){
        if(__output instanceof Function){
            output = __output;
        }else{
            throw "__output is not a function.";
        }
    },false);
    
    /**
     * 如果运行在server端，补充600的消息号，并添加 setOutputToServer的方法用于设置服务端互送消息的方法
     */
    if(isServer){
        Default_Message_ACL["600"] = "onS2SMessage";             // server only
        msgWrapper.__reg('setOutputToServer',function(__output){
            if(__output instanceof Function){
                outputToServer = __output;
            }else{
                throw "__output is not a function.";
            }
        });
    }
    
    /**
     * 设置接收消息的出口
     */
    //var setReceiver = 
    msgWrapper.__reg('setReceiver',function(__receiver){
        receiver = receiver || {};
        
        /*
         * 此处只接受在于currentACL中存在的number所对应的handle,其它项，统统忽略
         */
        // merge and overwrite
        var handleName , target , handle , receiverItem , insert, overwrite = false;
        for ( var number in currentACL) {
            handleName = currentACL[number];
            insert = __receiver[handleName];
            
            if(insert === undefined){
                continue;
            }else if(insert  instanceof Function){
                // 默认 
                target = '';
                handle = insert;
            }else{
                // 如果不指定target，默认为 ''
                target = insert.target || '';
                overwrite = !!insert.overwrite;
                if(! (handle = insert.handle) instanceof Function){
                    continue;
                }
                
                handle.once = !!insert.once;
            }

            /*
             * 一个handleName，对应一组标签 ，一个标签对应一个处理函数，
             * 如果存在标签为'' 的，则认为是默认的处理函数，将自动接收目标为当前handleName,但找不到匹配target的所有消息.
             */
            receiverItem = receiver[handleName] = receiver[handleName] || {};
            
            /*
             * FIXME: 此处不处理handle重复的情况,只是按顺序推入数组
             */
            //debugger;
            if(Array.isArray(target)){
                target.forEach(function(item){
                    
                    if(overwrite === true || !this[item]){
                        // 指明需要复盖之前的handle时,直接替换
                        this[item] = [handle];
                    }else if(Array.isArray(this[item]) === true){
                        this[item].push(handle);
                    }
                },receiverItem);
            }else{
                if(overwrite === true || !receiverItem[target]){
                    // 指明需要复盖之前的handle时,直接替换
                    receiverItem[target] = [handle];
                }else if(Array.isArray(receiverItem[target]) === true){
                    receiverItem[target].push(handle);
                }
            }
        }
        
        Object.keys(currentACL).forEach(function(item){
            if(this[currentACL[item]] instanceof Function){
                receiver[currentACL[item]] = this[currentACL[item]];
            }
        },__receiver);
        
        // 只在没有handle的时候执行,如果已创建则不在创建.
        // 这个判断不放在make out handle的时候是因为addAcl的时候要无条件执行makeOutHandle
        if(inited_OutHandle == false){
            makeOutHandle();
        }
    },false);
    
    /**
     * 派发消息
     * @param data {obj} 派发的消息
     * @returns {boolean} true派发成功 , false派发失败
     */
    var dispatch = function(data,conn){
        var handleName = null , handle = null;
        var rs = false , content = null;
        
        if(receiver === null){
            throw 'no receiver';                                        // 当为null时，说明一次setReceiver都没有执行过，当前状态没有任何派发能力
        }
        
        if(data.number === undefined){
            return false;                                               // 结构丢失，直接抛弃; 
        }
        
        if((handleName = currentACL[data.number]) === undefined){
            fw.log("unidentifiable message number");               // 无有效派发方法，直接返回false表示失败;
            return false;                                               // 未指定派发方法名称，直接返回false表示失败
        }else if(receiver[handleName] === undefined){
            fw.log("no receiver found");                          // 无有效派发方法，直接返回false表示失败;
            return false;
        }
        
        handle = receiver[handleName][data.target || ""];
        
        // 如果未找到指定标签的派发获到默认派发
        if(handle === undefined && data.target !== ""){
            
            handle = receiver[handleName][""];
            
            // 如果没有连默认派发，只能认为派发失败
            if(handle === undefined){
                return false;
            }
        }
        
        var oncomplete = function(){
            if(data.type == 'json' && data.number !== "0"){
                content = fw.utils.parseJSON(data.content);
            }else{
                content = data.content;
            }
            
            var onceArr = [];   // 执行一次即需要被清除的
            
            handle.forEach(function(fun,index){
                /*
                 * 派发数据,
                 * 防止一个处理错误的时候相同数据被反复派发,这里目前判断失败的方法是全部处理都反回false的情况才认为是失败.
                 */
                if(fun instanceof Function){
                    rs = rs || fun(content,data.target,conn);
                }
                
                if(fun.once){
                    onceArr.push(index);
                }
            });
            //debugger;
            if(onceArr.length > 0){
                // 如果两个长度相同,则直接清理当前的所有标签,否则需要清理数组
                if(onceArr.length == handle.length){
                    handle.length = 0;      // 清空数组;
                    delete receiver[handleName][data.target || ""];
                }else{
                    var index = undefined;
                    while((index = onceArr.pop()) !== undefined){
                        handle.splice(index,1);
                    }
                }
            }
            
            
            if(rs === false && data.number == "100"){
                data.number = "300";  
                return dispatch(data,conn);              // 当100派发失败，尝试300派发. 如果再次失败，则丢弃;
            }
            
            if(rs === false && data.number == "200"){
                data.number = "400";  
                return dispatch(data,conn);              // 当200派发失败，尝试400派发. 如果再次失败，则丢弃;
            }
        };
        
        if(inFilterRun.length !== 0){
            var run = fw.utils.chain(inFilterRun,oncomplete);
            run(data,conn);
        }else{
            oncomplete();
        }
        
//        // 过滤chain
//        var item;
//        for(var index in inFilter){
//            try{
//                item = inFilter[index];
//                data = item.filter(data,conn);
//            }catch(e){
//                // 明确抛出die，则停止消息传输及派发
//                if(e == 'die'){ 
//                    return false;
//                }
//            }
//        }
//        
//        
//        return rs;
    };
    
//    if(typeof module !='undefined' && module.exports){
//        module.exports = function(){
//        };
//    }
    
    fw.dev("runing [NetMessage] in " + ( fw.IS_SUMERU_SERVER ? "server" : "client"));
    return msgWrapper;
};


if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
}
;var runnable = function(fw){
	(function(fw){
		// sense　对像空间
		if (fw.sense)return fw.sense;
		var sense = fw.addSubPackage('sense');
		
		/**
		 * runSenseContext执行的方法周期内，将创建inspector，用于监视用户处理逻辑中的getter方法的执行.
		 * 在用户处理逻辑完成后自动销毁，使在runSenseContext方法周期外的用户逻辑代码，不再重复监听getter.
		 * 
		 * @param customClosure {function} 用户方法，在此方法中使用的所有sense对像，将被监听.
		 */
		sense.__reg('runSenseContext',function(customClosure){
			/*
			 * 监视器,用于监视customClosure的执行过程中，对sense对像的调用.
			 */
			sense.__reg('_senseInspector', function(senseObjInstance, key){
				senseObjInstance.addObserver(key, customClosure);
			}, true);
			
			//FIXME 如果用户逻辑中存在异步调用或setTimeout，将导到依赖关系丢失。
			// 触发用户处理过程
			customClosure();
			
			//用户代码执行完成后，销毁inspector
			sense.__reg('_senseInspector', function(){}, true);
		});
		
		var Sense = {
				/**
				 * 根据键名取得键值.如果触发时间点在runSenseContext的方法周期中,将向外部检查器注册当前context中，对某个key的依赖.
				 * @param key
				 * @returns　{any}
				 */
				get:function(key){
					sense._senseInspector && sense._senseInspector(this, key);
					if( typeof this.container != 'object') {
						 console.warn('no container error in sense get on line 38 '+key);
						return;
					}
					return this.container[key];
				},
				/**
				 * 设置或修改键值
				 * @param key {string}
				 * @param value　{any}
				 */
				set:function(key, value){
					this.container[key] = value;
					
					if(this.observer.length != 0){
						for(var i = 0, l = this.observer.length; i < l; i++){
							if(this.observer[i].key != key  || this.toBeCommited.some(function(item){
								return item(this.observer[i]);
							},this)){
								continue;
							}
							this.toBeCommited.push((function(that, observerItem){
								return function(checkObserver){
									if(arguments.length === 0 ){
										//fw.dev('exec customCloser', observerItem.customClosure.length);
										observerItem.customClosure.call(that, key);
									}else{
										return checkObserver == observerItem;
									}
								};
							})(this, this.observer[i]));
						}
					}
				},
				/**
				 * 确认修改session，并自动重新触发对相关依赖的用户方法.
				 * @returns {Boolean}
				 */
				commit:function(){
					var toBeCommited = this.toBeCommited;
					if(toBeCommited.length === 0){
						return true;
					}
					
					var tapped_blocks = [];
					fw.controller.__reg('_tapped_blocks', tapped_blocks, true);
					
					for (var i = 0, l = toBeCommited.length; i < l; i++){
						toBeCommited[i]();
					}
					
					//每个Controller的render方法会保证局部渲染一定等待主渲染流程完成才开始。
					fw.controller.__load('reactiveRender')(tapped_blocks);
				
					toBeCommited.length = 0;
				},
				addObserver:function(key, customClosure){
					// 去重
					for(var i = 0, l = this.observer.length; i < l; i++){
						if(this.observer[i].key === key && this.observer[i].customClosure == customClosure ){
							return; //两个函数不会相等的，不知道谁写的，但这行永远不会执行 FIXME ，上面的函数改成toString后会造成session.get在两个onload是相等的bug
						}
					}
					
					this.observer.push({
						key : key,
						customClosure : customClosure
					});
				},
				removeObserver:function(func){
					for(var i = 0, l = this.observer.length; i < l; i++){
						if(this.observer[i].customClosure === func){
							this.observer.splice(i, 1);
							return;
						}
					}
				},
				cleanObserver:function(){
				    this.observer.length = 0;
				    this.toBeCommited.length = 0;
				}
		};
		
		/**
		 * 创建继承自sense对像的类.
		 * @param constructor {function} 目标类的构造方法
		 * @param proto {object} 用于constructor的prototype，
		 *                       如果提供，则使用该对像做为继承prototype并附加方法，
		 *                       如果不提供，则使用constructor.prototype
		 * @returns {function} 继承处理过的构造方法
		 */
		sense.__reg('extend',function(constructor,proto){
			
			// 创建一个当前目标构造方法的代理方法，用于初始化sence对像。
			var proxy_constructor = (function(){
				return function(){
					// 对像属性
					this.toBeCommited = [];
					this.observer = [];
					this.container = {};
					// 执行正真的构造方法
					constructor.apply(this,arguments);
				};
			})(constructor);
			
			// copy sense的方法至目标构造方法的prototype
			proxy_constructor.prototype = fw.utils.cpp(proto || constructor.prototype,Sense);
			
			return proxy_constructor;
		});
		
	})(fw);
}
//for node
if(typeof module !='undefined' && module.exports){
	module.exports = runnable;
}else{
    runnable(sumeru);
}
;var runnable = function(fw){
	var session = fw.addSubPackage('session');
    /**
     * {
     *      "identifier":"hashSerializeStr"
     * }
     */
    var serialize_pool = {};

    var instance_pool = {};
    
    var parseJSON = fw.utils.parseJSON;
    
    var cloneObj = function(obj){
        return JSON.parse(JSON.stringify(resumeObj));
    };
    
    /**
     * 判断一个值是否是简单的基本类型,即 boolean,number,string
     * @param value{any} 将判断值
     * @returns {boolean} true是简单基本类型, false不是简单基本类型
     */
    var isSBDT = fw.utils.isSimpleType;
    
    var sense_get, sense_set, sense_commit;
    
    var _Session = fw.sense.extend(function(identifier){
        this.__identifier = identifier;
        this.__hashKey = [];    // 可以被hash的key
        this.__snapshot = {};   // 以hash为key的快照map
        
        this.__getId = function(){
            // 使用闭包值，防止this.__identifier被修改
            return identifier;
        };
    });
    
    // 原sense方法的引用
    sense_get = _Session.prototype.get;
    sense_set = _Session.prototype.set;
    sense_commit = _Session.prototype.commit;
    
    // 代理方法
    _Session.prototype.get = (function(_superFun){
        return function(){
            return _superFun.apply(this,arguments);  
        };
    })(sense_get);
    
    _Session.prototype.getContainer = function(){
        return this.container;
    };
    
    _Session.prototype.set = (function(_superFun){
        return function(key,value){
            // var checkType = isSerialize;
            // if(isSerialize){
                // this.__hashKey.push(key);
            // }
            
            // if((checkType || this.__hashKey.indexOf(key) != -1 ) && !isSBDT(value)){
                // // 不是string , number ,boolean , 抛出异常
                // throw "data type error";
            // }
            
            return _superFun.call(this,key,value);  
        };
    })(sense_set);
    
    _Session.prototype.setIfNull = (function(_superFun){
        return function(key,value){
            
            // 当存在当前key时，直接返回
            if(this.container.hasOwnProperty(key)){
                return;
            }
//             
            // if(isSerialize && this.__hashKey.indexOf(key) == -1){
                // this.__hashKey.push(key);
            // }
            
            if( !isSBDT(value)){
                // 不是string , number ,boolean , 抛出异常
                throw "data type error";
            }
            
            return _superFun.call(this,key,value);  
        };
    })(sense_set);
    
    _Session.prototype.commit = (function(_superFun){
        return function(){
            var obj = {};
            
            var rv = _superFun.apply(this,arguments);  
//             
            // this.__hashKey.forEach(function(key){
                // obj[key] = this.container[key];
            // },this);
            
            // serialize_pool[this.__identifier] = JSON.stringify(obj);
//             
            // if(serialize_pool[this.__identifier] == "{}"){
                // delete serialize_pool[this.__identifier];
            // }else{
                // this.__snapshot[serialize_pool[this.__identifier]] = JSON.stringify(this.container);
            // }
            
            session.serialize(JSON.stringify(this.container),this.__identifier);
            
            return rv;
        };
    })(sense_commit);
    
    // 还原 snapshot 
    _Session.prototype.__unserialize = function(){
        /*
         * 执行以下步骤
         * 1, 查找 serialize_pool 找出可以做为快照key的序列化字符串
         * 2, 将序死化字符串还原为对像,放入container,完成url中hash部份的还原, 如果没有,container仍为{},不进入下一步.
         * 3, 根据identifier,搜索snapshot, 如果存在内容,再根据序列化字符串搜索对应的历史记录并还原. 如果没有,则还原到此为止
         */
        var rv = false;
        var identifier = this.__identifier;
        var serializeStr = serialize_pool[identifier];
        var snapshot,serialize;
        
        /*
         * 当前实现为在创建session快照时,序列化所有存在session中的内容,
         * 所以如果可以根据serializeStr还原快照到创建serialize的状态,则需要再单独还原serializeStr的内容
         */ 
        if(this.__snapshot[serializeStr] && (snapshot = parseJSON(this.__snapshot[serializeStr]))){
                //此处直接替换container,一般认为,不序列化到URL中的内容更多,类型可能更复杂
                this.container = snapshot;
                rv = true;
        }else if(serializeStr !== "" && serializeStr != null){
            // 还原被序列化的值
            this.container = {};//覆盖
            for(var key in serialize = parseJSON(serializeStr)){
                // 直接将值还原到container中, 不触动set方法
                // this.container[key] = serialize[key];
                this.set(key,serialize[key]);
                // if(this.__hashKey.indexOf(key) == -1){
                    // this.__hashKey.push(key);
                // }
            }
            rv = true;
        }
        return rv;
    };
    
    _Session.prototype.clean = function(key){//clean controller session
        // this.__hashKey = [];
        this.container = {};
       
    };
    // ============================= 
    
    /**
     * session工厂，
     */
    session.__reg('create',function(identifier){
        var sessionObj = null;
        
        if(sessionObj = instance_pool[identifier]){
            return sessionObj;
        }
        
        sessionObj = instance_pool[identifier] = new _Session(identifier);
        sessionObj.__unserialize();
        return sessionObj;
    });
    
    /**
     * 清空对session绑定的所有引用，并将当前session从session的实例池中删除
     */
    session.__reg('destroy',function(identifier){
    	//这里在server渲染中有可能误删FIXME
        var item = typeof(identifier) == 'string' ? instance_pool[identifier] :identifier;
        identifier = item.__identifier;
        
        fw.utils.cleanObj(item);
        
        instance_pool[identifier] = undefined;
        serialize_pool[identifier] = undefined;
        
        delete instance_pool[identifier];
        delete serialize_pool[identifier];
    });
    
    /**
     * 将serialize_pool中的内容,序列化到url中
     */
    session.__reg('serialize',function(one_session){//__identifier
        // TO JSON STRING
        // var serializeDat = JSON.stringify(one_session);
        
        fw.router.joinSessionToHash(one_session);
        
    },true);
    
    session.__reg('setResumeNew',function(serializeDat,identifier){//by server ,TODO for client
        var serialize_pollurl = (serializeDat && parseJSON("{"+serializeDat+"}")) || {};
        //instance_pool 注册
        for (var key in serialize_pollurl) {
        	// if (!instance_pool[key]) {
        		// //复原session
        		// session.create(key);
        	// }
        	if (serialize_pollurl[key]=='{}'){
        		serialize_pollurl[key] = "";
        	}
        	serialize_pool[identifier] = serialize_pollurl[key];
        }
        var key = identifier ;
        if(instance_pool[key].__unserialize()){
        	instance_pool[key].commit();
        }
        
    },true);
    /**
     * 合并需要反序列化的session对像
     */
    session.__reg('setResume',function(serializeDat,controller){
        var serialize_pollurl = (serializeDat && parseJSON("{"+serializeDat+"}")) || {};
        //instance_pool 注册
        for (var key in serialize_pollurl) {
        	if (!instance_pool[key]) {
        		//复原session
        		session.create(key);
        	}
        	if (serialize_pollurl[key]=='{}'){
        		serialize_pollurl[key] = "";
        	}
        	serialize_pool[key] = serialize_pollurl[key];
        }
        var key = controller+"!" ;
        if(instance_pool[key].__unserialize()){
        	instance_pool[key].commit();
        }
//         
        // for(var key in instance_pool){
        	// if (controller+"!" == key) {//resume 只commit本controller下的session
        		// if(instance_pool[key].__unserialize()){
	                // instance_pool[key].commit();
	            // };
        	// }
//             
        // }
        
    },true);
    
    session.__reg('getSessionByController',function(controller){
        return serialize_pool[controller+"!"];
    },true);
    
}
if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{//这里是前端
    runnable(sumeru);
};/*
*
* Copyright (c) 2011 Justin Dearing (zippy1981@gmail.com)
* Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
* and GPL (http://www.opensource.org/licenses/gpl-license.php) version 2 licenses.
* This software is not distributed under version 3 or later of the GPL.
*
* Version 1.0.0
*
*/

/**
 * Javascript class that mimics how WCF serializes a object of type MongoDB.Bson.ObjectId
 * and converts between that format and the standard 24 character representation.
*/
var ObjectId = (function () {
    var increment = 0;
    var pid = Math.floor(Math.random() * (32767));
    var machine = Math.floor(Math.random() * (16777216));

    if (typeof (localStorage) != 'undefined') {
        var mongoMachineId = parseInt(localStorage['mongoMachineId']);
        if (mongoMachineId >= 0 && mongoMachineId <= 16777215) {
            machine = Math.floor(localStorage['mongoMachineId']);
        }
        // Just always stick the value in.
        localStorage['mongoMachineId'] = machine;
        document.cookie = 'mongoMachineId=' + machine + ';expires=Tue, 19 Jan 2038 05:00:00 GMT'
    }
    else {
        var cookieList = document.cookie.split('; ');
        for (var i in cookieList) {
            var cookie = cookieList[i].split('=');
            if (cookie[0] == 'mongoMachineId' && cookie[1] >= 0 && cookie[1] <= 16777215) {
                machine = cookie[1];
                break;
            }
        }
        document.cookie = 'mongoMachineId=' + machine + ';expires=Tue, 19 Jan 2038 05:00:00 GMT';

    }

    return function () {
        if (!(this instanceof ObjectId)) {
            return new ObjectId(arguments[0], arguments[1], arguments[2], arguments[3]).toString();
        }

        if (typeof (arguments[0]) == 'object') {
            this.timestamp = arguments[0].timestamp;
            this.machine = arguments[0].machine;
            this.pid = arguments[0].pid;
            this.increment = arguments[0].increment;
        }
        else if (typeof (arguments[0]) == 'string' && arguments[0].length == 24) {
            this.timestamp = Number('0x' + arguments[0].substr(0, 8)),
            this.machine = Number('0x' + arguments[0].substr(8, 6)),
            this.pid = Number('0x' + arguments[0].substr(14, 4)),
            this.increment = Number('0x' + arguments[0].substr(18, 6))
        }
        else if (arguments.length == 4 && arguments[0] != null) {
            this.timestamp = arguments[0];
            this.machine = arguments[1];
            this.pid = arguments[2];
            this.increment = arguments[3];
        }
        else {
            this.timestamp = Math.floor(new Date().valueOf() / 1000);
            this.machine = machine;
            this.pid = pid;
            if (increment > 0xffffff) {
                increment = 0;
            }
            this.increment = increment++;

        }
    };
})();

ObjectId.prototype.getDate = function () {
    return new Date(this.timestamp * 1000);
}

/**
* Turns a WCF representation of a BSON ObjectId into a 24 character string representation.
*/
ObjectId.prototype.toString = function () {
    var timestamp = this.timestamp.toString(16);
    var machine = this.machine.toString(16);
    var pid = this.pid.toString(16);
    var increment = this.increment.toString(16);
    return '00000000'.substr(0, 6 - timestamp.length) + timestamp +
           '000000'.substr(0, 6 - machine.length) + machine +
           '0000'.substr(0, 4 - pid.length) + pid +
           '000000'.substr(0, 6 - increment.length) + increment;
}

sumeru.__reg('__ObjectId', ObjectId, true);
delete ObjectID;;App = typeof App != 'undefined' ? App : {};
;var runnable = function(fw){
    (function(fw){
	var _sense = fw.sense.extend(function(){});
	
	//产生一个新config对象
	var _createObj = function(){
	    
	    var Config = function(){
		this.configMap = {};
	    },
	    //configMap = {},
	    sp = new _sense(),
	    tempFunc = function(){};
	    
	    tempFunc.prototype = sp;
	    Config.prototype = new tempFunc();//Config 继承sense API
	    
	    Config.prototype.set = function(){
		this.define.apply(this, arguments);
	    };
	    
	    Config.prototype.get = function(key){
		sp.get(key);
		return this.configMap[key]
	    };
	    
	    Config.prototype.define = function(){
		var config;
		
		if(arguments.length == 1){
		    config = arguments[0];
		}else if(arguments.length == 2){
		    config = {};
		    config[arguments[0]] = arguments[1];
		}else{
		    throw new Error('config define error');
		}
		for(var k in config){
		    if(config.hasOwnProperty(k)){
			sp.set(k, config[k]);
			this.configMap[k] = config[k];
		    }
		}
	    };
	    return (new Config());
	};
	
	//定义模块化config
	//@para moduleName 模块名称
	var defineModule = function(moduleName){
	    if(typeof moduleName === 'undefined')return;
	    
	    var configObj = _createObj();
	    
	    var tempFunc = function(){
		configObj.set.apply(configObj, arguments);
	    };
	    
	    tempFunc.defineModule = defineModule;
	    tempFunc.config = function(){
		configObj.set.apply(configObj, arguments);
	    };
	    tempFunc.get = function(){
		return configObj.get.apply(configObj, arguments);
	    };
	    
	    tempFunc.set = function(key, value){
		configObj.set.apply(configObj, arguments);
	    };
	    tempFunc.commit = function(){
		configObj.commit.apply(configObj, arguments);
		if ((typeof module !== 'undefined') && (typeof exports !== 'undefined')){
		    //Server
		    fw.pushUpdateOfConfig(configObj.configMap);
		}else{//Client
		    
		    fw.netMessage.sendMessage(configObj.configMap, 'config_push',
					      function(err){},
					      function(){});
		}
	    };
	    
	    this[moduleName] = tempFunc; 
	    return tempFunc;
	};	
	
	defineModule.call(fw, 'defineConfig');
	fw.config = fw.defineConfig;
    })(fw);
}

//for node
if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
};﻿(function(fw){
	
	fw.addSubPackage('transition');
	
	var blockClassName = '__viewBlock__';

	var _trim = function(str){
		return str.replace(/(^\s*)|(\s*$)/g, ""); 
	};
    var _getObj = function(id){
        return document.getElementById(id);
    };
    var _createObj = function(tn){
        return document.createElement(tn);
    };
	/**
	 * add className
	 * klass可以是string或array
	 */
    var _addClass = function(obj,klass){
      var klass = _hasClass(obj,klass);
      if (klass.length===0) return;
      var _ks = _trim(obj.className).replace(/\s+/g," ").split(" ");
        _ks = _ks.concat(klass);
        obj.className = _ks.join(" ");
    };
    
    var _hasClass = function(obj,klass) {
        if ( typeof klass === 'string'){
            klass = [klass];
        }
        var neededItems = [];
        Array.prototype.forEach.call(klass,function(k){
            var rex = new RegExp("( |^)" + k+"( |$)",["i"]);
            if ( !obj.className.match(rex) ) {
                neededItems.push(k);
            }
        });
        return neededItems;
   }
	/**
	 * remove className
	 * klass可以是string或array
	 */
	var _removeClass = function(obj,klass){
		var _ks = _trim(obj.className).replace(/\s+/g," ").split(" ");
		if(klass instanceof Array){
			for (var i=0,len=_ks.length;i<len;i++){
				if(klass.indexOf(_ks[i])>-1){
					_ks.splice(i,1);
				}
			}
		}else{
		    if ( klass.search("^") === 0 ) {
		        var regx = new RegExp(klass,"");
		        for (var i=0,len=_ks.length;i<len;i++){
                    if( _ks[i] && _ks[i].match(regx) ){
                        _ks.splice(i,1);
                    }
                }
		    } else {
				for (var i=0,len=_ks.length;i<len;i++){
    				if( _ks[i] === klass ){
    					_ks.splice(i,1);
    				}
    			}
            }
		}
		obj.className = _ks.join(" ");
	};

	/**
	 * add/remove className
	 * klass可以是string或array
	 */
	var _arClass = function(obj,addks,removeks){
		var _ks = _trim(obj.className).replace(/\s+/g," ").split(" ");
		if(removeks instanceof Array){
			for (var i=0,len=_ks.length;i<len;i++){
				if(removeks.indexOf(_ks[i])>-1){
					_ks.splice(i,1);
				}
			}
		}else{
			for (var i=0,len=_ks.length;i<len;i++){
				if(_ks[i]===removeks){
					_ks.splice(i,1);
				}
			}
		}
		_ks = _ks.concat(addks);
		obj.className = _ks.join(" ");

	}
    var _toggleClass = function(obj, kless, kless2){
        var _ks = _trim(obj.className).replace(/\s+/g," ").split(" ");
        var _index = _ks.indexOf(kless);
        var _index2 = kless2?_ks.indexOf(kless2):-1;
        if(_index>=0){
            _ks.splice(_index,1);
            if(kless2){
                _ks.push(kless2);
            }
        }else{
            _ks.push(kless);
            if(_index2>=0)_ks.splice(_index2,1);
        }
        obj.className =  _ks.join(" ");
    }
	var _fixSreenSize = function(obj){
		obj.style.width = "100%";
	};
    /**
	 * act分为两种：
	 * 1：两个scene分开执行动画效果，
         * usage：
         * sumeru.transition.__load('_run')({"anim":["push",0],"dom":document.getElementById("a3")});
	 * 2：两个scene放在一个容器里执行动画效果 ，
         * usage：
         * sumeru.transition.__load('_run')({
                                                               "dom":[document.getElementById("a1"),document.getElementById("a2")],
                                                               "domsType":"flip",
                                                               "anim":["push",1],
                                                               callback:{"load":function(){alert("loaded");}}
                                                               });
         * sumeru.transition.__load('_run')({"type":"flipleft"});
         * sumeru.transition.__load('_run')({"type":"flipright"});
	 */
	var _act = {
		"push":[1,1,1,1],//0:up,1:right,2:down,3:left,4:z
		"rotate":[0,1,0,1],
		"fade":[0,0,0,0,2],
        "shake":[0,1,0,1],
        "none":[0,0,0,0,2]
	};
	var _pattern = {
		"show":"_g_{$}_sw",//show
		"standby":"_g_{$}_sb",//standby
		"hide":"_g_{$}_hd"//hide
	};
	var act_direct_name = ["top","right","bottom","left",""];
	
	//可以当速查表使用,目前只有subcontroller的转场使用
	var _subact = {
	    "push":{"up":"Up","down":"Down","left":"Left","right":"Right"},
        "bounce":{"":"","up":"Up","down":"Down","left":"Left","right":"Right"},//震动支持这些方向,_fw_bounceIn
        "fade":{"":"","up":"Up","down":"Down","left":"Left","right":"Right"},//fade，支持这些方向
        "rotate":{"":"","up":"UpLeft","down":"DownRight","left":"DownLeft","right":"UpRight"},
        "flip":{"x":"X","y":"Y"},
        "expand":{"x":"X","y":"Y","":""},//试验中，效果不好，不推荐使用
        "none":{"none":""},
        1:1
    };
    var _subact_class = {
        "push":["_fw_pushIn","_fw_pushOut"],
        "bounce":["_fw_bounceIn","_fw_bounceOut"],//震动支持这些方向,_fw_bounceOut
        "fade":["_fw_fadeIn","_fw_fadeOut"],//fade，支持这些方向
        "rotate":["_fw_rotateIn","_fw_rotateOut"],
        "flip":["_fw_flipIn","_fw_flipOut"],
        "expand":["_fw_expand","_fw_collapse"],//试验中，效果不好，不推荐使用
        "none":["_fw_none","_fw_hide"],
        1:1
    };
	
	//容器
	var _wrap = null;

	var _createClassName = function(status,act){
        if(!(act instanceof Array && act.length>1)){
            act = ['push',1];
        }
        var act_name = act[0]+(act_direct_name[act[1]].length>0?("_"+act_direct_name[act[1]]):"");
		return _pattern[status].replace("{$}",act_name);
	};
	var _setting = {
		showScene:{
			type:null,
			dom:null,
			anim:null,
			classname:null
		},
		hideScene:{
			type:null,
			dom:null,
			anim:null,
			classname:null
		}
	};
	var _isFristLode = true;
	var _init = function(){
		if (!(_wrap = document.getElementById("_smr_runtime_wrapper"))) {
			_wrap = document.createElement("div");
	        _wrap.className = "_smr_runtime_wrapper";
	        _wrap.id = "_smr_runtime_wrapper";
	        // _wrap.style.width = "100%";
	        // _wrap.style.height = "100%";
			document.body.appendChild(_wrap);
			_isFristLode = false;
			// _fixSreenSize(_wrap);
		}
		_isFristLode = false;
	};

    var _createFlipObj = function(frontdom,backdom){
        var _box = _createObj("div"),
            _card = _createObj("div"),
            _front = _createObj("div"),
            _back = _createObj("div");
        _box.style.webkitPerspective = 1000;
        _card.className = "animated _g_flip_card";
        _front.className = "_g_flip_front";
        _back.className = "_g_flip_back";
        _front.appendChild(frontdom);
        _back.appendChild(backdom);
        _card.appendChild(_back);
        _card.appendChild(_front);
        _box.appendChild(_card);
        return _box;
    }
    var __dealTransitionAnim = function( target ) {

        var act_direct_name = {"up":0,"right":1,"down":2,"left":3,"z":4,"none":4};

        if(_act[target.anim[0]][act_direct_name[target.anim[1]]]<=0){
            target.anim = ['push',1];
        }
        if(target.transitionOut&&_act[target.transitionOut[0]][act_direct_name[target.transitionOut[1]]]<=0){
            target.transitionOut = ['push',1];
        }

        if(!target.type){
            target.type = "common";
        }
        
        if ( target.anim && typeof target.anim[1] !== 'undefined' &&  typeof act_direct_name[target.anim[1]] !== 'undefined' ) {
            
            target.anim = [target.anim[0],act_direct_name[target.anim[1]]];
            //target.anim[1] = act_direct_name[target.anim[1]];
        }
        
        if(!target.anim || typeof _act[target.anim[0]] === "undefined"
            ||typeof _act[target.anim[0]][target.anim[1]] === "undefined"
            ||_act[target.anim[0]][target.anim[1]]<=0){
            target.anim = ["push",1];
        }
       
        if ( target.transitionOut ) {//这里是反转
            if ( typeof target.transitionOut !=='object' ) {//有时侯transitionOut只传入true，表示反转target.anim
                target.anim[1] = (target.anim[1] + 2) % 4;
            } else {//其他时侯transitionOut传入的是反转前 的anim，则要反转target.transitionOut 然后赋值覆盖anim
                target.transitionOut[1] = (target.transitionOut[1] + 2) % 4;
                target.anim = target.transitionOut;
            }
        }
    }
	/**
	 * 切换场景
	 * @param target 目标scene
		{
			*type:"flip",//"common,flipleft,flipright"
			dom:document.getElementById("scene1"),//[document.getElementById("scene1"),document.getElementById("scene2")]
			*dom_back:document.getElementById("scene2"),只有在插入flip是type才需要
			anim:["push",1],//anim[1]:"top","right","bottom","left",""
			isback:false,
			callback:{
				"load":function(){},
				"hide":function(){}
			}
     * 限制：前一场景和后一场景的dom不能有重复的。
	 */
	var _transition = function(target){

		if(_isFristLode) _init();
        __dealTransitionAnim(target);
        
        var show = _setting.showScene;
        var hide = _setting.hideScene;

        var isChangeAnim = show&&show.anim?(show.anim[0]!=target.anim[0]||show.anim[1]!=target.anim[1]):true;

        switch(target.type){
            case "common":

                if(target.dom instanceof Array ){
                    target.dom_front = target.dom[0];
                    target.dom_back = target.dom[1];
                    
                }
                //fw.log(show.dom == target.dom,show.dom, target.dom)
                //有clonedom，说明是自己推自己，我要给他附加上去成背景图案，推完自己再抹去。
                if (target.cloneDom ) {
                    show.dom.parentNode.appendChild( target.cloneDom );
                    show.dom.addEventListener("webkitTransitionEnd", function(){
                        if ( target.cloneDom && target.cloneDom.parentNode ) {
                            target.cloneDom.parentNode.removeChild(target.cloneDom);//其他地方可能已经删除了
                            delete target.cloneDom;
                        }
                    }, false);
                    show.dom = target.cloneDom;
                } else if ( show.dom == target.dom ){//dom相同,自己转自己，而且没有clonedom，说明是不想让他转场，否则会传入之前clone的clonedom
                    return false;
                } else {
                    delete target.cloneDom;
                }
                
                if( (target.dom instanceof Array&&(show.dom == target.dom_front||show.dom == target.dom_back))
                    ||(typeof show.dom_front != "undefined"?
                                (show.dom_front == target.dom_front
                                ||show.dom_front == target.dom_back
                                ||show.dom_front == target.dom)
                        :false)
                    ||(typeof show.dom_back != "undefined"?
                                (show.dom_back == target.dom_front
                                ||show.dom_back == target.dom_back
                                ||show.dom_back == target.dom)
                        :false)){
                    return false;
                }
                    
                if(target.dom instanceof Array ){
                    target.dom = _createFlipObj(target.dom[0],target.dom[1]);
                }
                //hide对象隐藏
                if(hide&&hide.dom){

                    if(hide.dom_front){
                        var f_rm = 0;
                        //如果hide scene是flip dom 需要回收生成的辅助节点
                        if(hide.dom_front!=target.dom
                            &&hide.dom_front!=target.dom_front
                            &&hide.dom_front!=target.dom_back){
                            hide.dom_front.className = hide.front_classname?("hide "+hide.front_classname):"hide";
                            _wrap.appendChild(hide.dom_front);
                            f_rm++;
                        }
                        if(hide.dom_back!=target.dom
                            &&hide.dom_back!=target.dom_front
                            &&hide.dom_back!=target.dom_back){
                            hide.dom_back.className = hide.back_classname?("hide "+hide.back_classname):"hide";
                            _wrap.appendChild(hide.dom_back);
                            f_rm++
                        }
                        _wrap.removeChild(hide.dom);
                        
                    }else{
                        if(hide.dom!=target.dom
                            &&hide.dom!=target.dom_front
                            &&hide.dom!=target.dom_back){
                        hide.dom.className = hide.classname?("hide "+hide.classname):"hide";
                        }
                    }
                }
                //保存scene 原有的classname
                if(target.dom_front){

                    target.front_classname = (target.dom_front.className).replace(/(_g_[\S]*)|(transi)|(hide)|(animated)/g,"")
                        .replace(new RegExp(blockClassName,"g"),"")
                        .replace(/(^\s*)|(\s*$)/g,"")+blockClassName;
                    target.dom_front.className = target.front_classname;

                    target.back_classname = (target.dom_back.className).replace(/(_g_[\S]*)|(transi)|(hide)|(animated)/g,"")
                        .replace(new RegExp(blockClassName,"g"),"")
                        .replace(/(^\s*)|(\s*$)/g,"")+blockClassName;
                    target.dom_back.className = target.back_classname;
                }else{
                    target.classname = (target.dom.className).replace(/(_g_[\S]*)|(transi)|(hide)|(animated)/g,"")
                        .replace(new RegExp(blockClassName,"g"),"")
                        .replace(/(^\s*)|(\s*$)/g,"")+blockClassName;
                    target.dom.className = target.classname?("hide "+target.classname):"hide";
                }


                var _standby = target.dom;
                var _hide = hide.dom?hide.dom:false;
                var _show = show.dom?show.dom:false;


                //准备dom对象状态
                if(isChangeAnim){//只有动画效果也发生改变时才需要修改show dom的class
                    if(_show){
                        _show.className = show.classname?(blockClassName+" "+show.classname):blockClassName;
                        _addClass(_show,_createClassName("show",target["anim"]));
                    }
                }

                _addClass(_standby,[_createClassName("standby",target["anim"]),blockClassName]);


                //把dom移动到wrap中
                if(_wrap!=_standby.parentElement){
                    _wrap.appendChild(_standby);
                }
                _removeClass(_standby,"hide");

                //动画效果
                var timeout = isChangeAnim?10:1;

                setTimeout(function(){
                    if(_act[target.anim[0]][target.anim[1]]==1){
                        if(_show)_addClass(_show,"transi");
                        _addClass(_standby,"transi");
                    }
                    if(_show)_arClass(_show,_createClassName("hide",target["anim"]),_createClassName("show",target["anim"]));

                    _arClass(_standby,_createClassName("show",target["anim"]),_createClassName("standby",target["anim"]));


                    if(_act[target.anim[0]][target.anim[1]]==2){
                        if(_show)_addClass(_show,"animated");
                        _addClass(_standby,"animated");
                    }
                },timeout);

                //动画结束后的处理
                if(_setting.showScene.anim)_setting.showScene.anim = target.anim;
                _setting.hideScene = _setting.showScene;
                _setting.showScene = target;
                if(_setting.hideScene.callback&&_setting.hideScene.callback.hide){(_setting.hideScene.callback.hide)();}
                if(target.callback&&target.callback.load){(target.callback.load)()};
                break;
            case "flipleft":
                _removeClass(show.dom.firstChild,["_g_flip_card_right","_g_flip_card_right_def"]);
                _toggleClass(show.dom.firstChild,"_g_flip_card_left","_g_flip_card_left_def");
                break;
            case "flipright":
                _removeClass(show.dom.firstChild,["_g_flip_card_left","_g_flip_card_left_def"]);
                _toggleClass(show.dom.firstChild,"_g_flip_card_right","_g_flip_card_right_def");
                break;
        }
        return true;
	};
	//@dom dom
	//@object anim
	//@bool transitionOut
	//重构子转场@sundong
	var _subtransition = function ( target ,ishide) {
	    
	    var _standby = target.dom;
        if ( !target.anim ) target.anim = ["push","down"]
	    if ( ishide ) {//这里是离场
            if ( _subact[target.anim[0]] && typeof _subact[target.anim[0]][target.anim[1]]!=='undefined' ){
                _removeClass(_standby,"^_fw_");
                _addClass(_standby,_subact_class[target.anim[0]][1] + _subact[target.anim[0]][target.anim[1]]);
            }
            _standby.style.display = "";
            _standby.addEventListener("webkitAnimationEnd", _hideMe, false);
            
        } else {//这里是进场
	        
            _addClass(_standby,"animated");
            
            if ( _subact[target.anim[0]] && typeof _subact[target.anim[0]][target.anim[1]]!=='undefined' ){
                _removeClass(_standby,"^_fw_");
                _addClass(_standby,_subact_class[target.anim[0]][0] + _subact[target.anim[0]][target.anim[1]]);
            }
            _standby.style.display = "block";
            _standby.removeEventListener("webkitAnimationEnd", _hideMe, false);
	    }
	}
	var _hideMe = function(){
	    this.style.display = "none";
	}
	
    fw.transition.__reg('_init', _init, 'private');
    fw.transition.__reg('_run', _transition, 'private');
    fw.transition.__reg('_serverRun', function(){
        
    }, 'private');
	fw.transition.__reg('_subrun', _subtransition, 'private');
	
	
})(sumeru);
;var runnable = function(fw,PublishContainer){

    fw.addSubPackage('pubsub');

    var subscribeMgr = {};//TODO 这个在server运行的时候，当并发很多(>10/s)时，可能出现后一个请求覆盖前一个引起callback未执行的bug，server渲染自动终止。这里需要重新设计
    var publishModelMap = {a:1};
    var subscribeMgrKeys = []; //有序的key记录，每个key都是一个pubname，用于断线重连后按顺序redo subscribe

    var pubsubObject = function(){
        
    };
    var arrPop = Array.prototype.pop;
    var arrSlice = Array.prototype.slice;
    
    pubsubObject.prototype = {
        subscribe : function(pubName, /*arg1, arg2, arg3*/ onComplete){
            var _pubmap = publishModelMap[pubName.replace(/@@_sumeru_@@_page_([\d]+)/, '')];
            var modelName = _pubmap['modelname'];
            var plainStruct = _pubmap['plainstruct'];
            if (typeof modelName == 'undefined') {
                throw "publish " + pubName + ' NOT FOUND';
            };
            
            modelName = 'Model.' + modelName;
			
            var env = null;
            if ( typeof this === 'object' && typeof this.isWaiting !== 'undefined' ) {
                env = this ;//this是env
                env.wait();//自动调用wait方法
            }
            
            var collection = fw.collection.create({modelName : modelName});
            
            //在collection上记了一下他是从哪个publish上来的
            collection.pubName = pubName;
            
            var completeCallback = arrPop.call(arguments);
            var args = arrSlice.call(arguments,1);

            //send the subscribe netMessage
            var version = collection.getVersion();
            var id =  this.__UK;
            
            if(!subscribeMgr[pubName]){
                subscribeMgrKeys.push(pubName);
                subscribeMgr[pubName] = {
                    modelName    :    modelName,
                    plainStruct  :    plainStruct,
                    args   : args,
                    topPriority : false, //是否在redo subscribe时要保证先进行
                    stub    :    []
                };
            }
            
            var callbackStr = Function.toString.call(completeCallback);
            
            var sourceCustomClosure = this.subscribe.caller;  
            
            // 清理相同env下,相同customClosure所做的订阅
            subscribeMgr[pubName]['stub'] = subscribeMgr[pubName]['stub'].filter(function(item){
                
                if(item.id == id && item.sourceCustomClosure == sourceCustomClosure && item.callbackStr == callbackStr){
                    return false;
                }
                
                return true;
            });
            //去重之后，包装原有callback，添加处理wait的方法
            var tmpfunc = function( ){
            	try{
            		completeCallback(arguments[0],arguments[1]);
                }catch(e){
                	console.warn("error when pubsub callback on line 84 ",e);
                }
                if(env){
                    env.start();//自动调用start方法
                }
            }
            subscribeMgr[pubName]['stub'].push({
                id : id,
                sourceCustomClosure : sourceCustomClosure,
                collection    :    collection,
                callback      :    tmpfunc,
                callbackStr   :    callbackStr,
                env           :    this
            });
            
            
            fw.netMessage.sendMessage({
                name    :    pubName,
                //去掉第一个pubname，去掉最后一个回调函数
                args    :    args,
                uk:id,
                version :    version
            },'subscribe', function(err){
                sumeru.log("error : subscribe " + err);
            },function(){
                sumeru.dev("send subscribe " + pubName, version || 'no version');
            });
            
            return collection;
            //when data received from server, will run the onComplete
        },
        
        subscribeByPage : function(pubName, options, /*arg1, arg2,...*/ onComplete){
            var defaultOptions = {
                pagesize : 10,
                page : 1,
                uniqueField : 'time'
            };
            
            options = Library.objUtils.extend(defaultOptions, options);
            
            var args = arguments;
            //替换pubName
            args[0] = pubName + '@@_sumeru_@@_page_' + options.page;
            
            var collection = this.subscribe.apply(this, args);
            
            return collection;
        },
        
        prioritySubscribe : function(pubName, /*arg1, arg2,...*/ onComplete){
            var args = arguments;
            var collection = this.subscribe.apply(this, args);
            
            subscribeMgr[pubName].topPriority = true;
            
            return collection;
        }
    };
    
    /**
     * 断线重连后，重做所有subcribe
     */
    var redoAllSubscribe = function (){
        redoAllPrioritySubscribe_(redoAllNormalSubscribe_);
    };
    
    var redoAllPrioritySubscribe_ = function(callback){
        cbHandler = Library.asyncCallbackHandler.create(function(){
            callback();
            fw.pubsub.__reg('_priorityAsyncHandler', undefined, true);
        });
        
        fw.pubsub.__reg('_priorityAsyncHandler', cbHandler, true);
        cbHandler.add();

        //找出所有有优先级的订阅，发起并等待它们执行完毕
        for(var i = 0, l = subscribeMgrKeys.length; i < l; i++){
            
            var pubname = subscribeMgrKeys[i];
            if (pubname == 'auth-init') { //auth-init由auth init负责调用，不需要再重复redo了。
                continue;
            };
            if (!(pubname in subscribeMgr)) {
                continue;
            };
            if (subscribeMgr[pubname].topPriority === false) {
                continue;
            };
            
            cbHandler.add();
            
            //redo all priority subscribe netMessage
            var version = subscribeMgr[pubname].stub[0].collection.getVersion();
            fw.netMessage.sendMessage({
                name    :    pubname,
                //去掉第一个pubname，去掉最后一个回调函数
                args    :    subscribeMgr[pubname]['args'],
                version :    version
            },'subscribe' , function(err){
                fw.log("error : redoPrioritySubscribe", err);
            } , function(){
                fw.dev("sending redo priority subscribe " + pubname, version || "no version(redo)");
            });
        }
        
        cbHandler.enableCallback();
        cbHandler.decrease();

    };
    var redoAllNormalSubscribe_ = function(){
        //执行所有普通订阅
        for(var i = 0, l = subscribeMgrKeys.length; i < l; i++){
            
            var pubname = subscribeMgrKeys[i];
            if (pubname == 'auth-init') { //auth-init由auth init负责调用，不需要再重复redo了。
                continue;
            };
            if (!(pubname in subscribeMgr)) {
                continue;
            };
            if (subscribeMgr[pubname].topPriority === true) {
                continue;
            };
            
            var version = subscribeMgr[pubname].stub[0].collection.getVersion();
            //redo normal subscribe netMessage
            fw.netMessage.sendMessage({
                name    :    pubname,
                //去掉第一个pubname，去掉最后一个回调函数
                args    :    subscribeMgr[pubname]['args'],
                version :    version
            },'subscribe' , function(err){
                fw.log("Err : redoNormalSubscribe", err);
            } , function(){
                fw.dev("sending redo priority subscribe " + pubname, version || "no version(redo)");
            });
        }    
    };
    fw.pubsub.__reg("clearClient",function(client_id){//server controller destroy
    	for(var pubName in subscribeMgr){
    		subscribeMgr[pubName]['stub'] = subscribeMgr[pubName]['stub'].filter(function(item){
	            if(item.id == client_id || !item.id){
	                return false;
	            }
	            return true;
	        });
	        if (subscribeMgr[pubName]['stub'].length == 0){
	        	delete subscribeMgr[pubName];
	        }
    	}
    });
    fw.pubsub.__reg('clear',function(){
        var item;
        for(var pubName in subscribeMgr){
            item = subscribeMgr[pubName].stub || {};
            for(var key = item.length -1; key >= 0; key--){
                if(item[key].env.isDestroy){
                    item[key].collection = null;
                    item[key].callback = null;
                    item[key].env = null;
                    item.splice(key,1);
                };
            }
            if (item.length == 0) {
                //FIXME 不用实时回收，因为很多情况下refresh会unsub然后又sub
                //如果stub已经为空，通知Server，当前Client可以unsubscribe这个pubName了 
                fw.netMessage.sendMessage({
                    name : pubName
                }, 'unsubscribe', function(err){}, function(){
                    fw.dev('unsubscribing', pubName);
                });
                
                delete subscribeMgr[pubName];
                subscribeMgrKeys = subscribeMgrKeys.filter(function(item){
                    if (item == pubName) {
                        return false;
                    };
                    return true;
                });
            };
        }
    },true);
    
    fw.pubsub.__reg('_pubsubObject', pubsubObject, true);
    fw.pubsub.__reg('_subscribeMgr', subscribeMgr, true);
    fw.pubsub.__reg('_publishModelMap', publishModelMap, true);
    fw.pubsub.__reg('_redoAllSubscribe', redoAllSubscribe, true);
    
    /**
     * 延迟执行数据同步相关：
     */
    fw.pubsub.__reg('_postponeQueue', [], 'private');
    
    var postponeQueue = fw.pubsub._postponeQueue;
    /**
     * 释放后执行数据同步
     */
    var releaseHold = function(collection){
        if (postponeQueue.length === 0) {
            return;
        };
        
        postponeQueue.forEach(function(item, index){
            if (item.collection == collection) {
                //执行后删除该记录
                item.runner();
                postponeQueue.splice(index, 1);
            };
        });
    };
    
    fw.pubsub.__reg('_releaseHold', releaseHold, 'private');
    
    if (typeof PublishContainer !='undefined' ){//server no echo
    	(function(PublishContainer){
	    	for (var pubname in PublishContainer){
	            publishModelMap[pubname] = {
		            'modelname' : PublishContainer[pubname]['modelName'],
		        	'plainstruct' : PublishContainer[pubname]['plainStruct']
	            };
	        }
	    })(PublishContainer)
    }
    
};
if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
    
}else{//这里是前端
    runnable(sumeru);
}
;var runnable = function(fw){
    var _controller = fw.addSubPackage('controller');
   
    //所有当前活跃的控制器的容器
    //[{controller : controllerClass, renderFunc : renderFunc}, ...]
    //其中renderFunc主要是当服务器推送数据时，给MsgDispatcher使用的
    var activeController = [];
    var activeControllerId;
    var cloneDom = null;
    var transitionOut = false;//如果为true，则表明此controller是反转出场
    var globalIsforce = null;
    
    /**
     * 全局的模板ID => 数据的Map
     */
    _bindingMap = {};
    
    /**
     * 绑定数据和事件的方法
     */
    
    //FIXME 现在所有的widgetId都默认全App之内唯一
    // _bindingData中的widgetId, 是应该表示一个数据集的名称,由于数据集原本就是在messageDispatcher.js中向全局任意位置派发,所以此处全局唯一不应存在问题. wangsu
    var _bindingData = function(key, dataMap){
        var widgetId = this.__UK + "_" + key;
        if(!_bindingMap[widgetId]){
            _bindingMap[widgetId] = {
                view_data   :   {},
                eventMap    :   {}
            };
        }
        
        //如果存在tapped_blocks，则是在messageDispatcher处定义的
        var tapped_blocks = _controller.__load('_tapped_blocks');
        if(typeof tapped_blocks != 'undefined'){
            tapped_blocks.push({
                widgetId : widgetId
            });
        }

        for(var i in dataMap){
            if(dataMap.hasOwnProperty(i)){
                _bindingMap[widgetId].view_data[i] = dataMap[i];
            }
        }
    };
    
    //_bindingDataByPage和_bindingData的唯一区别是viewdata中细分了按页码存放的子数组
    var _bindingDataByPage = function(key, dataMap){
        var widgetId = this.__UK + "_" + key;
        if(!_bindingMap[widgetId]){
            _bindingMap[widgetId] = {
                view_data   :   {},
                eventMap    :   {}
            };
        }
        
        if (typeof dataMap.page == 'undefined') {
            throw "subscribeByPage always need a page parameter";
        };
        
        
        _bindingMap[widgetId].isByPage = true;
        
        var container = _bindingMap[widgetId]['view_data'][dataMap.page] = {}; 

        //如果存在tapped_blocks，则是在messageDispatcher处定义的
        var tapped_blocks = _controller.__load('_tapped_blocks');
        if(typeof tapped_blocks != 'undefined'){
            tapped_blocks.push({
                widgetId : widgetId,
                page    : dataMap.page,
                options : dataMap.options || {}
            }); 
        }
                
        for(var i in dataMap){
            if(dataMap.hasOwnProperty(i)){
                container[i] = dataMap[i];
            }
        }
        
    };
    var _cloneDom = function(instance) {
        cloneDom = instance.getDom().cloneNode(true);
        cloneDom.style.zIndex = "0";
        cloneDom.removeAttribute("id");
        var tpls = cloneDom.querySelectorAll("[tpl-id]");//去掉tpl-id，防止多加载
        for (var i = 0,len = tpls.length ; i < len ; i++ ) {
            tpls[i].removeAttribute("tpl-id");
        }
    }
    var _bindingEvent = function(key, eventFunc){
        var widgetId = this.__UK + "_" + key;
        if(!_bindingMap[widgetId]){
            _bindingMap[widgetId] = {
                view_data   :   {},
                eventMap    :   {}
            };
        }
        _bindingMap[widgetId].eventMap['__default_key__'] = eventFunc;
//         
        // var self = this;
//         
        // _bindingMap[widgetId].eventMap['__default_key__'] = function(){
        	// eventFunc.call(self);
        	// //event之后，检查a标签,通过history.js实现非刷新页面
        	// if (typeof document != 'undefined'){
        		// var anchors = document.querySelectorAll('a');
	            // for(var i=0,len=anchors.length;i<len;i++){
	            	// if (anchors[i].href.indexOf(location.origin) != -1 && !anchors[i].getAttribute("link-ajax")){//已？或者/开头的链接将阻止跳转
	            		// (function(item){
	            			// item.addEventListener("click", function(e){
	            				// var _this = this;
	            				// sumeru.router.redirect(_this.href.substr(location.origin.length));
	            				// e.preventDefault();
	            			// });
	            			// item.setAttribute("link-ajax",true)
	            		// })(anchors[i]);
// 	            		
	            	// }
	            // }
        	// }
//             
    	// };
        //立即执行一次
        _bindingMap[widgetId].eventMap['__default_key__']();
    };
    
    var queryElementsByTplId = function(id,rootElement){
        return (rootElement || document).querySelectorAll('block[tpl-id="' + id + '"]') || [];
    };
    
    //根据模板关系，从父模板到子模板，对每个block进行渲染  
    var doRenderByRelation = function(relationMap, func){
        for (var i in relationMap){
            func(i, relationMap[i]);
            doRenderByRelation(relationMap[i], func);
        }    
    };
    
    
    /**
     * 查找重用一个dom的controller,并无条件将其销毁...
     *   
     * FIXME 真狠..此处可能有销毁性能上的潜藏问题
     * @param id dom元素的id, 一般为模板根block的名称
     * @param butMe 需要跳过的销毁的controller id
     */
    var findAndDestroy = _controller.__reg('findAndDestroy',function(idArr,butMe){
        
        var destroyItems = activeController.filter(function(item){
            var id = item.__getID();
            if(id === butMe){
            }else if(idArr.indexOf(id)!== -1){
                return true;
            }
            return false;
        });
        
        destroyItems.forEach(function(item){
            item.destroy();
        });
    },true);
    
    /**
     * Controller's Env base
     */
    var _Environment = function(){
        this.isWaiting = 0;
        this.isWaitingChecker = null;
        this.callbackFunc = null;
        this.isDestroy = false;
        
        this.withEnyo = false;//third plugin enyojs
        
    };
    
    var _pubSubObject = new fw.pubsub._pubsubObject();
    
    _Environment.prototype = {
        
         __destroy:function(){
            fw.utils.cleanObj(this);
            this.isDestroy = true;
            fw.pubsub.clear();
        },
        
        setClockChecker : function(){
            var after = 8 * 1000;
            this.isWaitingChecker = setTimeout(function(){
                //这个checker可能会重复，所以添加hack
                if (this.isWaiting > 0)//hack
                    throw 'NOT call env.start after ' + after / 1000 + ' seconds, did you forget it?';
            }, after);
            // this.isWaitingChecker = setTimeout(function(){
                // throw 'NOT call env.start after ' + after / 1000 + ' seconds, do you forget it?';
            // }, after);
        },
        
        clearClockChecker : function(){
          clearTimeout(this.isWaitingChecker);  
        },
        
        setCallback : function(func){
            this.callbackFunc = func;
        },
        
        fireCallback : function(){
            if(this.isWaiting <= 0 && this.callbackFunc){
                this.callbackFunc();
            }
        },
        
        redirect:function(queryPath,paramMap,isforce){
            var urlHash = queryPath;
            if(paramMap){
                urlHash += "!" + fw.utils.mapToUriParam(paramMap);
            }
            fw.router.redirect(urlHash,isforce);
        },
        
        refresh:function(){
            return this.__getControllerInstance().__refresh();
        },
        
        /**
         * 调用一个子controller
         * @param conNam {string} controller的Name
         */
        callSub:function(conNam){
            this.__getControllerInstance().__callSubController(conNam);
        },
        
        wait : function () {//移到了pubsub.js中
            this.isWaiting++;
            this.setClockChecker();
        },
        
        start : function () {//移到了pubsub.js中
            this.clearClockChecker();
            if (--this.isWaiting <= 0) {
                this.isWaiting = 0;
                this.fireCallback(); 
            };
        },
        
        onload : function(){
            return [];
        },
        
        onrender : function(){
            //throw "Didn't specify a onrender event handler";
        },
        
        onready : function(){
        },
        
        /*
         * 以下情况执行该方法：
         *  当前controller移出屏幕并且dom对像将被复用时。
         *  性能调优时，长时间不活动的controller需要被暂停时。
         */
        onsleep : function(){
        },
        
        /*
         * 当controller从sleep中恢复活动时，执行该方法
         */
        onresume : function(){
        },
        
        /**
         * 通知controller将被销毁
         */
        ondestroy : function(){
        },
        
        /**
         * 当前controller收到错误消息时被触发
         */
        onerror : function(msg){
            sumeru.log(msg);
        },
        
        subscribe : _pubSubObject.subscribe,
        subscribeByPage : _pubSubObject.subscribeByPage,
        prioritySubscribe : _pubSubObject.prioritySubscribe
    };
    
    var controllerBase = {
            __init:function(){
                var env = null;
                var tapped_block = [];
                if(this.__isInited === false){
                    env = this.getEnvironment();
                    session = this.getSession();
                    var that = this;
                    
                    activeController.push(this);
                    
                    // 构建空的tapped_blocks用于触发不使用subscribe时的block的渲染
                    fw.controller.__reg('_tapped_blocks', tapped_block, true); 
                    
                    var toLoad = env.onload();
                    
                    var doLoad = function(i) {
                        if (i >= toLoad.length) {
                            env.setCallback(null);
                            return;
                        }
                        
                        env.setCallback(function() {
                            doLoad(++i);
                        });
                        
                        fw.sense.runSenseContext((function(customClosure) {
                            return function() {
                                // 构建空的tapped_blocks用于触发不使用subscribe时的block的渲染
                                fw.controller.__reg('_tapped_blocks', [], true);
                                customClosure.call({});
                                // 触发同步使用session.bind所应产生的演染
                                that.__render(fw.controller._tapped_blocks);
                            };
                        })(toLoad[i]));
                        
                        // toLoad[i]();
                        
                        // 如果这次没调用wait函数，则fire生效。否则此fire进入后就立即推出了，等待resume方法的fire进行实际触发。
                        env.fireCallback();
                    };
                    
                    // 开始初始化记载数据
                    doLoad(0);
                    // 构建空的tapped_blocks用于触发不使用subscribe时的block的渲染
                    
                    // 触发第一次渲染
                    this.__render();
                    
                    // 标记初始化结束
                    this.__isInited = true;
                }
                
            },
            __render:function(tapped_block,increment){
                var me = this;
                var item = tapped_block.widgetId;
                var env = this.getEnvironment();
                
                //FIXME 添加了enyo的hack
                if ( env.withEnyo ) {
                    this.__renderEnyo(tapped_block);
                    return true;
                } else if(typeof _bindingMap[item] == 'undefined' || me.__templateBlocks[item] == undefined){
                    return false;
                }
                
                var record = _bindingMap[item];
                if (record.isByPage) {
                    //如果是分页类的数据绑定
                    var targets = queryElementsByTplId(item),
                        page = tapped_block.page,
                        data = _bindingMap[item]['view_data'][page],
                        onePageContainer;
                    
                    for(var i = 0, l = targets.length; i < l; i++){
                        var target = targets[i];
                        if (tapped_block.options.cleanExist) { //如果指明要清除现有内容
                            var matched = target.querySelectorAll('[__page-unit-rendered-page]'),
                                existNode;
                            for (var x = 0, y = matched.length; x < y; x++){
                                existNode = matched[x];
                                existNode.parentNode.removeChild(existNode);
                                existNode.innerHTML = '';
                            };
                        };
    
    
                        //检查是否已被渲染的分页区域 page-unit-rendered-page
                        if (target.querySelectorAll('[__page-unit-rendered-page]').length == 0) {
                            //初次渲染
                            var html = me.__templateBlocks[item](data);
                            
                            //将标记的tpl-role=page_unit换为page-unit-rendered-page
                            html = html.replace(/tpl-role[\s]*=[\s]*['"]page_unit['"]/, '__page-unit-rendered-page="' + page + '"');
                            target.innerHTML = html;
                        } else {
                            var fakeNode = document.createElement('div');
                            fakeNode.innerHTML = me.__templateBlocks[item](data);
                            
                            var onePageDom;
                            
                            var onePageContentMatchElement = fakeNode.querySelector('[tpl-role="page_unit"]');
                            if (onePageContentMatchElement == null) {
                                //如果没有找到tpl-role的语法标记，则默认使用整个模板
                                onePageDom = fakeNode;
                            } else {
                                onePageDom = onePageContentMatchElement;
                            }
    
                            
                            
                            //将标记的tpl-role=page_unit换为page-unit-rendered-page
                            onePageDom.removeAttribute('tpl-role');
                            onePageDom.setAttribute('__page-unit-rendered-page', page);
                            
                            
                            //判断是否需要创建容器
                            var container;
                            if (container = target.querySelector('[__page-unit-rendered-page="' + page + '"]')) {
                                //如果已经存在容器
                                container.innerHTML = onePageDom.innerHTML;
                                
                            } else {
                                onePageDom.innerHTML = onePageDom.innerHTML.replace(/tpl-role[\s]*=[\s]*['"]page_unit['"]/, '__page-unit-rendered-page="' + page + '"');
                                
                                //取当前最后一个单页面容器，插入在其后面
                                var tmp = target.querySelectorAll('[__page-unit-rendered-page]');
                                container = tmp[tmp.length - 1];
                                //insertAfeter
                                container.parentNode.insertBefore(onePageDom, container.nextSibling); 
                                //it will still work because when the second parameter of insertBefore is null then the onePageDom is appended to the end of the parentNode
                            }
                            
                            //重写HTML抹除事件绑定
                            target.innerHTML = target.innerHTML + ' ';
                        }    
                    }
                    
                    
                    var blockEvents = _bindingMap[item]['eventMap'];
                    for(var i in blockEvents){
                        blockEvents[i]();
                    }
                    
                } else {
                    var data = _bindingMap[item]['view_data'];
                    var targets = queryElementsByTplId(item);
                    
                    for(var i = 0, l = targets.length; i < l; i++){
                        var target = targets[i];
                        
                        if(increment&&typeof nodomdiff== 'undefined'){
                            target.innerHTML = target.innerHTML;
                            fw.domdiff.convert(me.__templateBlocks[item](data),target);
                        }else{
                            target.innerHTML = me.__templateBlocks[item](data);
                        }
                    }
                    
                    var blockEvents = _bindingMap[item]['eventMap'];
                    for(var i in blockEvents){
                        blockEvents[i]();
                    }
                    
                    //根据模板关系，从触发的当前模块块，对其下每个block重新进行渲染  
                    var found = null;
                    doRenderByRelation(me.__templateRelation, function(i, currentItem){
                        if (i == item) {
                            found = currentItem;
                        };
                    });
                    
                    doRenderByRelation(found, function(i){
                        if(_bindingMap[i]){ //如果都没绑定数据和事件，就不用处理重新绘制了
                            var data = _bindingMap[i]['view_data'];
                            
                            
                            var targets = queryElementsByTplId(i);
                            for (var x = 0, y = targets.length; x < y; x++){
                                var target = targets[x];
                                

                                if(increment&&typeof nodomdiff== 'undefined'){
                                    target.innerHTML = target.innerHTML;
                                    fw.domdiff.convert(me.__templateBlocks[i](data),target);
                                }else{
                                    target.innerHTML = me.__templateBlocks[i](data);
                                }
                            }
                            
                            var blockEvents = _bindingMap[i]['eventMap'] || {};
                            for(var key in blockEvents){
                                blockEvents[key]();
                            }    
                        }
                    });
                }
                
                return true;
            },
            __renderEnyo: function( tapped_block ) {
                var enyoapp = session.get('enyoapp');
                if ( !enyoapp ) {
                    sumeru.log("__renderEnyo -> no enyoapp detacted!");
                    return false;
                }
                    
                if ( !tapped_block ) {//第一次要render到body上
                    var doc = document.getElementById('view/blank@@content');
                    enyoapp.renderInto(doc);
                    return;
                }
                
                var item = tapped_block.widgetId;
                var tmp = item.split(".").pop();
                var blockEvents = _bindingMap[item]['eventMap'];
                //执行步骤,是enyo更新dom的步骤
                //1.销毁，2.更新数据，3.render
                enyoapp.$[tmp].destroyClientControls();
                enyoapp.$[tmp].fwdata =_bindingMap[item].view_data.fwdata;
                enyoapp.$[tmp].fwdataChanged();
                enyoapp.$[tmp].render();
                
                for( var i in blockEvents ) {//这里是执行enyo.
                    blockEvents[i]();
                }
                
            },
            __refresh:function(){
                var identifier = this.__getID(), constructor , instance;
                var arr = identifier.split("!");
                
                if(arr.length === 1){
                    arr.push('');
                }
                
                constructor = findController(arr[0]);
                
                if (constructor === false) {
                    //可能由第三方程序接管，framework停止响应
                    return;
                };
                
                this.destroy(true,true); // 销毁自身，但保留session
                
                //创建一个新的controller,将自动使用未被销毁的旧session
                instance = new MainController(identifier, fw.utils.uriParamToMap(arr[1]), constructor);
                instance.__init();
                
            },
            rewriteUri:function(dom){
            	if (typeof dom != 'undefined'){
            		var checkRedirect = function(e){
            			if (e.target.nodeName.toLowerCase() =='a' && e.target.href.indexOf(location.origin) != -1) {//站内的链接，阻止跳转 已？或者/开头的链接将阻止跳转
            				if (!e.defaultPrevented) {
            					sumeru.router.redirect(e.target.href.substr(location.origin.length));
        						e.preventDefault();
            				}
            			}
            		}
            		if (!dom.getAttribute("link-ajax") && !dom.getAttribute("data-rel")) {
            			dom.addEventListener("click", checkRedirect);
            			dom.addEventListener("touchstart", checkRedirect);
            			dom.setAttribute("link-ajax",true);
            		}
            		
	        	}
		    },
            destroy:function(isKeepSession,isKeepDomForTrans){
                var id = this.__getID();
                var uk = this.__UK;
                //try {
                    var session = this.getSession();
                    var env = this.getEnvironment();
                    
                    //销毁之前，我要 clonedom 一份用于转场
                    //自己转自己，没有 clonedom 会出错，所以添加容错
                    if(!cloneDom && typeof this.getDom != 'undefined' && isKeepDomForTrans) _cloneDom(this);
                    
                    try {
                        env.ondestroy();                    // 通知用户controller将被销毁.
                    } catch (e) {}
                    
                    // 清理当前占用的dom
                    fw.render.clearTplContent(session);
                    
                    // 销毁过程..
                    if(isKeepSession !== true){
                        fw.session.destroy(session);
                    }else{
                        session.cleanObserver();
                    }
                    
                    env.__destroy();
                    
                    //销毁dom
                    //added view delete
                    fw.render.delTpl(this.tplName);
       
                    // 销毁子controller
                    if(this.__subControllerList){
                        for(var key in this.__subControllerList){
                            this.__subControllerList[key].destroy();
                        }
                    }
                    
                    // 清理_bindingMap
                    for(var key in _bindingMap){
                        if(key.indexOf(uk) === 0){
                            fw.utils.cleanObj(_bindingMap[key].view_data);
                            fw.utils.cleanObj(_bindingMap[key].eventMap);
                            fw.utils.cleanObj(_bindingMap[key]);
                            delete _bindingMap[key];
                        }
                    }
                    
                    // 外引对像　&　闭包方法
                    this.getSession = null;
                    this.getEnvironment = null;
                    this.__getIdentifier = null;
                    
                    delete this.getSession;
                    delete this.getEnvironment;
                    delete this.__getIdentifier;
                /*} catch (e) {
                    // TODO: handle exception
                    console.error(e);
                }finally{*/
                    var old = activeController;
                    
                    // 无论如何,清除activeController中的引用
                    activeController = old.filter(function(item){
                        return item.__getID() !== id;
                    });
                    
                    // 清空旧数组
                    old.length = 0;
                    
                    fw.dev('destory ["' + id + '"]');
                //}
            }
    };
    
    /**
     * 子controller的基类
     * 子controller，访问父controller的session与传入的collection对像用于触发父对像的随动反馈.
     * @param id {string} 
     * @param params {any} 传入参数
     */
    var SubControler =  function(id, params, _parent , constructor){
        var me = this;
        var env , session;
        env= new _Environment();
        session = fw.session.create(id);  // 相同的id会返回相同的session
        session.bind = _bindingData;
        session.event = _bindingEvent;
        //FIXME 为了与给HP的代码一致，临时给出一个简单的eventMap实现。后续要与事件库一起考虑
        session.eventMap = fw.event.mapEvent;
        
        session.__isSubController = true;
        
        // 取得父controller的session
        session.getMain = function(){
            return _parent.session;
        };
        
        env.isReady = function(){
            return false;  
        };
        
        env.show = function(){
            throw 'this controller not ready';
        };
        env.hide = function(){
            throw 'this controller not ready';
        };
        
        env.destroy = function(){
            me.destroy();
        };
        
        // 确保session bind时数据项唯一的随机字符串key
        env.__UK = session.__UK = this.__UK = "T" + fw.utils.randomStr(10);
        
        // 添加取得当前对像的get方法，
        // 保证值在controller的生命周期中是唯一，并且不可变更.
        
        this.getSession = function(){
            return session;
        };
        
        this.getEnvironment = function(){
            return env;
        };
        
        this.__getID = function(){
            return id;
        };
        
        this.__isFirstRender = true;
        this.__isInited = false;
        this.__templateBlocks = false;
        this.__templateRelation = false;
        
        constructor( env, session , params , _parent);
        
        env.__getControllerInstance = function(){
            return me;
        };
        
        fw.dev("create new : " + id);
    };
    
    SubControler.prototype = fw.utils.extendFrom(controllerBase,{
        __render:function(tapped_blocks){
            var me = this;
            var env = me.getEnvironment();
            var session = me.getSession();
            var _transitionType = null;//push left,right,down,up
            
            //此处env是在构造方法中创建，并在用户controller的构造方法执行时被替换了真正的生命周期方法.
            env.onrender(function(tplName, position , transitionType){
                 session.__currentTplName = tplName;          // 记录到session
                 var block , blockStyle = {
                         position : 'absolute',
                         top:0,
                         left:0,
                         width:'100%',
                         height:70,
                         display:'none'
                 };
                 //这里添加render时候的记录
                 _transitionType = (typeof transitionType !== 'undefined') ? ( transitionType ) : null;
                 
                 var doRender  = function(){
                    //pub sub触发的局部渲染
                    if (typeof tapped_blocks != 'undefined'){ //如果定义了tapped_blocks，那么就一定是来自msgDispater的局部渲染调用
                        
                        //优先抛弃length == 0的情况
                        if(!tapped_blocks.length){
                            return;
                        }
                        
                        //如果isFirstRender还为true，则说明数据push在首次渲染之前就到达了。需要等待首次渲染完成。
                        if (me.__isFirstRender) {
                            setTimeout(function(){
                                me.__render(tapped_blocks);
                            }, 50);
                            return;
                        }
                        for (var i = 0, l = tapped_blocks.length; i < l; i++){
                            //=====================
                            controllerBase.__render.call(me,tapped_blocks[i]);
                            //=====================
                        };
                        return;
                    }
                    
                    // 只记录模版的更新方法，模版骨架的创建方法，会在getTpl的时候，首次返回时解析.如果实在必须重新渲染骨架，使用 render.renderBone
                    var renderObject = fw.render.buildRender(session);
                    me.__templateBlocks = renderObject.renderBlock;
                    me.__templateRelation = renderObject.blocksRelation;
                     
                     
                    block = fw.render.getTplContent(session);
                    
                    fw.utils.setStyles(block,fw.utils.cpp(blockStyle,position));
                    
                    //对每个block进行渲染
                    //根据模板关系，从父模板到子模板，对每个block进行渲染  
                    doRenderByRelation(me.__templateRelation, function(i){
                        
                        var targets = queryElementsByTplId(i);
                        for(var x = 0, y = targets.length; x < y; x++){
                            var target = targets[x];
                            target.innerHTML = me.__templateBlocks[i]({});
                        }
                    });
                    
                    // 创建模版容器后，创真正的显示和隐藏方法
                    //这里添加转场动画,暂时只在onrender时候设置了默认动画，如果以后这里要加也可以
                    //其实这里很容易，因为只需要进场出场效果而已
                    env.show = function( transitionType ){
                       fw.transition._subrun({
                            "dom" : block,                               
                            "anim" : transitionType || _transitionType   // 如果没指明，则使用上一次的
                        },false);
                        if (!_transitionType && transitionType ) {
                            _transitionType = transitionType;
                        }
                        me.rewriteUri(block);
                    };
                    env.hide = function( transitionType ){
                         fw.transition._subrun({
                            "dom" : block,                               
                            "anim" : transitionType || _transitionType   // 如果没指明，则使用上一次的
                        },true);
                    };
                    
                    env.setPosition = function(css){
                        fw.utils.setStyles(block,css);
                    };
                    
                    env.isReady = function(){
                        return true;
                    };
                    
                    session.toBeCommited.length = 0;
                    
                    //FIXME 不能直接onready，还要判断是否FirstRender完成
                    env.onready(block);
                    
                    me.__isFirstRender = false;
                }; //end dorender  
                
                //这里修复了一个可能出现死锁的BUG，当tpl已经加载，对象却destroy的时候会出现，永远都是__isFirstRender == true
                //可能引起其他问题，另外不开控制台断点没问题,代码逻辑没问题，暂不修复 FIXME
                // if ( fw.render.getTplStatus(tplName) === 'loaded' ) {
                    // me.__isFirstRender = false;
                // }
                fw.render.getTpl(tplName,session,function(render){
                    me.tplName = tplName;//加入tplName入口
                    doRender();
                });
                
            });
        }
    });
    
    /**
     * controller
     */
    var MainController =  function(id, contr_argu , constructor){
        var me = this;
        var env , session;
        env= new _Environment();
        
        var isFirstPage = (activeController.length==0);
        
        session = fw.session.create(id);  // 相同的id会返回相同的session
        
        session.bind = _bindingData;
        session.bindByPage = _bindingDataByPage;
        session.event = _bindingEvent;
        //FIXME 为了与给HP的代码一致，临时给出一个简单的eventMap实现。后续要与事件库一起考虑
        session.eventMap = fw.event.mapEvent;
        
        env.callSubController = function(name,param,forceFresh){
            return me.__callSubController(name,param,forceFresh);
        };
        
        // 确保session bind时数据项唯一的随机字符串key
        env.__UK = session.__UK = this.__UK = "T" + fw.utils.randomStr(10);
        
        session.__isSubController = false;
        // 添加取得当前对像的get方法，
        // 保证值在controller的生命周期中是唯一，并且不可变更.
        
        this.getSession = function(){
            return session;
        };
        
        this.getEnvironment = function(){
            return env;
        };
        
        this.__getID = function(){
            return id;
        };
        
        this.__isFirstRender = true;
        this.__isInited = false;
        this.__templateBlocks = false;
        
        this.__subControllerList = {};
        // constructor( env, session , params);
        constructor( env, session , session.getContainer());//兼容老式写法,仅限maincontroller和servercontroller
        
        env.__getControllerInstance = function(){
            return me;
        };
        
        fw.dev("create new : " + id);
    };
    
    MainController.prototype = fw.utils.extendFrom(controllerBase,{
        __render:function(tapped_blocks){
            var me = this;
            var env = me.getEnvironment();
            var session = me.getSession();
            
            //此处env是在构造方法中创建，并在用户controller的构造方法执行时被替换了真正的生命周期方法.
            env.onrender(function( tplName, transitionType ){
                 session.__currentTplName = tplName;          // 记录到session
                 var tplContentDom;
                 var doRender  = function(){
                    //pub sub触发的局部渲染
                    if (typeof tapped_blocks != 'undefined'){ //如果定义了tapped_blocks，那么就一定是来自msgDispater的局部渲染调用
                        
                        //优先抛弃length == 0的情况
                        if(!tapped_blocks.length){
                            return;
                        }
                        
                        //如果isFirstRender还为true，则说明数据push在首次渲染之前就到达了。需要等待首次渲染完成。
                        if (me.__isFirstRender) {
                            setTimeout(function(){
                                me.__render(tapped_blocks);
                            }, 50);
                            return;
                        }
                        for (var i = 0, l = tapped_blocks.length; i < l; i++){
                            //=====================
                            controllerBase.__render.call(me,tapped_blocks[i],true);
                            //=====================
                        };
                        return;
                    }
                    
                    // 只记录模版的更新方法，模版骨架的创建方法，会在getTpl的时候，首次返回时解析.如果实在必须重新渲染骨架，使用 render.renderBone
                    var renderObject = fw.render.buildRender(session);
                    me.__templateBlocks = renderObject.renderBlock;
                    me.__templateRelation = renderObject.blocksRelation;
                    
                    tplContentDom = fw.render.getTplContent(session);
                          
                    //根据模板关系，从父模板到子模板，对每个block进行渲染                
                    doRenderByRelation(me.__templateRelation, function(i){
                        var targets = queryElementsByTplId(i);
                        for(var x = 0, y = targets.length; x < y; x++){
                            var target = targets[x];
                            target.innerHTML = me.__templateBlocks[i]({});    
                        }
                    });
                    
                    // if (me._isFirstPage && (fw.config.get("runServerRender")!==false) ) {//开启server渲染，且是首页，则不进行转场（转场会销毁dom）
                        // me.__transition(tplName,["none","none"],function() {
	                        // session.toBeCommited.length = 0;
	                        // env.onready(tplContentDom);
	                    // });
	                    // me._isFirstPage = false;
                    // }else{
                    	me.__transition(tplName,transitionType,function() {
	                        session.toBeCommited.length = 0;
	                        env.onready(tplContentDom);
	                    });
                    // }
                    me.rewriteUri(tplContentDom);
                    
                    if ( env.withEnyo && me.__isFirstRender ) {//初始化enyo render,确保只执行一次!
                        controllerBase.__renderEnyo();
                    }
                    me.__isFirstRender = false;
                    
                    
                }; //end dorender  
                
                fw.render.getTpl(tplName,session,function(render){
                    doRender();
                });
            });
        },
        /**
         * 调用一个子controller
         * @param conNam {string} controller的名称
         */
        __callSubController:function(conNam,params,forceFresh){
            var constructor = findController(conNam), rootElement = this.__lastTransitionIn;
            
            if (constructor === false) {
                //可能由第三方程序接管，framework停止响应
                return;
            };
            
            var env = this.getEnvironment();
            var subEnv , subId = "__subFrom/" + this.__getID()  + "/" + conNam ,instance;
            var parent = {
                    session:this.getSession(),
                    env:fw.utils.getProxy(env,['redirect','refresh']),
                    tplContent:rootElement
            };
            
            if(!constructor){
               throw 'can not find a sub controller';
            }
            //这个判断添加一个feature，用于更新subcontroller add by sundong
            instance = this.__subControllerList[subId];
            if( instance && typeof forceFresh !== 'undefined' && forceFresh){
                instance.destroy();
            }
            if( instance = this.__subControllerList[subId] ){
                /**
                 * 重用子controller
                 */
            }else{
                instance = new SubControler(subId , params , parent , constructor);
                this.__subControllerList[subId] = instance;
                subEnv = instance.getEnvironment();
                // 代理env的一些事件方法，用于通知创建者子controller的生命周期
                subEnv.onready = (function(before,after){
                    return function(){
                        before.apply(this,arguments);
                        after && after.apply({},arguments);
                    };
                })(subEnv.onready,params.oncreated);
                
                subEnv.ondestroy = (function(before,after,superController,subId){
                    return function(){
                        try {
                            before.apply(this,arguments);
                            after && after();
                            
                        } catch (e) {
                            // TODO: handle exception
                            console.error(e);
                        }finally{
                            // 子controller被destroy时，自动清理父controller记录的__subControllerList,用于防止再次创建时引发错误.
                            superController.__subControllerList[subId] = null;
                            delete superController.__subControllerList[subId];
                        }
                        
                    };
                })(subEnv.ondestroy,params.ondestroy,this,subId);
                
                subEnv.onerror = (function(before,after){
                    return function(){
                        before.apply(this,arguments);
                        after && after.apply({},arguments);
                    };
                })(subEnv.onerror);
            }
            
            instance.__init();
            return fw.utils.getProxy(instance.getEnvironment(),['show','hide','setPosition','isReady','destroy']);
        },
        __transition:function(tplName,transitionType,oncomplete){
            
            var lastTransitionIn , rv,tmp;
            var me = this;
            /*
             * 偷偷记录，当前url，session与使用dom的历史关系，用于返回,
             * 由于controller的id，由controllerPath + params组成，
             * 所以此处不再从url中取值.直接取得session中序列化部份的的值对session的key进行排序.
             * 然后对形成新对像进行JSON序列化记录.拼到id后面，生成索引键.
             */
            this.urlToTplHistory = this.urlToTplHistory || {};
            var index = this.__getID();
            var session = this.getSession();
            var hashKey = session.__hashKey.sort();
            var jsonObj = {};
            
            hashKey.forEach(function(key){
                jsonObj[key] = session.get(key);
            },hashKey);
            
            
            index += JSON.stringify(jsonObj);
            
            // 如果提供tplName进行history记录处理,否则进行检索处理
            if(tplName || tplName === ""){
                
                // 此处不考虑一个完全不变的url对应多个tplName的问题，只记录最后一次的使用.所以，此处使用map结构，便于检索使用
                this.urlToTplHistory[index] = tplName;
                lastTransitionIn = fw.render.getTplContent(session);
            }else{
                // 查找历史记录
                tplName = this.urlToTplHistory[index];
                // 找到对应的tplName,并且的确被当前实例引用则使用，未找到，则使用最后一次的
                if(tplName || tplName == ""){
                    lastTransitionIn = fw.render.getTplContent(session);
                }else{
                    lastTransitionIn = this.__lastTransitionIn;
                }
                
                if(!lastTransitionIn){
                    // 如果此处再无法决定转场进入那一个controller，则认为转场失败.
                    return false;       
                }
            }
            var anim = transitionType || this.__lastTransitionType;// 如果没指明，则使用上一次的
            
            if (me._isFirstPage && (fw.config.get("runServerRender")!==false) ) {//开启server渲染，且是首页，则不进行转场（转场会销毁dom）
            	me._isFirstPage = false;
            	anim=["none","none"]
            }
            
            //before转场，let's 对历史记录进行一下操作，
            //由于现在的逻辑是，无论是否为activecontroller，都必须走这里
            //这里很悲剧，我得不到 render 的 transiton 方法。
            if ( tmp = fw.historyCache.hitUrl([index ,(transitionType || this.__lastTransitionType)], globalIsforce) ) {
                // transitionOut = tmp[1];
            }
            rv = fw.transition._run({
                "dom" : lastTransitionIn,                               
                "cloneDom" : cloneDom,
                "transitionOut" : transitionOut,
                "anim" : anim,
                "callback" : {
                    "load" : oncomplete || function(){}                 // 如果不指明，则什么都不做
                }
            });
            
            transitionOut = false;//赋值完成，自己回归
            cloneDom = null;//赋值完成，自己回归
            
            // 如果转场未移动任务内容，则手动触发 oncomplete
            rv || (oncomplete || function(){})();
            
            // 记录最后当前controller移入的dom和转场效果类型
            //位置提前，因为js是引用传递，下面的run会修改这个类型
            //可能会长期不传入transitiontype，原来不加——lasttype会出现bug
            this.__lastTransitionType = (transitionType || this.__lastTransitionType);
            
            this.__lastTransitionIn = lastTransitionIn;
            return true;  // 
        },
        getDom : function() {
            return fw.render.getTplContent(this.getSession());
        },
        setFirstPage : function(isFirstPage){
        	this._isFirstPage = isFirstPage;
        }
    });
    
    //server begin
    var _bindingServerEvent = function(key,eventFunc){
        var widgetId = this.__UK + "_" + key;
        if(!_bindingMap[widgetId]){
            _bindingMap[widgetId] = {
                view_data   :   {},
                eventMap    :   {}
            };
        }
        _bindingMap[widgetId].eventMap['__default_key__'] = function(){};
    }
    var serverController = function(id, contr_argu , constructor){
        var me = this;
        var env , session;
        env= new _Environment();
        
        var uk = "T" + fw.utils.randomStr(10);
        
        session = fw.session.create(uk);  // 相同的id会返回相同的session
        session.bind = _bindingData;
        session.bindByPage = _bindingDataByPage;
        session.event = _bindingServerEvent;
        //FIXME 为了与给HP的代码一致，临时给出一个简单的eventMap实现。后续要与事件库一起考虑
        session.eventMap = fw.event.mapEvent;
        
        env.callSubController = function(name,param,forceFresh){
            return me.__callSubController(name,param,forceFresh);
        };
        
        // 确保session bind时数据项唯一的随机字符串key
        env.__UK = session.__UK = this.__UK = uk;//"T" + fw.utils.randomStr(10);
        
        session.__isSubController = false;
        // 添加取得当前对像的get方法，
        // 保证值在controller的生命周期中是唯一，并且不可变更.
        
        this.getSession = function(){
            return session;
        };
        
        this.getEnvironment = function(){
            return env;
        };
        
        this.__getID = function(){
            return id;
        };
        
        this.__isFirstRender = true;
        this.__isInited = false;
        this.__templateBlocks = false;
        
        this.__subControllerList = {};
        constructor( env, session , session.getContainer());
        
        env.__getControllerInstance = function(){
            return me;
        };
        
        // activeController.push(me);
        
        fw.dev("create new : " + id);
    };
    
    serverController.prototype = fw.utils.extendFrom(controllerBase,{
        __render:function(tapped_blocks){
            var me = this;
            if (!me.getEnvironment){
            	console.warn("render... error...   @controller on line 1179");
            	return ;
            }
            var env = me.getEnvironment();
            var session = me.getSession();
            //此处env是在构造方法中创建，并在用户controller的构造方法执行时被替换了真正的生命周期方法.
            env.onrender(function( tplName, transitionType ){
                 session.__currentTplName = tplName;          // 记录到session
                 // var tplContentDom;
                 var doRender  = function(render){
                    //pub sub触发的局部渲染
                    var uk = me.__UK;
                    try{
                    
	                    if ( me.__isFirstRender ) {//first render 之前应该先初始化模板
	                    	// 只记录模版的更新方法，模版骨架的创建方法，会在getTpl的时候，首次返回时解析.如果实在必须重新渲染骨架，使用 render.renderBone
		                    var renderObject = fw.render.buildRender(session,render);
		                    me.tplContent = renderObject.tplContent;
		                    me.domId = renderObject.domId;
		                    
		                    me.__templateBlocks = renderObject.renderBlock;
		                    me.__templateRelation = renderObject.blocksRelation;
		                    
		                    me.__isFirstRender = false;
		                }
	                    if (typeof tapped_blocks != 'undefined'){ //如果定义了tapped_blocks，那么就一定是来自msgDispater的局部渲染调用
	                        
	                        //优先抛弃length == 0的情况
	                        if(!tapped_blocks.length){
	                            return;
	                        }
	                        
	                        for (var i = 0, l = tapped_blocks.length; i < l; i++){
	                            //=====================
	                            me.__renderData.call(me,tapped_blocks[i]);
	                            //=====================
	                        };
	                        return;
	                    }
	                    
	                    //销毁前渲染
                		var finishhtml = '<div class="_smr_runtime_wrapper" id="_smr_runtime_wrapper"><section id="'+me.domId+'" class="__viewBlock__">'+me.tplContent+'</section></div>';
               			env.__onFinish && env.__onFinish(finishhtml);
	                    me.server_destroy();
                    	
	                }catch(e){
                    	console.warn("controller do render error on line 1226 "+uk);
                    	env.__onFinish && env.__onFinish();
                    	me && me.server_destroy();
                    }
                    
                    
                }; //end dorender  
                
                fw.render.getTpl(tplName,session,function(render){
                   
                    doRender(render);
                });
                //onready
            });
        },
        server_destroy:function(){
        	if (!this || !this.__UK) {
        		console.warn("server destroy already... on line 1242 controller.js");
        		return;
        	}
    	    var id = this.__getID();
            var uk = this.__UK;
            var session = this.getSession();
            var env = this.getEnvironment();
            
            
            
            fw.session.destroy(session);
            
            // env.__destroy();
            
            fw.utils.cleanObj(env);
	        env.isDestroy = true;
	        fw.pubsub.clearClient(uk);//根据uk进行移除
            
            // 清理_bindingMap
            for(var key in _bindingMap){
                if(key.indexOf(uk) === 0){
                    fw.utils.cleanObj(_bindingMap[key].view_data);
                    fw.utils.cleanObj(_bindingMap[key].eventMap);
                    fw.utils.cleanObj(_bindingMap[key]);
                    delete _bindingMap[key];
                }
            }
            
            fw.utils.cleanObj(this);
            //close socket...
            
            // 外引对像　&　闭包方法
            // this.getSession = null;
            // this.getEnvironment = null;
            // this.__getIdentifier = null;
//                 
            // delete this.getSession;
            // delete this.getEnvironment;
            // delete this.__getIdentifier;
            
            fw.dev('destory ["' + id + '"]' + uk);
        },
        __renderData:function(tapped_block){
            var me = this;
            if (typeof me == 'undefined'){
            	console.warn("error ,no controller");
            	return ;
            }
            var item = tapped_block.widgetId;
            var env = this.getEnvironment();
            if(typeof _bindingMap[item] == 'undefined' || me.__templateBlocks[item] == undefined){
                return false;
            }
            
            var data,record = _bindingMap[item];
            
            if (record.isByPage) {
            	data = _bindingMap[item]['view_data'][tapped_block.page];
            }else{
            	data = _bindingMap[item]['view_data'];
            }
            //TODO 分页问清楚再改
            //检查是否已被渲染的分页区域 page-unit-rendered-page
                    
            var tplReg = new RegExp("("+item + "[^>]*>)[\\s\\S]*?(<\/block>)")
            //把 item 里面的内容进行替换，替换成有内容的
            me.tplContent = me.tplContent.replace(tplReg,"\$1"+me.__templateBlocks[item](data)+"\$2");
           
        },
        __init:function(){
            var env = null;
            var tapped_block = [];
            if(this.__isInited === false || this.pathChange){
            	this.__isInited = 'waiting';
            	this.pathChange = false;
                env = this.getEnvironment();
                session = this.getSession();
                
                var that = this;
                // 构建空的tapped_blocks用于触发不使用subscribe时的block的渲染
                fw.controller.__reg('_tapped_blocks', tapped_block, true); 
                
                var toLoad = env.onload();
                var finalCallback = function(error){//放在callback中
                	// 触发页面渲染
            		that.__render();
                   // 标记初始化结束
                    that.__isInited = true;
                    env.isWaiting = 0;
                }
                //@params i number
                var t=0;
                var doLoad = function(i,callbackfunc) {
                	
                	callbackfunc && callbackfunc();
                	
                    if (i >= toLoad.length) {
                		env.setCallback(null);
                    	finalCallback && finalCallback();
                        return;
                    }
                    //说明：只有当subscribe的结果回来，env.start之后，才会执行doLoad的callbackfunc
                    env.setCallback(function() {
                    	doLoad(++i,function(){
                        	that.__render(fw.controller._tapped_blocks);
                        });
                    });
                    
                    //hack no need 注册
                    fw.controller.__reg('_tapped_blocks', [], true);
                    try{
                    	toLoad[i].call({});
                    }catch(e){
                    	fw.log(e,'toLoadEror...');
                    }
                    
                    env.fireCallback();
                    
                };
                // 开始初始化记载数据
                doLoad(0);
            }else if (this.__isInited === 'waiting' ){
            	this.__render();
            }else{
            	this.__render(fw.controller._tapped_blocks);
            	this.__render();
            }
        },
        setPath:function(path){
        	if (this.path != path){
        		this.path = path;
        		this.pathChange = true;
        	}
        }
    });
    _controller.__reg('serverController',serverController);
    
    _controller.__reg('getServerInstance',function(identifier, uriParts,path,constructor,__onFinish){
    	
    	var instance = new fw.controller.serverController(identifier, uriParts.contr_argu,constructor);
    	//处理session
    	// uriParts.contr_argu
    	fw.session.setResumeNew(uriParts.session,instance.__UK);
        var env = instance.getEnvironment();
    	env.__onFinish = __onFinish;
    	env.arguments = uriParts.contr_argu;//HERE, controller arguments here
    	
    	instance.setPath(path);//HERE 设置path，用于判断是否重新加载load
    	
    	instance.__init();
    });
    _controller.__reg('create',function(constructor){
        return constructor;
    });
    
    /**
     * 根据名称查找controller
     */
    var findController = _controller.__reg("findController",function(path){
        var routeMap = fw.router.getAll();
        var pattern , find;
        for(var i = routeMap.length - 1; i >= 0; i--){
            
            // 因为已经path与params预先分离，所以此处要求路径整行完全匹配，即 ^ 到$
            pattern = new RegExp('^' + routeMap[i]['path'] + "$");  
            
            if((routeMap[i]['path'] == '' && path == '') || (routeMap[i]['path'] !== '' && pattern.test(path) === true)){
                if(find = eval(routeMap[i]['action'])){
                    return find; 
                }else{
                    // 如果找到匹配的path，但是结果是undefined或null等，说明controller载入不成功或配置内容错误.
                    throw "found a router record for controller [" + path +"], but the controller is undefined.";
                }
            }
        }
        
        //检查是否有第三方处理器，如果有，按顺序调用，如果有任何一个返回true，则表示匹配成功
        var externalProcessors = sumeru.router.externalProcessor.getAll(),
            processor;
        
        //这里不用forEach是因为要return本层函数
        for(var i = 0, l = externalProcessors.length; i < l; i++){
            processor = externalProcessors[i];
            if (true === processor(path)) {
                //已经匹配成功，并且在if中已经移交第三方processor处理
                return false;
            };
        }
        
        //走到这里说明没有route config匹配，检查是否有默认项
        if (typeof SUMERU_DEFAULT_CONTROLLER != 'undefined') {
            return eval(SUMERU_DEFAULT_CONTROLLER);
        };
       
       throw "Can NOT find a controller [" + path +"]";
       
    }, fw.SUMERU_APP_FW_DEBUG ? false : true);
    
    
    var _testReusing = function(item,queryPath){
        var tmpId = item.__getID();
        return tmpId.indexOf(queryPath + "!") == 0;
    };
    
    /**
     * controller的管理器的触发方法,将自动根据当前运行中的controller决定创建新的或使用已有的.
     * @param queryPath {string} 访问controller的路径
     * @param params {string} 调用参数的字符串表示
     * @param onFound {function} 当找到controller时,触发该回调.
     */
    var dispatch = _controller.__reg('dispatch',function(queryPath,contr_argu,isforce){
        
        var identifier = queryPath + "!" + (typeof(contr_argu) != 'string' ? "" : contr_argu);
        var constructor, instance = null , item = false;
        constructor = findController(queryPath);
        
        var isFirstPage = (activeController.length==0);
        
        if (constructor === false) {
            //可能由第三方程序接管，framework停止响应
            return;
        };
        fw.dev("dispatch " + identifier);
        
        /*
         * 检测当前controller队列
         * 
         * 重用dom的controller执行sleep.
         * 调用已有的controller执行wakeup.
         * 其它的continue;
         */
        
        globalIsforce = isforce; //因为转场时候要判断是否为强制刷新，所以这里我设置了全局变量来存放是否强制刷新
        
        var tmpId = null;
        for(var key in activeController){
            item = activeController[key];
            tmpId = item.__getID();
            if(tmpId == identifier){
                
                // ID完全匹配的,转场进入即可
                instance = item;
                
                // 如果转场失败，则认为dom被销毁，此时，销毁找到的controller实例，进入创建新controller的过程.
                if(!instance.__transition() || isforce){
                    instance.destroy(true,false);
                    item = false;
                };
                
                fw.dev("ROUTER FULL QUERY PATH : " + identifier);
                break;
            }else if(_testReusing(instance = item , queryPath)){
				//@patchbysundong20121127:
				//我对这里进行了改进，转场再销毁自身前，我要保存一下它的当前副本，用来下一步进行动画切换,
				//这里clone，在render时传入
				//fixbug20121130,有时，不会走这里destroy，相反，他会直接进行转场,trans
				//_cloneDom(instance);//挪到了destroy里面
				// queryPath匹配的，重用根DOM. 交由controller构造方法自己处理,此处仅 sleep被复用的controller即可。
				
                //！！！这里匹配有两种可能：1.当前active的是自身，则自身转自身。2.当前active的不是自身，则不cloneDom，而直接转场
                if (activeControllerId === queryPath){//说明当前active的就是自身，所以对自身进行转场（clonedom）
                    instance.destroy(false,true);
                    item = false;
                    fw.dev("ROUTER SAME QUERY PATH: " + identifier);
                }else{//说明当前active的不是自身，所以对别人进行转场
                    if(!instance.__transition() || isforce){
                        instance.destroy();
                        item = false;
                        fw.dev("ROUTER FULL QUERY PATH: " + identifier);
                    }
                }
                
                
            }else{
                // 完全不匹配的，创建新的controller.
                item = false;
                fw.dev("ROUTER NOT MATCH : " + identifier);
            }
        }
        
        // 找到已存在的controller实例，则直接使用，不再创建新的
        if(!item){
            instance = new MainController(identifier, contr_argu , constructor);
            instance.setFirstPage(isFirstPage);
        }
    	
    	var env = instance.getEnvironment();
    	env.arguments = contr_argu;
    	
        //设置当前 activeControllerId
        activeControllerId = queryPath;
        
        instance.__init();
        
        return;
    }, fw.SUMERU_APP_FW_DEBUG ? false : true);
    
    /**
     * 在数据push到之后，对于所有当前活跃的控制器，都调用其render方法（主要考虑三屏的场景）
     */
    _controller.__reg("reactiveRender" , function(tapped_blocks){
        activeController.forEach(function(item){
            //每个Controller的render方法会保证局部渲染一定等待其自己的主渲染流程完成才开始。
            item.__render(tapped_blocks);
        });
    });
    
   
    
}
if(typeof module !='undefined' && module.exports){
	module.exports = function(fw){
    	runnable(fw);
    }
    
    // fw.config.set('runServerRender',true);
}else{//这里是前端
    runnable(sumeru);
}
;Library = typeof Library == 'undefined' ? {} : Library;

var runnable = function(fw){
	fw.addSubPackage('Library');
	
	var createLibrary = function(method){
		var exports = {};
		
		method.call(this, exports);
		
		return exports;
	}
	
	var loadLibrary = function(name){
		//name format: string: Library.objUtils
		var library = eval(name);
		
		if(typeof library == 'undefined'){
			throw "Error finding the library " + name;
		}
	}
	
	fw.Library.__reg('create', createLibrary);
	fw.Library.__reg('load', loadLibrary);
	
};

if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
}

;
var runnable = function(sumeru){
    Library.objUtils = sumeru.Library.create(function(exports){
    		
    	var isPlainObject = exports.isPlainObject = function( obj ) {
    		// Must be an Object.
    		// Because of IE, we also have to check the presence of the constructor property.
    		// Make sure that DOM nodes and window objects don't pass through, as well
    		if ( !obj || type(obj) !== "object" || obj.nodeType || obj === obj.window ) {
    			return false;
    		}
    
    		try {
    			// Not own constructor property must be Object
    			if ( obj.constructor &&
    				!Object.prototype.hasOwnProperty.call(obj, "constructor") &&
    				!Object.prototype.hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf") ) {
    				return false;
    			}
    		} catch ( e ) {
    			// IE8,9 Will throw exceptions on certain host objects #9897
    			return false;
    		}
    
    		// Own properties are enumerated firstly, so to speed up,
    		// if last one is own, then all properties are own.
    
    		var key;
    		for ( key in obj ) {}
    
    		return key === undefined || Object.prototype.hasOwnProperty.call( obj, key );
    	};
    	
    	var class2type = {};
    	
    	"Boolean Number String Function Array Date RegExp Object".split(' ').forEach(function(item){
    		class2type["[object " + item + "]"] = item.toLowerCase();
    	});
    	
    	var type = function(obj){
    			return obj == null ?
    				'null' :
    				class2type[ Object.prototype.toString.call(obj) ] || "object";
    		},
    		
    		isObject = exports.isObject = function(obj){
    			return type(obj) === 'object';
    		},
    		isEmpty = exports.isEmpty = function(obj){
    			var empty = true, fld;
				for (fld in obj) {
				  empty = false;
				  break;
				}
				return empty;
    		},
    		isArray = exports.isArray = function(obj){
    			return type(obj) === 'array';
    		},
    		isFunction = exports.isFunction = function(obj){
    			return type(obj) === 'function';
    		},
    		isString = exports.isString = function(obj){
    			return type(obj) === 'string';
    		},
    		isBoolean = exports.isBoolean = function(obj){
    			return type(obj) === 'bollean';
    		},
    		isNumber = exports.isNumber = function(obj){
    			return type(obj) === 'number';
    		},
    		isDate = exports.isDate = function(obj){
    			return type(obj) === 'date';
    		},
    		isRegExp = exports.isRegExp = function(obj){
    			return type(obj) === 'regexp';
    		},
    		
    		extend = exports.extend =  function(){
    			var options, name, src, copy, copyIsArray, clone,
    				target = arguments[0] || {},
    				i = 1,
    				length = arguments.length,
    				deep = false;
    		
    			// Handle a deep copy situation
    			if ( typeof target === "boolean" ) {
    				deep = target;
    				target = arguments[1] || {};
    				// skip the boolean and the target
    				i = 2;
    			}
    		
    			// Handle case when target is a string or something (possible in deep copy)
    			if ( typeof target !== "object" && !isFunction(target) ) {
    				target = {};
    			}
    		
    			// if only one argument is passed, do nothing
    			if ( length === i ) {
    				return target;
    			}
    		
    			for ( ; i < length; i++ ) {
    				// Only deal with non-null/undefined values
    				if ( (options = arguments[ i ]) != null ) {
    					// Extend the base object
    					for ( name in options ) {
    						src = target[ name ];
    						copy = options[ name ];
    		
    						// Prevent never-ending loop
    						if ( target === copy ) {
    							continue;
    						}
    		
    						// Recurse if we're merging plain objects or arrays
    						if ( deep && copy && ( isPlainObject(copy) || (copyIsArray = isArray(copy)) ) ) {
    							if ( copyIsArray ) {
    								copyIsArray = false;
    								clone = src && isArray(src) ? src : [];
    		
    							} else {
    								clone = src && isPlainObject(src) ? src : {};
    							}
    		
    							// Never move original objects, clone them
    							target[ name ] = extend( deep, clone, copy );
    		
    						// Don't bring in undefined values
    						} else if ( copy !== undefined ) {
    							target[ name ] = copy;
    						}
    					}
    				}
    			}
    		
    			// Return the modified object
    			return target;
    		};
    	return exports;
    });
};

if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
}

;// lib/handlebars/base.js
var Handlebars = {};

Handlebars.VERSION = "1.0.beta.6";

Handlebars.helpers  = {};
Handlebars.partials = {};

Handlebars.registerHelper = function(name, fn, inverse) {
  if(inverse) { fn.not = inverse; }
  this.helpers[name] = fn;
};

Handlebars.registerPartial = function(name, str) {
  this.partials[name] = str;
};

Handlebars.registerHelper('helperMissing', function(arg) {
  if(arguments.length === 2) {
    return undefined;
  } else {
    throw new Error("Could not find property '" + arg + "'");
  }
});

var toString = Object.prototype.toString, functionType = "[object Function]";

Handlebars.registerHelper('blockHelperMissing', function(context, options) {
  var inverse = options.inverse || function() {}, fn = options.fn;


  var ret = "";
  var type = toString.call(context);

  if(type === functionType) { context = context.call(this); }

  if(context === true) {
    return fn(this);
  } else if(context === false || context == null) {
    return inverse(this);
  } else if(type === "[object Array]") {
    if(context.length > 0) {
      for(var i=0, j=context.length; i<j; i++) {
        ret = ret + fn(context[i]);
      }
    } else {
      ret = inverse(this);
    }
    return ret;
  } else {
    return fn(context);
  }
});

Handlebars.registerHelper('each', function(context, options) {
  var fn = options.fn, inverse = options.inverse;
  var ret = "";

  if(context && context.length > 0) {
    for(var i=0, j=context.length; i<j; i++) {
      ret = ret + fn(context[i]);
    }
  } else {
    ret = inverse(this);
  }
  return ret;
});

Handlebars.registerHelper('if', function(context, options) {
  var type = toString.call(context);
  if(type === functionType) { context = context.call(this); }

  if(!context || Handlebars.Utils.isEmpty(context)) {
    return options.inverse(this);
  } else {
    return options.fn(this);
  }
});

Handlebars.registerHelper('unless', function(context, options) {
  var fn = options.fn, inverse = options.inverse;
  options.fn = inverse;
  options.inverse = fn;

  return Handlebars.helpers['if'].call(this, context, options);
});

Handlebars.registerHelper('with', function(context, options) {
  return options.fn(context);
});

Handlebars.registerHelper('log', function(context) {
  Handlebars.log(context);
});
;
// lib/handlebars/compiler/parser.js
/* Jison generated parser */
var handlebars = (function(){

var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"root":3,"program":4,"EOF":5,"statements":6,"simpleInverse":7,"statement":8,"openInverse":9,"closeBlock":10,"openBlock":11,"mustache":12,"partial":13,"CONTENT":14,"COMMENT":15,"OPEN_BLOCK":16,"inMustache":17,"CLOSE":18,"OPEN_INVERSE":19,"OPEN_ENDBLOCK":20,"path":21,"OPEN":22,"OPEN_UNESCAPED":23,"OPEN_PARTIAL":24,"params":25,"hash":26,"param":27,"STRING":28,"INTEGER":29,"BOOLEAN":30,"hashSegments":31,"hashSegment":32,"ID":33,"EQUALS":34,"pathSegments":35,"SEP":36,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",14:"CONTENT",15:"COMMENT",16:"OPEN_BLOCK",18:"CLOSE",19:"OPEN_INVERSE",20:"OPEN_ENDBLOCK",22:"OPEN",23:"OPEN_UNESCAPED",24:"OPEN_PARTIAL",28:"STRING",29:"INTEGER",30:"BOOLEAN",33:"ID",34:"EQUALS",36:"SEP"},
productions_: [0,[3,2],[4,3],[4,1],[4,0],[6,1],[6,2],[8,3],[8,3],[8,1],[8,1],[8,1],[8,1],[11,3],[9,3],[10,3],[12,3],[12,3],[13,3],[13,4],[7,2],[17,3],[17,2],[17,2],[17,1],[25,2],[25,1],[27,1],[27,1],[27,1],[27,1],[26,1],[31,2],[31,1],[32,3],[32,3],[32,3],[32,3],[21,1],[35,3],[35,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: return $$[$0-1] 
break;
case 2: this.$ = new yy.ProgramNode($$[$0-2], $$[$0]) 
break;
case 3: this.$ = new yy.ProgramNode($$[$0]) 
break;
case 4: this.$ = new yy.ProgramNode([]) 
break;
case 5: this.$ = [$$[$0]] 
break;
case 6: $$[$0-1].push($$[$0]); this.$ = $$[$0-1] 
break;
case 7: this.$ = new yy.InverseNode($$[$0-2], $$[$0-1], $$[$0]) 
break;
case 8: this.$ = new yy.BlockNode($$[$0-2], $$[$0-1], $$[$0]) 
break;
case 9: this.$ = $$[$0] 
break;
case 10: this.$ = $$[$0] 
break;
case 11: this.$ = new yy.ContentNode($$[$0]) 
break;
case 12: this.$ = new yy.NativeNode($$[$0]) //new yy.CommentNode($$[$0]) //因为里面耦合太多，加不进正则，所以修改了这个comment注释
break;
case 13: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]) 
break;
case 14: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]) 
break;
case 15: this.$ = $$[$0-1] 
break;
case 16: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]) 
break;
case 17: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1], true) 
break;
case 18: this.$ = new yy.PartialNode($$[$0-1]) 
break;
case 19: this.$ = new yy.PartialNode($$[$0-2], $$[$0-1]) 
break;
case 20: 
break;
case 21: this.$ = [[$$[$0-2]].concat($$[$0-1]), $$[$0]] 
break;
case 22: this.$ = [[$$[$0-1]].concat($$[$0]), null] 
break;
case 23: this.$ = [[$$[$0-1]], $$[$0]] 
break;
case 24: this.$ = [[$$[$0]], null] 
break;
case 25: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 26: this.$ = [$$[$0]] 
break;
case 27: this.$ = $$[$0] 
break;
case 28: this.$ = new yy.StringNode($$[$0]) 
break;
case 29: this.$ = new yy.IntegerNode($$[$0]) 
break;
case 30: this.$ = new yy.BooleanNode($$[$0]) 
break;
case 31: this.$ = new yy.HashNode($$[$0]) 
break;
case 32: $$[$0-1].push($$[$0]); this.$ = $$[$0-1] 
break;
case 33: this.$ = [$$[$0]] 
break;
case 34: this.$ = [$$[$0-2], $$[$0]] 
break;
case 35: this.$ = [$$[$0-2], new yy.StringNode($$[$0])] 
break;
case 36: this.$ = [$$[$0-2], new yy.IntegerNode($$[$0])] 
break;
case 37: this.$ = [$$[$0-2], new yy.BooleanNode($$[$0])] 
break;
case 38: this.$ = new yy.IdNode($$[$0]) 
break;
case 39: $$[$0-2].push($$[$0]); this.$ = $$[$0-2]; 
break;
case 40: this.$ = [$$[$0]] 
break;
}
},
table: [{3:1,4:2,5:[2,4],6:3,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],22:[1,13],23:[1,14],24:[1,15]},{1:[3]},{5:[1,16]},
{5:[2,3],7:17,8:18,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,19],20:[2,3],22:[1,13],23:[1,14],24:[1,15]},
{5:[2,5],14:[2,5],15:[2,5],16:[2,5],19:[2,5],20:[2,5],22:[2,5],23:[2,5],24:[2,5]},{4:20,6:3,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,4],22:[1,13],23:[1,14],24:[1,15]},
{4:21,6:3,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,4],22:[1,13],23:[1,14],24:[1,15]},{5:[2,9],14:[2,9],15:[2,9],16:[2,9],19:[2,9],20:[2,9],22:[2,9],23:[2,9],24:[2,9]},
{5:[2,10],14:[2,10],15:[2,10],16:[2,10],19:[2,10],20:[2,10],22:[2,10],23:[2,10],24:[2,10]},{5:[2,11],14:[2,11],15:[2,11],16:[2,11],19:[2,11],20:[2,11],22:[2,11],23:[2,11],24:[2,11]},
{5:[2,12],14:[2,12],15:[2,12],16:[2,12],19:[2,12],20:[2,12],22:[2,12],23:[2,12],24:[2,12]},{17:22,21:23,33:[1,25],35:24},{17:26,21:23,33:[1,25],35:24},{17:27,21:23,33:[1,25],35:24},
{17:28,21:23,33:[1,25],35:24},{21:29,33:[1,25],35:24},{1:[2,1]},{6:30,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],22:[1,13],23:[1,14],24:[1,15]},
{5:[2,6],14:[2,6],15:[2,6],16:[2,6],19:[2,6],20:[2,6],22:[2,6],23:[2,6],24:[2,6]},{17:22,18:[1,31],21:23,33:[1,25],35:24},{10:32,20:[1,33]},{10:34,20:[1,33]},
{18:[1,35]},{18:[2,24],21:40,25:36,26:37,27:38,28:[1,41],29:[1,42],30:[1,43],31:39,32:44,33:[1,45],35:24},{18:[2,38],28:[2,38],29:[2,38],30:[2,38],33:[2,38],36:[1,46]},
{18:[2,40],28:[2,40],29:[2,40],30:[2,40],33:[2,40],36:[2,40]},{18:[1,47]},{18:[1,48]},{18:[1,49]},{18:[1,50],21:51,33:[1,25],35:24},
{5:[2,2],8:18,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,2],22:[1,13],23:[1,14],24:[1,15]},
{14:[2,20],15:[2,20],16:[2,20],19:[2,20],22:[2,20],23:[2,20],24:[2,20]},{5:[2,7],14:[2,7],15:[2,7],16:[2,7],19:[2,7],20:[2,7],22:[2,7],23:[2,7],24:[2,7]},
{21:52,33:[1,25],35:24},{5:[2,8],14:[2,8],15:[2,8],16:[2,8],19:[2,8],20:[2,8],22:[2,8],23:[2,8],24:[2,8]},{14:[2,14],15:[2,14],16:[2,14],19:[2,14],20:[2,14],22:[2,14],23:[2,14],24:[2,14]},
{18:[2,22],21:40,26:53,27:54,28:[1,41],29:[1,42],30:[1,43],31:39,32:44,33:[1,45],35:24},{18:[2,23]},{18:[2,26],28:[2,26],29:[2,26],30:[2,26],33:[2,26]},{18:[2,31],32:55,33:[1,56]},
{18:[2,27],28:[2,27],29:[2,27],30:[2,27],33:[2,27]},{18:[2,28],28:[2,28],29:[2,28],30:[2,28],33:[2,28]},{18:[2,29],28:[2,29],29:[2,29],30:[2,29],33:[2,29]},{18:[2,30],28:[2,30],29:[2,30],30:[2,30],33:[2,30]},
{18:[2,33],33:[2,33]},{18:[2,40],28:[2,40],29:[2,40],30:[2,40],33:[2,40],34:[1,57],36:[2,40]},{33:[1,58]},
{14:[2,13],15:[2,13],16:[2,13],19:[2,13],20:[2,13],22:[2,13],23:[2,13],24:[2,13]},{5:[2,16],14:[2,16],15:[2,16],16:[2,16],19:[2,16],20:[2,16],22:[2,16],23:[2,16],24:[2,16]},
{5:[2,17],14:[2,17],15:[2,17],16:[2,17],19:[2,17],20:[2,17],22:[2,17],23:[2,17],24:[2,17]},{5:[2,18],14:[2,18],15:[2,18],16:[2,18],19:[2,18],20:[2,18],22:[2,18],23:[2,18],24:[2,18]},{18:[1,59]},
{18:[1,60]},{18:[2,21]},{18:[2,25],28:[2,25],29:[2,25],30:[2,25],33:[2,25]},{18:[2,32],33:[2,32]},{34:[1,57]},{21:61,28:[1,62],29:[1,63],30:[1,64],33:[1,25],35:24},{18:[2,39],28:[2,39],29:[2,39],30:[2,39],33:[2,39],36:[2,39]},
{5:[2,19],14:[2,19],15:[2,19],16:[2,19],19:[2,19],20:[2,19],22:[2,19],23:[2,19],24:[2,19]},{5:[2,15],14:[2,15],15:[2,15],16:[2,15],19:[2,15],20:[2,15],22:[2,15],23:[2,15],24:[2,15]},
{18:[2,34],33:[2,34]},{18:[2,35],33:[2,35]},{18:[2,36],33:[2,36]},{18:[2,37],33:[2,37]}],
defaultActions: {16:[2,1],37:[2,23],53:[2,21]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == "undefined")
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    if (typeof this.yy.parseError === "function")
        this.parseError = this.yy.parseError;
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            if (!recovering) {
                expected = [];
                for (p in table[state])
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                var errStr = "";
                if (this.lexer.showPosition) {
                    errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + this.terminals_[symbol] + "'";
                } else {
                    errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1?"end of input":"'" + (this.terminals_[symbol] || symbol) + "'");
                }
                this.parseError(errStr, {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0)
                    recovering--;
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column};
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}
};/* Jison generated lexer */
var lexer = (function(){

var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parseError) {
            this.yy.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext+=ch;
        this.yyleng++;
        this.match+=ch;
        this.matched+=ch;
        var lines = ch.match(/\n/);
        if (lines) this.yylineno++;
        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        this._input = ch + this._input;
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            match = this._input.match(this.rules[rules[i]]);
            if (match) {
                lines = match[0].match(/\n.*/g);
                if (lines) this.yylineno += lines.length;
                this.yylloc = {first_line: this.yylloc.last_line,
                               last_line: this.yylineno+1,
                               first_column: this.yylloc.last_column,
                               last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match[0].length}
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
              
                token = this.performAction.call(this, this.yy, this, rules[i],this.conditionStack[this.conditionStack.length-1]);
                if (token) return token;
                else return;
            }
        }
        
        if (this._input === "") {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:
                                   if(yy_.yytext.slice(-1) !== "\\") this.begin("mu");
                                   if(yy_.yytext.slice(-1) === "\\") yy_.yytext = yy_.yytext.substr(0,yy_.yyleng-1), this.begin("emu");
                                   if(yy_.yytext) return 14;
                                 
break;
case 1: return 14; 
break;
case 2: this.popState(); return 14; 
break;
case 3: return 24; 
break;
case 4: return 16; 
break;
case 5: return 20; 
break;
case 6: return 19; 
break;
case 7: return 19; 
break;
case 8: return 23; 
break;
case 9: return 23; 
break;
case 10: yy_.yytext = yy_.yytext.substr(3,yy_.yyleng-5); this.popState(); return 15; 
break;
case 11: return 22; 
break;
case 12: return 34; 
break;
case 13: return 33; 
break;
case 14: return 33; 
break;
case 15: return 36; 
break;
case 16: /*ignore whitespace*/ 
break;
case 17: this.popState(); return 18; 
break;
case 18: this.popState(); return 18; 
break;
case 19: yy_.yytext = yy_.yytext.substr(1,yy_.yyleng-2).replace(/\\"/g,'"'); return 28; 
break;
case 20: return 30; 
break;
case 21: return 30; 
break;
case 22: return 29; 
break;
case 23: return 33; 
break;
case 24: yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 33; 
break;
case 25: return 'INVALID'; 
break;
case 26: return 5; 
break;
}
};
lexer.rules = [/^[^\x00]*?(?=(\{\{))/,/^[^\x00]+/,/^[^\x00]{2,}?(?=(\{\{))/,/^\{\{>/,/^\{\{#/,/^\{\{\//,/^\{\{\^/,/^\{\{\s*else\b/,/^\{\{\{/,
    /^\{\{&/,/^\{\{\$[\s\S]*?\}\}/,/^\{\{/,/^=/,/^\.(?=[} ])/,/^\.\./,/^[\/.]/,/^\s+/,/^\}\}\}/,/^\}\}/,/^"(\\["]|[^"])*"/,/^true(?=[}\s])/,
    /^false(?=[}\s])/,/^[0-9]+(?=[}\s])/,/^[a-zA-Z0-9_$-]+(?=[=}\s\/.])/,/^\[[^\]]*\]/,/^./,/^$/];
lexer.conditions = {"mu":{"rules":[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26],"inclusive":false},"emu":{"rules":[2],"inclusive":false},"INITIAL":{"rules":[0,1,26],"inclusive":true}};return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = handlebars;
exports.parse = function () { return handlebars.parse.apply(handlebars, arguments); }
exports.main = function commonjsMain(args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    if (typeof process !== 'undefined') {
        var source = require('fs').readFileSync(require('path').join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
};
;
// lib/handlebars/compiler/base.js
Handlebars.Parser = handlebars;

Handlebars.parse = function(string) {
  Handlebars.Parser.yy = Handlebars.AST;
  return Handlebars.Parser.parse(string);
};

Handlebars.print = function(ast) {
  return new Handlebars.PrintVisitor().accept(ast);
};

Handlebars.logger = {
  DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, level: 3,

  // override in the host environment
  log: function(level, str) {}
};

Handlebars.log = function(level, str) { Handlebars.logger.log(level, str); };
;
// lib/handlebars/compiler/ast.js
(function() {

  Handlebars.AST = {};

  Handlebars.AST.ProgramNode = function(statements, inverse) {
    this.type = "program";
    this.statements = statements;
    if(inverse) { this.inverse = new Handlebars.AST.ProgramNode(inverse); }
  };

  Handlebars.AST.MustacheNode = function(params, hash, unescaped) {
    this.type = "mustache";
    this.id = params[0];
    this.params = params.slice(1);
    this.hash = hash;
    this.escaped = !unescaped;
  };

  Handlebars.AST.PartialNode = function(id, context) {
    this.type    = "partial";

    // TODO: disallow complex IDs

    this.id      = id;
    this.context = context;
  };

  var verifyMatch = function(open, close) {
    if(open.original !== close.original) {
      throw new Handlebars.Exception(open.original + " doesn't match " + close.original);
    }
  };

  Handlebars.AST.BlockNode = function(mustache, program, close) {
    verifyMatch(mustache.id, close);
    this.type = "block";
    this.mustache = mustache;
    this.program  = program;
  };

  Handlebars.AST.InverseNode = function(mustache, program, close) {
    verifyMatch(mustache.id, close);
    this.type = "inverse";
    this.mustache = mustache;
    this.program  = program;
  };

  Handlebars.AST.ContentNode = function(string) {
    this.type = "content";
    this.string = string;
  };

  Handlebars.AST.HashNode = function(pairs) {
    this.type = "hash";
    this.pairs = pairs;
  };

  Handlebars.AST.IdNode = function(parts) {
    this.type = "ID";
    this.original = parts.join(".");

    var dig = [], depth = 0;

    for(var i=0,l=parts.length; i<l; i++) {
      var part = parts[i];

      if(part === "..") { depth++; }
      else if(part === "." || part === "this") { this.isScoped = true; }
      else { dig.push(part); }
    }

    this.parts    = dig;
    this.string   = dig.join('.');
    this.depth    = depth;
    this.isSimple = (dig.length === 1) && (depth === 0);
  };

  Handlebars.AST.StringNode = function(string) {
    this.type = "STRING";
    this.string = string;
  };

  Handlebars.AST.IntegerNode = function(integer) {
    this.type = "INTEGER";
    this.integer = integer;
  };

  Handlebars.AST.BooleanNode = function(bool) {
    this.type = "BOOLEAN";
    this.bool = bool;
  };

  Handlebars.AST.CommentNode = function(comment) {
    this.type = "comment";
    this.comment = comment;
  };
  
  Handlebars.AST.NativeNode = function(code) {
    this.type = "nativerun";
    this.code = code;
  };

})();;
// lib/handlebars/utils.js
Handlebars.Exception = function(message) {
  var tmp = Error.prototype.constructor.apply(this, arguments);

  for (var p in tmp) {
    if (tmp.hasOwnProperty(p)) { this[p] = tmp[p]; }
  }

  this.message = tmp.message;
};
Handlebars.Exception.prototype = new Error;

// Build out our basic SafeString type
Handlebars.SafeString = function(string) {
  this.string = string;
};
Handlebars.SafeString.prototype.toString = function() {
  return this.string.toString();
};

(function() {
  var escape = {
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "`": "&#x60;"
  };

  var badChars = /&(?!\w+;)|[<>"'`]/g;
  var possible = /[&<>"'`]/;

  var escapeChar = function(chr) {
    return escape[chr] || "&amp;";
  };

  Handlebars.Utils = {
    escapeExpression: function(string) {
      // don't escape SafeStrings, since they're already safe
      if (string instanceof Handlebars.SafeString) {
        return string.toString();
      } else if (string == null || string === false) {
        return "";
      }

      if(!possible.test(string)) { return string; }
      return string.replace(badChars, escapeChar);
    },

    isEmpty: function(value) {
      if (typeof value === "undefined") {
        return true;
      } else if (value === null) {
        return true;
      } else if (value === false) {
        return true;
      } else if(Object.prototype.toString.call(value) === "[object Array]" && value.length === 0) {
        return true;
      } else if(typeof value === 'object') {
          for(var name in value) {
              return false;
          }
          return true;
      } else {
        return false;
      }
    }
  };
})();;
// lib/handlebars/compiler/compiler.js
Handlebars.Compiler = function() {};
Handlebars.JavaScriptCompiler = function() {};

(function(Compiler, JavaScriptCompiler) {
  Compiler.OPCODE_MAP = {
    appendContent: 1,
    getContext: 2,
    lookupWithHelpers: 3,
    lookup: 4,
    append: 5,
    invokeMustache: 6,
    appendEscaped: 7,
    pushString: 8,
    truthyOrFallback: 9,
    functionOrFallback: 10,
    invokeProgram: 11,
    invokePartial: 12,
    push: 13,
    assignToHash: 15,
    pushStringParam: 16,
    nativerun: 17
  };

  Compiler.MULTI_PARAM_OPCODES = {
    appendContent: 1,
    getContext: 1,
    lookupWithHelpers: 2,
    lookup: 1,
    invokeMustache: 3,
    pushString: 1,
    truthyOrFallback: 1,
    functionOrFallback: 1,
    invokeProgram: 3,
    invokePartial: 1,
    push: 1,
    assignToHash: 1,
    pushStringParam: 1,
    nativerun: 1 //这里的参数意思用于opcode判断传入几个参数，这里只有一个参数，就是用于执行的code.
  };

  Compiler.DISASSEMBLE_MAP = {};

  for(var prop in Compiler.OPCODE_MAP) {
    var value = Compiler.OPCODE_MAP[prop];
    Compiler.DISASSEMBLE_MAP[value] = prop;
  }

  Compiler.multiParamSize = function(code) {
    return Compiler.MULTI_PARAM_OPCODES[Compiler.DISASSEMBLE_MAP[code]];
  };

  Compiler.prototype = {
    compiler: Compiler,

    disassemble: function() {
      var opcodes = this.opcodes, opcode, nextCode;
      var out = [], str, name, value;

      for(var i=0, l=opcodes.length; i<l; i++) {
        opcode = opcodes[i];

        if(opcode === 'DECLARE') {
          name = opcodes[++i];
          value = opcodes[++i];
          out.push("DECLARE " + name + " = " + value);
        } else {
          str = Compiler.DISASSEMBLE_MAP[opcode];

          var extraParams = Compiler.multiParamSize(opcode);
          var codes = [];

          for(var j=0; j<extraParams; j++) {
            nextCode = opcodes[++i];

            if(typeof nextCode === "string") {
              nextCode = "\"" + nextCode.replace("\n", "\\n") + "\"";
            }

            codes.push(nextCode);
          }

          str = str + " " + codes.join(" ");

          out.push(str);
        }
      }

      return out.join("\n");
    },

    guid: 0,

    compile: function(program, options) {
      this.children = [];
      this.depths = {list: []};
      this.options = options;

      // These changes will propagate to the other compiler components
      var knownHelpers = this.options.knownHelpers;
      this.options.knownHelpers = {
        'helperMissing': true,
        'blockHelperMissing': true,
        'each': true,
        'if': true,
        'unless': true,
        'with': true,
        'log': true
      };
      if (knownHelpers) {
        for (var name in knownHelpers) {
          this.options.knownHelpers[name] = knownHelpers[name];
        }
      }

      return this.program(program);
    },

    accept: function(node) {
      return this[node.type](node);
    },

    program: function(program) {
      var statements = program.statements, statement;
      this.opcodes = [];

      for(var i=0, l=statements.length; i<l; i++) {
        statement = statements[i];
        this[statement.type](statement);
      }
      this.isSimple = l === 1;

      this.depths.list = this.depths.list.sort(function(a, b) {
        return a - b;
      });

      return this;
    },

    compileProgram: function(program) {
      var result = new this.compiler().compile(program, this.options);
      var guid = this.guid++;

      this.usePartial = this.usePartial || result.usePartial;

      this.children[guid] = result;

      for(var i=0, l=result.depths.list.length; i<l; i++) {
        depth = result.depths.list[i];

        if(depth < 2) { continue; }
        else { this.addDepth(depth - 1); }
      }

      return guid;
    },

    block: function(block) {
      var mustache = block.mustache;
      var depth, child, inverse, inverseGuid;

      var params = this.setupStackForMustache(mustache);

      var programGuid = this.compileProgram(block.program);

      if(block.program.inverse) {
        inverseGuid = this.compileProgram(block.program.inverse);
        this.declare('inverse', inverseGuid);
      }

      this.opcode('invokeProgram', programGuid, params.length, !!mustache.hash);
      this.declare('inverse', null);
      this.opcode('append');
    },

    inverse: function(block) {
      var params = this.setupStackForMustache(block.mustache);

      var programGuid = this.compileProgram(block.program);

      this.declare('inverse', programGuid);

      this.opcode('invokeProgram', null, params.length, !!block.mustache.hash);
      this.declare('inverse', null);
      this.opcode('append');
    },

    hash: function(hash) {
      var pairs = hash.pairs, pair, val;

      this.opcode('push', '{}');

      for(var i=0, l=pairs.length; i<l; i++) {
        pair = pairs[i];
        val  = pair[1];

        this.accept(val);
        this.opcode('assignToHash', pair[0]);
      }
    },

    partial: function(partial) {
      var id = partial.id;
      this.usePartial = true;

      if(partial.context) {
        this.ID(partial.context);
      } else {
        this.opcode('push', 'depth0');
      }

      this.opcode('invokePartial', id.original);
      this.opcode('append');
    },

    content: function(content) {
      this.opcode('appendContent', content.string);
    },

    mustache: function(mustache) {
      var params = this.setupStackForMustache(mustache);

      this.opcode('invokeMustache', params.length, mustache.id.original, !!mustache.hash);

      if(mustache.escaped && !this.options.noEscape) {
        this.opcode('appendEscaped');
      } else {
        this.opcode('append');
      }
    },

    ID: function(id) {
      this.addDepth(id.depth);

      this.opcode('getContext', id.depth);

      this.opcode('lookupWithHelpers', id.parts[0] || null, id.isScoped || false);

      for(var i=1, l=id.parts.length; i<l; i++) {
        this.opcode('lookup', id.parts[i]);
      }
    },

    STRING: function(string) {
      this.opcode('pushString', string.string);
    },

    INTEGER: function(integer) {
      this.opcode('push', integer.integer);
    },

    BOOLEAN: function(bool) {
      this.opcode('push', bool.bool);
    },

    comment: function() {},
    
    nativerun: function( code ) {
        this.opcode('nativerun', code.code);
    },
    
    // HELPERS
    pushParams: function(params) {
      var i = params.length, param;

      while(i--) {
        param = params[i];

        if(this.options.stringParams) {
          if(param.depth) {
            this.addDepth(param.depth);
          }

          this.opcode('getContext', param.depth || 0);
          this.opcode('pushStringParam', param.string);
        } else {
          this[param.type](param);
        }
      }
    },

    opcode: function(name, val1, val2, val3) {
      this.opcodes.push(Compiler.OPCODE_MAP[name]);
      if(val1 !== undefined) { this.opcodes.push(val1); }
      if(val2 !== undefined) { this.opcodes.push(val2); }
      if(val3 !== undefined) { this.opcodes.push(val3); }
    },

    declare: function(name, value) {
      this.opcodes.push('DECLARE');
      this.opcodes.push(name);
      this.opcodes.push(value);
    },

    addDepth: function(depth) {
      if(depth === 0) { return; }

      if(!this.depths[depth]) {
        this.depths[depth] = true;
        this.depths.list.push(depth);
      }
    },

    setupStackForMustache: function(mustache) {
      var params = mustache.params;

      this.pushParams(params);

      if(mustache.hash) {
        this.hash(mustache.hash);
      }

      this.ID(mustache.id);

      return params;
    }
  };

  JavaScriptCompiler.prototype = {
    // PUBLIC API: You can override these methods in a subclass to provide
    // alternative compiled forms for name lookup and buffering semantics
    nameLookup: function(parent, name, type) {
			if (/^[0-9]+$/.test(name)) {
        return parent + "[" + name + "]";
      } else if (JavaScriptCompiler.isValidJavaScriptVariableName(name)) {
	    	return parent + "." + name;
			}
			else {
				return parent + "['" + name + "']";
      }
    },

    appendToBuffer: function(string) {
      if (this.environment.isSimple) {
        return "return " + string + ";";
      } else {
        return "buffer += " + string + ";";
      }
    },

    initializeBuffer: function() {
      return this.quotedString("");
    },

    namespace: "Handlebars",
    // END PUBLIC API

    compile: function(environment, options, context, asObject) {
      this.environment = environment;
      this.options = options || {};

      this.name = this.environment.name;
      this.isChild = !!context;
      this.context = context || {
        programs: [],
        aliases: { self: 'this' },
        registers: {list: []}
      };

      this.preamble();

      this.stackSlot = 0;
      this.stackVars = [];

      this.compileChildren(environment, options);

      var opcodes = environment.opcodes, opcode;

      this.i = 0;

      for(l=opcodes.length; this.i<l; this.i++) {
          
        opcode = this.nextOpcode(0);

        if(opcode[0] === 'DECLARE') {
          this.i = this.i + 2;
          this[opcode[1]] = opcode[2];
        } else {
          this.i = this.i + opcode[1].length;
          this[opcode[0]].apply(this, opcode[1]);
        }
      }

      return this.createFunctionContext(asObject);
    },

    nextOpcode: function(n) {
      var opcodes = this.environment.opcodes, opcode = opcodes[this.i + n], name, val;
      var extraParams, codes;

      if(opcode === 'DECLARE') {
        name = opcodes[this.i + 1];
        val  = opcodes[this.i + 2];
        return ['DECLARE', name, val];
      } else {
        name = Compiler.DISASSEMBLE_MAP[opcode];

        extraParams = Compiler.multiParamSize(opcode);
        codes = [];

        for(var j=0; j<extraParams; j++) {
          codes.push(opcodes[this.i + j + 1 + n]);
        }

        return [name, codes];
      }
    },

    eat: function(opcode) {
      this.i = this.i + opcode.length;
    },

    preamble: function() {
      var out = [];

      // this register will disambiguate helper lookup from finding a function in
      // a context. This is necessary for mustache compatibility, which requires
      // that context functions in blocks are evaluated by blockHelperMissing, and
      // then proceed as if the resulting value was provided to blockHelperMissing.
      this.useRegister('foundHelper');

      if (!this.isChild) {
        var namespace = this.namespace;
        var copies = "helpers = helpers || " + namespace + ".helpers;";
        if(this.environment.usePartial) { copies = copies + " partials = partials || " + namespace + ".partials;"; }
        out.push(copies);
      } else {
        out.push('');
      }

      if (!this.environment.isSimple) {
        out.push(", buffer = " + this.initializeBuffer());
      } else {
        out.push("");
      }

      // track the last context pushed into place to allow skipping the
      // getContext opcode when it would be a noop
      this.lastContext = 0;
      this.source = out;
    },

    createFunctionContext: function(asObject) {
      var locals = this.stackVars;
      if (!this.isChild) {
        locals = locals.concat(this.context.registers.list);
      }

      if(locals.length > 0) {
        this.source[1] = this.source[1] + ", " + locals.join(", ");
      }

      // Generate minimizer alias mappings
      if (!this.isChild) {
        var aliases = []
        for (var alias in this.context.aliases) {
          this.source[1] = this.source[1] + ', ' + alias + '=' + this.context.aliases[alias];
        }
      }

      if (this.source[1]) {
        this.source[1] = "var " + this.source[1].substring(2) + ";";
      }

      // Merge children
      if (!this.isChild) {
        this.source[1] += '\n' + this.context.programs.join('\n') + '\n';
      }

      if (!this.environment.isSimple) {
        this.source.push("return buffer;");
      }

      var params = this.isChild ? ["depth0", "data"] : ["Handlebars", "depth0", "helpers", "partials", "data"];

      for(var i=0, l=this.environment.depths.list.length; i<l; i++) {
        params.push("depth" + this.environment.depths.list[i]);
      }

      if (asObject) {
        params.push(this.source.join("\n  "));

        return Function.apply(this, params);
      } else {
        var functionSource = 'function ' + (this.name || '') + '(' + params.join(',') + ') {\n  ' + this.source.join("\n  ") + '}';
        Handlebars.log(Handlebars.logger.DEBUG, functionSource + "\n\n");
        return functionSource;
      }
    },

    appendContent: function(content) {
      this.source.push(this.appendToBuffer(this.quotedString(content)));
    },

    append: function() {
      var local = this.popStack();
      this.source.push("if(" + local + " || " + local + " === 0) { " + this.appendToBuffer(local) + " }");
      if (this.environment.isSimple) {
        this.source.push("else { " + this.appendToBuffer("''") + " }");
      }
    },

    appendEscaped: function() {
      var opcode = this.nextOpcode(1), extra = "";
      this.context.aliases.escapeExpression = 'this.escapeExpression';

      if(opcode[0] === 'appendContent') {
        extra = " + " + this.quotedString(opcode[1][0]);
        this.eat(opcode);
      }

      this.source.push(this.appendToBuffer("escapeExpression(" + this.popStack() + ")" + extra));
    },

    getContext: function(depth) {
      if(this.lastContext !== depth) {
        this.lastContext = depth;
      }
    },

    lookupWithHelpers: function(name, isScoped) {
      if(name) {
        var topStack = this.nextStack();

        this.usingKnownHelper = false;

        var toPush;
        if (!isScoped && this.options.knownHelpers[name]) {
          toPush = topStack + " = " + this.nameLookup('helpers', name, 'helper');
          this.usingKnownHelper = true;
        } else if (isScoped || this.options.knownHelpersOnly) {
          toPush = topStack + " = " + this.nameLookup('depth' + this.lastContext, name, 'context');
        } else {
          this.register('foundHelper', this.nameLookup('helpers', name, 'helper'));
          toPush = topStack + " = foundHelper || " + this.nameLookup('depth' + this.lastContext, name, 'context');
        }

        toPush += ';';
        this.source.push(toPush);
      } else {
        this.pushStack('depth' + this.lastContext);
      }
    },

    lookup: function(name) {
      var topStack = this.topStack();
      this.source.push(topStack + " = (" + topStack + " === null || " + topStack + " === undefined || " + topStack + " === false ? " +
 				topStack + " : " + this.nameLookup(topStack, name, 'context') + ");");
    },
    nativerun: function( code ){
        //var abc = 'depth' + this.lastContext//暂时没发现问题，不知道这个depth什么时候用，如果有depth问题的话，就用注释掉的这个表达式
        if (code.match(/this/)) {
            code = code.replace(/this/g,"depth0");
        }
        this.source.push("if(!Handlebars.Utils.isEmpty(depth0)){with(depth0){"+this.appendToBuffer(code)+"}}");//尝试直接执行
    },
    
    pushStringParam: function(string) {
      this.pushStack('depth' + this.lastContext);
      this.pushString(string);
    },

    pushString: function(string) {
      this.pushStack(this.quotedString(string));
    },

    push: function(name) {
      this.pushStack(name);
    },

    invokeMustache: function(paramSize, original, hasHash) {
      this.populateParams(paramSize, this.quotedString(original), "{}", null, hasHash, function(nextStack, helperMissingString, id) {
        if (!this.usingKnownHelper) {
          this.context.aliases.helperMissing = 'helpers.helperMissing';
          this.context.aliases.undef = 'void 0';
          this.source.push("else if(" + id + "=== undef) { " + nextStack + " = helperMissing.call(" + helperMissingString + "); }");
          if (nextStack !== id) {
            this.source.push("else { " + nextStack + " = " + id + "; }");
          }
        }
      });
    },

    invokeProgram: function(guid, paramSize, hasHash) {
      var inverse = this.programExpression(this.inverse);
      var mainProgram = this.programExpression(guid);

      this.populateParams(paramSize, null, mainProgram, inverse, hasHash, function(nextStack, helperMissingString, id) {
        if (!this.usingKnownHelper) {
          this.context.aliases.blockHelperMissing = 'helpers.blockHelperMissing';
          this.source.push("else { " + nextStack + " = blockHelperMissing.call(" + helperMissingString + "); }");
        }
      });
    },

    populateParams: function(paramSize, helperId, program, inverse, hasHash, fn) {
      var needsRegister = hasHash || this.options.stringParams || inverse || this.options.data;
      var id = this.popStack(), nextStack;
      var params = [], param, stringParam, stringOptions;

      if (needsRegister) {
        this.register('tmp1', program);
        stringOptions = 'tmp1';
      } else {
        stringOptions = '{ hash: {} }';
      }

      if (needsRegister) {
        var hash = (hasHash ? this.popStack() : '{}');
        this.source.push('tmp1.hash = ' + hash + ';');
      }

      if(this.options.stringParams) {
        this.source.push('tmp1.contexts = [];');
      }

      for(var i=0; i<paramSize; i++) {
        param = this.popStack();
        params.push(param);

        if(this.options.stringParams) {
          this.source.push('tmp1.contexts.push(' + this.popStack() + ');');
        }
      }

      if(inverse) {
        this.source.push('tmp1.fn = tmp1;');
        this.source.push('tmp1.inverse = ' + inverse + ';');
      }

      if(this.options.data) {
        this.source.push('tmp1.data = data;');
      }

      params.push(stringOptions);

      this.populateCall(params, id, helperId || id, fn, program !== '{}');
    },

    populateCall: function(params, id, helperId, fn, program) {
      var paramString = ["depth0"].concat(params).join(", ");
      var helperMissingString = ["depth0"].concat(helperId).concat(params).join(", ");

      var nextStack = this.nextStack();

      if (this.usingKnownHelper) {
        this.source.push(nextStack + " = " + id + ".call(" + paramString + ");");
      } else {
        this.context.aliases.functionType = '"function"';
        var condition = program ? "foundHelper && " : ""
        this.source.push("if(" + condition + "typeof " + id + " === functionType) { " + nextStack + " = " + id + ".call(" + paramString + "); }");
      }
      fn.call(this, nextStack, helperMissingString, id);
      this.usingKnownHelper = false;
    },

    invokePartial: function(context) {
      params = [this.nameLookup('partials', context, 'partial'), "'" + context + "'", this.popStack(), "helpers", "partials"];

      if (this.options.data) {
        params.push("data");
      }

      this.pushStack("self.invokePartial(" + params.join(", ") + ");");
    },

    assignToHash: function(key) {
      var value = this.popStack();
      var hash = this.topStack();

      this.source.push(hash + "['" + key + "'] = " + value + ";");
    },

    // HELPERS

    compiler: JavaScriptCompiler,

    compileChildren: function(environment, options) {
      var children = environment.children, child, compiler;

      for(var i=0, l=children.length; i<l; i++) {
        child = children[i];
        compiler = new this.compiler();

        this.context.programs.push('');     // Placeholder to prevent name conflicts for nested children
        var index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context);
      }
    },

    programExpression: function(guid) {
      if(guid == null) { return "self.noop"; }

      var child = this.environment.children[guid],
          depths = child.depths.list;
      var programParams = [child.index, child.name, "data"];

      for(var i=0, l = depths.length; i<l; i++) {
        depth = depths[i];

        if(depth === 1) { programParams.push("depth0"); }
        else { programParams.push("depth" + (depth - 1)); }
      }

      if(depths.length === 0) {
        return "self.program(" + programParams.join(", ") + ")";
      } else {
        programParams.shift();
        return "self.programWithDepth(" + programParams.join(", ") + ")";
      }
    },

    register: function(name, val) {
      this.useRegister(name);
      this.source.push(name + " = " + val + ";");
    },

    useRegister: function(name) {
      if(!this.context.registers[name]) {
        this.context.registers[name] = true;
        this.context.registers.list.push(name);
      }
    },

    pushStack: function(item) {
      this.source.push(this.nextStack() + " = " + item + ";");
      return "stack" + this.stackSlot;
    },

    nextStack: function() {
      this.stackSlot++;
      if(this.stackSlot > this.stackVars.length) { this.stackVars.push("stack" + this.stackSlot); }
      return "stack" + this.stackSlot;
    },

    popStack: function() {
      return "stack" + this.stackSlot--;
    },

    topStack: function() {
      return "stack" + this.stackSlot;
    },

    quotedString: function(str) {
      return '"' + str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r') + '"';
    }
  };

  var reservedWords = (
    "break else new var" +
    " case finally return void" +
    " catch for switch while" +
    " continue function this with" +
    " default if throw" +
    " delete in try" +
    " do instanceof typeof" +
    " abstract enum int short" +
    " boolean export interface static" +
    " byte extends long super" +
    " char final native synchronized" +
    " class float package throws" +
    " const goto private transient" +
    " debugger implements protected volatile" +
    " double import public let yield"
  ).split(" ");

  var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

  for(var i=0, l=reservedWords.length; i<l; i++) {
    compilerWords[reservedWords[i]] = true;
  }

	JavaScriptCompiler.isValidJavaScriptVariableName = function(name) {
		if(!JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]+$/.test(name)) {
			return true;
		}
		return false;
	}

})(Handlebars.Compiler, Handlebars.JavaScriptCompiler);

Handlebars.precompile = function(string, options) {
  options = options || {};

  var ast = Handlebars.parse(string);
  var environment = new Handlebars.Compiler().compile(ast, options);
  return new Handlebars.JavaScriptCompiler().compile(environment, options);
};

Handlebars.compile = function(string, options) {
  options = options || {};

  var compiled;
  function compile() {
    var ast = Handlebars.parse(string);
    var environment = new Handlebars.Compiler().compile(ast, options);
    var templateSpec = new Handlebars.JavaScriptCompiler().compile(environment, options, undefined, true);
    return Handlebars.template(templateSpec);
  }

  // Template is only compiled on first use and cached after that point.
  return function(context, options) {
    if (!compiled) {
      compiled = compile();
    }
    return compiled.call(this, context, options);
  };
};
;
// lib/handlebars/runtime.js
Handlebars.VM = {
  template: function(templateSpec) {
    // Just add water
    var container = {
      escapeExpression: Handlebars.Utils.escapeExpression,
      invokePartial: Handlebars.VM.invokePartial,
      programs: [],
      program: function(i, fn, data) {
        var programWrapper = this.programs[i];
        if(data) {
          return Handlebars.VM.program(fn, data);
        } else if(programWrapper) {
          return programWrapper;
        } else {
          programWrapper = this.programs[i] = Handlebars.VM.program(fn);
          return programWrapper;
        }
      },
      programWithDepth: Handlebars.VM.programWithDepth,
      noop: Handlebars.VM.noop
    };

    return function(context, options) {
      options = options || {};
      return templateSpec.call(container, Handlebars, context, options.helpers, options.partials, options.data);
    };
  },

  programWithDepth: function(fn, data, $depth) {
    var args = Array.prototype.slice.call(arguments, 2);

    return function(context, options) {
      options = options || {};

      return fn.apply(this, [context, options.data || data].concat(args));
    };
  },
  program: function(fn, data) {
    return function(context, options) {
      options = options || {};

      return fn(context, options.data || data);
    };
  },
  noop: function() { return ""; },
  invokePartial: function(partial, name, context, helpers, partials, data) {
    options = { helpers: helpers, partials: partials, data: data };

    if(partial === undefined) {
      throw new Handlebars.Exception("The partial " + name + " could not be found");
    } else if(partial instanceof Function) {
      return partial(context, options);
    } else if (!Handlebars.compile) {
      throw new Handlebars.Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    } else {
      partials[name] = Handlebars.compile(partial);
      return partials[name](context, options);
    }
  }
};

Handlebars.template = Handlebars.VM.template;


if(typeof module !='undefined' && module.exports){
	module.exports = Handlebars;
}else{
    // window.Handlebars = runnable(sumeru);
};var runnable = function(Handlebars){
	//foreach method
	Handlebars.registerHelper("foreach", function(context, options) {
	    var buffer = "", key;
	    if(context) {
	        if ( (context instanceof Array) ) {//数组的遍历
	            for(var i=0, j=context.length; i<j; i++) {
	                //如果是object类型，则，内容支持this，在解析的时候this会被直接被替换到到depth0上,
	                //因为this本身的方法不能依赖于使用object.value调用的方法，所以直接把key附到this上
	                // if ( 0 ) {
	                    // context[i].key = i;
	                    // buffer = buffer + options.fn(context[i]);
	                // } else {
	                    //解释一下，内容是字符串类型的，则不支持this，所以和object遍历一样，给它value选项
	                buffer += options.fn({
	                    key : i,
	                    index : i,
	                    value : context[i]
	                });
	                // }
	            }
	        }else if (typeof context ==='object'){//object的遍历
	            for (key in context) {
	                if (context.hasOwnProperty(key)) {
	                    buffer += options.fn({
	                        key : key,
	                        value : context[key]
	                    });
	                }
	            }
	        }else {
	            //did nothing。此方法只支持数组和对象，其他不支持
	        }
	    } else {
	        buffer = options.inverse(this);
	    }
	    return buffer;
	});
	
	
	/*
	 * 
	 * compare 
	 * 
	 * usage:
	 *
	 *{{#compare A ">" B}}  // (defaults to == if operator omitted)
	 *   when A < B
	 *{{else}}
	 *   when A >= B    
	 *{{/compare}}
	 * 
	 */    
	
	Handlebars.registerHelper('compare', function (lvalue, operator, rvalue, options) {
	
	    var operators, result;
	    
	    if (arguments.length < 3) {
	        throw new Error("Handlerbars Helper 'compare' needs 2 parameters");
	    }
	    
	    if (options === undefined) {
	        options = rvalue;
	        rvalue = operator;
	        operator = "===";
	    }
	    
	    operators = {
	        '==': function (l, r) { return l == r; },
	        '===': function (l, r) { return l === r; },
	        '!=': function (l, r) { return l != r; },
	        '!==': function (l, r) { return l !== r; },
	        '<': function (l, r) { return l < r; },
	        '>': function (l, r) { return l > r; },
	        '<=': function (l, r) { return l <= r; },
	        '>=': function (l, r) { return l >= r; },
	        'typeof': function (l, r) { return typeof l == r; }
	    };
	    
	    if (!operators[operator]) {
	        throw new Error("Handlerbars Helper 'compare' doesn't know the operator " + operator);
	    }
	    
	    result = operators[operator](lvalue, rvalue);
	    
	    if (result) {
	        return options.fn(this);
	    } else {
	        return options.inverse(this);
	    }
	
	});
	
}

if(typeof module !='undefined' && module.exports){
	module.exports = runnable;
}else{
    runnable(Handlebars);
};Library.net = sumeru.Library.create(function(exports){	
	exports.get = function(options){
		var xhr = new window.XMLHttpRequest();
		
		xhr.onreadystatechange = function(){
		if (xhr.readyState == 4) {
			var result, error = false;
				if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status == 0 && location.protocol == 'file:')) {
				  result = xhr.responseText;
				  options.callback(result);
				} else {
				  options.callback(xhr.responseText);	
				}
			}
		};
		
		xhr.open('GET', options.url, true);
		xhr.send(options.query || '');
	};
	
	
	return exports;
});;/* SockJS client, version 0.3.1, http://sockjs.org, MIT License

Copyright (c) 2011-2012 VMware, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// JSON2 by Douglas Crockford (minified).
//var JSON;JSON||(JSON={}),function(){function str(a,b){var c,d,e,f,g=gap,h,i=b[a];i&&typeof i=="object"&&typeof i.toJSON=="function"&&(i=i.toJSON(a)),typeof rep=="function"&&(i=rep.call(b,a,i));switch(typeof i){case"string":return quote(i);case"number":return isFinite(i)?String(i):"null";case"boolean":case"null":return String(i);case"object":if(!i)return"null";gap+=indent,h=[];if(Object.prototype.toString.apply(i)==="[object Array]"){f=i.length;for(c=0;c<f;c+=1)h[c]=str(c,i)||"null";e=h.length===0?"[]":gap?"[\n"+gap+h.join(",\n"+gap)+"\n"+g+"]":"["+h.join(",")+"]",gap=g;return e}if(rep&&typeof rep=="object"){f=rep.length;for(c=0;c<f;c+=1)typeof rep[c]=="string"&&(d=rep[c],e=str(d,i),e&&h.push(quote(d)+(gap?": ":":")+e))}else for(d in i)Object.prototype.hasOwnProperty.call(i,d)&&(e=str(d,i),e&&h.push(quote(d)+(gap?": ":":")+e));e=h.length===0?"{}":gap?"{\n"+gap+h.join(",\n"+gap)+"\n"+g+"}":"{"+h.join(",")+"}",gap=g;return e}}function quote(a){escapable.lastIndex=0;return escapable.test(a)?'"'+a.replace(escapable,function(a){var b=meta[a];return typeof b=="string"?b:"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+a+'"'}function f(a){return a<10?"0"+a:a}"use strict",typeof Date.prototype.toJSON!="function"&&(Date.prototype.toJSON=function(a){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z":null},String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(a){return this.valueOf()});var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","\t":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;typeof JSON.stringify!="function"&&(JSON.stringify=function(a,b,c){var d;gap="",indent="";if(typeof c=="number")for(d=0;d<c;d+=1)indent+=" ";else typeof c=="string"&&(indent=c);rep=b;if(!b||typeof b=="function"||typeof b=="object"&&typeof b.length=="number")return str("",{"":a});throw new Error("JSON.stringify")}),typeof JSON.parse!="function"&&(JSON.parse=function(text,reviver){function walk(a,b){var c,d,e=a[b];if(e&&typeof e=="object")for(c in e)Object.prototype.hasOwnProperty.call(e,c)&&(d=walk(e,c),d!==undefined?e[c]=d:delete e[c]);return reviver.call(a,b,e)}var j;text=String(text),cx.lastIndex=0,cx.test(text)&&(text=text.replace(cx,function(a){return"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)}));if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,""))){j=eval("("+text+")");return typeof reviver=="function"?walk({"":j},""):j}throw new SyntaxError("JSON.parse")})}()

SockJS=function(){var a=document,b=window,c={},d=function(){};d.prototype.addEventListener=function(a,b){this._listeners||(this._listeners={}),a in this._listeners||(this._listeners[a]=[]);var d=this._listeners[a];c.arrIndexOf(d,b)===-1&&d.push(b);return},d.prototype.removeEventListener=function(a,b){if(!(this._listeners&&a in this._listeners))return;var d=this._listeners[a],e=c.arrIndexOf(d,b);if(e!==-1){d.length>1?this._listeners[a]=d.slice(0,e).concat(d.slice(e+1)):delete this._listeners[a];return}return},d.prototype.dispatchEvent=function(a){var b=a.type,c=Array.prototype.slice.call(arguments,0);this["on"+b]&&this["on"+b].apply(this,c);if(this._listeners&&b in this._listeners)for(var d=0;d<this._listeners[b].length;d++)this._listeners[b][d].apply(this,c)};var e=function(a,b){this.type=a;if(typeof b!="undefined")for(var c in b){if(!b.hasOwnProperty(c))continue;this[c]=b[c]}};e.prototype.toString=function(){var a=[];for(var b in this){if(!this.hasOwnProperty(b))continue;var c=this[b];typeof c=="function"&&(c="[function]"),a.push(b+"="+c)}return"SimpleEvent("+a.join(", ")+")"};var f=function(a){this.events=a||[]};f.prototype.emit=function(a){var b=this,d=Array.prototype.slice.call(arguments,1);!b.nuked&&b["on"+a]&&b["on"+a].apply(b,d),c.arrIndexOf(b.events,a)===-1&&c.log("Event "+JSON.stringify(a)+" not listed "+JSON.stringify(b.events)+" in "+b)},f.prototype.nuke=function(a){var b=this;b.nuked=!0;for(var c=0;c<b.events.length;c++)delete b[b.events[c]]};var g="abcdefghijklmnopqrstuvwxyz0123456789_";c.random_string=function(a,b){b=b||g.length;var c,d=[];for(c=0;c<a;c++)d.push(g.substr(Math.floor(Math.random()*b),1));return d.join("")},c.random_number=function(a){return Math.floor(Math.random()*a)},c.random_number_string=function(a){var b=(""+(a-1)).length,d=Array(b+1).join("0");return(d+c.random_number(a)).slice(-b)},c.getOrigin=function(a){a+="/";var b=a.split("/").slice(0,3);return b.join("/")},c.isSameOriginUrl=function(a,c){return c||(c=b.location.href),a.split("/").slice(0,3).join("/")===c.split("/").slice(0,3).join("/")},c.getParentDomain=function(a){if(/^[0-9.]*$/.test(a))return a;if(/^\[/.test(a))return a;if(!/[.]/.test(a))return a;var b=a.split(".").slice(1);return b.join(".")},c.objectExtend=function(a,b){for(var c in b)b.hasOwnProperty(c)&&(a[c]=b[c]);return a};var h="_jp";c.polluteGlobalNamespace=function(){h in b||(b[h]={})},c.closeFrame=function(a,b){return"c"+JSON.stringify([a,b])},c.userSetCode=function(a){return a===1e3||a>=3e3&&a<=4999},c.countRTO=function(a){var b;return a>100?b=3*a:b=a+200,b},c.log=function(){b.console&&console.log&&console.log.apply&&console.log.apply(console,arguments)},c.bind=function(a,b){return a.bind?a.bind(b):function(){return a.apply(b,arguments)}},c.flatUrl=function(a){return a.indexOf("?")===-1&&a.indexOf("#")===-1},c.amendUrl=function(b){var d=a.location;if(!b)throw new Error("Wrong url for SockJS");if(!c.flatUrl(b))throw new Error("Only basic urls are supported in SockJS");return b.indexOf("//")===0&&(b=d.protocol+b),b.indexOf("/")===0&&(b=d.protocol+"//"+d.host+b),b=b.replace(/[/]+$/,""),b},c.arrIndexOf=function(a,b){for(var c=0;c<a.length;c++)if(a[c]===b)return c;return-1},c.arrSkip=function(a,b){var d=c.arrIndexOf(a,b);if(d===-1)return a.slice();var e=a.slice(0,d);return e.concat(a.slice(d+1))},c.isArray=Array.isArray||function(a){return{}.toString.call(a).indexOf("Array")>=0},c.delay=function(a,b){return typeof a=="function"&&(b=a,a=0),setTimeout(b,a)};var i=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,j={"\0":"\\u0000","\x01":"\\u0001","\x02":"\\u0002","\x03":"\\u0003","\x04":"\\u0004","\x05":"\\u0005","\x06":"\\u0006","\x07":"\\u0007","\b":"\\b","\t":"\\t","\n":"\\n","\x0b":"\\u000b","\f":"\\f","\r":"\\r","\x0e":"\\u000e","\x0f":"\\u000f","\x10":"\\u0010","\x11":"\\u0011","\x12":"\\u0012","\x13":"\\u0013","\x14":"\\u0014","\x15":"\\u0015","\x16":"\\u0016","\x17":"\\u0017","\x18":"\\u0018","\x19":"\\u0019","\x1a":"\\u001a","\x1b":"\\u001b","\x1c":"\\u001c","\x1d":"\\u001d","\x1e":"\\u001e","\x1f":"\\u001f",'"':'\\"',"\\":"\\\\","\x7f":"\\u007f","\x80":"\\u0080","\x81":"\\u0081","\x82":"\\u0082","\x83":"\\u0083","\x84":"\\u0084","\x85":"\\u0085","\x86":"\\u0086","\x87":"\\u0087","\x88":"\\u0088","\x89":"\\u0089","\x8a":"\\u008a","\x8b":"\\u008b","\x8c":"\\u008c","\x8d":"\\u008d","\x8e":"\\u008e","\x8f":"\\u008f","\x90":"\\u0090","\x91":"\\u0091","\x92":"\\u0092","\x93":"\\u0093","\x94":"\\u0094","\x95":"\\u0095","\x96":"\\u0096","\x97":"\\u0097","\x98":"\\u0098","\x99":"\\u0099","\x9a":"\\u009a","\x9b":"\\u009b","\x9c":"\\u009c","\x9d":"\\u009d","\x9e":"\\u009e","\x9f":"\\u009f","\xad":"\\u00ad","\u0600":"\\u0600","\u0601":"\\u0601","\u0602":"\\u0602","\u0603":"\\u0603","\u0604":"\\u0604","\u070f":"\\u070f","\u17b4":"\\u17b4","\u17b5":"\\u17b5","\u200c":"\\u200c","\u200d":"\\u200d","\u200e":"\\u200e","\u200f":"\\u200f","\u2028":"\\u2028","\u2029":"\\u2029","\u202a":"\\u202a","\u202b":"\\u202b","\u202c":"\\u202c","\u202d":"\\u202d","\u202e":"\\u202e","\u202f":"\\u202f","\u2060":"\\u2060","\u2061":"\\u2061","\u2062":"\\u2062","\u2063":"\\u2063","\u2064":"\\u2064","\u2065":"\\u2065","\u2066":"\\u2066","\u2067":"\\u2067","\u2068":"\\u2068","\u2069":"\\u2069","\u206a":"\\u206a","\u206b":"\\u206b","\u206c":"\\u206c","\u206d":"\\u206d","\u206e":"\\u206e","\u206f":"\\u206f","\ufeff":"\\ufeff","\ufff0":"\\ufff0","\ufff1":"\\ufff1","\ufff2":"\\ufff2","\ufff3":"\\ufff3","\ufff4":"\\ufff4","\ufff5":"\\ufff5","\ufff6":"\\ufff6","\ufff7":"\\ufff7","\ufff8":"\\ufff8","\ufff9":"\\ufff9","\ufffa":"\\ufffa","\ufffb":"\\ufffb","\ufffc":"\\ufffc","\ufffd":"\\ufffd","\ufffe":"\\ufffe","\uffff":"\\uffff"},k=/[\x00-\x1f\ud800-\udfff\ufffe\uffff\u0300-\u0333\u033d-\u0346\u034a-\u034c\u0350-\u0352\u0357-\u0358\u035c-\u0362\u0374\u037e\u0387\u0591-\u05af\u05c4\u0610-\u0617\u0653-\u0654\u0657-\u065b\u065d-\u065e\u06df-\u06e2\u06eb-\u06ec\u0730\u0732-\u0733\u0735-\u0736\u073a\u073d\u073f-\u0741\u0743\u0745\u0747\u07eb-\u07f1\u0951\u0958-\u095f\u09dc-\u09dd\u09df\u0a33\u0a36\u0a59-\u0a5b\u0a5e\u0b5c-\u0b5d\u0e38-\u0e39\u0f43\u0f4d\u0f52\u0f57\u0f5c\u0f69\u0f72-\u0f76\u0f78\u0f80-\u0f83\u0f93\u0f9d\u0fa2\u0fa7\u0fac\u0fb9\u1939-\u193a\u1a17\u1b6b\u1cda-\u1cdb\u1dc0-\u1dcf\u1dfc\u1dfe\u1f71\u1f73\u1f75\u1f77\u1f79\u1f7b\u1f7d\u1fbb\u1fbe\u1fc9\u1fcb\u1fd3\u1fdb\u1fe3\u1feb\u1fee-\u1fef\u1ff9\u1ffb\u1ffd\u2000-\u2001\u20d0-\u20d1\u20d4-\u20d7\u20e7-\u20e9\u2126\u212a-\u212b\u2329-\u232a\u2adc\u302b-\u302c\uaab2-\uaab3\uf900-\ufa0d\ufa10\ufa12\ufa15-\ufa1e\ufa20\ufa22\ufa25-\ufa26\ufa2a-\ufa2d\ufa30-\ufa6d\ufa70-\ufad9\ufb1d\ufb1f\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufb4e\ufff0-\uffff]/g,l,m=JSON&&JSON.stringify||function(a){return i.lastIndex=0,i.test(a)&&(a=a.replace(i,function(a){return j[a]})),'"'+a+'"'},n=function(a){var b,c={},d=[];for(b=0;b<65536;b++)d.push(String.fromCharCode(b));return a.lastIndex=0,d.join("").replace(a,function(a){return c[a]="\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4),""}),a.lastIndex=0,c};c.quote=function(a){var b=m(a);return k.lastIndex=0,k.test(b)?(l||(l=n(k)),b.replace(k,function(a){return l[a]})):b};var o=["websocket","xdr-streaming","xhr-streaming","iframe-eventsource","iframe-htmlfile","xdr-polling","xhr-polling","iframe-xhr-polling","jsonp-polling"];c.probeProtocols=function(){var a={};for(var b=0;b<o.length;b++){var c=o[b];a[c]=y[c]&&y[c].enabled()}return a},c.detectProtocols=function(a,b,c){var d={},e=[];b||(b=o);for(var f=0;f<b.length;f++){var g=b[f];d[g]=a[g]}var h=function(a){var b=a.shift();d[b]?e.push(b):a.length>0&&h(a)};return c.websocket!==!1&&h(["websocket"]),d["xhr-streaming"]&&!c.null_origin?e.push("xhr-streaming"):d["xdr-streaming"]&&!c.cookie_needed&&!c.null_origin?e.push("xdr-streaming"):h(["iframe-eventsource","iframe-htmlfile"]),d["xhr-polling"]&&!c.null_origin?e.push("xhr-polling"):d["xdr-polling"]&&!c.cookie_needed&&!c.null_origin?e.push("xdr-polling"):h(["iframe-xhr-polling","jsonp-polling"]),e};var p="_sockjs_global";c.createHook=function(){var a="a"+c.random_string(8);if(!(p in b)){var d={};b[p]=function(a){return a in d||(d[a]={id:a,del:function(){delete d[a]}}),d[a]}}return b[p](a)},c.attachMessage=function(a){c.attachEvent("message",a)},c.attachEvent=function(c,d){typeof b.addEventListener!="undefined"?b.addEventListener(c,d,!1):(a.attachEvent("on"+c,d),b.attachEvent("on"+c,d))},c.detachMessage=function(a){c.detachEvent("message",a)},c.detachEvent=function(c,d){typeof b.addEventListener!="undefined"?b.removeEventListener(c,d,!1):(a.detachEvent("on"+c,d),b.detachEvent("on"+c,d))};var q={},r=!1,s=function(){for(var a in q)q[a](),delete q[a]},t=function(){if(r)return;r=!0,s()};c.attachEvent("beforeunload",t),c.attachEvent("unload",t),c.unload_add=function(a){var b=c.random_string(8);return q[b]=a,r&&c.delay(s),b},c.unload_del=function(a){a in q&&delete q[a]},c.createIframe=function(b,d){var e=a.createElement("iframe"),f,g,h=function(){clearTimeout(f);try{e.onload=null}catch(a){}e.onerror=null},i=function(){e&&(h(),setTimeout(function(){e&&e.parentNode.removeChild(e),e=null},0),c.unload_del(g))},j=function(a){e&&(i(),d(a))},k=function(a,b){try{e&&e.contentWindow&&e.contentWindow.postMessage(a,b)}catch(c){}};return e.src=b,e.style.display="none",e.style.position="absolute",e.onerror=function(){j("onerror")},e.onload=function(){clearTimeout(f),f=setTimeout(function(){j("onload timeout")},2e3)},a.body.appendChild(e),f=setTimeout(function(){j("timeout")},15e3),g=c.unload_add(i),{post:k,cleanup:i,loaded:h}},c.createHtmlfile=function(a,d){var e=new ActiveXObject("htmlfile"),f,g,i,j=function(){clearTimeout(f)},k=function(){e&&(j(),c.unload_del(g),i.parentNode.removeChild(i),i=e=null,CollectGarbage())},l=function(a){e&&(k(),d(a))},m=function(a,b){try{i&&i.contentWindow&&i.contentWindow.postMessage(a,b)}catch(c){}};e.open(),e.write('<html><script>document.domain="'+document.domain+'";'+"</s"+"cript></html>"),e.close(),e.parentWindow[h]=b[h];var n=e.createElement("div");return e.body.appendChild(n),i=e.createElement("iframe"),n.appendChild(i),i.src=a,f=setTimeout(function(){l("timeout")},15e3),g=c.unload_add(k),{post:m,cleanup:k,loaded:j}};var u=function(){};u.prototype=new f(["chunk","finish"]),u.prototype._start=function(a,d,e,f){var g=this;try{g.xhr=new XMLHttpRequest}catch(h){}if(!g.xhr)try{g.xhr=new b.ActiveXObject("Microsoft.XMLHTTP")}catch(h){}if(b.ActiveXObject||b.XDomainRequest)d+=(d.indexOf("?")===-1?"?":"&")+"t="+ +(new Date);g.unload_ref=c.unload_add(function(){g._cleanup(!0)});try{g.xhr.open(a,d,!0)}catch(i){g.emit("finish",0,""),g._cleanup();return}if(!f||!f.no_credentials)g.xhr.withCredentials="true";if(f&&f.headers)for(var j in f.headers)g.xhr.setRequestHeader(j,f.headers[j]);g.xhr.onreadystatechange=function(){if(g.xhr){var a=g.xhr;switch(a.readyState){case 3:try{var b=a.status,c=a.responseText}catch(a){}c&&c.length>0&&g.emit("chunk",b,c);break;case 4:g.emit("finish",a.status,a.responseText),g._cleanup(!1)}}},g.xhr.send(e)},u.prototype._cleanup=function(a){var b=this;if(!b.xhr)return;c.unload_del(b.unload_ref),b.xhr.onreadystatechange=function(){};if(a)try{b.xhr.abort()}catch(d){}b.unload_ref=b.xhr=null},u.prototype.close=function(){var a=this;a.nuke(),a._cleanup(!0)};var v=c.XHRCorsObject=function(){var a=this,b=arguments;c.delay(function(){a._start.apply(a,b)})};v.prototype=new u;var w=c.XHRLocalObject=function(a,b,d){var e=this;c.delay(function(){e._start(a,b,d,{no_credentials:!0})})};w.prototype=new u;var x=c.XDRObject=function(a,b,d){var e=this;c.delay(function(){e._start(a,b,d)})};x.prototype=new f(["chunk","finish"]),x.prototype._start=function(a,b,d){var e=this,f=new XDomainRequest;b+=(b.indexOf("?")===-1?"?":"&")+"t="+ +(new Date);var g=f.ontimeout=f.onerror=function(){e.emit("finish",0,""),e._cleanup(!1)};f.onprogress=function(){e.emit("chunk",200,f.responseText)},f.onload=function(){e.emit("finish",200,f.responseText),e._cleanup(!1)},e.xdr=f,e.unload_ref=c.unload_add(function(){e._cleanup(!0)});try{e.xdr.open(a,b),e.xdr.send(d)}catch(h){g()}},x.prototype._cleanup=function(a){var b=this;if(!b.xdr)return;c.unload_del(b.unload_ref),b.xdr.ontimeout=b.xdr.onerror=b.xdr.onprogress=b.xdr.onload=null;if(a)try{b.xdr.abort()}catch(d){}b.unload_ref=b.xdr=null},x.prototype.close=function(){var a=this;a.nuke(),a._cleanup(!0)},c.isXHRCorsCapable=function(){return b.XMLHttpRequest&&"withCredentials"in new XMLHttpRequest?1:b.XDomainRequest&&a.domain?2:L.enabled()?3:4};var y=function(a,b,d){var e=this,f;e._options={devel:!1,debug:!1,protocols_whitelist:[],info:undefined,rtt:undefined},d&&c.objectExtend(e._options,d),e._base_url=c.amendUrl(a),e._server=e._options.server||c.random_number_string(1e3),e._options.protocols_whitelist&&e._options.protocols_whitelist.length?f=e._options.protocols_whitelist:(typeof b=="string"&&b.length>0?f=[b]:c.isArray(b)?f=b:f=null,f&&e._debug('Deprecated API: Use "protocols_whitelist" option instead of supplying protocol list as a second parameter to SockJS constructor.')),e._protocols=[],e.protocol=null,e.readyState=y.CONNECTING,e._ir=S(e._base_url),e._ir.onfinish=function(a,b){e._ir=null,a?(e._options.info&&(a=c.objectExtend(a,e._options.info)),e._options.rtt&&(b=e._options.rtt),e._applyInfo(a,b,f),e._didClose()):e._didClose(1002,"Can't connect to server",!0)}};y.prototype=new d,y.version="0.3.1",y.CONNECTING=0,y.OPEN=1,y.CLOSING=2,y.CLOSED=3,y.prototype._debug=function(){this._options.debug&&c.log.apply(c,arguments)},y.prototype._dispatchOpen=function(){var a=this;a.readyState===y.CONNECTING?(a._transport_tref&&(clearTimeout(a._transport_tref),a._transport_tref=null),a.readyState=y.OPEN,a.dispatchEvent(new e("open"))):a._didClose(1006,"Server lost session")},y.prototype._dispatchMessage=function(a){var b=this;if(b.readyState!==y.OPEN)return;b.dispatchEvent(new e("message",{data:a}))},y.prototype._dispatchHeartbeat=function(a){var b=this;if(b.readyState!==y.OPEN)return;b.dispatchEvent(new e("heartbeat",{}))},y.prototype._didClose=function(a,b,d){var f=this;if(f.readyState!==y.CONNECTING&&f.readyState!==y.OPEN&&f.readyState!==y.CLOSING)throw new Error("INVALID_STATE_ERR");f._ir&&(f._ir.nuke(),f._ir=null),f._transport&&(f._transport.doCleanup(),f._transport=null);var g=new e("close",{code:a,reason:b,wasClean:c.userSetCode(a)});if(!c.userSetCode(a)&&f.readyState===y.CONNECTING&&!d){if(f._try_next_protocol(g))return;g=new e("close",{code:2e3,reason:"All transports failed",wasClean:!1,last_event:g})}f.readyState=y.CLOSED,c.delay(function(){f.dispatchEvent(g)})},y.prototype._didMessage=function(a){var b=this,c=a.slice(0,1);switch(c){case"o":b._dispatchOpen();break;case"a":var d=JSON.parse(a.slice(1)||"[]");for(var e=0;e<d.length;e++)b._dispatchMessage(d[e]);break;case"m":var d=JSON.parse(a.slice(1)||"null");b._dispatchMessage(d);break;case"c":var d=JSON.parse(a.slice(1)||"[]");b._didClose(d[0],d[1]);break;case"h":b._dispatchHeartbeat()}},y.prototype._try_next_protocol=function(b){var d=this;d.protocol&&(d._debug("Closed transport:",d.protocol,""+b),d.protocol=null),d._transport_tref&&(clearTimeout(d._transport_tref),d._transport_tref=null);for(;;){var e=d.protocol=d._protocols.shift();if(!e)return!1;if(y[e]&&y[e].need_body===!0&&(!a.body||typeof a.readyState!="undefined"&&a.readyState!=="complete"))return d._protocols.unshift(e),d.protocol="waiting-for-load",c.attachEvent("load",function(){d._try_next_protocol()}),!0;if(!!y[e]&&!!y[e].enabled(d._options)){var f=y[e].roundTrips||1,g=(d._options.rto||0)*f||5e3;d._transport_tref=c.delay(g,function(){d.readyState===y.CONNECTING&&d._didClose(2007,"Transport timeouted")});var h=c.random_string(8),i=d._base_url+"/"+d._server+"/"+h;return d._debug("Opening transport:",e," url:"+i," RTO:"+d._options.rto),d._transport=new y[e](d,i,d._base_url),!0}d._debug("Skipping transport:",e)}},y.prototype.close=function(a,b){var d=this;if(a&&!c.userSetCode(a))throw new Error("INVALID_ACCESS_ERR");return d.readyState!==y.CONNECTING&&d.readyState!==y.OPEN?!1:(d.readyState=y.CLOSING,d._didClose(a||1e3,b||"Normal closure"),!0)},y.prototype.send=function(a){var b=this;if(b.readyState===y.CONNECTING)throw new Error("INVALID_STATE_ERR");return b.readyState===y.OPEN&&b._transport.doSend(c.quote(""+a)),!0},y.prototype._applyInfo=function(b,d,e){var f=this;f._options.info=b,f._options.rtt=d,f._options.rto=c.countRTO(d),f._options.info.null_origin=!a.domain;var g=c.probeProtocols();f._protocols=c.detectProtocols(g,e,b)};var z=y.websocket=function(a,d){var e=this,f=d+"/websocket";f.slice(0,5)==="https"?f="wss"+f.slice(5):f="ws"+f.slice(4),e.ri=a,e.url=f;var g=b.WebSocket||b.MozWebSocket;e.ws=new g(e.url),e.ws.onmessage=function(a){e.ri._didMessage(a.data)},e.unload_ref=c.unload_add(function(){e.ws.close()}),e.ws.onclose=function(){e.ri._didMessage(c.closeFrame(1006,"WebSocket connection broken"))}};z.prototype.doSend=function(a){this.ws.send("["+a+"]")},z.prototype.doCleanup=function(){var a=this,b=a.ws;b&&(b.onmessage=b.onclose=null,b.close(),c.unload_del(a.unload_ref),a.unload_ref=a.ri=a.ws=null)},z.enabled=function(){return!!b.WebSocket||!!b.MozWebSocket},z.roundTrips=2;var A=function(){};A.prototype.send_constructor=function(a){var b=this;b.send_buffer=[],b.sender=a},A.prototype.doSend=function(a){var b=this;b.send_buffer.push(a),b.send_stop||b.send_schedule()},A.prototype.send_schedule_wait=function(){var a=this,b;a.send_stop=function(){a.send_stop=null,clearTimeout(b)},b=c.delay(25,function(){a.send_stop=null,a.send_schedule()})},A.prototype.send_schedule=function(){var a=this;if(a.send_buffer.length>0){var b="["+a.send_buffer.join(",")+"]";a.send_stop=a.sender(a.trans_url,b,function(){a.send_stop=null,a.send_schedule_wait()}),a.send_buffer=[]}},A.prototype.send_destructor=function(){var a=this;a._send_stop&&a._send_stop(),a._send_stop=null};var B=function(b,d,e){var f=this;if(!("_send_form"in f)){var g=f._send_form=a.createElement("form"),h=f._send_area=a.createElement("textarea");h.name="d",g.style.display="none",g.style.position="absolute",g.method="POST",g.enctype="application/x-www-form-urlencoded",g.acceptCharset="UTF-8",g.appendChild(h),a.body.appendChild(g)}var g=f._send_form,h=f._send_area,i="a"+c.random_string(8);g.target=i,g.action=b+"/jsonp_send?i="+i;var j;try{j=a.createElement('<iframe name="'+i+'">')}catch(k){j=a.createElement("iframe"),j.name=i}j.id=i,g.appendChild(j),j.style.display="none";try{h.value=d}catch(l){c.log("Your browser is seriously broken. Go home! "+l.message)}g.submit();var m=function(a){if(!j.onerror)return;j.onreadystatechange=j.onerror=j.onload=null,c.delay(500,function(){j.parentNode.removeChild(j),j=null}),h.value="",e()};return j.onerror=j.onload=m,j.onreadystatechange=function(a){j.readyState=="complete"&&m()},m},C=function(a){return function(b,c,d){var e=new a("POST",b+"/xhr_send",c);return e.onfinish=function(a,b){d(a)},function(a){d(0,a)}}},D=function(b,d){var e,f=a.createElement("script"),g,h=function(a){g&&(g.parentNode.removeChild(g),g=null),f&&(clearTimeout(e),f.parentNode.removeChild(f),f.onreadystatechange=f.onerror=f.onload=f.onclick=null,f=null,d(a),d=null)},i=!1,j=null;f.id="a"+c.random_string(8),f.src=b,f.type="text/javascript",f.charset="UTF-8",f.onerror=function(a){j||(j=setTimeout(function(){i||h(c.closeFrame(1006,"JSONP script loaded abnormally (onerror)"))},1e3))},f.onload=function(a){h(c.closeFrame(1006,"JSONP script loaded abnormally (onload)"))},f.onreadystatechange=function(a){if(/loaded|closed/.test(f.readyState)){if(f&&f.htmlFor&&f.onclick){i=!0;try{f.onclick()}catch(b){}}f&&h(c.closeFrame(1006,"JSONP script loaded abnormally (onreadystatechange)"))}};if(typeof f.async=="undefined"&&a.attachEvent)if(!/opera/i.test(navigator.userAgent)){try{f.htmlFor=f.id,f.event="onclick"}catch(k){}f.async=!0}else g=a.createElement("script"),g.text="try{var a = document.getElementById('"+f.id+"'); if(a)a.onerror();}catch(x){};",f.async=g.async=!1;typeof f.async!="undefined"&&(f.async=!0),e=setTimeout(function(){h(c.closeFrame(1006,"JSONP script loaded abnormally (timeout)"))},35e3);var l=a.getElementsByTagName("head")[0];return l.insertBefore(f,l.firstChild),g&&l.insertBefore(g,l.firstChild),h},E=y["jsonp-polling"]=function(a,b){c.polluteGlobalNamespace();var d=this;d.ri=a,d.trans_url=b,d.send_constructor(B),d._schedule_recv()};E.prototype=new A,E.prototype._schedule_recv=function(){var a=this,b=function(b){a._recv_stop=null,b&&(a._is_closing||a.ri._didMessage(b)),a._is_closing||a._schedule_recv()};a._recv_stop=F(a.trans_url+"/jsonp",D,b)},E.enabled=function(){return!0},E.need_body=!0,E.prototype.doCleanup=function(){var a=this;a._is_closing=!0,a._recv_stop&&a._recv_stop(),a.ri=a._recv_stop=null,a.send_destructor()};var F=function(a,d,e){var f="a"+c.random_string(6),g=a+"?c="+escape(h+"."+f),i=function(a){delete b[h][f],e(a)},j=d(g,i);b[h][f]=j;var k=function(){b[h][f]&&b[h][f](c.closeFrame(1e3,"JSONP user aborted read"))};return k},G=function(){};G.prototype=new A,G.prototype.run=function(a,b,c,d,e){var f=this;f.ri=a,f.trans_url=b,f.send_constructor(C(e)),f.poll=new $(a,d,b+c,e)},G.prototype.doCleanup=function(){var a=this;a.poll&&(a.poll.abort(),a.poll=null)};var H=y["xhr-streaming"]=function(a,b){this.run(a,b,"/xhr_streaming",bd,c.XHRCorsObject)};H.prototype=new G,H.enabled=function(){return b.XMLHttpRequest&&"withCredentials"in new XMLHttpRequest&&!/opera/i.test(navigator.userAgent)},H.roundTrips=2,H.need_body=!0;var I=y["xdr-streaming"]=function(a,b){this.run(a,b,"/xhr_streaming",bd,c.XDRObject)};I.prototype=new G,I.enabled=function(){return!!b.XDomainRequest},I.roundTrips=2;var J=y["xhr-polling"]=function(a,b){this.run(a,b,"/xhr",bd,c.XHRCorsObject)};J.prototype=new G,J.enabled=H.enabled,J.roundTrips=2;var K=y["xdr-polling"]=function(a,b){this.run(a,b,"/xhr",bd,c.XDRObject)};K.prototype=new G,K.enabled=I.enabled,K.roundTrips=2;var L=function(){};L.prototype.i_constructor=function(a,b,d){var e=this;e.ri=a,e.origin=c.getOrigin(d),e.base_url=d,e.trans_url=b;var f=d+"/iframe.html";e.ri._options.devel&&(f+="?t="+ +(new Date)),e.window_id=c.random_string(8),f+="#"+e.window_id,e.iframeObj=c.createIframe(f,function(a){e.ri._didClose(1006,"Unable to load an iframe ("+a+")")}),e.onmessage_cb=c.bind(e.onmessage,e),c.attachMessage(e.onmessage_cb)},L.prototype.doCleanup=function(){var a=this;if(a.iframeObj){c.detachMessage(a.onmessage_cb);try{a.iframeObj.iframe.contentWindow&&a.postMessage("c")}catch(b){}a.iframeObj.cleanup(),a.iframeObj=null,a.onmessage_cb=a.iframeObj=null}},L.prototype.onmessage=function(a){var b=this;if(a.origin!==b.origin)return;var c=a.data.slice(0,8),d=a.data.slice(8,9),e=a.data.slice(9);if(c!==b.window_id)return;switch(d){case"s":b.iframeObj.loaded(),b.postMessage("s",JSON.stringify([y.version,b.protocol,b.trans_url,b.base_url]));break;case"t":b.ri._didMessage(e)}},L.prototype.postMessage=function(a,b){var c=this;c.iframeObj.post(c.window_id+a+(b||""),c.origin)},L.prototype.doSend=function(a){this.postMessage("m",a)},L.enabled=function(){var a=navigator&&navigator.userAgent&&navigator.userAgent.indexOf("Konqueror")!==-1;return(typeof b.postMessage=="function"||typeof b.postMessage=="object")&&!a};var M,N=function(a,d){parent!==b?parent.postMessage(M+a+(d||""),"*"):c.log("Can't postMessage, no parent window.",a,d)},O=function(){};O.prototype._didClose=function(a,b){N("t",c.closeFrame(a,b))},O.prototype._didMessage=function(a){N("t",a)},O.prototype._doSend=function(a){this._transport.doSend(a)},O.prototype._doCleanup=function(){this._transport.doCleanup()},c.parent_origin=undefined,y.bootstrap_iframe=function(){var d;M=a.location.hash.slice(1);var e=function(a){if(a.source!==parent)return;typeof c.parent_origin=="undefined"&&(c.parent_origin=a.origin);if(a.origin!==c.parent_origin)return;var e=a.data.slice(0,8),f=a.data.slice(8,9),g=a.data.slice(9);if(e!==M)return;switch(f){case"s":var h=JSON.parse(g),i=h[0],j=h[1],k=h[2],l=h[3];i!==y.version&&c.log('Incompatibile SockJS! Main site uses: "'+i+'", the iframe:'+' "'+y.version+'".');if(!c.flatUrl(k)||!c.flatUrl(l)){c.log("Only basic urls are supported in SockJS");return}if(!c.isSameOriginUrl(k)||!c.isSameOriginUrl(l)){c.log("Can't connect to different domain from within an iframe. ("+JSON.stringify([b.location.href,k,l])+")");return}d=new O,d._transport=new O[j](d,k,l);break;case"m":d._doSend(g);break;case"c":d&&d._doCleanup(),d=null}};c.attachMessage(e),N("s")};var P=function(a,b){var d=this;c.delay(function(){d.doXhr(a,b)})};P.prototype=new f(["finish"]),P.prototype.doXhr=function(a,b){var d=this,e=(new Date).getTime(),f=new b("GET",a+"/info"),g=c.delay(8e3,function(){f.ontimeout()});f.onfinish=function(a,b){clearTimeout(g),g=null;if(a===200){var c=(new Date).getTime()-e,f=JSON.parse(b);typeof f!="object"&&(f={}),d.emit("finish",f,c)}else d.emit("finish")},f.ontimeout=function(){f.close(),d.emit("finish")}};var Q=function(b){var d=this,e=function(){var a=new L;a.protocol="w-iframe-info-receiver";var c=function(b){if(typeof b=="string"&&b.substr(0,1)==="m"){var c=JSON.parse(b.substr(1)),e=c[0],f=c[1];d.emit("finish",e,f)}else d.emit("finish");a.doCleanup(),a=null},e={_options:{},_didClose:c,_didMessage:c};a.i_constructor(e,b,b)};a.body?e():c.attachEvent("load",e)};Q.prototype=new f(["finish"]);var R=function(){var a=this;c.delay(function(){a.emit("finish",{},2e3)})};R.prototype=new f(["finish"]);var S=function(a){if(c.isSameOriginUrl(a))return new P(a,c.XHRLocalObject);switch(c.isXHRCorsCapable()){case 1:return new P(a,c.XHRCorsObject);case 2:return new P(a,c.XDRObject);case 3:return new Q(a);default:return new R}},T=O["w-iframe-info-receiver"]=function(a,b,d){var e=new P(d,c.XHRLocalObject);e.onfinish=function(b,c){a._didMessage("m"+JSON.stringify([b,c])),a._didClose()}};T.prototype.doCleanup=function(){};var U=y["iframe-eventsource"]=function(){var a=this;a.protocol="w-iframe-eventsource",a.i_constructor.apply(a,arguments)};U.prototype=new L,U.enabled=function(){return"EventSource"in b&&L.enabled()},U.need_body=!0,U.roundTrips=3;var V=O["w-iframe-eventsource"]=function(a,b){this.run(a,b,"/eventsource",_,c.XHRLocalObject)};V.prototype=new G;var W=y["iframe-xhr-polling"]=function(){var a=this;a.protocol="w-iframe-xhr-polling",a.i_constructor.apply(a,arguments)};W.prototype=new L,W.enabled=function(){return b.XMLHttpRequest&&L.enabled()},W.need_body=!0,W.roundTrips=3;var X=O["w-iframe-xhr-polling"]=function(a,b){this.run(a,b,"/xhr",bd,c.XHRLocalObject)};X.prototype=new G;var Y=y["iframe-htmlfile"]=function(){var a=this;a.protocol="w-iframe-htmlfile",a.i_constructor.apply(a,arguments)};Y.prototype=new L,Y.enabled=function(){return L.enabled()},Y.need_body=!0,Y.roundTrips=3;var Z=O["w-iframe-htmlfile"]=function(a,b){this.run(a,b,"/htmlfile",bc,c.XHRLocalObject)};Z.prototype=new G;var $=function(a,b,c,d){var e=this;e.ri=a,e.Receiver=b,e.recv_url=c,e.AjaxObject=d,e._scheduleRecv()};$.prototype._scheduleRecv=function(){var a=this,b=a.poll=new a.Receiver(a.recv_url,a.AjaxObject),c=0;b.onmessage=function(b){c+=1,a.ri._didMessage(b.data)},b.onclose=function(c){a.poll=b=b.onmessage=b.onclose=null,a.poll_is_closing||(c.reason==="permanent"?a.ri._didClose(1006,"Polling error ("+c.reason+")"):a._scheduleRecv())}},$.prototype.abort=function(){var a=this;a.poll_is_closing=!0,a.poll&&a.poll.abort()};var _=function(a){var b=this,d=new EventSource(a);d.onmessage=function(a){b.dispatchEvent(new e("message",{data:unescape(a.data)}))},b.es_close=d.onerror=function(a,f){var g=f?"user":d.readyState!==2?"network":"permanent";b.es_close=d.onmessage=d.onerror=null,d.close(),d=null,c.delay(200,function(){b.dispatchEvent(new e("close",{reason:g}))})}};_.prototype=new d,_.prototype.abort=function(){var a=this;a.es_close&&a.es_close({},!0)};var ba,bb=function(){if(ba===undefined)if("ActiveXObject"in b)try{ba=!!(new ActiveXObject("htmlfile"))}catch(a){}else ba=!1;return ba},bc=function(a){var d=this;c.polluteGlobalNamespace(),d.id="a"+c.random_string(6,26),a+=(a.indexOf("?")===-1?"?":"&")+"c="+escape(h+"."+d.id);var f=bb()?c.createHtmlfile:c.createIframe,g;b[h][d.id]={start:function(){g.loaded()},message:function(a){d.dispatchEvent(new e("message",{data:a}))},stop:function(){d.iframe_close({},"network")}},d.iframe_close=function(a,c){g.cleanup(),d.iframe_close=g=null,delete b[h][d.id],d.dispatchEvent(new e("close",{reason:c}))},g=f(a,function(a){d.iframe_close({},"permanent")})};bc.prototype=new d,bc.prototype.abort=function(){var a=this;a.iframe_close&&a.iframe_close({},"user")};var bd=function(a,b){var c=this,d=0;c.xo=new b("POST",a,null),c.xo.onchunk=function(a,b){if(a!==200)return;for(;;){var f=b.slice(d),g=f.indexOf("\n");if(g===-1)break;d+=g+1;var h=f.slice(0,g);c.dispatchEvent(new e("message",{data:h}))}},c.xo.onfinish=function(a,b){c.xo.onchunk(a,b),c.xo=null;var d=a===200?"network":"permanent";c.dispatchEvent(new e("close",{reason:d}))}};return bd.prototype=new d,bd.prototype.abort=function(){var a=this;a.xo&&(a.xo.close(),a.dispatchEvent(new e("close",{reason:"user"})),a.xo=null)},y.getUtils=function(){return c},y.getIframeTransport=function(){return L},y}(),"_sockjs_onload"in window&&setTimeout(_sockjs_onload,1),typeof define=="function"&&define.amd&&define("sockjs",[],function(){return SockJS});Library.string = sumeru.Library.create(function(exports){	
	exports.trim = function(str){
		return str.replace(/^\s|\s$/g, '');
	};
	
	
	exports.escapeRegex = function(str){
	    return (str+'').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
	}
	
	return exports;
});;Library.screenUtils = sumeru.Library.create(function(exports){
		
	var fullScreen = exports.fullScreen = function(){
	    function hideAddressBar(){
            var docElement = document.documentElement,
                innerHeight = window.innerHeight,
                outterHeight = window.outerHeight,
                devicePixelRatio = window.devicePixelRatio;
            
            docElement.style.height = '100%';
                
            if(scrollHeight<outterHeight){
               docElement.style.height=(outterHeight/window.devicePixelRatio) +'px';
            }

            setTimeout(function(){window.scrollTo(0,1)},0);
        }
        window.addEventListener("load",function(){hideAddressBar();});
        window.addEventListener("orientationchange",function(){
            //这句话保证在android设备上rotate后不会出现错误的zoom
            document.documentElement.style.height = 'auto';
            hideAddressBar();
            setTimeout(function(){
                hideAddressBar();
            }, 800)
        });
	}
	
	return exports;
});
;;
if(typeof module != 'undefined' && module.exports){//server运行
	Library.cookie = sumeru.Library.create(function(exports){	
	    var EMPTY = '';
		var cookieStack = {};
		var addCookie = exports.addCookie = function(name, value, expireHours){
			cookieStack[name] = value;
		};
		
		var getCookie = exports.getCookie = function(name){
			return cookieStack[name] || EMPTY;
		};
		
		var deleteCookie = exports.deleteCookie = function(name){
		    delete cookieStack[name];
		};
		
		return exports;
	});
}else{//client
	
	Library.cookie = sumeru.Library.create(function(exports){	
	    var EMPTY = '';
		
		/**
		 *@para expireHours， cookie过期的时间， 为小时。
		 */
		var addCookie = exports.addCookie = function(name, value, expireHours){
			var cookieString = name + "=" + escape(value);
			//判断是否设置过期时间
			if(expireHours > 0){
				var date = new Date();
				date.setTime(date.getTime() + expireHours * 3600 * 1000);
				cookieString = cookieString + "; expires=" + date.toGMTString();
			}
			document.cookie = cookieString;
		};
		
		var getCookie = exports.getCookie = function(name){
			var strcookie = document.cookie;
			var arrcookie = strcookie.split("; ");
			for(var i = 0; i < arrcookie.length; i++){
				var arr = arrcookie[i].split("=");
				if(arr[0] == name) return arr[1];
			}
			return EMPTY;
		};
		
		var deleteCookie = exports.deleteCookie = function(name){
		    addCookie(name, EMPTY);
		};
		
		return exports;
	});
}
;var touch = Library.touch = sumeru.Library.create(function(exports){
    //工具类接口
    var isPlainObject = function(obj) {
        if (!obj || type(obj) !== "object" || obj.nodeType || obj === obj.window ) {
            return false;
        }
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        // Not own constructor property must be Object
        if (obj.constructor && !hasOwnProperty.call(obj, "constructor") &&
            !hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf")) {
            return false;
        }

        var key;
        for (key in obj) {}

        return key === undefined || hasOwnProperty.call(obj, key);
    };
    
    var typeMap = {};
    "Boolean Number String Function Array Date RegExp Object".split(' ').forEach(function(item){
        typeMap["[object " + item + "]"] = item.toLowerCase();
    });
    
    var type = function(obj){
            return obj == null ?
                'null' :
                typeMap[ Object.prototype.toString.call(obj)] || "object";
        },
        
        isObject = function(obj){
            return type(obj) === 'object';
        },
        
        isArray  = function(obj){
            return type(obj) === 'array';
        },
        isFunction = function(obj){
            return type(obj) === 'function';
        },
        isString = function(obj){
            return type(obj) === 'string';
        },
        isBoolean = function(obj){
            return type(obj) === 'bollean';
        },
        isNumber = function(obj){
            return type(obj) === 'number';
        },
        isDate = function(obj){
            return type(obj) === 'date';
        },
        isRegExp = function(obj){
            return type(obj) === 'regexp';
        },
        
        extend = function(){
            var options, name, src, copy, copyIsArray, clone,
                target = arguments[0] || {},
                i = 1,
                length = arguments.length,
                deep = false;
        
            //Handle a deep copy situation
            if(typeof target === "boolean") {
                deep = target;
                target = arguments[1] || {};
                // skip the boolean and the target
                i = 2;
            }
        
            //Handle case when target is a string or something (possible in deep copy)
            if ( typeof target !== "object" && !isFunction(target) ) {
                target = {};
            }
        
            // if only one argument is passed, do nothing
            if (length === i) {
                return target;
            }
        
            for ( ; i < length; i++) {
                // Only deal with non-null/undefined values
                if ((options = arguments[i]) != null) {
                    // Extend the base object
                    for (name in options) {
                        src = target[name];
                        copy = options[name];
        
                        // Prevent never-ending loop
                        if (target === copy) {
                            continue;
                        }
        
                        // Recurse if we're merging plain objects or arrays
                        if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)) ) ) {
                            if (copyIsArray) {
                                copyIsArray = false;
                                clone = src && isArray(src) ? src : [];
        
                            } else {
                                clone = src && isPlainObject(src) ? src : {};
                            }
        
                            // Never move original objects, clone them
                            target[name] = extend(deep, clone, copy);
        
                        // Don't bring in undefined values
                        } else if (copy !== undefined) {
                            target[ name ] = copy;
                        }
                    }
                }
            }
        
            //Return the modified object
            return target;
        };
        
    var _utils = (function(){
        var randomStr = '1234567890abcdefghijklmno'+
                  'pqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ';
        var randomStrLen = randomStr.length - 1;
        return {
            query: function(selector){
                return document.querySelectorAll(selector);
            },
            randomStr: function(max){
                var rv = '';
                max = (typeof max === 'undefined') ? 8 : max;
                
                for(var i=0; i < max; i++){
                    rv += randomStr[Math.floor(Math.random() * (randomStrLen + 1))];
                }
                return rv;
            },
            //获取某个元素的Data ID, 如果该元素不存在该id， 则随机生成一个id， 并分配给
            //该元素的uid attribute。
            //return {uid}
            getElUID: function(el){
                var uid = el.getAttribute('data-uid');
                if(!uid){
                    uid = this.randomStr(18);
                    el.setAttribute('data-uid', uid);
                }
                return uid;
            },
            addEvents: function(el, types, callback){
                types = types ? types.split(" ") : [];
                for(var i= 0,len=types.length; i<len; i++) {
                    if(el.addEventListener){
                        callback && el.addEventListener(types[i], callback, false);
                    }
                }
            },
            removeEvents: function(el, types, callback){
                types = types ? types.split(" ") : [];
                for(var i= 0,len=types.length; i<len; i++) {
                    if(el.removeEventListener){
                        el.removeEventListener(types[i], callback, false);
                    }
                }
            },
            
            deepCopy: function(obj1, obj2){
                if(!obj2){
                    obj2 = obj1;
                    obj1 = {};
                }
                extend(true, obj1, obj2);
                return obj1;
            }
        }
    })();
    
    var _touchData = (function(){
        var dataMap = {};//key是一个uid, value是data object， 代表uid的是一个数据集合。
        return {
            get: function(el, key){
                var uid = _utils.getElUID(el);
                dataMap[uid] = dataMap[uid] || {};
                if(arguments.length === 1){
                    return dataMap[uid];
                }else{
                    return dataMap[uid][key];
                }
            },
            set: function(el, key, value){
                var uid = _utils.getElUID(el);
                dataMap[uid] = dataMap[uid] || {};
                dataMap[uid][key] = value;
            }
        }
    })();
    
    /*
     *事件管理器，托管由用户定义的事件和处理程序。
     */
    var eventManager = (function(){
        var eventHanlderMap = {};
        var hdInterMap = {};
        return {
            trigger: function(el, type, paras){
                var uid = _utils.getElUID(el);
                var handlers = eventHanlderMap[uid][type]['handler'];
                var smrEv = smrEventList;
                var swipeList = [
                                  smrEv.SWIPE_START, smrEv.SWIPING, 
                                  smrEv.SWIPE_END, smrEv.SWIPE_LEFT,
                                  smrEv.SWIPE_RIGHT, smrEv.SWIPE_UP,
                                  smrEv.SWIPE_DOWN, smrEv.SWIPE
                                ];
                                
                var execHandler = function(func, el, ops, pr){
                    //当配置interval大于0， 对event handler进行切片处理
                    if(ops && ops.interval){
                        hdInterMap[func] = hdInterMap[func] || {};
                        hdInterMap[func]['list'] = hdInterMap[func]['list'] || [];
                        
                        hdInterMap[func]['list'].push((function(h,e,p){
                            return function(){
                                h.call(e, p);
                            }
                        })(func, el, pr));
                        
                        if(!hdInterMap[func]['interval']){
                            hdInterMap[func]['interval'] = setInterval((function(h){
                                return function(){
                                    var prx = hdInterMap[h]['list'].shift();
                                    if(prx){
                                        prx();
                                    }else{
                                        clearInterval(hdInterMap[h]['interval']);
                                        hdInterMap[h]['interval'] = null;
                                    }
                                }
                            })(func), ops.interval);
                        }
                    }else{
                        func.call(el, pr);
                    }
                };
                
                for(var i=0, len=handlers.length; i < len; i++){
                    var ops = handlers[i].options;
                    //如果是sumeru swipe类事件， 加速度处理
                    if(swipeList.indexOf(type) != -1){
                        if(ops && ops.swipeFactor){
                            var duration = paras.duration/1000;
                            paras.factor = (10 - ops.swipeFactor) * duration * duration * 10;
                        }
                    }
                    
                    if(ops && ops.__binding_live){
                        var target = paras.originEvent.target;
                        
                        //兼容ios4, 文本节点的父节点为target
                        if(target && target.nodeType === 3){
                            target = target.parentNode;
                        }
                        var liveEls = _utils.query(ops.__binding_live);
                        if(liveEls && liveEls.length > 0){
                            liveEls = Array.prototype.slice.apply(liveEls, [0]);
                            liveEls.forEach(function(le){
                                if(le.contains(target)){
                                    execHandler(handlers[i], le, ops, paras);
                                }
                            });
                        }
                    }else{
                        execHandler(handlers[i], el, ops, paras);
                    }
                }
            },
            off: function(){
                if(typeof arguments[0] === 'undefined'){
                   return;
                }
                
                var uid = _utils.getElUID(arguments[0]);
                
                //解除live的绑定
                if(typeof arguments[3] === 'string'){
                    var handlers = [];
                    try{
                        handlers = eventHanlderMap[uid][arguments[1]]['handler'];
                    }catch(e){ 
                        handlers = [];
                    }
                    if(arguments[2]){
                        var index = handlers.indexOf(arguments[2]);
                        if(index > -1){
                            var h = handlers.splice(index, 1);
                            delete h.options;
                        }
                    }else{
                        for( var i=0; i < handlers.length; i++){
                            var ops = handlers[i].options;
                            if(ops && ops.__binding_live 
                                && ops.__binding_live === arguments[3]){
                                var h = handlers.splice(i, 1);
                                delete h.options;
                                i--;
                            }
                        }
                    }
                    return false;
                }
                
                //解除on绑定
                if(arguments.length == 1){
                    eventHanlderMap[uid] = null;
                }else if(arguments.length === 2){
                    eventHanlderMap[uid] && (eventHanlderMap[uid][arguments[1]] = null);
                }else{
                    if( eventHanlderMap[uid] && 
                        eventHanlderMap[uid][arguments[1]] &&
                        eventHanlderMap[uid][arguments[1]]['handler'] ){
                        var handlers = eventHanlderMap[uid][arguments[1]]['handler'];
                        var index = handlers.indexOf(arguments[2]);
                        if(index > -1){
                            var h = handlers.splice(index, 1);
                            delete h.options;
                        }
                    }
                }
            },
            add: function(el, type, hanlder, options){
                var uid = _utils.getElUID(el);
                eventHanlderMap[uid] = eventHanlderMap[uid] || {};
                eventHanlderMap[uid][type] = eventHanlderMap[uid][type] || {};
                
                eventHanlderMap[uid][type]['handler']  = eventHanlderMap[uid][type]['handler'] || [];
                !options || (hanlder.options = options);
                typeof hanlder === 'function' ? eventHanlderMap[uid][type]['handler'].push(hanlder) : null;
            },
            hasHandler: function(el, type){
                try{
                    var uid = _utils.getElUID(el);
                    var handlers = eventHanlderMap[uid][type]['handler'];
                    return handlers && handlers.length > 0 ? true : false; 
                }catch(e){
                    return false;
                }
            },
            isEmpty: function(el){
                var uid = _utils.getElUID(el);
                var thisEvent = eventHanlderMap[uid];
                for(var type in thisEvent){
                    if(thisEvent[type] && 
                        thisEvent[type]['handler'] &&
                        thisEvent[type]['handler']['length'] !== 0){
                        return false;
                    }
                }
                return true;
            }
        }
    })();
    
    var config = {
        tap: true,
        doubleTap: true,
        tapMaxDistance: 10,
        hold: true,
        holdTime: 650,//ms
        maxDoubleTapInterval: 300,
       
        //swipe
        swipe: true,
        swipeTime: 300,
        swipeMinDistance: 18,
        swipeFactor: 5,
        
        drag: true,
        //pinch config, minScaleRate与minRotationAngle先指定为0
        pinch: true,
        minScaleRate: 0,
        minRotationAngle: 0
    };
    /*
     *@constructor SmrEvent: one element, one SmrEvent obj. 这个对象
     *封装了旋转、pinchin、pinchout、swipe、tap等事件。
     */
    var SmrEvent = (function(){
        var _hasTouch = ('ontouchstart' in window);
        
        /**
         * 获取事件的位置信息
         * @param  ev, 原生事件对象
         * @return array  [{ x: int, y: int }]
         */
        function getPosOfEvent(ev){   
            //多指触摸， 返回多个手势位置信息
            if(_hasTouch) {
                var pos = [];
                var src = null;
                
                for(var t=0, len=ev.touches.length; t<len; t++) {
                    src = ev.touches[t];
                    pos.push({ x: src.pageX, y: src.pageY });
                }
                return pos;
            }//处理PC浏览器的情况
            else {
                return [{
                    x: ev.pageX,
                    y: ev.pageY
                }];
            }
        };
        /**
         *获取两点之间的距离
         */
        function getDistance(pos1, pos2){
            var x = pos2.x - pos1.x, y = pos2.y - pos1.y;
            return Math.sqrt((x * x) + (y * y));
        };
        
        /**
         *计算事件的手势个数
         *@param ev {Event}
         */
        function getFingers(ev){
            return ev.touches ? ev.touches.length : 1;
        };
        //计算收缩的比例
        function calScale(pstart/*开始位置*/, pmove/*移动中的位置*/){
            if(pstart.length >= 2 && pmove.length >= 2) {
                var disStart = getDistance(pstart[1], pstart[0]);
                var disEnd = getDistance(pmove[1], pmove[0]);
                
                return disEnd / disStart;
            }
            return 1;
        };
        
        //return 角度，范围为{-180-0，0-180}， 用来识别swipe方向。
        function getAngle(p1, p2){
            return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
        };
        //return 角度， 范围在{0-180}， 用来识别旋转角度
        function _getAngle180(p1, p2){
            var agl = Math.atan((p2.y - p1.y) * -1 / (p2.x - p1.x)) * (180 / Math.PI);
            return (agl < 0 ? (agl + 180) : agl);
        };
        
        //根据角度计算方位 
        //@para agl {int} 是调用getAngle获取的。
        function getDirectionFromAngle(agl) {
            var directions = {
                up: agl < -45 && agl > -135,
                down: agl >= 45 && agl < 135,
                left: agl >= 135 || agl <= -135,
                right: agl >= -45 && agl <= 45 
            };
            for(var key in directions){
                if(directions[key])return key;
            }
            return null;
        };
        
        
        //取消事件的默认行为和冒泡
        function preventDefault(ev){
            ev.preventDefault();
            ev.stopPropagation();
        };
        
        function getXYByElement(el){
            var left =0,  top = 0;
            
            while (el.offsetParent) {
                left += el.offsetLeft;
                top += el.offsetTop;
                el = el.offsetParent;
            }
            return { left: left, top: top };
        };
        
        return function(el){
            var me = this;
            var pos = {start : null, move: null, end: null};
            var startTime = 0; 
            var fingers = 0;
            var startEvent = null;
            var moveEvent = null;
            var endEvent = null;
            var startSwiping = false;
            var startPinch = false;
            var startDrag = false;
            
            var __offset = {};
            var __touchStart = false;
            var __holdTimer = null;
            var __tapped = false;
            var __lastTapEndTime = null;
            
            function triggerEvent(name, paras){
                if(typeof me["on"+ name] === 'function'){
                    me["on"+ name](paras);
                }
            };
            
            function reset(){
                startEvent = moveEvent = endEvent = null;
                __tapped = __touchStart = startSwiping = startPinch = false;
                startDrag = false;
                pos = {};
                __rotation_single_finger = false;
            };
            
            function isTouchStart(ev){
                return (ev.type === 'touchstart' || ev.type === 'mousedown');
            };
            function isTouchMove(ev){
                return (ev.type === 'touchmove' || ev.type === 'mousemove');
            };
            function isTouchEnd(ev){
                return (ev.type === 'touchend' || ev.type === 'mouseup' || ev.type === 'touchcancel');
            };
            
            function triggerCustomEvent(el, customEventName, eventObj, copy){
                if(eventManager.hasHandler(el, customEventName)){
                    copy = typeof copy == 'undefind' ? true : copy;
                    
                    if(copy){
                       eventObj = _utils.deepCopy(eventObj);
                    }
                    eventObj.type = customEventName;
                    eventObj.startRotate = function(){
                       me.startRotate();
                    }
                    triggerEvent(customEventName, eventObj);
                }
            };
            
            var __scale_last_rate = 1;
            var __rotation_single_finger = false;
            var __rotation_single_start = [];//元素坐标中心位置
            var __initial_angle = 0;
            var __rotation = 0; 
            
            var __prev_tapped_end_time = 0;
            var __prev_tapped_pos = null;
            
            var gestures = {
                _getAngleDiff: function(currentPos){
                    var diff = parseInt(__initial_angle - _getAngle180(currentPos[0], currentPos[1]), 10);
                    var count = 0;
                    
                    while(Math.abs(diff - __rotation) > 90 && count++ < 50) {
                        if(__rotation < 0){
                            diff -= 180;
                        }else{
                            diff += 180;
                        }
                    }
                    __rotation = parseInt(diff, 10);
                    return __rotation;
                },
                pinch: function(ev){
                    if(config.pinch){
                        //touchend进入此时的getFinger(ev) < 2
                        if(!__touchStart)return;
                        if(getFingers(ev) < 2){
                            if(!isTouchEnd(ev))return;
                        }
                        var em = eventManager;
                        var scale = calScale(pos.start, pos.move);
                        var rotation = this._getAngleDiff(pos.move);
                        var eventObj = {
                            type: '',
                            originEvent: ev,
                            scale: scale,
                            rotation: rotation,
                            direction: (rotation > 0 ? 'right' : 'left'),
                            fingersCount: getFingers(ev),
                            startRotate: function(){
                               me.startRotate();
                            }                                           
                        };
                        if(!startPinch){
                            startPinch = true;
                            eventObj.fingerStatus = "start";
                            triggerCustomEvent(el, smrEventList.PINCH_START, eventObj);
                        }else if(isTouchMove(ev)){
                            eventObj.fingerStatus = "move";
                        }else if(isTouchEnd(ev)){
                            eventObj.fingerStatus = "end";
                            triggerCustomEvent(el, smrEventList.PINCH_END, eventObj);
                        }
                        
                        triggerCustomEvent(el, smrEventList.PINCH, eventObj);
                        
                        if(Math.abs(1-scale) > config.minScaleRate){
                            var scaleEv = _utils.deepCopy(eventObj);
                            
                            //手势放大, 触发pinchout事件
                            var scale_diff = 0.00000000001;//防止touchend的scale与__scale_last_rate相等，不触发事件的情况。
                            if(scale > __scale_last_rate){
                                __scale_last_rate = scale - scale_diff;
                                triggerCustomEvent(el, smrEventList.PINCH_OUT, scaleEv, false);
                            }//手势缩小,触发pinchin事件
                            else if(scale < __scale_last_rate){
                                __scale_last_rate = scale + scale_diff;
                                triggerCustomEvent(el, smrEventList.PINCH_IN, scaleEv, false);
                            }
                            
                            if(isTouchEnd(ev)){
                                __scale_last_rate = 1;
                            }
                        }
                        
                        if(Math.abs(rotation) > config.minRotationAngle){
                            var rotationEv = _utils.deepCopy(eventObj), eventType;
                            
                            eventType = rotation > 0 ? smrEventList.ROTATION_RIGHT : smrEventList.ROTATION_LEFT;
                            triggerCustomEvent(el, eventType, rotationEv, false);
                            triggerCustomEvent(el, smrEventList.ROTATION, eventObj);
                        }
                        
                        //preventDefault(ev);
                    }
                },
                rotateSingleFinger: function(ev){
                    if(__rotation_single_finger && getFingers(ev) < 2){
                        if(!pos.move)return;
                        if(__rotation_single_start.length < 2){
                            var docOff = getXYByElement(el);
                            
                            __rotation_single_start = [{
                                x: docOff.left + el.offsetWidth/2,
                                y: docOff.top + el.offsetHeight/2
                            }, pos.move[0]];
                            __initial_angle = parseInt(_getAngle180(__rotation_single_start[0], __rotation_single_start[1]), 10);
                        }
                        var move = [__rotation_single_start[0], pos.move[0]];
                        var rotation = this._getAngleDiff(move);
                        var eventObj = {
                            type: '',
                            originEvent: ev,
                            rotation: rotation,
                            direction: (rotation > 0 ? 'right' : 'left'),
                            fingersCount: getFingers(ev)
                        };
                        
                        if(isTouchMove(ev)){
                            eventObj.fingerStatus = "move";
                        }else if(isTouchEnd(ev) || ev.type === 'mouseout'){
                            eventObj.fingerStatus = "end";
                            triggerCustomEvent(el, smrEventList.PINCH_END, eventObj);
                        }
                        
                        eventType = rotation > 0 ? smrEventList.ROTATION_RIGHT : smrEventList.ROTATION_LEFT;
                        triggerCustomEvent(el, eventType, eventObj);
                        triggerCustomEvent(el, smrEventList.ROTATION, eventObj);
                    }
                },
                swipe: function(ev){
                    //目前swipe只存在一个手势上
                    if(!__touchStart || !pos.move || getFingers(ev) > 1){
                        return;
                    }
                    
                    var em = eventManager;
                    var now = Date.now();
                    var touchTime = now - startTime;
                    var distance = getDistance(pos.start[0], pos.move[0]);
                    var position = {
                       x: pos.move[0].x - __offset.left,
                       y: pos.move[0].y - __offset.top
                    };
                    var angle = getAngle(pos.start[0], pos.move[0]);
                    var direction = getDirectionFromAngle(angle);
                    var touchSecond = touchTime/1000;
                    var factor = ((10 - config.swipeFactor) * 10 * touchSecond * touchSecond);
                    var eventObj = {
                        type: smrEventList.SWIPE,//DEFAULT: smrEventList.SWIPE event.
                        originEvent: ev,
                        position: position,
                        direction: direction,
                        distance: distance,
                        distanceX: pos.move[0].x - pos.start[0].x,
                        distanceY: pos.move[0].y - pos.start[0].y,
                        angle: angle,
                        duration: touchTime,
                        fingersCount: getFingers(ev),
                        factor: factor
                    };
                    if(config.swipe){
                        var swipeTo = function(){
                            var elt = smrEventList;
                            switch(direction){
                                case 'up': triggerCustomEvent(el, elt.SWIPE_UP, eventObj);break;
                                case 'down': triggerCustomEvent(el, elt.SWIPE_DOWN, eventObj);break;
                                case 'left': triggerCustomEvent(el, elt.SWIPE_LEFT, eventObj);break;
                                case 'right': triggerCustomEvent(el, elt.SWIPE_RIGHT, eventObj);break;
                            }
                        };
                        
                        if(!startSwiping){
                            eventObj.fingerStatus = eventObj.swipe = 'start';
                            startSwiping = true;
                            triggerCustomEvent(el, smrEventList.SWIPE_START, eventObj);
                        }else if(isTouchMove(ev)){
                            eventObj.fingerStatus = eventObj.swipe = 'move';
                            triggerCustomEvent(el, smrEventList.SWIPING, eventObj);
                            
                            if(touchTime > config.swipeTime && 
                              touchTime < config.swipeTime + 50 &&
                              distance > config.swipeMinDistance){
                                swipeTo();
                                triggerCustomEvent(el, smrEventList.SWIPE, eventObj, false);
                            }
                        }else if(isTouchEnd(ev) || ev.type === 'mouseout'){
                            eventObj.fingerStatus = eventObj.swipe = 'end';
                            triggerCustomEvent(el, smrEventList.SWIPE_END, eventObj);
                            
                            if(config.swipeTime > touchTime && 
                                distance > config.swipeMinDistance){
                                swipeTo();
                                triggerCustomEvent(el, smrEventList.SWIPE, eventObj, false);
                            }
                        }
                    }
                    
                    if(config.drag){
                        if(!startDrag){
                            eventObj.fingerStatus = eventObj.swipe = 'start';
                            startDrag = true;
                        }else if(isTouchMove(ev)){
                            eventObj.fingerStatus = eventObj.swipe = 'move';
                        }else if(isTouchEnd(ev)){
                            eventObj.fingerStatus = eventObj.swipe = 'end';
                        }
                        triggerCustomEvent(el, smrEventList.DRAG, eventObj);
                    }
                },
                tap: function(ev){
                    if(config.tap){
                        var em = eventManager;
                        var now = Date.now();
                        var touchTime = now - startTime;
                        var distance = getDistance(pos.start[0], pos.move ? pos.move[0]:pos.start[0]);
                        
                        clearTimeout(__holdTimer);//去除hold事件
                        
                        var isDoubleTap = (function(){
                            if(__prev_tapped_pos && config.doubleTap &&
                                (startTime - __prev_tapped_end_time) < config.maxDoubleTapInterval){
                                var doubleDis = getDistance(__prev_tapped_pos, pos.start[0]);
                                if(doubleDis < 16)return true;
                            }
                            return false;
                        })();
                        
                        if(isDoubleTap){
                            triggerEvent(smrEventList.DOUBLE_TAP, {
                                type: smrEventList.DOUBLE_TAP,
                                originEvent   : ev,
                                position        : pos.start[0]
                            });
                            return;
                        }
                        
                        if(config.tapMaxDistance < distance)return;
                        
                        if(config.holdTime > touchTime && getFingers(ev) <= 1){
                            //clearTimeout在ios上有时不work（alert引起的）， 先用__tapped顶一下
                            __tapped = true;
                            __prev_tapped_end_time = now;
                            __prev_tapped_pos = pos.start[0];
                            
                            if(em.hasHandler(el, smrEventList.TAP)){
                                triggerEvent(smrEventList.TAP, {
                                    type: smrEventList.TAP,
                                    originEvent   : ev,
                                    fingersCount: getFingers(ev),
                                    position        : pos.start[0]
                                });
                            }
                            if(em.hasHandler(el, smrEventList.CLICK)){
                                triggerEvent(smrEventList.CLICK, {
                                    type: smrEventList.CLICK,
                                    originEvent   : ev,
                                    fingersCount: getFingers(ev),
                                    position        : pos.start[0]
                                });
                            }
                        }
                    }
                },
                hold: function(ev){
                    if(config.hold) {
                        clearTimeout(__holdTimer);
                        
                        __holdTimer = setTimeout(function() {
                            if(!pos.start)return;
                            var distance = getDistance(pos.start[0], pos.move ? pos.move[0]:pos.start[0]);
                            if(config.tapMaxDistance < distance)return;
                            
                            if(!__tapped){
                                triggerEvent("hold", {
                                    type: 'hold',
                                    originEvent: ev,
                                    fingersCount: getFingers(ev),
                                    position: pos.start[0]
                                });
                            }
                        }, config.holdTime);
                    }
                }
            };
            
            var handlerOriginEvent = function(ev){
                switch(ev.type){
                    case 'touchstart':
                    case 'mousedown':
                        __rotation_single_finger = false;
                        __rotation_single_start = [];
                        triggerCustomEvent(el, ev.type, {
                           originEvent: ev
                        });
                        
                        __touchStart = true;
                        if(!pos.start || pos.start.length < 2){
                            pos.start = getPosOfEvent(ev);
                        }
                        if(getFingers(ev) >= 2){
                            __initial_angle = parseInt(_getAngle180(pos.start[0], pos.start[1]), 10);
                        }
                        
                        startTime = Date.now(); 
                        startEvent = ev;
                        __offset = {};
                        
                        //来自jquery offset的写法: https://github.com/jquery/jquery/blob/master/src/offset.js
                        var box = el.getBoundingClientRect();
                        var docEl = document.documentElement;
                        __offset = {
                            top: box.top  + ( window.pageYOffset || docEl.scrollTop )  - ( docEl.clientTop  || 0 ),
                            left: box.left + ( window.pageXOffset || docEl.scrollLeft ) - ( docEl.clientLeft || 0 )
                        };
                        
                        gestures.hold(ev);
                        break;
                    case 'touchmove':
                    case 'mousemove':
                        triggerCustomEvent(el, ev.type, {
                            originEvent: ev
                        });
                        if(!__touchStart  || !pos.start)return; 
                        pos.move = getPosOfEvent(ev);
                        
                        if(getFingers(ev) >= 2){
                            gestures.pinch(ev);
                        }else if(__rotation_single_finger){
                            gestures.rotateSingleFinger(ev);
                        }else{
                            gestures.swipe(ev);
                        }
                        break;
                    case 'touchend':
                    case 'touchcancel':
                    case 'mouseup':
                    case 'mouseout':
                        triggerCustomEvent(el, ev.type, {
                            originEvent: ev
                        });
                        if(!__touchStart)return;
                        endEvent = ev;
                        
                        if(startPinch){
                            gestures.pinch(ev);
                        }else if(__rotation_single_finger){
                            gestures.rotateSingleFinger(ev);
                        }else{
                            if(startSwiping){
                                gestures.swipe(ev);
                            }
                        }
                        gestures.tap(ev);
                        
                        reset();
                        __initial_angle = 0;
                        __rotation = 0;
                        if(ev.touches && ev.touches.length === 1){
                            __touchStart = true;
                            __rotation_single_finger = true;
                        }
                        break;
                }
            };
            
            
            var eventNames = _hasTouch ? 'touchstart touchmove touchend touchcancel': 
                'mouseup mousedown mousemove mouseout';
            _utils.addEvents(el, eventNames, handlerOriginEvent);      
            
            this.tearDown = function(){
                _utils.removeEvents(el, eventNames, handlerOriginEvent); 
            }
            
            this.startRotate = function(){
                __rotation_single_finger = true;
            }
        }
    })();
    
    /*
     *@param el {Element} 
     *@param types {String} 事件类型， 可以空格分割多个事件。
     *@param handler {Function} 事件处理函数
     *@param options {Object}
     *{
     *  swipeFactor: int (1-10) 加速度因子， 值越大速率越大。
     *  interval: 0 //单位ms， 用来对handler的回调进行切片。
     *}
     */
    var _on = function(){
        if(typeof arguments.length < 3)throw 'Please specify complete argments';
        var element = typeof arguments[0] === 'string' ? 
                          _utils.query(arguments[0]) : [arguments[0]];
        var types = arguments[1].split(' ');
        var handler = arguments[arguments.length - 1];
        var options = arguments.length > 3 ? arguments[arguments.length - 2] : undefined;
        
        element = Array.prototype.slice.apply(element, [0]);
        element.forEach(function(el){
            for(var i=0; i < types.length; i++){
                var eventName = mapEvent(types[i]);
                if(event.special[eventName]){
                    eventManager.add(el, eventName, handler, options);
                    event.special[eventName].setUp.apply(this, [el, eventName]);
                }else{
                    _utils.addEvents(el, eventName, handler);
                }
            }
        });
    };
    
    var _live = function(){
        if(arguments.length < 3){
            throw new Error('wrong argument');
        }
        //如果指定的第一个元素不为选择器, 则交给on处理。
        if(typeof arguments[0] != 'string'){
            _on.apply(exports, arguments);
            return;
        }
        var options = arguments.length > 3 ? arguments[arguments.length - 2] : {};
        var types = arguments[1];
        var handler = arguments[arguments.length - 1];
        options.__binding_live = arguments[0];
        _on.apply(exports, [document.body, types, options, handler]);
    };
    
    
    var _off = function(selector, types, handler, liveSelector){
        if(typeof selector === 'undefined'){
           throw 'Please specify the selector.';
        }
        
        selector = typeof selector === 'string' ? _utils.query(selector) : [selector];
        selector = Array.prototype.slice.apply(selector, [0]);
        
        if(!types){
            eventManager.off(selector);
            _utils.removeEvents(selector);
        }else{
            types = types.split(' ');
            selector.forEach(function(el){
                types.forEach(function(type, index){
                    var args = [el, mapEvent(type)];
                    handler ? args.push(handler) : null; 
                    liveSelector ? args.push(liveSelector) : null; 
                    
                    if(event.special[type]){
                        eventManager.off.apply(eventManager, args);
                        if(eventManager.isEmpty(el, type)){
                            event.special[type].tearDown(el);
                        }
                    }else{
                        _utils.removeEvents.apply(this, args);
                    }
                });
            });
        } 
    };
    
    var _die = function(selector, types, handler){
        _off(document.body, types, handler, selector);
    }
    
    var touchEvent = {
       'touchstart': 'mousedown',
       'touchmove': 'mousemove',
       'touchend': 'mouseup'
    };
    
    var mapEvent = function(eventName){
        if(!('ontouchstart' in window ) && touchEvent[eventName]){
            return touchEvent[eventName];
        }
        return eventName;
    };
    /**
     *全局可配置的参数：
     *{
     *  tap: true, //tap类事件开关, 默认为true
     *  doubleTap: true, //doubleTap事件开关， 默认为true
     *  hold: true,//hold事件开关, 默认为true
     *  holdTime: 650,//hold时间长度
     *  swipe: true,//swipe事件开关
     *  swipeTime: 300,//触发swipe事件的最大时长
     *  swipeMinDistance: 18,//swipe移动最小距离
     *  swipeFactor: 5,//加速因子, 值越大变化速率越快 
     *  pinch: true,//pinch类事件开关
     *}
     */
    var _config = function(customConfig){
        if(typeof customConfig !== 'object')return;
        config = extend(config, customConfig);
    };
    
    function touchSetup(el, type){
        var touchEv = _touchData.get(el, '_touchEv');
        if(!touchEv){
            touchEv = new SmrEvent(el);
            _touchData.set(el, '_touchEv', touchEv);
        }
        
        touchEv['on'+type] = function(paras){
            eventManager.trigger(el, type, paras);
        }
    };
    
    function tearDown(el){
        var touchEv = _touchData.get(el, '_touchEv');
        if(!touchEv)return;
        _touchData.set(el, '_touchEv', null);
        touchEv.tearDown();
    }
    var smrSpecical = { setUp: touchSetup, tearDown: tearDown};
    var smrEventList = {
        TOUCH_START: 'touchstart',
        TOUCH_MOVE: 'touchmove',
        TOUCH_END: 'touchend',
        TOUCH_CANCEL: 'touchcancel',
        
        MOUSE_DOWN: 'mousedown',
        MOUSE_MOVE: 'mousemove',
        MOUSE_UP: 'mouseup',
        
        CLICK: 'click',
        
        //PINCH TYPE EVENT NAMES
        PINCH_START: 'pinchstart',
        PINCH_END: 'pinchend',
        PINCH: 'pinch',
        PINCH_IN: 'pinchin',
        PINCH_OUT: 'pinchout',
        
        ROTATION_LEFT: 'rotateleft',
        ROTATION_RIGHT: 'rotateright',
        ROTATION: 'rotate',
        
        SWIPE_START: 'swipestart',
        SWIPING: 'swiping',
        SWIPE_END: 'swipeend',
        SWIPE_LEFT: 'swipeleft',
        SWIPE_RIGHT: 'swiperight',
        SWIPE_UP: 'swipeup',
        SWIPE_DOWN: 'swipedown',
        SWIPE: 'swipe',
        
        DRAG: 'drag',
        
        //HOLD AND TAP  
        HOLD: 'hold',
        TAP: 'tap',
        DOUBLE_TAP: 'doubletap'
    };
    
    var event = {};
    event.special = {};
    Object.keys(smrEventList).forEach(function(key){
        event.special[smrEventList[key]] = smrSpecical;
    });
    
    exports.live = _live;
    exports.die = _die;
    exports.on = _on;
    exports.off = _off;
    exports.config = _config;
    return exports;
});;(function(){
    Library.domUtils = sumeru.Library.create(function(exports){
        exports.on = function(dom,type,handle){
            if(dom && type && handle){
                if(type.indexOf('on') == 0){
                    type = type.substr(2);
                }
                dom.addEventListener(type,handle);
            }
        };
        
        exports.hasClass = function(dom,testClassName){
            if(dom.className == ""){
                return false;
            }
            
            if(dom.classList && dom.classList.contains){
                return dom.classList.contains(testClassName);
            }
            
            var classArr = dom.className.split(' ');
            return classArr.indexOf(testClassName) !== -1;
        };
    });
})();;typeof JSON!="object"&&(JSON={}),function(){"use strict";function f(e){return e<10?"0"+e:e}function quote(e){return escapable.lastIndex=0,escapable.test(e)?'"'+e.replace(escapable,function(e){var t=meta[e];return typeof t=="string"?t:"\\u"+("0000"+e.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+e+'"'}function str(e,t){var n,r,i,s,o=gap,u,a=t[e];a&&typeof a=="object"&&typeof a.toJSON=="function"&&(a=a.toJSON(e)),typeof rep=="function"&&(a=rep.call(t,e,a));switch(typeof a){case"string":return quote(a);case"number":return isFinite(a)?String(a):"null";case"boolean":case"null":return String(a);case"object":if(!a)return"null";gap+=indent,u=[];if(Object.prototype.toString.apply(a)==="[object Array]"){s=a.length;for(n=0;n<s;n+=1)u[n]=str(n,a)||"null";return i=u.length===0?"[]":gap?"[\n"+gap+u.join(",\n"+gap)+"\n"+o+"]":"["+u.join(",")+"]",gap=o,i}if(rep&&typeof rep=="object"){s=rep.length;for(n=0;n<s;n+=1)typeof rep[n]=="string"&&(r=rep[n],i=str(r,a),i&&u.push(quote(r)+(gap?": ":":")+i))}else for(r in a)Object.prototype.hasOwnProperty.call(a,r)&&(i=str(r,a),i&&u.push(quote(r)+(gap?": ":":")+i));return i=u.length===0?"{}":gap?"{\n"+gap+u.join(",\n"+gap)+"\n"+o+"}":"{"+u.join(",")+"}",gap=o,i}}typeof Date.prototype.toJSON!="function"&&(Date.prototype.toJSON=function(e){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z":null},String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(e){return this.valueOf()});var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","	":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;typeof JSON.stringify!="function"&&(JSON.stringify=function(e,t,n){var r;gap="",indent="";if(typeof n=="number")for(r=0;r<n;r+=1)indent+=" ";else typeof n=="string"&&(indent=n);rep=t;if(!t||typeof t=="function"||typeof t=="object"&&typeof t.length=="number")return str("",{"":e});throw new Error("JSON.stringify")}),typeof JSON.parse!="function"&&(JSON.parse=function(text,reviver){function walk(e,t){var n,r,i=e[t];if(i&&typeof i=="object")for(n in i)Object.prototype.hasOwnProperty.call(i,n)&&(r=walk(i,n),r!==undefined?i[n]=r:delete i[n]);return reviver.call(e,t,i)}var j;text=String(text),cx.lastIndex=0,cx.test(text)&&(text=text.replace(cx,function(e){return"\\u"+("0000"+e.charCodeAt(0).toString(16)).slice(-4)}));if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,"")))return j=eval("("+text+")"),typeof reviver=="function"?walk({"":j},""):j;throw new SyntaxError("JSON.parse")})}(),function(e,t){"use strict";var n=e.History=e.History||{};if(typeof n.Adapter!="undefined")throw new Error("History.js Adapter has already been loaded...");n.Adapter={handlers:{},_uid:1,uid:function(e){return e._uid||(e._uid=n.Adapter._uid++)},bind:function(e,t,r){var i=n.Adapter.uid(e);n.Adapter.handlers[i]=n.Adapter.handlers[i]||{},n.Adapter.handlers[i][t]=n.Adapter.handlers[i][t]||[],n.Adapter.handlers[i][t].push(r),e["on"+t]=function(e,t){return function(r){n.Adapter.trigger(e,t,r)}}(e,t)},trigger:function(e,t,r){r=r||{};var i=n.Adapter.uid(e),s,o;n.Adapter.handlers[i]=n.Adapter.handlers[i]||{},n.Adapter.handlers[i][t]=n.Adapter.handlers[i][t]||[];for(s=0,o=n.Adapter.handlers[i][t].length;s<o;++s)n.Adapter.handlers[i][t][s].apply(this,[r])},extractEventData:function(e,n){var r=n&&n[e]||t;return r},onDomLoad:function(t){var n=e.setTimeout(function(){t()},2e3);e.onload=function(){clearTimeout(n),t()}}},typeof n.init!="undefined"&&n.init()}(window),function(e,t){"use strict";var n=e.document,r=e.setTimeout||r,i=e.clearTimeout||i,s=e.setInterval||s,o=e.History=e.History||{};if(typeof o.initHtml4!="undefined")throw new Error("History.js HTML4 Support has already been loaded...");o.initHtml4=function(){if(typeof o.initHtml4.initialized!="undefined")return!1;o.initHtml4.initialized=!0,o.enabled=!0,o.savedHashes=[],o.isLastHash=function(e){var t=o.getHashByIndex(),n;return n=e===t,n},o.isHashEqual=function(e,t){return e=encodeURIComponent(e).replace(/%25/g,"%"),t=encodeURIComponent(t).replace(/%25/g,"%"),e===t},o.saveHash=function(e){return o.isLastHash(e)?!1:(o.savedHashes.push(e),!0)},o.getHashByIndex=function(e){var t=null;return typeof e=="undefined"?t=o.savedHashes[o.savedHashes.length-1]:e<0?t=o.savedHashes[o.savedHashes.length+e]:t=o.savedHashes[e],t},o.discardedHashes={},o.discardedStates={},o.discardState=function(e,t,n){var r=o.getHashByState(e),i;return i={discardedState:e,backState:n,forwardState:t},o.discardedStates[r]=i,!0},o.discardHash=function(e,t,n){var r={discardedHash:e,backState:n,forwardState:t};return o.discardedHashes[e]=r,!0},o.discardedState=function(e){var t=o.getHashByState(e),n;return n=o.discardedStates[t]||!1,n},o.discardedHash=function(e){var t=o.discardedHashes[e]||!1;return t},o.recycleState=function(e){var t=o.getHashByState(e);return o.discardedState(e)&&delete o.discardedStates[t],!0},o.emulated.hashChange&&(o.hashChangeInit=function(){o.checkerFunction=null;var t="",r,i,u,a,f=Boolean(o.getHash());return o.isInternetExplorer()?(r="historyjs-iframe",i=n.createElement("iframe"),i.setAttribute("id",r),i.setAttribute("src","#"),i.style.display="none",n.body.appendChild(i),i.contentWindow.document.open(),i.contentWindow.document.close(),u="",a=!1,o.checkerFunction=function(){if(a)return!1;a=!0;var n=o.getHash(),r=o.getHash(i.contentWindow.document);return n!==t?(t=n,r!==n&&(u=r=n,i.contentWindow.document.open(),i.contentWindow.document.close(),i.contentWindow.document.location.hash=o.escapeHash(n)),o.Adapter.trigger(e,"hashchange")):r!==u&&(u=r,f&&r===""?o.back():o.setHash(r,!1)),a=!1,!0}):o.checkerFunction=function(){var n=o.getHash()||"";return n!==t&&(t=n,o.Adapter.trigger(e,"hashchange")),!0},o.intervalList.push(s(o.checkerFunction,o.options.hashChangeInterval)),!0},o.Adapter.onDomLoad(o.hashChangeInit)),o.emulated.pushState&&(o.onHashChange=function(t){var n=t&&t.newURL||o.getLocationHref(),r=o.getHashByUrl(n),i=null,s=null,u=null,a;return o.isLastHash(r)?(o.busy(!1),!1):(o.doubleCheckComplete(),o.saveHash(r),r&&o.isTraditionalAnchor(r)?(o.Adapter.trigger(e,"anchorchange"),o.busy(!1),!1):(i=o.extractState(o.getFullUrl(r||o.getLocationHref()),!0),o.isLastSavedState(i)?(o.busy(!1),!1):(s=o.getHashByState(i),a=o.discardedState(i),a?(o.getHashByIndex(-2)===o.getHashByState(a.forwardState)?o.back(!1):o.forward(!1),!1):(o.pushState(i.data,i.title,encodeURI(i.url),!1),!0))))},o.Adapter.bind(e,"hashchange",o.onHashChange),o.pushState=function(t,n,r,i){r=encodeURI(r).replace(/%25/g,"%");if(o.getHashByUrl(r))throw new Error("History.js does not support states with fragment-identifiers (hashes/anchors).");if(i!==!1&&o.busy())return o.pushQueue({scope:o,callback:o.pushState,args:arguments,queue:i}),!1;o.busy(!0);var s=o.createStateObject(t,n,r),u=o.getHashByState(s),a=o.getState(!1),f=o.getHashByState(a),l=o.getHash(),c=o.expectedStateId==s.id;return o.storeState(s),o.expectedStateId=s.id,o.recycleState(s),o.setTitle(s),u===f?(o.busy(!1),!1):(o.saveState(s),c||o.Adapter.trigger(e,"statechange"),!o.isHashEqual(u,l)&&!o.isHashEqual(u,o.getShortUrl(o.getLocationHref()))&&o.setHash(u,!1),o.busy(!1),!0)},o.replaceState=function(t,n,r,i){r=encodeURI(r).replace(/%25/g,"%");if(o.getHashByUrl(r))throw new Error("History.js does not support states with fragment-identifiers (hashes/anchors).");if(i!==!1&&o.busy())return o.pushQueue({scope:o,callback:o.replaceState,args:arguments,queue:i}),!1;o.busy(!0);var s=o.createStateObject(t,n,r),u=o.getHashByState(s),a=o.getState(!1),f=o.getHashByState(a),l=o.getStateByIndex(-2);return o.discardState(a,s,l),u===f?(o.storeState(s),o.expectedStateId=s.id,o.recycleState(s),o.setTitle(s),o.saveState(s),o.Adapter.trigger(e,"statechange"),o.busy(!1)):o.pushState(s.data,s.title,s.url,!1),!0}),o.emulated.pushState&&o.getHash()&&!o.emulated.hashChange&&o.Adapter.onDomLoad(function(){o.Adapter.trigger(e,"hashchange")})},typeof o.init!="undefined"&&o.init()}(window),function(e,t){"use strict";var n=e.console||t,r=e.document,i=e.navigator,s=e.sessionStorage||!1,o=e.setTimeout,u=e.clearTimeout,a=e.setInterval,f=e.clearInterval,l=e.JSON,c=e.alert,h=e.History=e.History||{},p=e.history;try{s.setItem("TEST","1"),s.removeItem("TEST")}catch(d){s=!1}l.stringify=l.stringify||l.encode,l.parse=l.parse||l.decode;if(typeof h.init!="undefined")throw new Error("History.js Core has already been loaded...");h.init=function(e){return typeof h.Adapter=="undefined"?!1:(typeof h.initCore!="undefined"&&h.initCore(),typeof h.initHtml4!="undefined"&&h.initHtml4(),!0)},h.initCore=function(d){if(typeof h.initCore.initialized!="undefined")return!1;h.initCore.initialized=!0,h.options=h.options||{},h.options.hashChangeInterval=h.options.hashChangeInterval||100,h.options.safariPollInterval=h.options.safariPollInterval||500,h.options.doubleCheckInterval=h.options.doubleCheckInterval||500,h.options.disableSuid=h.options.disableSuid||!1,h.options.storeInterval=h.options.storeInterval||1e3,h.options.busyDelay=h.options.busyDelay||250,h.options.debug=h.options.debug||!1,h.options.initialTitle=h.options.initialTitle||r.title,h.options.html4Mode=h.options.html4Mode||!1,h.options.delayInit=h.options.delayInit||!1,h.intervalList=[],h.clearAllIntervals=function(){var e,t=h.intervalList;if(typeof t!="undefined"&&t!==null){for(e=0;e<t.length;e++)f(t[e]);h.intervalList=null}},h.debug=function(){(h.options.debug||!1)&&h.log.apply(h,arguments)},h.log=function(){var e=typeof n!="undefined"&&typeof n.log!="undefined"&&typeof n.log.apply!="undefined",t=r.getElementById("log"),i,s,o,u,a;e?(u=Array.prototype.slice.call(arguments),i=u.shift(),typeof n.debug!="undefined"?n.debug.apply(n,[i,u]):n.log.apply(n,[i,u])):i="\n"+arguments[0]+"\n";for(s=1,o=arguments.length;s<o;++s){a=arguments[s];if(typeof a=="object"&&typeof l!="undefined")try{a=l.stringify(a)}catch(f){}i+="\n"+a+"\n"}return t?(t.value+=i+"\n-----\n",t.scrollTop=t.scrollHeight-t.clientHeight):e||c(i),!0},h.getInternetExplorerMajorVersion=function(){var e=h.getInternetExplorerMajorVersion.cached=typeof h.getInternetExplorerMajorVersion.cached!="undefined"?h.getInternetExplorerMajorVersion.cached:function(){var e=3,t=r.createElement("div"),n=t.getElementsByTagName("i");while((t.innerHTML="<!--[if gt IE "+ ++e+"]><i></i><![endif]-->")&&n[0]);return e>4?e:!1}();return e},h.isInternetExplorer=function(){var e=h.isInternetExplorer.cached=typeof h.isInternetExplorer.cached!="undefined"?h.isInternetExplorer.cached:Boolean(h.getInternetExplorerMajorVersion());return e},h.options.html4Mode?h.emulated={pushState:!0,hashChange:!0}:h.emulated={pushState:!Boolean(e.history&&e.history.pushState&&e.history.replaceState&&!/ Mobile\/([1-7][a-z]|(8([abcde]|f(1[0-8]))))/i.test(i.userAgent)&&!/AppleWebKit\/5([0-2]|3[0-2])/i.test(i.userAgent)),hashChange:Boolean(!("onhashchange"in e||"onhashchange"in r)||h.isInternetExplorer()&&h.getInternetExplorerMajorVersion()<8)},h.enabled=!h.emulated.pushState,h.bugs={setHash:Boolean(!h.emulated.pushState&&i.vendor==="Apple Computer, Inc."&&/AppleWebKit\/5([0-2]|3[0-3])/.test(i.userAgent)),safariPoll:Boolean(!h.emulated.pushState&&i.vendor==="Apple Computer, Inc."&&/AppleWebKit\/5([0-2]|3[0-3])/.test(i.userAgent)),ieDoubleCheck:Boolean(h.isInternetExplorer()&&h.getInternetExplorerMajorVersion()<8),hashEscape:Boolean(h.isInternetExplorer()&&h.getInternetExplorerMajorVersion()<7)},h.isEmptyObject=function(e){for(var t in e)if(e.hasOwnProperty(t))return!1;return!0},h.cloneObject=function(e){var t,n;return e?(t=l.stringify(e),n=l.parse(t)):n={},n},h.getRootUrl=function(){var e=r.location.protocol+"//"+(r.location.hostname||r.location.host);if(r.location.port||!1)e+=":"+r.location.port;return e+="/",e},h.getBaseHref=function(){var e=r.getElementsByTagName("base"),t=null,n="";return e.length===1&&(t=e[0],n=t.href.replace(/[^\/]+$/,"")),n=n.replace(/\/+$/,""),n&&(n+="/"),n},h.getBaseUrl=function(){var e=h.getBaseHref()||h.getBasePageUrl()||h.getRootUrl();return e},h.getPageUrl=function(){var e=h.getState(!1,!1),t=(e||{}).url||h.getLocationHref(),n;return n=t.replace(/\/+$/,"").replace(/[^\/]+$/,function(e,t,n){return/\./.test(e)?e:e+"/"}),n},h.getBasePageUrl=function(){var e=h.getLocationHref().replace(/[#\?].*/,"").replace(/[^\/]+$/,function(e,t,n){return/[^\/]$/.test(e)?"":e}).replace(/\/+$/,"")+"/";return e},h.getFullUrl=function(e,t){var n=e,r=e.substring(0,1);return t=typeof t=="undefined"?!0:t,/[a-z]+\:\/\//.test(e)||(r==="/"?n=h.getRootUrl()+e.replace(/^\/+/,""):r==="#"?n=h.getPageUrl().replace(/#.*/,"")+e:r==="?"?n=h.getPageUrl().replace(/[\?#].*/,"")+e:t?n=h.getBaseUrl()+e.replace(/^(\.\/)+/,""):n=h.getBasePageUrl()+e.replace(/^(\.\/)+/,"")),n.replace(/\#$/,"")},h.getShortUrl=function(e){var t=e,n=h.getBaseUrl(),r=h.getRootUrl();return h.emulated.pushState&&(t=t.replace(n,"")),t=t.replace(r,"/"),h.isTraditionalAnchor(t)&&(t="./"+t),t=t.replace(/^(\.\/)+/g,"./").replace(/\#$/,""),t},h.getLocationHref=function(e){return e=e||r,e.URL===e.location.href?e.location.href:e.location.href===decodeURIComponent(e.URL)?e.URL:e.location.hash&&decodeURIComponent(e.location.href.replace(/^[^#]+/,""))===e.location.hash?e.location.href:e.URL.indexOf("#")==-1&&e.location.href.indexOf("#")!=-1?e.location.href:e.URL||e.location.href},h.store={},h.idToState=h.idToState||{},h.stateToId=h.stateToId||{},h.urlToId=h.urlToId||{},h.storedStates=h.storedStates||[],h.savedStates=h.savedStates||[],h.normalizeStore=function(){h.store.idToState=h.store.idToState||{},h.store.urlToId=h.store.urlToId||{},h.store.stateToId=h.store.stateToId||{}},h.getState=function(e,t){typeof e=="undefined"&&(e=!0),typeof t=="undefined"&&(t=!0);var n=h.getLastSavedState();return!n&&t&&(n=h.createStateObject()),e&&(n=h.cloneObject(n),n.url=n.cleanUrl||n.url),n},h.getIdByState=function(e){var t=h.extractId(e.url),n;if(!t){n=h.getStateString(e);if(typeof h.stateToId[n]!="undefined")t=h.stateToId[n];else if(typeof h.store.stateToId[n]!="undefined")t=h.store.stateToId[n];else{for(;;){t=(new Date).getTime()+String(Math.random()).replace(/\D/g,"");if(typeof h.idToState[t]=="undefined"&&typeof h.store.idToState[t]=="undefined")break}h.stateToId[n]=t,h.idToState[t]=e}}return t},h.normalizeState=function(e){var t,n;if(!e||typeof e!="object")e={};if(typeof e.normalized!="undefined")return e;if(!e.data||typeof e.data!="object")e.data={};return t={},t.normalized=!0,t.title=e.title||"",t.url=h.getFullUrl(e.url?e.url:h.getLocationHref()),t.hash=h.getShortUrl(t.url),t.data=h.cloneObject(e.data),t.id=h.getIdByState(t),t.cleanUrl=t.url.replace(/\??\&_suid.*/,""),t.url=t.cleanUrl,n=!h.isEmptyObject(t.data),(t.title||n)&&h.options.disableSuid!==!0&&(t.hash=h.getShortUrl(t.url).replace(/\??\&_suid.*/,""),/\?/.test(t.hash)||(t.hash+="?"),t.hash+="&_suid="+t.id),t.hashedUrl=h.getFullUrl(t.hash),(h.emulated.pushState||h.bugs.safariPoll)&&h.hasUrlDuplicate(t)&&(t.url=t.hashedUrl),t},h.createStateObject=function(e,t,n){var r={data:e,title:t,url:n};return r=h.normalizeState(r),r},h.getStateById=function(e){e=String(e);var n=h.idToState[e]||h.store.idToState[e]||t;return n},h.getStateString=function(e){var t,n,r;return t=h.normalizeState(e),n={data:t.data,title:e.title,url:e.url},r=l.stringify(n),r},h.getStateId=function(e){var t,n;return t=h.normalizeState(e),n=t.id,n},h.getHashByState=function(e){var t,n;return t=h.normalizeState(e),n=t.hash,n},h.extractId=function(e){var t,n,r,i;return e.indexOf("#")!=-1?i=e.split("#")[0]:i=e,n=/(.*)\&_suid=([0-9]+)$/.exec(i),r=n?n[1]||e:e,t=n?String(n[2]||""):"",t||!1},h.isTraditionalAnchor=function(e){var t=!/[\/\?\.]/.test(e);return t},h.extractState=function(e,t){var n=null,r,i;return t=t||!1,r=h.extractId(e),r&&(n=h.getStateById(r)),n||(i=h.getFullUrl(e),r=h.getIdByUrl(i)||!1,r&&(n=h.getStateById(r)),!n&&t&&!h.isTraditionalAnchor(e)&&(n=h.createStateObject(null,null,i))),n},h.getIdByUrl=function(e){var n=h.urlToId[e]||h.store.urlToId[e]||t;return n},h.getLastSavedState=function(){return h.savedStates[h.savedStates.length-1]||t},h.getLastStoredState=function(){return h.storedStates[h.storedStates.length-1]||t},h.hasUrlDuplicate=function(e){var t=!1,n;return n=h.extractState(e.url),t=n&&n.id!==e.id,t},h.storeState=function(e){return h.urlToId[e.url]=e.id,h.storedStates.push(h.cloneObject(e)),e},h.isLastSavedState=function(e){var t=!1,n,r,i;return h.savedStates.length&&(n=e.id,r=h.getLastSavedState(),i=r.id,t=n===i),t},h.saveState=function(e){return h.isLastSavedState(e)?!1:(h.savedStates.push(h.cloneObject(e)),!0)},h.getStateByIndex=function(e){var t=null;return typeof e=="undefined"?t=h.savedStates[h.savedStates.length-1]:e<0?t=h.savedStates[h.savedStates.length+e]:t=h.savedStates[e],t},h.getCurrentIndex=function(){var e=null;return h.savedStates.length<1?e=0:e=h.savedStates.length-1,e},h.getHash=function(e){var t=h.getLocationHref(e),n;return n=h.getHashByUrl(t),n},h.unescapeHash=function(e){var t=h.normalizeHash(e);return t=decodeURIComponent(t),t},h.normalizeHash=function(e){var t=e.replace(/[^#]*#/,"").replace(/#.*/,"");return t},h.setHash=function(e,t){var n,i;return t!==!1&&h.busy()?(h.pushQueue({scope:h,callback:h.setHash,args:arguments,queue:t}),!1):(h.busy(!0),n=h.extractState(e,!0),n&&!h.emulated.pushState?h.pushState(n.data,n.title,n.url,!1):h.getHash()!==e&&(h.bugs.setHash?(i=h.getPageUrl(),h.pushState(null,null,i+"#"+e,!1)):r.location.hash=e),h)},h.escapeHash=function(t){var n=h.normalizeHash(t);return n=e.encodeURIComponent(n),h.bugs.hashEscape||(n=n.replace(/\%21/g,"!").replace(/\%26/g,"&").replace(/\%3D/g,"=").replace(/\%3F/g,"?")),n},h.getHashByUrl=function(e){var t=String(e).replace(/([^#]*)#?([^#]*)#?(.*)/,"$2");return t=h.unescapeHash(t),t},h.setTitle=function(e){var t=e.title,n;t||(n=h.getStateByIndex(0),n&&n.url===e.url&&(t=n.title||h.options.initialTitle));try{r.getElementsByTagName("title")[0].innerHTML=t.replace("<","&lt;").replace(">","&gt;").replace(" & "," &amp; ")}catch(i){}return r.title=t,h},h.queues=[],h.busy=function(e){typeof e!="undefined"?h.busy.flag=e:typeof h.busy.flag=="undefined"&&(h.busy.flag=!1);if(!h.busy.flag){u(h.busy.timeout);var t=function(){var e,n,r;if(h.busy.flag)return;for(e=h.queues.length-1;e>=0;--e){n=h.queues[e];if(n.length===0)continue;r=n.shift(),h.fireQueueItem(r),h.busy.timeout=o(t,h.options.busyDelay)}};h.busy.timeout=o(t,h.options.busyDelay)}return h.busy.flag},h.busy.flag=!1,h.fireQueueItem=function(e){return e.callback.apply(e.scope||h,e.args||[])},h.pushQueue=function(e){return h.queues[e.queue||0]=h.queues[e.queue||0]||[],h.queues[e.queue||0].push(e),h},h.queue=function(e,t){return typeof e=="function"&&(e={callback:e}),typeof t!="undefined"&&(e.queue=t),h.busy()?h.pushQueue(e):h.fireQueueItem(e),h},h.clearQueue=function(){return h.busy.flag=!1,h.queues=[],h},h.stateChanged=!1,h.doubleChecker=!1,h.doubleCheckComplete=function(){return h.stateChanged=!0,h.doubleCheckClear(),h},h.doubleCheckClear=function(){return h.doubleChecker&&(u(h.doubleChecker),h.doubleChecker=!1),h},h.doubleCheck=function(e){return h.stateChanged=!1,h.doubleCheckClear(),h.bugs.ieDoubleCheck&&(h.doubleChecker=o(function(){return h.doubleCheckClear(),h.stateChanged||e(),!0},h.options.doubleCheckInterval)),h},h.safariStatePoll=function(){var t=h.extractState(h.getLocationHref()),n;if(!h.isLastSavedState(t))return n=t,n||(n=h.createStateObject()),h.Adapter.trigger(e,"popstate"),h;return},h.back=function(e){return e!==!1&&h.busy()?(h.pushQueue({scope:h,callback:h.back,args:arguments,queue:e}),!1):(h.busy(!0),h.doubleCheck(function(){h.back(!1)}),p.go(-1),!0)},h.forward=function(e){return e!==!1&&h.busy()?(h.pushQueue({scope:h,callback:h.forward,args:arguments,queue:e}),!1):(h.busy(!0),h.doubleCheck(function(){h.forward(!1)}),p.go(1),!0)},h.go=function(e,t){var n;if(e>0)for(n=1;n<=e;++n)h.forward(t);else{if(!(e<0))throw new Error("History.go: History.go requires a positive or negative integer passed.");for(n=-1;n>=e;--n)h.back(t)}return h};if(h.emulated.pushState){var v=function(){};h.pushState=h.pushState||v,h.replaceState=h.replaceState||v}else h.onPopState=function(t,n){var r=!1,i=!1,s,o;return h.doubleCheckComplete(),s=h.getHash(),s?(o=h.extractState(s||h.getLocationHref(),!0),o?h.replaceState(o.data,o.title,o.url,!1):(h.Adapter.trigger(e,"anchorchange"),h.busy(!1)),h.expectedStateId=!1,!1):(r=h.Adapter.extractEventData("state",t,n)||!1,r?i=h.getStateById(r):h.expectedStateId?i=h.getStateById(h.expectedStateId):i=h.extractState(h.getLocationHref()),i||(i=h.createStateObject(null,null,h.getLocationHref())),h.expectedStateId=!1,h.isLastSavedState(i)?(h.busy(!1),!1):(h.storeState(i),h.saveState(i),h.setTitle(i),h.Adapter.trigger(e,"statechange"),h.busy(!1),!0))},h.Adapter.bind(e,"popstate",h.onPopState),h.pushState=function(t,n,r,i){if(h.getHashByUrl(r)&&h.emulated.pushState)throw new Error("History.js does not support states with fragement-identifiers (hashes/anchors).");if(i!==!1&&h.busy())return h.pushQueue({scope:h,callback:h.pushState,args:arguments,queue:i}),!1;h.busy(!0);var s=h.createStateObject(t,n,r);return h.isLastSavedState(s)?h.busy(!1):(h.storeState(s),h.expectedStateId=s.id,p.pushState(s.id,s.title,s.url),h.Adapter.trigger(e,"popstate")),!0},h.replaceState=function(t,n,r,i){if(h.getHashByUrl(r)&&h.emulated.pushState)throw new Error("History.js does not support states with fragement-identifiers (hashes/anchors).");if(i!==!1&&h.busy())return h.pushQueue({scope:h,callback:h.replaceState,args:arguments,queue:i}),!1;h.busy(!0);var s=h.createStateObject(t,n,r);return h.isLastSavedState(s)?h.busy(!1):(h.storeState(s),h.expectedStateId=s.id,p.replaceState(s.id,s.title,s.url),h.Adapter.trigger(e,"popstate")),!0};if(s){try{h.store=l.parse(s.getItem("History.store"))||{}}catch(m){h.store={}}h.normalizeStore()}else h.store={},h.normalizeStore();h.Adapter.bind(e,"unload",h.clearAllIntervals),h.saveState(h.storeState(h.extractState(h.getLocationHref(),!0))),s&&(h.onUnload=function(){var e,t,n;try{e=l.parse(s.getItem("History.store"))||{}}catch(r){e={}}e.idToState=e.idToState||{},e.urlToId=e.urlToId||{},e.stateToId=e.stateToId||{};for(t in h.idToState){if(!h.idToState.hasOwnProperty(t))continue;e.idToState[t]=h.idToState[t]}for(t in h.urlToId){if(!h.urlToId.hasOwnProperty(t))continue;e.urlToId[t]=h.urlToId[t]}for(t in h.stateToId){if(!h.stateToId.hasOwnProperty(t))continue;e.stateToId[t]=h.stateToId[t]}h.store=e,h.normalizeStore(),n=l.stringify(e);try{s.setItem("History.store",n)}catch(i){if(i.code!==DOMException.QUOTA_EXCEEDED_ERR)throw i;s.length&&(s.removeItem("History.store"),s.setItem("History.store",n))}},h.intervalList.push(a(h.onUnload,h.options.storeInterval)),h.Adapter.bind(e,"beforeunload",h.onUnload),h.Adapter.bind(e,"unload",h.onUnload));if(!h.emulated.pushState){h.bugs.safariPoll&&h.intervalList.push(a(h.safariStatePoll,h.options.safariPollInterval));if(i.vendor==="Apple Computer, Inc."||(i.appCodeName||"")==="Mozilla")h.Adapter.bind(e,"hashchange",function(){h.Adapter.trigger(e,"popstate")}),h.getHash()&&h.Adapter.onDomLoad(function(){h.Adapter.trigger(e,"hashchange")})}},(!h.options||!h.options.delayInit)&&h.init()}(window);﻿var runnable = function(sumeru){
    Library.asyncCallbackHandler = sumeru.Library.create(function(exports){
        /**
         * 用于解决多个异步请求，共用一个callback
         * callback 这个还不知道在哪里运行呢，所以，里面用到的变量一定要放到这个函数的闭包中。
         * timeout 如果有设置timeout，则在enableCallback之后设置定时器，如果时间到了异步调用还没有执行完，就直接调用callback。callback只能被调用一次。
         * useage：
            cbHandel = Library.asyncCallbackHandler.create(callback);
            cbHandel.add();
            cbHandel.decrease();
            cbHandel.enableCallback();//所有的请求都发送完毕后调用
         */
        var _asyncCallbackHandler = function(callback,timeout){
            this.counter = 0;
            this.callbacked = false;
            this.callback = function(){//保证callback只被调用一次
                if(!this.callbacked){
                    callback();
                    this.callbacked = true;
                }
            };
            this._enableCallback = false;//表示所有请求都已经发送，可以callback了
            if(timeout)this.timeout = timeout;
            this.timeoutFunc = null;
        };

        _asyncCallbackHandler.prototype = {
            add:function(){
                this.counter++;
            },
            decrease:function(){
                this.counter--;
                if(this._enableCallback&&this.counter===0){
                    this.callback();
                }
            },
            enableCallback:function(){
                this._enableCallback = true;
                if(this.timeout){
                    this.timeoutFunc = setTimeout((function(obj){
                                                        obj.callback();
                                                    })(this),this.timeout);
                };
                if(this._enableCallback&&this.counter===0){
                    this.callback();
                }
            }
        };

        exports.create = function(callback,timeout){
            return new _asyncCallbackHandler(callback,timeout);
        };
        return exports;
    });
};

if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
}

;var runnable = function(fw){
	
fw.addSubPackage('oquery');
var oQuery = {};
oQuery.OPERATORS = [
						["=", ">=", ">", "<=", "<", "!=", "LIKE", "IN","FUNC"],
						["AND"],
						["OR"]
					];
oQuery.OPENOPERATORS = ["=", ">=", ">", "<=", "<", "!=", "LIKE", "IN"];
oQuery.isUnitOp = function(op){
	return oQuery.OPERATORS[0].indexOf(op)>=0;
}

oQuery.query = function(item,q){
	var resultValue = false,subQ;
	for (op in q){
		if(oQuery.isUnitOp(op)){
			if(op == "FUNC"){
				var _func = q[op];
				if(_func instanceof Function){
					resultValue = oQuery.unitOp(op,
											_func,
											item);
				}else{
					resultValue = false;
					console.error("value is not a function.");
				}
			}else{
				resultValue = oQuery.unitOp(op,
											item.get(q[op]["key"]),
											q[op]["value"]);
			}
		}else{
			subQ = q[op];
			if(op=="AND"){
				resultValue = true;
				for(var i=0,l=subQ.length;i<l;i++){
					resultValue = oQuery.query(item,subQ[i])&&resultValue;
					if(!resultValue) break;
				}
			}else if (op=="OR"){
				for(var i=0,l=subQ.length;i<l;i++){
					resultValue = oQuery.query(item,subQ[i])||resultValue;
					if(resultValue) break;
				}
			}
		}

	}
	return resultValue;
}
//元计算
oQuery.unitOp = function(op,a1,a2){
	var resultValue = false;
	switch(op){
		case "=":
			if(a1 === a2){
				resultValue = true;
			}
			break;
		case ">=":
			if(a1 >= a2){
				resultValue = true;
			}
			break;
		case ">":
			if(a1 > a2){
				resultValue = true;
			}
			break;
		case "<=":
			if(a1 <= a2){
				resultValue = true;
			}
			break;
		case "<":
			if(a1 < a2){
				resultValue = true;
			}
			break;
		case "!=":
			if(a1 != a2){
				resultValue = true;
			}
			break;
		case "LIKE":
			if((a1+"").indexOf(a2)>=0){
				resultValue = true;
			}
			break;
		case "IN":
			if(a2.indexOf(a1)>=0){
				resultValue = true;
			}
			break;
		case "FUNC":
			resultValue = !!(a1.call(this,a2));
			break;
		default:
			resultValue = false;
			console.error("unit operator not support.");
	}
	
	return resultValue;
}
fw.oquery.__reg('_query', oQuery.query, 'private');
fw.oquery.__reg('_queryop', oQuery.OPENOPERATORS, 'private');

	
}
if(typeof module !='undefined' && module.exports){
	module.exports = runnable;
}else{
    runnable(sumeru);
};var runnable = function(fw){
	
fw.addSubPackage('validation');
var oValidation = oValidation||{};
oValidation.copyArgs = function(args){
	var _args = [];
	for(var i=0,ilen=args.length; i<ilen; i++){
		_args.push(args[i]);
	}
	return _args;
};
oValidation.validations = {};

/**
 * 将验证结果转换为msg，需要替换的是
 * $1  ->  label：验证的字段label

 * $2  ->  传入验证func/asyncFunc的第一个参数 eg：length[1,20] ,其中1为$2 20为$3
 * $3  ->  按上例类推
 */
oValidation.getErrorMsg = function(result,label,validation){
	//console.log(JSON.stringify(arguments));
	var _msgTemp="";
	if(oValidation.validations[validation]&&oValidation.validations[validation]["msg"]){
		if(Library.objUtils.isNumber(result)&&result>=0){
			_msgTemp = oValidation.validations[validation]["msg"][result];
		}else{
			_msgTemp = oValidation.validations[validation]["msg"];
		}
		_msgTemp = _msgTemp.replace("$1",label);
		for(var i=2,len=arguments.length;i<len;i++){
			_msgTemp = _msgTemp.replace("$"+(i-1),arguments[i]);
		}
	}
	return _msgTemp;
};
/**
 * 这里比较奇葩，验证通过返回false，否则返回result obj
 */
oValidation.unitValidation = function(runat,label,key,value,validation,callback,modelObj){//这里的callback参数只有在asyncFunc时，如果是func，则是arg1。。。，如果是regexp则没有这个参数
	/*
	 * 这个函数的arguments最后会拼装到func/asyncFunc/getErrorMsg 作为参数
	 */

	var returnvalue = true,errorMsg="";
	if(Library.objUtils.isFunction(validation)){
		returnvalue = validation.call(this,value);
	}else if(Library.objUtils.isRegExp(validation)){
		returnvalue = validation.test(value);
	}else if(Library.objUtils.isString(validation)){
		var vali = oValidation.validations[validation];
		if(vali){
			if(vali.runat.indexOf(runat)<0&&vali.runat!='both'){return false};//判断与预定义的运行方是否一致
			if(vali["regexp"]){
				returnvalue = (new RegExp(vali["regexp"])).test(value);
			}else if(vali["func"]){
				var _args = oValidation.copyArgs(arguments);
				_args.splice(0,5,value);

				returnvalue = vali["func"].apply(this,_args);
			}else if(vali["asyncFunc"]){
				vali["asyncFunc"].call(this,callback,key,value,modelObj);
				return "asyn";
			}
		}
	}
	if(!returnvalue||(Library.objUtils.isNumber(returnvalue)&&returnvalue>=0)){

		var _args = oValidation.copyArgs(arguments);
		_args.splice(0,5,returnvalue,label,validation);
		errorMsg = oValidation.getErrorMsg.apply(this,_args);

		returnvalue = {"value":returnvalue,"msg":errorMsg}
	}else{
		returnvalue = false;
	}
	return returnvalue;
};
oValidation.clientValidation = function(label,key,value,validation){
	var _args = oValidation.copyArgs(arguments);
	_args.unshift("client");
	return oValidation.unitValidation.apply(this,_args);
};
oValidation.serverValidation = function(label,key,value,validation){
	var _args = oValidation.copyArgs(arguments);
	_args.unshift("server");
	return oValidation.unitValidation.apply(this,_args);
};

oValidation.isAsynVali = function(valiKey){
	return (typeof oValidation.validations[valiKey] != 'undefined')
			&&(typeof oValidation.validations[valiKey]['asyncFunc'] != 'undefined');
};
/**
 * 用户自定义validation rule，可覆盖默认的validation，
 */
oValidation.addRule = function(key,value){
	oValidation.validations[key] = value;
};
fw.validation.__reg('addrule', oValidation.addRule, 'publish');
fw.validation.__reg('_svalidation', oValidation.serverValidation, 'private');
fw.validation.__reg('_cvalidation', oValidation.clientValidation, 'private');
fw.validation.__reg('_getvalidationmsg', oValidation.getErrorMsg , 'private');
fw.validation.__reg('_isasynvali', oValidation.isAsynVali , 'private');
};


if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
};var runnable = function(fw){
	fw.validation.addrule("length" , {
										"runat":"both",
										"func":function(v,min,max){
											var v = v+""||"",
												len = v.length;
											if(len>parseInt(max)){
												if(len<parseInt(min)){
													return 0;
												}
												return 1;
											}else if(len<parseInt(min)){
												return 2;
											}else{
												return -1;
											}
										},
										"msg":["$1长度不能大于$3，且不能小于$2。","$1长度不能大于$3。","$1长度不能小于$2。"]
									});
	fw.validation.addrule("minlength" , {
										"runat":"both",
										"func":function(v,min){
											var v = v+""||"",
												len = v.length;
											return len>parseInt(min);
										},
										"msg":"$1长度不能小于$2。"
									});
	fw.validation.addrule("maxlength" , {
										"runat":"both",
										"func":function(v,max){
											var v = v+""||"",
												len = v.length;
											return len<parseInt(max);
										},
										"msg":"$1长度不能大于$2。"
									});
	fw.validation.addrule("required" , {
										"runat":"both",
										"func":function(v){
											var v = typeof v != "undefined"?v+"":"";
											var len = v.length;
											return len>0;
										},
										"msg":"$1为必填项。"
									});
	fw.validation.addrule("number" , {
										"runat":"both",
										"regexp":"^[0-9]+$",
										"msg":"$1必须为数字。"
									});
	fw.validation.addrule("telephone" , {
										"runat":"both",
										"regexp":"^(0[0-9]{2,3}\-)?([2-9][0-9]{6,7})+(\-[0-9]{1,4})?$",
										"msg":"$1必须为电话号码格式。"
									});
	fw.validation.addrule("mobilephone" , {
										"runat":"both",
										"regexp":"(^0?[1][358][0-9]{9}$)",
										"msg":"$1必须为手机号码格式。"
									});
	fw.validation.addrule("email" , {   
										"runat":"both",
										"regexp":"^[a-zA-Z0-9_\.\+\-]+\@([a-zA-Z0-9\-]+\.)+[a-zA-Z0-9]{2,4}$",
										"msg":"$1必须为email格式。"
									});
	fw.validation.addrule("onlyletter" , {
										"runat":"both",
										"regexp":"^[a-zA-Z]+$",
										"msg":"$只能是字母。"
									});
	fw.validation.addrule("nospecialchars" , {
										"runat":"both",
										"regexp":"^[0-9a-zA-Z]+$",
										"msg":"$1不能包含特殊字符。"
									});
	fw.validation.addrule("date" , {
										"runat":"both",
										"regexp":"^[0-9]{2,4}[\/\-]{1}[0,1]{0,1}[0-9]{1}[\/\-]{1}[0,3]{0,1}[0-9]{1}$",
										"msg":"$1格式不正确。"
									});
	fw.validation.addrule("chinese" , {  
										"runat":"both", 
								        "regexp":"/^[\u4e00-\u9fa5]+$/",
										"msg":"$1必须为中文。"
								    });
	fw.validation.addrule("url" , {   
										"runat":"both",
								        "regexp":"/^[a-zA-z]:\\/\\/[^s]$/",
										"msg":"$1必须为URL。"
								    });
	fw.validation.addrule("unique" , {
									    /**
									     * asyncFunc 这个东西存在的理由是，有些验证是需要用到server端的特性的，比如查数据库
									       典型的应用场景：用户名不重复验证

									       这里的asyncFunc是在server端运行，其中测callback是server端生成的。
									       this == dbCollectionHandle
									     */
										"runat":"server",
								        "asyncFunc":function(callback,k,v,modelObj){
								        	var where = {};
								        	where[k] = v;
								        	this.find(where).toArray(function(err,items){
								        		var result = true;
								        		if(!err){
								                	if(items.length>0){
								                		result = false;
								                	}
								                	callback.call(this,err,result);
								                }else{
								                	callback.call(this,err);
								                }
								        	});
								    	},
										"msg":"$1不能重复。"
								    });
}

//for node
if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
}
;Model = typeof Model == 'undefined' ? {} : Model;

var runnable = function(fw){

	cmodel.__reg('models', []);//等echo交换
	
	var modelTools = {
		/**
		 * 定义model属性的getter/setter方法，这些方法在创建modeltemp时就生成了，这些方法仅供开发者调用。
		 */
		defineProperty:function(property){
			Object.defineProperty(this, property,{
				get:function(){
					return this.__smr__.dataMap[property];
				},
				set:function(v){
					if(v!=this.__smr__.dataMap[property]){
						this.__smr__.dataMap[property]=v;
						this._setDirty();
					}
				}
			});
		},
		/**
		 * 将输入的对象的某些方法，包装成不可修改的方法
		 */
		setDefineProperties:function (targetObj,propertyMap,configueable,writable,enumerable){
			var configueable = configueable||false,
				writable = writable||false,
				enumerable = enumerable||false;
			if(typeof Object.defineProperty != 'undefined'){
				for(var p in propertyMap){
					Object.defineProperty(targetObj,p,
						{
							value:propertyMap[p],
							configueable:configueable,
							writable:writable,
							enumerable:enumerable
						}
					);
				}
			}else{
				for(var p in propertyMap){
					targetObj[p] = propertyMap[p];
				}
			}
		}
	};

	/**
	 * 所有model 的 function lib、常量
	 * 以_开头的函数为内部函数
	 * model的状态由用户来调用来改变  save 来改变。。。
	 */
	var modelBaseProto = {
		_isModel:true,
		_idField : 'smr_id',
		_clientIdField : '__clientId',

		//return true：need save
		_isClean	:	function(){
			return !this.__smr__.isDirty && !this.__smr__.isPhantom;
		},
		_isDeleted :	function(){
			return this.__smr__.isDeleted;
		},
		_setDirty : function(status){
			status = typeof status == 'undefined' ? true : status;
			this.__smr__.isDirty = !!status;
		},
		_setDeleted : function(status){
			status = typeof status == 'undefined' ? true : status;
			this.__smr__.isDeleted = !!status;
		},
		_setPhantom : function(status){
			status = typeof status == 'undefined' ? true : status;
			this.__smr__.isPhantom = status;
			this.set(this._idField, 0);
			this.set(this._clientIdField, fw.__random());
		},
		_setModelChain :function(parentModelChain,fieldKey){
			this.__smr__.modelchain = parentModelChain.slice(0);
			this.__smr__.modelchain.push(fieldKey);
		},
		_getModelChain :function(){
			return this.__smr__.modelchain;
		},
		_delete : function(key){
			this.__smr__.dataMap[key] = undefined;
		},
		/**
		 * 将数据设置为clean状态，不触发保持的状态
		 */
		_clean :function(){
			this.__smr__.isDirty = false;
			this.__smr__.isDeleted = false;
			this.__smr__.isPhantom = false;
			var key;
			for (key in this._fieldsMap) {
				var field = this._fieldsMap[key];
				var fieldType = field['type'];
				if(fieldType === 'model'){
					this[key]._clean();
				}
			}
		},
		_getModelName : function(){
			return this._modelName;
		},
		/**
		 * 最简单的set数据，不设置任何状态,也不做任何参数检测
		 */
		_baseSet : function(key,val){
			this.__smr__.dataMap[key] = val;
		},
		/**
		 * 如果val是model或collection，就直接插入。
		 * isDirty subModel的状态由它自己负责
		 * isPhantom 只在set fieldId的时候设置
		 */
		_set : function(key, val, isDirty){

			if (key in this._fieldsMap) {
				var field = this._fieldsMap[key];
				var fieldType = field['type'];
				if(fieldType === 'model'){
					var fieldModelName = field['model'];
					var fieldModelRelation = field['relation'];
					if(fieldModelRelation==='many'){
						if(val._isCollection){
							if(val._getModelName()===fieldModelName){
								this._baseSet(key, val);
							}else{
								fw.log('model.set arguments format error');
							}
						}else{
							if(this[key]._isCollection){
								this[key].truncate();
							}else{
								this._baseSet(key, fw.collection.create({modelName:fieldModelName}));
							}
							var newModel;
							for(var i = 0, l = val.length; i < l; i++){
							    //传进来的可能是model对象，也可能已经是dataMap
							    if(val[i]._isModel){
							        newModel = val[i];
							    }else{
							    	newModel = cmodel.create(fieldModelName,val[i]);
							    }
								this[key].add(newModel);
							}
						}
					}else{
						if(val._isModel){
							if(val._getModelName()===fieldModelName){
								this._baseSet(key, val);
							}else{
								fw.log('model.set arguments format error');
							}
						}else{
							this._baseSet(key, cmodel.create(fieldModelName,val));
						}
					}
				}else{
					if(this[key] === val){
						return this;
					}
					this[key] = val;
					if (key == this._idField && val != 0) {
					    this.__smr__.isPhantom = false;
					};
				}
				this._setDirty(isDirty);
			}
			
			return this;
		},
		_setData:function(dataMap,isDirty){
			var dataMap = dataMap || {};
			for (var i in dataMap){
				this._set(i, dataMap[i],isDirty);//所有子model都是！dirty
			}
			this._setDirty(isDirty);
		},
		/**
		 * arguments:(key,val) 或 dataMap
		 */
		set : function(key, val){
			var argslen = arguments.length;
			var dataMap;
			if(argslen==1){
				dataMap = arguments[0];
				if(Library.objUtils.isObject(dataMap)){
					for(var p in dataMap){
						this._set(p, dataMap[p], true);
					}
				}
			}else if(argslen==2){
				this._set(key, val, true);
			}
		},
		_setPilotId : function(pilotid){
			this.__smr__.pilotid = pilotid;
		},
		_getPilotId : function(){
			return typeof this.__smr__.pilotid == 'undefined' ? false:this.__smr__.pilotid;
		},
		_setStorable : function(){
			fw.msgpilot.setPilot(this);
		},
		toJSON : function(){
			var resuleJSON = {};
			for(key in this.__smr__.dataMap){
				if(this._fieldsMap[key]
					&&this._fieldsMap[key]["type"]=="model"){
					/**
					 * 根据model中的定义来判断实际数据是否是model/collection，
					 * model/collection都有同名方法getJSON
					 */
					resuleJSON[key] = this.__smr__.dataMap[key].toJSON(); 
				}else{
					resuleJSON[key] = this.__smr__.dataMap[key];
				}
			}
			return resuleJSON;
		},

		/**
		 * 将当前状态保存为snapshot
		 */
		_takeSnapshot : function(){
	        this.__smr__.dataMapSnapshot = cmodel._extend({}, this.__smr__.dataMap);
		},
		_getSnapshot : function(){
			return this.__smr__.dataMapSnapshot;
		},
		get : function(key){
			return this.__smr__.dataMap[key];
		},
		getId : function(){
		  return this.__smr__.dataMap[this._idField];  
		},
		getData : function(){
			return this.toJSON();
		},
		destroy : function(){
			this.__smr__.isDeleted = true;
			this._setDirty();
		},
		/**
		 * 返回验证失败的key value validation
		 */
		validation : function(fieldKey){
			if(!fw.config.get('clientValidation'))return true;
			var resultObjs = [],oneField,label,validations,validation,validationMsg,type,value,resultObj;

			var createFaildObj = function(key,value,validationResult){
				var _obj = {};
				_obj["key"] = key;
				_obj["value"] = value;
				_obj["msg"] = validationResult["msg"];
				return _obj;
			};
			//组合子model或collection的faild obj
			var createSubFaildObj = function(key,value,faildObj){
				var _obj = {}
				_obj["key"] = key+"."+faildObj["key"];
				/*_obj["value"] = [faildObj["value"][0]];//这个改动是为了移除中间的引用。_obj["value"] = faildObj["value"];
				_obj["value"].push(value);*/
				_obj["value"] = faildObj["value"][0];
				_obj["msg"] = faildObj["msg"];
				return _obj;
			};
			
			//验证oneField
			var oneFieldValidation = function(oneField){

				var label = oneField["label"]||oneField['name'],
				validation = oneField["validation"],
				validationMsg = oneField["validationMsg"],
				type = oneField["type"],
				value = this[oneField['name']],
				key = oneField['name'];
				if(validation){
					if(Library.objUtils.isString(validation)){
						validations = validation.split("|");
					}else{
						validations = [validation];
					}
					for(var i=0,len = validations.length;i<len;i++){
						//由于length是有参数的所以单独处理
						var _lengthMatch = (new RegExp("([min,max]*length)\\[([0-9]+)[\\,]*([0-9]*)\\]")).exec(validations[i]);
						if(_lengthMatch){
							if(_lengthMatch.length>=3){
								_lengthMatch.shift();
								_lengthMatch.unshift(value);
								_lengthMatch.unshift(key);
								_lengthMatch.unshift(label);
								var validationResult = fw.validation.__load('_cvalidation').apply(this,_lengthMatch);
								if(validationResult){
									resultObjs.push(createFaildObj(key,value,validationResult));
								}
							}
						}else{
							var validationResult = fw.validation.__load('_cvalidation').call(this,label,key,value,validations[i]);
							if(validationResult){
								resultObjs.push(createFaildObj(key,value,validationResult));
							}
						}
					}
				}else if(type=="model"){
					var _result = value.validation();
					for(var k=0,klen=_result.length;k<klen;k++){
						resultObj = createSubFaildObj(key,value,_result[k]);
						resultObjs.push(resultObj);
					}
				}
			};

			if(typeof fieldKey != 'undefined'){
				oneFieldValidation.call(this,this._fieldsMap[fieldKey]);
			}else{
				for(var p in this._fieldsMap){
					oneField = this._fieldsMap[p];
					oneFieldValidation.call(this,oneField);
				}
			}
			var ispass = false;
			if(resultObjs.length === 0){
				ispass = true;
			}
			if(this.onValidation){
				this.onValidation.call(this, ispass, 'client', resultObjs);
			}
			return resultObjs;
		},
		_save : function(callback, pubname, pilotid, isSubSave){
			var pilotid = pilotid||this._getPilotId();
			if(!pubname&&!pilotid){
				this._setStorable();
				pilotid = this._getPilotId();
			}
			//subSave是不需要validation的，因为validation是多层的。
			if(!isSubSave){
				var validationResult = this.validation();
				if(validationResult.length>0){
					return validationResult;
				}
			}
			callback = callback || function(){};

			var self,//model本体
				_self;//用来执行save的model分身。
			if(!isSubSave){//非
				self = this;
				_self = cmodel._extend(createModel(this._getModelName()), self);
				_self.__smr_assist__.__extendPointer = self;
				_self.__smr_assist__.__pkgId = fw.__random();
			}else{
				_self = this;
				self = _self.__smr_assist__.__sourcePointer[0];
			}
			var	hasModel = false,
				toSave = _self.__smr__.dataMap,
				
				//状态位
				hasSaved = false,

				//这里是一个model的对应的save
				doSave = function(callback){
					//判断里面是否有没有序列化的model，如果有则认为现在还没有到能save的时候。
					for (var i in toSave) {

						if (toSave[i]&&toSave[i]._isCollection) {
							for (var x = 0, y = toSave[i].length; x < y; x++) {
								if (toSave[i].get(x) && toSave[i].get(x)._isModel) {
									if(toSave[i].get(x)._isClean()){
										continue;
									}
									
									if (toSave[i].get(x).getData().isReference) {
									    continue;
									};
									//还有 model没被序列化就等一下，还会有其他callback来调的。
									return;
								}
							}
						}else if (toSave[i]&&toSave[i]._isModel) {
							if(!toSave[i]._isClean() && !toSave[i].getData().isReference){
								return;
							}
						}
					}
					
					
					//hasSaved 这个东西的存在是为了阻止save后的从submodel来的callback
					if(hasSaved){
						return;
					}
					hasSaved = true;

					//保存成功的事件钩子，但是没用了
					/*var _callback = function(callback,isSubSave){
						return function(){
							callback.apply(this,arguments);
							if(!isSubSave){
								if (typeof this.onSaved != 'undefined') {
									this.onSaved.call(this);
								};
							}
						};
					}(callback,isSubSave);*/
					var _callback = function(data){
						callback.call(_self, data);
					}

					_self._proxy.save(_self, _callback, pubname, pilotid, _self._getModelChain().join('.'));
				},

				//save subModel
				saveModel = function(_model){
					var _model = _model;

					//对于干净的，无需二次存储，直接转换为reference
					if(_model._isClean()){

							_model.__smr__.dataMap = {
	                            isReference : true,
	                            val :   '::referenceID::' + _model._getModelName() + '::' + _model.getId()
	                        };
						return;
					}
					hasModel = true;
					//save完后要把给原指针的id和dirty改掉
					_model._save((function(_model){
						    return function(data){
								var id = data.cnt.smr_id;
		                        _model.__smr_assist__.__sourcePointer[0].set(_model._idField, id);
		                        _model.__smr_assist__.__sourcePointer[0]._setDirty(false);
		                        
	                            _model.__smr__.dataMap = {
	                                isReference : true,
	                                val :   '::referenceID::' + _model._getModelName() + '::' + id
	                            };
	                            //在sub model的save callback中出发main model的save
		                        doSave(callback);   
		                    }
						})(_model), pubname, pilotid, true);
				};

			for (var i in toSave) {


				if (toSave[i]&&toSave[i]._isCollection) {
					for (var x = 0, y = toSave[i].length; x < y; x++) {
						if (toSave[i].get(x)._isModel) {
							toSave[i].get(x)._setModelChain(_self._getModelChain(),i);
							saveModel(toSave[i].get(x));
						}
					}
					
					if(toSave[i].length === 0){
						//这里不能删除空model数组，否则本地随动反馈会出现undefined。对空数组的删除向下放到dal层处理
						//delete toSave[i];
					}
				}else if(toSave[i]&&toSave[i]._isModel){
					toSave[i]._setModelChain(_self._getModelChain(),i);
					saveModel(toSave[i]);
				}
			}
			if (!hasModel && !this._isClean()) {
				doSave(callback);
			}
			return true;
		},
		save : function(callback, pubname, pilotid){
			this._save(callback, pubname, pilotid, false);
		},
		/**
		 * @ispass true:'验证通过',false:'验证失败
		 * @runat 'client':客户端验证结果,'server':服务端验证结果
		 */
		onValidation : function(ispass, runat, validationResult){
		}
	}
	/**
	 * model 的基类，ta的原型是所有modle的基础方法，成员是每个用户定义model template的私有属性
	 */
	var modelBase = function(){
		this._modelName = "";
		this._dal = {type : 'live'};
		this._proxy = {};
		this._fieldsMap = {};
		this._fieldsMap[this._idField] = {name : this._idField, type	:	'int'};
		this._fieldsMap[this._clientIdField] = {name : this._clientIdField, type	:	'string'};
	};
	/**
	 * 目的是不让用户自定义方法覆盖model自身的方法
	 */
	modelTools.setDefineProperties(modelBase.prototype,modelBaseProto,false,false,true);
	/**
	 * 在构造函数中定义每个model实例都单独持有的属性
	 */
	var model = function(){
		this.__smr__ = {
			dataMap : {},
			dataMapSnapshot : {},
			//validationResult : {},
			isDirty : false,//是否被修改过但未上传
			isPhantom : true,//是否本地新创建
			isDeleted : false,//是否已被标记为删除
			modelchain : []//如果这个实例是个子model，这里面存的是其上层的model list 自顶向下顺序。
		};
		this.__smr_assist__ = {
			__sourcePointer:null,
			__extendPointer:null,
		}
	};

	
	/**
	 * 想法是：全局model的解析工作只做一次。
	 * 一个model的属性可以分为几部分
	 *		1、fw本身提供的方法，都放在modelFunc中，_funcname 为内部方法，funcname为外部方法；
	 *		2、全局内部属性__isModel
	 **************************以上在fw初始化时就生成了 这就是modelBase  不可修改，可枚举，不可删除**********************

	 *		3、每类model的属性\function
	 			1）fieldMap: name\type\relation\model\validation\defaultValue
	 				validation在这个位置
	 			2）function: 
	 **************************以上在第一次创建时通过getModelTemp生成，并放在cmodel.models中，以后每次用时直接取 不可修改，不可枚举，不可删除**********************

	 *		4、每个model独立的属性：
	 			dataMap,这个dataMap会直接挂在model obj上
	 **************************这里是产出设计model的时候用的 **********************

	 */

	/**
	 * 将用户定义的model，转换为真实使用的model原型存放在cmodel.models中。每个model只做一次转换。
	 */
	var getModelTemp = function(modelName){
		
		if(typeof cmodel.models[modelName] == 'undefined' ){

			//执行定义func，获得导出的config和方法等
			var exports = {},
				modelDef = cmodel._getModelDef(modelName);
			modelDef.call(this, exports);
			
			modelDef = exports;

			var newModelTemp = new modelBase();
			newModelTemp._modelName = modelName;
			
			if(typeof modelDef.config != 'undefined'){
				var fields = modelDef.config.fields || [],
					oneField;
				
				//FIXME 理论上 我只准备在model上保留_fieldsMap了
				//newModelTemp.fields = fields;
				
				for(var i = 0, l = fields.length; i < l; i++){
					
					oneField = fields[i];
					
					newModelTemp._fieldsMap[oneField['name']] = oneField;

					//FIXME 这里还要把validation的函数生成出来。还不确定是不是要这样干。
					
				}
				
				var dal = modelDef.config.layer || newModelTemp._dal;
				newModelTemp._proxy = fw.__DAL.make(dal);
			}
			
			/**
			 * 复制用户自定义方法到modeltemp上，由于modelbase使用了不可修改和覆盖的方式。所以这里既是覆盖了也是无效的。
			 */
			for(var key in modelDef){
				if(!modelDef.hasOwnProperty(key)){
					continue;
				}
				if(key == 'config'){
					continue;
				}
			
				newModelTemp[key] = modelDef[key];
			}

			
			cmodel.models[modelName] = newModelTemp;
			
		}
		return cmodel.models[modelName];
	}


	/**
	 * 组装model
	 */
	var createModel = function(modelName,dataMap){
		//获取model模板
		var modelTemp = getModelTemp(modelName);

		//创建model对象，继承model模板
		var newModel = new model();
		newModel.__proto__ = modelTemp;

		var _fieldsMap = modelTemp._fieldsMap, oneField;

		for(var p in _fieldsMap){
			oneField = _fieldsMap[p];
				//定义getter/setter方法，后面的赋值都是通过getter/setter进行赋值的。
				modelTools.defineProperty.call(newModel,oneField['name']);

				if(oneField['type'] === 'model' && typeof oneField['model'] !== 'undefined'){
					if( typeof oneField['relation'] !== 'undefined' && oneField['relation']=='many'){
						//不默认创建任何Model对象
						//在这里创建一个子collection
						var subCollection = fw.collection.create({modelName  : oneField['model']});
						newModel[oneField['name']] = subCollection;
					}else{
						var subModel = cmodel.create(oneField['model']);
						newModel[oneField['name']] = subModel;
					}
					
					
				} else {
				    if (oneField['type'] == 'datetime' && oneField['defaultValue'] == 'now()') {
				        //解析now()
				        newModel[oneField['name']] = fw.utils.getTimeStamp();
				    } else if(oneField['type'] == 'array'){
				    	//FIXME array的默认值不应该是eval出来的，标记，以后要改
				    	newModel[oneField['name']] = eval(oneField['defaultValue']) || [];
				    } else if(oneField['type'] == 'object'){
						newModel[oneField['name']] = fw.utils.parseJSON(oneField['defaultValue']) || [];
				    } else {
	                    newModel[oneField['name']] = oneField['defaultValue'] || undefined; //其实后一个undefined不用写，只是为了更易读   
				    }
				}

		}
    	newModel._setPhantom();

		if(dataMap){
			newModel._setData(dataMap,false);
		}
		return newModel;
	};
	
    /**
     * 深度拷贝Model，Collection对象
     * param target,source-1,source-2...source-n
     */
    var extendModel =  function(){
        var objUtils = Library.objUtils;
        
        var options, name, src, copy, copyIsArray, copyIsCollection, copyIsModel, clone,
            target = arguments[0] || {},
            i = 1,
            length = arguments.length;
    
        // Handle case when target is a string or something (possible in deep copy)
        if ( typeof target !== "object" && !objUtils.isFunction(target) ) {
            target = {};
        }
        
        // if only one argument is passed, do nothing
        if ( length === i ) {
            return target;
        }
    
        for ( ; i < length; i++ ) {
            // Only deal with non-null/undefined values
            if ( (options = arguments[ i ]) != null ) {
                // Extend the base object
                for ( name in options ) {
                	//不拷贝原型链中的属性
                    if (!options.hasOwnProperty(name)) {
                        continue;
                    };
                    //不拷贝指针
                    if(name == '__smr_assist__'){
                        continue;
                    }
                    src = target[ name ];
                    copy = options[ name ];
    
                    // Prevent never-ending loop
                    if ( target === copy ) {
                        continue;
                    }
                    // Recurse if we're merging model objects, collection objects or arrays
                    if ( copy && ( objUtils.isPlainObject(copy) 
                                || (copyIsCollection = copy._isCollection)
                                || (copyIsModel = copy._isModel)
                                || (copyIsArray = objUtils.isArray(copy)) ) ) {

                        if ( copyIsArray ) {
                            copyIsArray = false;
                            clone = src && objUtils.isArray(src) ? src : [];
                        } else if(copyIsCollection){
                          copyIsCollection = false;  
                          
                          clone = src && src._isCollection ? src : fw.collection.create({modelName : copy._getModelName()});
                          
                        } else if(copyIsModel) {
                          copyIsModel = false;
                          clone = src && src._isModel ? src : cmodel.create(copy._getModelName());            
                          //留存一个指向原对象的指针
                          clone.__smr_assist__.__sourcePointer = copy.__smr_assist__.__sourcePointer || [];
                          clone.__smr_assist__.__sourcePointer.push(copy);
                          
                        } else {
                          clone = src && objUtils.isPlainObject(src) ? src : {};
                        }
    
                        // Never move original objects, clone them
                        target[ name ] = extendModel(clone, copy);
    
                    // Don't bring in undefined values
                    } else if ( copy !== undefined ) {
                        target[ name ] = copy;
                    }
                }
            }
        }

        // Return the modified object
        return target;
    }
	
    cmodel.__reg('create', createModel);
    cmodel.__reg('_extend', extendModel);
    cmodel.__reg('_getModelTemp', getModelTemp);
    
	
};

//客户端与服务器端的命名空间不同
var cmodel;
if(typeof module != 'undefined' && module.exports){//server运行
	module.exports = function(_fw){
		fw = _fw;
		cmodel = fw.addSubPackage('model');
		cmodel.__reg('_getModelDef', function(modelName){
			if (modelName.search("Model.") != -1 ) {//兼容客户端的modelName写法,客户端用Model.xxx,服务端用xxx
				modelName = modelName.substr(6);
			}
			return Model[modelName];
		});
		//兼容dal的错误
		if (typeof fw.__DAL == 'undefined'){
			fw.__DAL = {};
			fw.__DAL.make = function(){};
			fw.__DAL.make.save = function(){};
		}
		runnable(fw);
	}
	
}else{//client运行
	cmodel = sumeru.addSubPackage('model');
	//cmodel.__reg('models', []);//等echo交换
	cmodel.__reg('_getModelDef', function(modelName){
		return eval(modelName);
	});
	runnable(sumeru);
}
//for node
/*if(typeof exports != 'undefined'){
	exports.createModel = fw.__modelFactory;
}*/;/**
 * modelPoll package
 * 
 * provide local model poll
 * 
 * @author huangxin03@baidu.com
 */
 
var runnable = function(fw){
	
	fw.addSubPackage('modelPoll');
	var cmodel = fw.model;
    
	var ENABLE = true; //modelPoll开关
	var _pollMap = {};  //存modelPolls的实例

	function Poll(modelName) {
		this.modelName = modelName;
		this.dataMap = {}; //存modelPoll中model实例
	}

	Poll.prototype = {

		add : function(model){
			this.dataMap[model.smr_id] = model;
		},

		destroy : function(model){
			if(this.dataMap[model.smr_id]){
				delete this.dataMap[model.smr_id];
			} else {
				fw.log('Model', model, 'had been already destroyed earlier.');
			}
		},

		get : function(smr_id){
			return this.dataMap[smr_id];
		}
	}


	/**
	 * 获得modelPoll, 没有相应的modelPoll就new一个
	 */
	function getPoll(modelName){
		if(!_pollMap[modelName]){
			_pollMap[modelName] = new Poll(modelName);
		}
		return _pollMap[modelName];
	}

	function getModel(modelName, row){

		if(!ENABLE){ return cmodel.create(modelName, row);}

		var poll = getPoll(modelName);
		var newModel;

		if(poll.get(row.smr_id)){
			//池中已有的数据直接返回
			newModel = poll.get(row.smr_id);
			//更新model
			newModel._setData(row);
		}else{
			//池中没有的数据, 新建model
			newModel = cmodel.create(modelName, row);
			//入池
			if(row.smr_id){poll.add(newModel);}
		}
		return newModel;
	}

	function destroyModel(modelName, model){
		if(!ENABLE){ return; }
		if(modelName && model){
			var poll = getPoll(modelName);
			poll.destroy(model);
		}else{
			console.error('Please specify correct arugments.');
		}
		
	}

	function addModel(modelName, model){
		if(!ENABLE){ return; }
		var poll = getPoll(modelName);
		poll.add(model);
	}

	fw.modelPoll.__reg('data', _pollMap); //DELETE
	fw.modelPoll.__reg('getModel', getModel);
	fw.modelPoll.__reg('addModel', addModel);
	fw.modelPoll.__reg('destroyModel', destroyModel);
	
}
if(typeof module !='undefined' && module.exports){
    module.exports = function(fw){
    	runnable(fw);
    }
}else{//这里是前端
	runnable(sumeru);
};var runnable = function(fw){

	fw.addSubPackage('collection');

	var collectionTools = {

		/**
		 * 定义指定到[0]的model属性的getter/setter方法，主要在创建collection时使用
		 */
		defineProperty:function(property){
			Object.defineProperty(this, property,{

				get:function(){
					if(this.length>0){
						return this[0][property];
					}
				},
				set:function(v){
					for(var i=0,ilen=this.length;i<ilen;i++){
						this[i][property]=v;
					}
				}
			});
		},
	}

	collectionPrototype = {
		
		_isCollection : true,
		_setSynced : function(status){
			status = typeof status == 'undefined' ? false : status;
			this.__smr__.isSynced = !!status;
		},
		_isSynced : function(status){
			return this.__smr__.isSynced;
		},
		_setNeedSort: function(status){
			status = typeof status == 'undefined' ? true : status;
			this.__smr__.isNeedSort = !!status;
		},
		_takeSnapshot : function(){
			var allModels = this.find();
			allModels.forEach(function(item){
				item._takeSnapshot();
			});
		},
		_getModelName : function(){
			return this.__smr__.modelName;
		},
		_setPilotId : function(pilotid){
			this.__smr__.pilotid = pilotid;
		},
		_getPilotId : function(){
			return typeof this.__smr__.pilotid == 'undefined' ? false:this.__smr__.pilotid;
		},
		_setStorable : function(){
			fw.msgpilot.setPilot(this);
		},
		setVersion : function(version){
			this.__smr__.version = version;
		},
		getVersion : function(){
			return this.__smr__.version;
		},
		/**
		 * 将数据设置为clean状态，不触发保持的状态
		 */
		_clean :function(){
			var allModels = this.find();
			allModels.forEach(function(item){
				item._clean();
			});
		},

		/**
		 * 返回验证失败的key value validation
		 */
		validation : function(){
			if(!fw.config.get('clientValidation'))return true;
			if(arguments.length==0){
				var resultObjs = [],resultObj,model;
				for (var j = 0, jlen = this.length; j < jlen; j++){
					model = this[j];
					var _result = model.validation();
					if(_result!==true){
						resultObjs = resultObjs.concat(_result);
					}
				}

				var isPass = false;
				if(resultObjs.length === 0){
					isPass = true;
				}

				if(this.onValidation){
					this.onValidation.call(this, isPass, 'client', resultObjs);
				}
				return isPass||resultObjs;
			}else{
				//FIXME 考虑以后在这里提供验证某个字段的功能。
			}
		},
		
		add : function(row){
			var newModel;
			var modelName = this._getModelName();
			if (row._isModel) {
				if(row._getModelName() == modelName){
			    	newModel = row;
				}else{
					sumeru.log("collection.add arguments format error.")
				}
			}else{
				newModel = fw.modelPoll.getModel(modelName, row);
			};
			
			this.push(newModel);
			this._setSynced(false);
			this._setNeedSort();
			return true;
		},
		
		update : function(updateMap, where){
			var candidates = this.find.call(this, where);

			if(Library.objUtils.isObject(updateMap)){
				for(var x = 0, y = candidates.length; x < y; x++){
					candidates[x]._setData(updateMap,true);
				}
				this._setSynced(false);
				this._setNeedSort();
			}
		},
		
		//remove只是从collection中去除，并不实际删除。
		//所以不需要改变Synced状态
		remove : function(where){
			if(where._isModel){
				for (var j = 0, k = this.length; j < k; j++){
					if(this[j] == where){
						this.splice(j, 1);
						j--;
						k--;
						this._setNeedSort();
					}
				}
			}else{
				var candidates = this.find.apply(this, arguments);
				
				//FIXME 因为要兼容Find，做了两次遍历
				for (var i = 0, l = candidates.length; i < l; i++){
					for (var j = 0, k = this.length; j < k; j++){
						if(this[j] == candidates[i]){
							this.splice(j, 1);
							j--;
							k--;
							this._setNeedSort();
						}
					}
				}
			}
		},
		
		//从collection中实际删除。
		destroy : function(where){
			var candidates = this.find.apply(this, arguments);
			
			//FIXME 因为要兼容Find，做了两次遍历
			for (var i = 0, l = candidates.length; i < l; i++){
				for (var j = 0, k = this.length; j < k; j++){
					if(this[j] == candidates[i]){
						var item = this.splice(j, 1);
						j--;
						k--;
						item[0].destroy();
						
						this._setSynced(false);
						this._setNeedSort();
						
						
						//从modelPoll中删除此model
						fw.modelPoll.destroyModel(this._getModelName(), item[0]);
						//destroy因为是删除，splice之后collection就不可知了，所以不需要collection自己调save了，destroy直接调用model的
						item[0].save(function(){}, this.pubName, item[0]._getPilotId());
						
					}
				}
			}
		},
		
		setData :	function(data){
			this.length = 0;
			for(var i = 0, l = data.length; i < l; i++){
				this.add(data[i]);
			}
			this._setSynced(false);
			this._setNeedSort();
		},

		/**
		 * 从conditionMap 格式数据 format 为json数据。
		 * 典型的map有：__smr__.wheres
		 */
		_formatQuery : function(queryArr){
			var queryArr = queryArr||[];
			var qObj = {};
			if(Library.objUtils.isArray(queryArr)){
				qObj = {"AND":[]};
				for(var i=0,l = queryArr.length;i<l;i++){
					qObj["AND"].push(queryArr[i]);
				}
			}else if(Library.objUtils.isObject(queryArr)){
				qObj = this._formatUnitQuery(queryArr);
			}
			return qObj;
		},
		/**
		 * 参数可以是一个function，可以是{"a":1,"b >":12,"c IN":[1,2,3,4]}
		 */
		_formatUnitQuery : function(cunit,op){
			if(Library.objUtils.isFunction(cunit)){ //单个function
				return {"FUNC":cunit};
			}else if(Library.objUtils.isObject(cunit)){//包含单/多个key value的Array
				var cunitArr = [];
				for(var p in cunit){
					var cunitObj = {},cunitObjOp;

					//切分operator
					var _re = new RegExp("["+fw.oquery.__load('_queryop').join(",")+"]+$");
					var _p = p.replace(/^\s+|\s+$/g,"");
					var _re_arr = _re.exec(p);
					if(_re_arr&&_re_arr.length>0){
						_p = _p.replace(_re_arr[0]," "+_re_arr[0]);

						//p = p.replace(new RegExp("\\s+"+_re_arr[0],"g")," "+_re_arr[0]);
						_p = _p.replace(/\s+/," ");
					}

					var keys = _p.split(" ");//通过空格把field和operator分开
					if(keys.length==2){
						cunitObjOp = keys[1];
					}else{
						cunitObjOp = "=";
					}
					cunitObj[cunitObjOp] = {};
					cunitObj[cunitObjOp]["key"] = keys[0];
					cunitObj[cunitObjOp]["value"] = cunit[p];
					cunitArr.push(cunitObj);
				}
				if (cunitArr.length>1) {
					var op = op||"AND";
					var _cunitArr = cunitArr;
					cunitArr = {};
					cunitArr[op] = _cunitArr;
				}else{
					cunitArr = cunitArr[0];
				};
				return cunitArr;
			}
		},

		/**
		 * 所有传入的条件，都要通过这个func进行转换
		 */
		_addCondition :function(target,condition,op){
			if(typeof condition == 'undefined'){
				return;
			}else if(condition.length == 2){ //如果传入了两个参数，则为key, val
				var _t = {};
				_t[condition[0]] = condition[1];
				target.push(this._formatUnitQuery(_t,op));
			}else if(Library.objUtils.isObject(condition[0])
					||Library.objUtils.isFunction(condition[0])){ //单个function、单/多个key value的Array
				target.push(this._formatUnitQuery(condition[0],op));
			}
		},
		
		where : function(){
			this._addCondition(this.__smr__.wheres,arguments,"AND");
			return this;
		},
		orWhere : function(){
			this._addCondition(this.__smr__.wheres,arguments,"OR");
			return this;
		},
		_clearWheres :function(){
			this.__smr__.wheres.length = 0;
		},
		find : function(){
			var rs = [];
			this.sortIt();
			if(arguments.length > 0){
				this._addCondition(this.__smr__.wheres,arguments,"AND");
			}
			if(this.__smr__.wheres.length == 0){
				return this;
			}
			
			var item,
				isQualify,
				fieldKey;
				
			for(var i = 0, l = this.length; i < l; i++){
				item = this[i];
				
				if(item._isDeleted() === true){ //如果该model已经被删除
					this.splice(i, 1);
					i--;
					l--;
					continue;
				}

				isQualify = fw.oquery.__load('_query')(item,this._formatQuery(this.__smr__.wheres));

				if(isQualify == true){
					rs.push(item);
				}
			}
			
			this._clearWheres();
			return rs;
		},
		/**
		 * 取列数据
		 */
		pluck : function(fieldKey){
			if(!fieldKey)return [];
			var result = [];
			var rs = this.find();
			for(var i = 0, l = rs.length; i < l; i++){
				if(typeof rs[i][fieldKey] != 'undefined'){
					result.push(rs[i][fieldKey]);
				}
			}
			return result;
		},
		_oSort : function(sortArr){
			//元比较
			var unitComp = function(v1,v2,order){
				var returnValue = 0;
				var isString1 = (typeof v1.localeCompare != "undefined");
				var isString2 = (typeof v2.localeCompare != "undefined");
				switch(order){
					case "ASC":
						returnValue = isString1?v1.localeCompare(v2):v1-v2;
						break;
					case "DESC":
						returnValue = isString2?v2.localeCompare(v1):v2-v1;
						break;
					default:
						if(typeof order == "function"){
							returnValue = order.call(this,v1,v2);
						}
				}
				return returnValue;
			}
			var unitSort = function(a,b,sortArr){
				var returnValue = 0,
					_v1,_v2,_key,_order;
				if(sortArr.length>0){
					if(typeof sortArr[0] == "function"){
						returnValue = unitComp.call(this,a,b,sortArr[0]);
					}else{
						_key = sortArr[0]["key"];
						_order = sortArr[0]["value"];
						var _v1 = a.get(_key);
						var _v2 = b.get(_key);
						returnValue = unitComp.call(this,_v1,_v2,_order);

						if(sortArr.length>1&&returnValue==0){
							sortArr.shift();
							returnValue = unitSort.call(this,a,b,sortArr);
						}
					}
				}
				return returnValue;
			}
			return function(a,b){
				return unitSort(a,b,sortArr);
			}
		},
		_formatSorter : function(){
			var _order = "ASC",//默认升序
				_sorter = [];
			if(arguments.length==0){
				return;
			}else if(arguments.length==1){
				var _s = arguments[0];
				//function排序
				if(Library.objUtils.isFunction(_s)){
					_sorter.push(_s);
				}else if(Library.objUtils.isObject(_s)){
					for(var p in _s){
						if(/^ASC|DESC$/.test(_s[p])
							||Library.objUtils.isFunction(_s)){
							_order = _s[p];
						}
						_sorter.push({"key":p,
								"value":_order});
					}
				}else{
					_sorter.push({"key":_s,
								"value":_order});
				}
			}else{
				if(/^ASC|DESC$/.test(arguments[1])){
					_order = arguments[1];
				}
				_sorter.push({"key":arguments[0],
							"value":_order});
			}
			return _sorter;
		},
		addSorters : function(){
			this.__smr__.sorters = this.__smr__.sorters.concat(this._formatSorter.apply(this, arguments));
			this._setNeedSort();
		},
		clearSorters : function(){
			this.__smr__.sorters.length = 0;
			this._setNeedSort();
		},
		sortIt : function(){
			if(arguments.length>0){
				this.addSorters.apply(this, arguments);
			}
			if(this.__smr__.sorters.length==0
				|| !this.__smr__.isNeedSort){
				return;
			}
			
			this.sort(this._oSort(this.__smr__.sorters));
			
			this._setNeedSort(false);
		},
		
		get : function(index){
			index = index || 0;
			if(index >= this.length || index < 0){
				return undefined;
			}
			this.sortIt();
			var item,fieldKey,returnValue;
			if(!Library.objUtils.isNumber(index)){
				fieldKey = index;
				index = 0;
			}
			item = this[index];
				
			//如果发现被删除的，则循环找下一个。如果最终都找不到，返回undefined
			while(item._isDeleted() === true){ //如果该model已经被删除
				this.splice(index, 1);
				item = this[index];
			}
			if(fieldKey){
				return this[fieldKey];
			}
			return item;
		},
		set : function(key,val){
			this[key] = val;
		},
		
		stringify : function(){
			return JSON.stringify(this);
		},
		
		toJSON : function(){
			var ret = [];
			this.find().forEach(function(item){
				ret.push(item.getData());
			})
			return ret;
		},
		
		getData : function(){
		  return this.toJSON();  
		},
		
		save : function(isSubSave,isSecure){
            if(isSecure){
				this.__smr__.saveType = 'ensure';
            }else{
				this.__smr__.saveType = 'none';
            }
			if(!isSubSave){
				var validationResult = this.validation();
				if(validationResult.length>0){
					return validationResult;
				}
				
				if(!this.pubName){
					this._setStorable();
				}
			}
			
			for(var i = 0, l = this.length; i < l; i++){
				this[i].save(function(data){
					if(data.type === 'insert'){
						var modelObj = this;
						//1. 新增一条数据，更新smr_id
						modelObj.set('smr_id', data.cnt.smr_id);
						//2. 加入modelPoll中
						var modelName = 'Model.' + data.modelName;
						fw.modelPoll.addModel(modelName, modelObj);
					}
					
				}, this.pubName, this._getPilotId(), true);
			}

			//因为分配id的逻辑在model的save里，所以随动反馈在下面做，稍微晚了一点
            //在save的时候，直接通知本地update subscribe
        
            //FIXME 伪造一个消息发送给自己
            if(!isSecure){
            	this.render();
            }
			
			return true;
		},
		ensureSave : function(){
			this.save(false,true);
		},
		rollback : function(){
			for(var i = 0, l = this.length; i < l; i++){
				var item = this[i];
				var _snapshot = item._getSnapshot();
				if(_snapshot['smr_id']){
					item._setData(_snapshot);
				}else{
					this.remove(item);
					l--;
				}

			}
			this._clean();
		},
		//重新渲染数据
		render : function(){
			if(typeof this.pubName != 'undefined'){
	            fw.netMessage.sendLocalMessage({
	                pubname :   this.pubName,
	                data    :   ''
	            }, 'data_write_latency');
	        };
		},
		
		truncate : function(){
		    this.length = 0;
		},
		
		hold : function(){
		    this.__smr__.isHolding = true;
		},
		
		releaseHold : function(){
		    fw.pubsub._releaseHold(this);
		    this.__smr__.isHolding = false;
		},
		isEnsureSave : function(){
			return this.__smr__.saveType === 'ensure';
		},
		/**
		 * @ispass true:'验证通过',false:'验证失败
		 * @runat 'client':客户端验证结果,'server':服务端验证结果
		 */
		onValidation : function(ispass, runat, validationResult){
		}
	};
	var collectionBase = function(){
		var baseArray = [];
		for(p in collectionPrototype){
			baseArray[p] = collectionPrototype[p];
		}
		return baseArray;
	};
	var collection = function(){
		//collectionBase.call(this);
		this.__smr__ = {
			/**
			 * sorters的格式：
			 * ['字段名', 排序Func,...]
			 */
			sorters : [],
			isNeedSort : false,

			/**
			 * wheres(find后清除)的格式：
			 * [{key : value},{key : value,key : value,key : value}, ..., {key : function(){}}]
			 */
			wheres:[],

			/**
			 * 正在修改，或已经修改过。是否被延迟数据同步
			 */
			isHolding:false,
			modelName:'',
			dal:{type : 'live'},
			isSynced:false,
			/**
			 * none:数据在没有验证完成，不确定是否能正确存入的时候就进行渲染
			 * ensure:数据在验证通过后，再进行渲染
			 */
			saveType:'none',
			version: ''
		}
		return this;
	}
	collection.prototype = new collectionBase();
	var __collectionFactory = function(def,dataMap){
		//在这里将config送入工厂，产出Collection
		if(typeof def.modelName == 'undefined'){
			//根本没定义model的话，只能直接return了
			return false;
		};

		var instance = new collection();
	
		//定义getter/setter方法，读0写all。
		var modelTemp = fw.model._getModelTemp(def.modelName);
		var fieldsMap = modelTemp._fieldsMap;
		for(var p in fieldsMap){
			collectionTools.defineProperty.call(instance,fieldsMap[p]['name']);
		}

		instance.__smr__.modelName = def.modelName;
			
		if (def.sorters){
			instance.__smr__.sorters = def.sorters;
		}
		
		var dal = def.layer || instance.__smr__.dal;
		
		instance.__smr__.proxy = fw.__DAL.make(dal);
		
		if(dataMap){
			instance.setData(dataMap);
		}

		return instance;
	};
	


	/**
	 * for developer , storable
	 */
    fw.collection.__reg('create', function(def,dataMap){
    	var coll = __collectionFactory(def,dataMap);
    	coll._setStorable();
		return coll;
	});

    /**
     * for framework, unstorable
     */
    fw.collection.__reg('_create', function(def,dataMap){
		return __collectionFactory(def,dataMap);
	});
}
if(typeof module !='undefined' && module.exports){
	module.exports = runnable;
}else{
    runnable(sumeru);
};/**
  * usage: fw.domdiff.convert(htmlfragment,target);
  */

(function(fw){
    
  fw.addSubPackage('domdiff');

      var util = {
        make : function(t,c) { 
          var d = document.createElement(t); 
          if(c){
            if(c.innerHTML){
              d.innerHTML = c.innerHTML;
            }else{
              d.innerHTML = c;
            }
          }; 
          return d; },
        arrayCopy : function(arr) {
          var narr = [], a, l=arr.length;
          for(a=0; a<l; a++) { narr[a] = arr[a]; }
          return narr;
        },
        mergeAttrs : function(e1,e2){
          var attrs = [],
            e1as = e1.attributes,
            e2as = e2.attributes,
            len;
          if(e1as && e2as) {
            var helper = document.createElement(e1.nodeName); 

            for(len = e1as.length-1;len>=0;len--){
              helper.setAttribute(e1as[len].nodeName,e1as[len].nodeValue);
            }
            for(len = e2as.length-1;len>=0;len--){
              helper.setAttribute(e2as[len].nodeName,e2as[len].nodeValue);
            }
            for(len = helper.attributes.length-1;len>=0;len--){
              attrs.push(helper.attributes[len].nodeName);
            }
          };
          return attrs;
        },

        snapshot : function(list) {
          var newlist = [], i=0, last=list.length;
          for(;i<last;i++) { newlist.push(list[i]); }
          return newlist;
        },

        hashCode : function(str,undef) {
          if(str===null || str===undef) return 0;

          var hash = 0, i, last = str.length;
          for (i = 0; i < last; ++i) {
            hash = (hash * 31 + str.charCodeAt(i)) & 0xFFFFFFFF;
          }
          return hash;
        },

        /*递归实现element的hash*/
        hashAll : function(element, undef) {
          var child,
              last = (element.childNodes === undef ? 0 : element.childNodes.length),
              hash = 0,
              hashString = element.nodeName;

          if(element.attributes) {
            var attr,
                a,
                attributes = element.attributes,
                len = attributes.length;
            for (a=0; a<len; a++) {
              attr = attributes[a];
              hashString += attr.nodeName+":"+attr.nodeValue;
            }
          }

          hash = util.hashCode( (hashString+element.textContent).replace(/\s+/g,''));
          
          for(child = last-1; child >=0; child--) {
            hash = (hash * 31 + util.hashAll(element.childNodes[child])) & 0xFFFFFFFF;
          }
          
          element["hashCode"] = hash;
          return hash;
        },

        find: function(e,treeRoute) {
          var route = util.snapshot(treeRoute),
              pos = route.splice(0,1)[0];
          while(pos!==-1) {
            e = e.childNodes[pos];
            pos = route.splice(0,1)[0];
          }
          return e;
        }
      }

      var getDiff = function(e1, e2) {
        var route = equal(e1,e2),
            routes = [route],
            newRoute;

        while(typeof route === "object") {
          newRoute = equal(e1,e2,util.arrayCopy(route));
          routes.push(newRoute);
          route = newRoute;
        }

        // 删除最后一项，因为最后一项代表的是wrap的attributes对比结果。不需要care wrap的对比结果
        if(routes.length>1) { routes.splice(routes.indexOf(0), 1); }
        return routes;
      };

      var equal = function(e1, e2, after) {
        var soffset = (after && after.length!==0 ? after.splice(0,1)[0] : 0);
        if(soffset === -1) {
          return 0;
        }

        if(e1.nodeType !== e2.nodeType) {
          return -1;
        }

        // shortcut handling for text?
        if(e1.nodeType===3 && e2.nodeType===3) {
          if(e1.textContent.trim() != e2.textContent.trim()) {
            return -1;
          }
          return 0;
        }

        // different element (2)?
        if(e1.nodeName !== e2.nodeName) {
          return -1;
        }

        // different content?
        if(e1.childNodes.length !== e2.childNodes.length) {
          return -1;
        }

        // Different child node list?
        // Find where the first difference is
        var i, last = e1.childNodes.length, eq, ret;
        for(i=soffset; i<last; i++) {
          // recurse to see if these children differ
          eq = equal(e1.childNodes[i], e2.childNodes[i], after);
          if(eq !== 0)
          {
            // (first) difference found. "eq" will indicate
            // which childNodes position the diff is found at.
            return [i].concat(eq);
          }
        }

        // different attributes?
        var attrs = util.mergeAttrs(e1,e2),
            a, last = attrs.length,
            attr, a1, a2;

        for(a=0; a<last; a++) {
          attr = attrs[a];
          a1 = e1.getAttribute(attr);
          a2 = e2.getAttribute(attr);
          if(a1==a2 || (!a1 && a2=="") || (!a2 && a1=="")) continue;
          return -1;
        }

        // nothing left to fail on - consider
        // these two elements equal.
        return 0;
      };

      /**
       * Do these elements agree on their HTML attributes?
       *
       * @return array of [differing attribute, value in e1, value in e2] triplets
       */
      function outerEquality(e1, e2) {
        var diff = [];
        
        // do the tags agree?
        if(e1.nodeType===1 && e2.nodeType===1) {
          if(e1.nodeName !== e2.nodeName) {
            diff.push(["nodeName",e1.nodeName,e2.nodeName]);
          }
        }

        // do the attributes agree?
        if(e1.attributes && e2.attributes) {
          var attributes = e1.attributes,
              len = attributes.length,
              a, a1, a2, attr;
          
          // attribute insertion/modification diff
          for (a=0; a<len; a++) {
            attr = attributes[a].nodeName;
            a1 = e1.getAttribute(attr);
            a2 = e2.getAttribute(attr);
            if(a1==a2) continue;
            diff.push([attr,a1,a2]);
          }
          
          // attribute removal diff
          attributes = e2.attributes;
          len = attributes.length;
          for (a=0; a<len; a++) {
            attr = attributes[a].nodeName;
            a1 = e1.getAttribute(attr);
            a2 = e2.getAttribute(attr);
            if(a1==a2) continue;
            diff.push([attr,a1,a2]);
          }
        }
        return diff;
      };


      /**
       * Do these elements agree on their content,
       * based on the .childNodes NodeSet?
       *
       * @return a diff tree between the two elements
       */
      var innerEquality = function(e1, e2) {
        util.hashAll(e1);
        util.hashAll(e2);
        c1 = util.snapshot(e1.childNodes);
        c2 = util.snapshot(e2.childNodes);
        var localdiff = childDiff(c1,c2);
        return (localdiff.insertions.length > 0 || localdiff.removals.length > 0 || localdiff.relocations.length > 0 ?  localdiff : false);
      };


      /**
       * Does a nodeset snapshot of an element's
       * .childNodes contain an element that has
       * <hash> as hashing number?
       *
       * @return -1 if not contained, or the
       *         position in the snapshot if
       *         it is contained.
       */
      function getPositions(list, reference) {
        var hash = reference.hashCode,
            c, last = list.length, child,
            result = [];
        for(c=0; c<last; c++) {
          child = list[c];
          if(child.hashCode === hash) {
            result.push(c);
          }
        }
        return result;
      }


      /**
       * Create a diff between .childNode
       * snapshots c1 and c2.
       *
       * @return a local content diff
       */
      function childDiff(c1, c2) {
        var relocations = [],
            insertions = [],
            removals = [];

        var c, last=c1.length, child, hash, positions, pos;
        for(c=0; c<last; c++) {
          child = c1[c];
          positions = getPositions(c2, child);

          if(positions.length===0) continue;

          if(positions.length>1) continue;

          pos = positions[0];
          if(c!==pos && getPositions(c1, child).length <= 1) {
            relocations.push(c2[pos]);
            child["marked"] = true;
            c2[pos]["marked"] = true;
          }

          else if(c===pos) {
            child["marked"] = true;
            c2[pos]["marked"] = true;
          }
        }

        last = c2.length;
        for(c=0; c<last; c++) {
          child = c2[c];
          if(!child["marked"]) {
            removals.push(child);
          }
        }
        
        last = c1.length;
        for(c=0; c<last; c++) {
          child = c1[c];
          if(!child["marked"]) {
            insertions.push(child);
          }
        }

        var localdiff = {
          c1: util.snapshot(c1),
          c2: util.snapshot(c2),
          relocations: relocations,
          insertions: insertions,
          removals: removals
        };
        return localdiff;
      }
      /**
       * newhtml : new dom
       * targetElement : 需要修改的dom
       */
      var convert = function(newhtml,targetElement) {

        var d1 = util.make(targetElement.nodeName,newhtml),d2 = targetElement;

        var routes = getDiff(d1,d2), route, iroute,
            d, lastRoute = routes.length, v;

        if(lastRoute===1 && routes[0]===0) { return false; }

        for(d = 0; d < lastRoute; d++)
        {
          if (routes[d] === 0) { continue; }

          // rewrite so we do can resolve the top-level diff
          if (routes[d] === -1) { routes[d] = [-1]; }

          // follow the route to the elements
          route = util.arrayCopy(routes[d]),
          iroute = util.arrayCopy(routes[d]);
          var e1 = d1, e2 = d2,
              e = route.splice(0,1)[0];
          while (e !== -1) {
            e1 = e1.childNodes[e];
            e2 = e2.childNodes[e];
            e = route.splice(0,1)[0]; 
          }

          if(e1.nodeType===3 && e2.nodeType===3) {
              var parent = e2.parentNode;
              parent.replaceChild(e1.cloneNode(),e2);
          }

          else {
            var complexDiff = innerEquality(e1,e2),
                pos, last, entry;

            //不对比最外层的attributes
            if(routes[d].length > 1){
              var outerDiff = outerEquality(e1,e2);
            }else{
              var outerDiff = [];
            }

            if(outerDiff.length>0) {
              last = outerDiff.length;
              for(pos=0; pos<last; pos++) {
                entry = outerDiff[pos];
                
                if(entry[0]==="nodeName") {
                  var element = util.find(d2,iroute),
                      newElement = document.createElement(entry[1]);

                  while(element.childNodes.length>0) {
                    newElement.appendChild(element.childNodes[0]);
                  }

                  for(var alen=element.attributes.length-1;alen>=0;alen--){
                    newElement.setAttribute(element.attributes[alen].nodeName,element.attributes[alen].nodeValue);
                  }

                  element.parentNode.replaceChild(newElement, element);
                }else {
                  var element = util.find(d2,iroute);
                  if(entry[1]==null) {
                    element.removeAttribute(entry[0]);
                  }else {
                    element.setAttribute(entry[0], entry[1]);
                  }
                }
              }
            }

            if(!complexDiff) {
              continue;
            }

            var parent = util.find(d2,iroute);
            var newParent = util.find(d1,iroute);

            //处理remove的节点
            last = complexDiff.removals.length;
            if(last>0) {
              for(pos=last-1; pos>=0; pos--) {
                entry = complexDiff.removals[pos];
                parent.removeChild(entry);
              }
            }

            //处理insert的节点，这时是无序插入的。
            last = complexDiff.insertions.length;
            if(last>0) {
              for(pos=0; pos<last; pos++) {
                entry = complexDiff.insertions[pos];
                var newEntry = entry.cloneNode(true);
                newEntry["hashCode"] = entry.hashCode;
                parent.appendChild(newEntry);//克隆的目的是为了包装参照树不被改变。
              }
            }

            /**
              var test = function(e,id){
              var last = e.length;
              var arr = [];
              for(var i=0;i<last;i++){
                arr.push(e[i][id]);
              }
            }*/
            //重新排序
            var newNodes = newParent.childNodes,
                nodes = parent.childNodes,
                oldPos,newPos;

            /**
              test(newNodes,'hashCode');
              test(nodes,'hashCode');
              */
            last = newNodes.length;
            for(newPos=0; newPos<last; newPos++) {
              oldPos = getPositions(nodes,newNodes[newPos]);
              if(oldPos.length<1){
                console.error('error: convert error');
                continue;
              }
              if(oldPos.length>1){
                if(oldPos[0]==newPos) continue;

                oldPos = oldPos[oldPos.length-1];
                entry = nodes[oldPos];
              }else{
                oldPos = oldPos[0];
                entry = nodes[oldPos];
              }
              if(oldPos===newPos) continue;

              parent.insertBefore(entry,nodes[newPos]);


            }

          }
        }

        return true;
      };

  fw.domdiff.__reg('convert', convert, 'private');
})(sumeru);;var fw = fw || {};
(function(fw){
	//Data Accses Layer
	fw.__DAL = {};
	
	var objUtils = Library.objUtils;
	
	var findDiff = function(modelObj){
	    
		/**
		 * 接受传入Model Object，取出：要存储的对象和其上一次保存后的快照。二者比较形成diff
		 */
		var dataMap = modelObj.getData(),
			snapshot = modelObj._getSnapshot(),
			type = '',
			msgCnt = {};
		//这里的findDiff是向云保存的，所以把snapshot中的所有子model都转化为reference形式。再进行diff
        for (var key in snapshot){
            if (snapshot[key]._isCollection) {
                for(var i=0,l=snapshot[key].length; i<l; i++){
                    if (snapshot[key].get(i)._isModel) {

                        snapshot[key].get(i).dataMap = {
                                    isReference : true,
                                    val :   '::referenceID::' + snapshot[key].get(i)._getModelName() + '::' + snapshot[key].get(i).getId()
                                };  
                    }
                };
            }else if(snapshot[key]._isModel) {

                snapshot[key].dataMap = {
                            isReference : true,
                            val :   '::referenceID::' + snapshot[key]._getModelName() + '::' + snapshot[key].getId()
                        };  
            }
        }
		
		if(!dataMap[modelObj._idField]){
			type = 'insert';
	        //msgCnt = Library.objUtils.extend(true, {}, dataMap);
	        msgCnt = fw.model._extend({}, dataMap);
	        
            //msgCnt = dataMap;
            //分配一个objectid
            msgCnt[modelObj._idField] = fw.__load('__ObjectId')();
            if(modelObj.__smr_assist__.__extendPointer){
                modelObj.__smr_assist__.__extendPointer.set(modelObj._idField, msgCnt[modelObj._idField]);
            }
		} else if(modelObj._isDeleted()){
			type = 'delete';
			msgCnt[modelObj._idField] = dataMap[modelObj._idField];
		} else {
			type = 'update';
			for(var i in dataMap){
				if(!snapshot[i]  //无快照
				    || (!dataMap[i]._isCollection && snapshot[i] != dataMap[i]) //非关联model型快照不相等 
				    || ((dataMap[i]._isCollection||dataMap[i]._isModel) && JSON.stringify(dataMap[i]) != JSON.stringify(snapshot[i])) //此对象为关联model，且不相等
				  ){
					//不允许传输对ID和clientId的修改
					if(i === modelObj._idField || i === modelObj._clientIdField){
						continue;
					}
					
					msgCnt[i] = dataMap[i];
				}
				
				
                //取不到snapshot时可能是第一次sync还没回来，这时候直接取dataMap的 fix bug http://jira.baidu.com:8080/browse/SS-15
				msgCnt[modelObj._idField] = snapshot[modelObj._idField] || dataMap[modelObj._idField];
			}
		}
		
		//删除所有空数组
		for (var key in msgCnt){
		    if (objUtils.isObject(msgCnt[key])&&msgCnt[key]._isCollection && msgCnt[key].length === 0) {
		        delete msgCnt[key];
		    };
		}
		modelObj._setDirty(false);
        if(modelObj.__smr_assist__.__extendPointer){
            modelObj.__smr_assist__.__extendPointer._setDirty(false);
        }
		
		
		//var rs = [];
		//rs = dataMap;
		return {
			type	: 	type,
			modelName : modelObj._getModelName().replace(/Model\./, ''),
			cnt		: 	msgCnt
		};
	};
	
	fw.__DAL.make = function(dalDef){
		var type = dalDef.type.toLowerCase();
		
		if(__proxy[type]){
			var instance = new __proxy[type]();
			instance.config = dalDef;
			var _instanceSave = instance.save;
			//在save前通过diff操作，形成符合传输协议的数据包
			instance.save = function(modelObj, callback, pubname, pilotid, modelchain){
				var diff = findDiff(modelObj);
				//FIXME 做一个性能测试吧，看看同样一个socket，每个model走一次和打一个batch包，性能差多少
				_instanceSave(diff, callback, pubname, pilotid, modelchain);
			};
			
			return instance;
		}
	};
	
	//各类Proxy的定义
	var __proxy = {};
	
	__proxy.live = function(){
		this.proxyid = fw.__random();
	};
	
	__proxy.live.prototype = {
		save : function(data, callback, pubname, pilotid, modelchain){
			if (typeof pubname != 'undefined' || typeof pilotid != 'undefined') {
				//send the data
				if(pubname)pilotid = '';
			    fw.netMessage.sendMessage({
			    	pubname : pubname,
                    pilotid : pilotid,
                    modelchain : modelchain,
                    data    : data
                },'data_write_from_client',function(err){
                    fw.log('Err : data_write_from_client ' + err);
                },function(){
                    
                });
                callback(data);
			}else{
			    callback(data);
			}
		}
	};
	
	__proxy.network = function(){
		this.proxyid = fw.__random();
	};
	
	__proxy.network.prototype = {
		save :function(data, callback){
			var url = this.config.url;
			fw.dev('network layer saving : ' , url + ' ' , data);
			var id = data.id;
			callback(id);
		},
		
		get : function(param){
			
		},
		
		load : function(param, callback){
			var json = [];
			callback(json);
		}
	};
	
	
	__proxy.localstorage = function(){
		this.proxyid = fw.__random();
	}
	__proxy.localstorage.prototype = {
		save : function(data){
			fw.dev('localstorage layer saving : ' + data);
		},
		
		get : function(param){
			
		}
	};
	
	
	__proxy.memory = function(){
		this.proxyid = fw.__random();
		this.data =  {};
		__proxy.memory.manager[this.proxyid] = this;
	}
	
	__proxy.memory.manager = {};
	__proxy.memory.manager.resolveRef = function(refString, callback){
		var regex = /::referenceID::(.*)::(.*)/,
			match = refString.match(regex);
			callback(__proxy.memory.manager[match[2]].get());
	};
	
	__proxy.memory.prototype = {
		save : function(data, callback){
			this.data = data;
			fw.dev('memory layer save done' , data);
			callback(this.proxyid);
			return true;
		},
		
		get : function(){
			return this.data;
		},
				
		load : function(param, callback){
			
			var json = {};
			
			callback(json);
		}
	};
	
})(sumeru);
;"use strict";
var runnable = function(fw, findDiff, publishBaseDir, externalConfig, http, serverObjectId){

	//package
	var external = fw.addSubPackage('external');
	
	//constants
	var REQUEST_TIMEOUT = 30 * 1000;    //request timeout config
	
	//data managers
	var remoteDataMgr = {};		//fetched and dev resolved data manager from external server
	var localDataMgr = {};		//executed data manager by sumeru
	var urlMgr = {};			//url manager arranged by modelName, record all subscribes.
	var fetchTimer = {};        //fetch timer
	
	
	//localData Constructor
	function LocalData(){
		this.data = [];
	};
	
	LocalData.prototype = {
		
		getData : function(){
			return this.data;
		},

		insert : function(item){
			this.data.push(item);
		},
		
		remove : function(smr_id){
			var item = this.find(smr_id);
			if(item){
				var index = this.data.indexOf(item);
				this.data.splice(index, 1);
				return true;
			}
			return false;
		},
		
		update : function(oldItem, newItem){
			var index = this.data.indexOf(oldItem);
			this.data.splice(index, 1, newItem);
		},
		
		find : function(smr_id){
			
			var ret = this.data.filter(function(item){
				return item.smr_id === smr_id;
			});
			
			if(ret.length > 1){
				fw.log("ERROR: uniqueColumn data is not unique, it may cause error. ");
			}
			
			if(ret.length){
				return ret[0];
			}
			
			return null;
			
		},
		
		findOne : function(key, value){
			
			if(!key || !value){
				return null;
			}

			var ret = this.data.filter(function(item){
				return item[key] === value;
			});
			
			if(ret.length > 1){
				fw.log("ERROR: uniqueColume data is not unique, it may cause error. ");
			}
			
			if(ret.length){
				return ret[0];
			}
			
			return null;
		}
		
	}
	
	
	/**
	 * http.get util for external fetch
	 * @param {String} url: set external source localtion
	 * @param {Function} cb: success handler/callback
	 * @param {Function} errorHandler: error handler will be called automatically when error occurs in the get request.  
	 * @param {Function} timeoutHandler: timeout handler will be called automatically when a get request is timeout.
	 */
	function _doGet(url, cb, errorHandler, timeoutHandler){
		
		var chunks = [];
		var size = 0;
		
		var getRequest = http.get(url, function(res){
		
			var data = null;
			
			res.on('data', function(chunk){
				
				chunks.push(chunk);
				size += chunk.length;
				
			});
			
			res.on('end', function(){
				
				switch(chunks.length){
					case 0 : 
						data = new Buffer(0);
						break;
					case 1 :
						data = chunks[0]; 
						break;
					default : 
						data = new Buffer(size);
						for (var i = 0, pos = 0, l = chunks.length; i < l; i++) {
							var buf = chunks[i];
							buf.copy(data, pos);
							pos += buf.length;
						}
						break;
				}
				
				cb(data);
				
			});
			
		});
		
		//error handler
		getRequest.on('error', function(err){
			fw.log("Error when do external fetch", url);
			errorHandler && errorHandler(err);
		});
		
		//timeout handler
		getRequest.setTimeout( REQUEST_TIMEOUT, function(info){
			fw.log("Timeout when do external fetch", url);
			timeoutHandler && timeoutHandler();
		});
		
	}
	
	
	/**
	 * http post util for external post
	 * @param {String} options: set external source localtion
	 * @param {String} postData: post data sent to external server.
	 * @param {Function} cb: success handler/callback
	 * @param {Function} errorHandler: error handler will be called automatically when error occurs in the get request.  
	 * @param {Function} timeoutHandler: timeout handler will be called automatically when a get request is timeout.
	 */
	function _doPost(options, postData, cb, errorHandler, timeoutHandler){
		
		var chunks = [];
		var size = 0;
		
		var postRequest = http.request(options, function(res){
			
			var data = null;
			
			res.on('data', function(chunk){
				
				chunks.push(chunk);
				size += chunk.length;
				
			});
			
			res.on('end', function(){
				
				switch(chunks.length){
					case 0 : 
						data = new Buffer(0);
						break;
					case 1 :
						data = chunks[0]; 
						break;
					default : 
						data = new Buffer(size);
						for (var i = 0, pos = 0, l = chunks.length; i < l; i++) {
							var buf = chunks[i];
							buf.copy(data, pos);
							pos += buf.length;
						}
						break;
				}
				
				cb(data);
				
			});
			
		});

		postRequest.write(postData);
		postRequest.end();
		
		//error handler
		postRequest.on('error', function(err){
			fw.log("Error when do external post", url);
			errorHandler && errorHandler(err);
		});
		
		//timeout handler
		postRequest.setTimeout( REQUEST_TIMEOUT, function(){
			fw.log("Timeout when do external post", url);
			timeoutHandler && timeoutHandler();
		});
		
	}

	//在各种post成功后，更新本地数据
	function _updateLocalData(modelName, pubName, url, type, data){

		var localData = localDataMgr[url];

		if(type === 'insert'){
			var struct = fw.server_model.getModelTemp(modelName);
			var newItem = fw.utils.deepClone(struct);
			for(p in newItem){
				newItem[p] = data[p];
			}
			newItem.smr_id = data.smr_id;
			localData.insert(newItem);
		}else if(type === 'delete'){
			localData.remove(data.smr_id);
		}else if(type === 'update'){
			//抓取回来以后会自动update, 这里不用做localUpdate
		}

	}
	
	/**
	 * @method _resolve: resolve fetched originData to Array. 处理抓取的原始数据
	 * @param {Buffer} originData : origin data
	 * @param {String} pubName : publish name
	 * @return {Array} return the resolved data
	 */
	function _resolve(originData, pubName){
		var config = externalConfig[pubName];
		var data = config.buffer ? originData : originData.toString();
		if(!config.resolve){ throw new Error('Need function resolve for external fetch!');} //强制有resolve函数
		var remoteData = config.resolve(data);
		remoteData = Array.isArray(remoteData) ? remoteData : [remoteData];
		return remoteData;
	}
	
	/**
	 * @method _process: 处理外部数据，将其转成本地数据
	 * @param {String} modelName : name of model
	 * @param {String} pubName : publish name
	 * @param {String} url : external data source url
	 * @return {Array} return the processed localData
	 */
	function _process(modelName, pubName, url){
		
		var struct = fw.server_model.getModelTemp(modelName);
		var config = externalConfig[pubName];
		var remoteData = remoteDataMgr[url];
		var ret = new LocalData();

		remoteData.forEach(function(item){
			
			var newItem = fw.utils.deepClone(struct);
			for(p in newItem){
				newItem[p] = item[p];
			}

			var unique = config.uniqueColumn || config.keyColume;
			var oldItem = null;

			if(unique){
				oldItem = localDataMgr[url] && localDataMgr[url].findOne(unique, newItem[unique]);
			}
			
			if(oldItem){
				newItem.smr_id = oldItem.smr_id;
			}else{
				newItem.smr_id = serverObjectId.ObjectId();
			}
			ret.insert(newItem);
			
		});

		localDataMgr[url] = null;
		
		return ret;

	}
	
	/**
	 * @method _sync: 同步外部数据
	 * @param {String} modelName : name of model
	 * @param {String} pubName : publish name
	 * @param {String} url : external data source url
	 */
	function _sync(modelName, pubName, url, callback){
		_doGet(url, function(data){

			if(typeof remoteDataMgr[url] === "undefined"){ var firstFetch = true; }	//首次抓取不必trigger_push
			var remoteData = _resolve(data, pubName);	//处理原始数据
			if(firstFetch){
				remoteDataMgr[url] = remoteData;
				localDataMgr[url] = _process(modelName, pubName, url);
				var dataArray = fw.utils.deepClone(localDataMgr[url].getData());
				callback(dataArray);
			}else{
				var diff = findDiff(remoteData, remoteDataMgr[url], modelName);	//这里可以不需要Diff工具，直接stringify对比
				if(diff.length){
					remoteDataMgr[url] = remoteData;
					localDataMgr[url] = _process(modelName, pubName, url);
					fw.netMessage.sendLocalMessage({modelName : modelName}, 'trigger_push');
				}
			}

		});
	}


	//优先处理prepare方法，再次deInser/doDelete/doUpdate
	function _getPostData(config, type, data, modelName, pubName){
		
		var prefix = "on";
		var handler, ret;

		if(config.prepare){
			handler = config.prepare;
		}else{
			var handlerName = prefix + type.charAt(0).toUpperCase() + type.substring(1);
			handler = config[handlerName];
		}

		if(!handler){ fw.log("External Post", pubName, "unhandled operation type of", type); return false; } //hander未定义
		//hack doDelele/toUpdate 增量只给了smr_id, 需要查到item, 并提供给devloper
		if(type === 'delete'){
			var item;
			for(var i=0, l=urlMgr[modelName].length; i<l ;i++){
				var url = urlMgr[modelName][i];
				item = localDataMgr[url].find(data.smr_id);
				if(item){break;}
			}
			if(item){ ret = item; }

		}else if( type === 'update' ){


			var item;
			for(var i=0, l=urlMgr[modelName].length; i<l ;i++){
				var url = urlMgr[modelName][i];
				
				item = localDataMgr[url].find(data.smr_id);
				if(item){break;}
			}

			if(item){
				ret = fw.utils.merge(data, item);	//更新操作, 提供最新数据
			}
		}else{
			ret = data;
		}

		if(typeof ret === "undefined"){
			fw.log("Cannot find model ", data.smr_id ,"external post");
		}
		if(config.prepare){
			return handler(type, ret);
		}else{
			return handler(ret);
		}

	}

	//优先处理getOptions函数, 再次是deleteUrl/insertUrl/updateUrl
	function _getPostOptions(config, type, args){
		
		var suffix = 'Url';
		var opts;

		if(config.postUrl){
			Array.prototype.unshift.call(args, type);
			opts = config.postUrl.apply(null, args);
		}else{
			opts = config[type + suffix].apply(null, args);
		}
		
		if(!opts) { fw.log("External Post ", pubName, "options have no post config!" ); return false; }

		return opts;
	}

	//receiver of fw.external.post()
	//a low-level channel for client do post request.
	fw.netMessage.setReceiver({
	    onMessage : {
	        target : "SEND_EXTERNAL_POST",
	        overwrite: true,
	        handle : function(pack,target,conn) {
	            var cbn = pack.cbn;
	            var postData = encodeURIComponent(JSON.stringify(pack.postData));
	            var defaultOptions = {
					method : 'POST',
					headers: {
				        'Content-Type': 'application/x-www-form-urlencoded',
				        'Content-Length': postData.length
				    }
				};

				var opts = fw.utils.merge( pack.options, defaultOptions);

		        _doPost(opts, postData, function(data){
		        	fw.netMessage.sendMessage(data.toString(),cbn,conn._sumeru_socket_id);
		        });
	            
	            
	        }
	    }
	});

	//receiver of fw.external.get()
	//a low-level channel for client do get request.
	fw.netMessage.setReceiver({
	    onMessage : {
	        target : "SEND_EXTERNAL_GET",
	        overwrite: true,
	        handle : function(pack,target,conn) {
	            var cbn = pack.cbn;
	            var url = pack.url;
	            var buffer = pack.buffer;
		        _doGet(url, function(data){
		        	data = buffer ? data : data.toString();
		        	fw.netMessage.sendMessage(data,cbn,conn._sumeru_socket_id);
		        });
	            
	            
	        }
	    }
	});

	//---------------------------------- 以下为external接口 -------------------------------//
	/**
	 * package: external
	 * method name: externalFetch
	 * @param {String} modelName: name of the model
	 * @param {String} pubName: name of external publish
	 * @param {Array} args: subscribe arguments
	 * @param {Function} callback: subscribe callback.
	 */
	function externalFetch(modelName, pubName, args, callback){

		var config = externalConfig[pubName];
		var url = (config.fetchUrl && config.fetchUrl.apply(null, args)) || config.geturl(args); //兼容老的geturl方法
		
		//分modelName存下每一个做过external.fetch的url
		if(!urlMgr[modelName]){ urlMgr[modelName] = [];}
		if(urlMgr[modelName].indexOf(url) < 0){
			urlMgr[modelName].push(url);
		}
		
		//有本地数据,直接返回本地数据
		//无本地数据,抓取后trigger_push
		var localData = localDataMgr[url];
		if(localData){
			var dataArray = fw.utils.deepClone(localData.getData());  //生成一个对象，否则本地update导致数据同步异常
			callback(dataArray);							//run subsribe callback
		}else{
			_sync(modelName, pubName, url, callback);		//同步数据
		}

		if(config.fetchInterval && !fetchTimer[url]){
			fetchTimer[url] = setInterval(function(){
				_sync(modelName, pubName, url, callback);	
			}, config.fetchInterval);
		}
		
	}
	
	
	/**
	 * package: external
	 * method name: externalPost
	 * @param {String} modelName: name of the model
	 * @param {String} pubName: name of external publish
	 * @param {String} type: delta operation type, the possible values are 'delete', 'insert' or 'update';
	 * @param {Object} data: delta value generated by sumeru.
	 * @param {ArrayLike} args: subscribe arguments.
	 */
	function externalPost(modelName, pubName, type, smrdata, args){
		
		//generate postData and options by developers' config.
		var config = externalConfig[pubName];
		Array.prototype.pop.call(args); //remove callback
		var d = _getPostData(config, type, smrdata, modelName, pubName),
			opt = _getPostOptions(config, type, args);

		if(!(d && opt)){return false;}	//post config error, stop post

		var postData = encodeURIComponent(JSON.stringify(d)); //final postData

		var defaultOptions = {
			method : 'POST',
			headers: {
		        'Content-Type': 'application/x-www-form-urlencoded',
		        'Content-Length': postData.length
		    }
		};

		var opts = fw.utils.merge( opt, defaultOptions);    //final options

		_doPost(opts, postData, function(data){
		 	//成功的情况下，重新拉取数据
			urlMgr[modelName].forEach(function(refetchurl){
				_updateLocalData(modelName, pubName, refetchurl, type, smrdata);
				_sync(modelName, pubName, refetchurl, function(){});		//POST完成后重新抓取三方数据,trigger_push不用主动callback	
			});
		});
		
	}

	/**
	 * package: external
	 * method name: sendPost
	 * description : send post request from client to external server 
	 * @param {Object} options: set external source localtion
	 * @param {Object} postData: post data sent to external server.
	 * @param {Function} cb: get callback, result for getData;
	 */
	function sendGetRequest(url, cb, buffer){

		if(!url || !cb){ fw.log('Please specify url and callback for sumeru.external.get!');}
		var cbn = "WAITING_EXTERNAL_GET_CALLBACK_" + fw.utils.randomStr(8);

		fw.netMessage.setReceiver({
	        onMessage : {
	            target : cbn,
	            overwrite: true,
	            once:true,
	            handle : function(data){
	            	cb(data);
	            }
	        }
	    });

		fw.netMessage.sendMessage({
	        cbn : cbn,
	        url : url,
	        buffer : buffer
	    }, "SEND_EXTERNAL_GET");
	    
	}
	
	/**
	 * package: external
	 * method name: sendPost
	 * description : send post request from client to external server 
	 * @param {Object} options: set external source localtion
	 * @param {Object} postData: post data sent to external server.
	 * @param {Function} cb: post callback, result for;
	 */
	function sendPostRequest(options, postData, cb){

		if(!options || !postData){fw.log("please specify options or postData for sumeru.external.post");return false;}
		cb = cb || function(){};

		var cbn = "WAITING_EXTERNAL_POST_CALLBACK_" + fw.utils.randomStr(8);

		fw.netMessage.setReceiver({
	        onMessage : {
	            target : cbn,
	            overwrite: true,
	            once:true,
	            handle : function(data){
	            	cb(data);
	            }
	        }
	    });

		fw.netMessage.sendMessage({
	        cbn : cbn,
	        options : options,
	        postData : postData
	    }, "SEND_EXTERNAL_POST");

	}
	
	external.__reg('doFetch', externalFetch, 'private');		//external.fetch
	external.__reg('doPost', externalPost, 'private');		//external.post
	external.__reg('get', sendGetRequest);
	external.__reg('post', sendPostRequest);
	
}

if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
};var runnable = function(fw){	
	
    var _controller = fw.controller;
    var _model = fw.model;
    function mergeArray(array, struct){
        var structGroupType,structGroupCnt;
        for (var i = 0, ilen = struct.length; i < ilen; i++){
            structGroupType = struct[i]['type'];
            structGroupCnt = struct[i]['cnt'];
            if(structGroupType=="append"){
                array.splice(array.length,0,structGroupCnt);
            }else if(structGroupType=="update"){
                array[structGroupCnt['id']] = structGroupCnt['cnt'];
            }else if(structGroupType=="splice"){
                array.splice(structGroupCnt);
            }
        }
    };
    function mergeObj(obj, struct){
        var structGroupType,structGroupCnt;
        for (var i = 0, ilen = struct.length; i < ilen; i++){
            structGroupType = struct[i].type;
            structGroupCnt = struct[i].cnt;
            if(structGroupType=="insert"){
                for(var p in structGroupCnt){
                    obj[p] = structGroupCnt[p];
                }
            }else if(structGroupType=="update"){
                for(var p in structGroupCnt){
                    obj[p] = structGroupCnt[p];
                }
            }else if(structGroupType=="delete"){
                for(var p,plen=structGroupCnt.length; p<plen; p++){
                    obj[p] = undefined;
                }
            }
        }
    };
    function mergeModel(model, struct){
        var structGroupType,structGroupCnt;
        var modelName = model._modelName;
        var modelFieldsMap = fw.model._getModelTemp(modelName)._fieldsMap,
            fieldType,subModelName,subModelRelation;
        for (var i = 0, ilen = struct.length; i < ilen; i++){
            structGroupType = struct[i].type;
            structGroupCnt = struct[i].cnt;

            if(structGroupType=="insert"){
                for(var p in structGroupCnt){
                    fieldType = modelFieldsMap[p]['type'];
                    if(fieldType=="model"){
                        subModelName = modelFieldsMap[p]['model'];
                        subModelRelation = modelFieldsMap[p]['relation'];
                        if(subModelRelation=="many"){
                            var subCollection = fw.collection.create({modelName : subModelName},structGroupCnt[p]);
                            model._baseSet(p, subCollection);
                        }else{
                            subModel = fw.model.create(subModelName, structGroupCnt[p]);
                            model._baseSet(p, subModel);
                        }
                    }else{
                        model._baseSet(p, structGroupCnt[p]);
                    }
                } 
            }else if(structGroupType=="update"){

                for(var p in structGroupCnt){
                    fieldType = modelFieldsMap[p]['type'];
                    if(fieldType=="model"){
                        subModelName = modelFieldsMap[p]['model'];
                        subModelRelation = modelFieldsMap[p]['relation'];
                        if(subModelRelation=="many"){
                            mergeCollection(model[p],structGroupCnt[p]);
                        }else{
                            mergeModel(model[p],structGroupCnt[p]);
                        }
                    }else if(fieldType=="array"){
                        model._baseSet(p, structGroupCnt[p]);
                        /*不好判断，暂时直接赋值。mergeArray(model[p],structGroupCnt[p]);*/
                    }else if(fieldType=="object"){
                        mergeObj(model[p],structGroupCnt[p]);
                    }else{
                        model._baseSet(p, structGroupCnt[p]);
                    }
                } 
            }else if(structGroupType=="delete"){
                for(var j=0,jlen = structGroupCnt.length;j<jlen;j++){
                    model._delete(structGroupCnt[j]);
                }
            }

        }
    }
    /**
     * Merge服务器下发的增量数据
     * 由syncCollection调用
     */
    function mergeCollection(collection, delta, serverVersion){

        //增量
        var doReactiveProcess = false;
        for (var i = 0, ilen = delta.length; i < ilen; i++){
            var struct = delta[i];
            //此处顺序为，先insert，delete,然后update
            if(struct.type == 'insert'){
                var structData = struct['cnt'];
                var is_exist = collection.find({smr_id : structData.smr_id});
                if (is_exist.length) {
                    /*当本次存在id相同的项目时，认为是latency compensation的server回发请求，
                    但由于服务器上可能通过beforeInsert来修改数据，因此在这里先移除本地数据，再使用服务器的数据*/
                   /*FIXME 这里应该有一个标记，判断数据是否被服务器修改过，否则每次都reactive性能太差*/
                    /*collection.remove({
                        'smr_id' : structData.smr_id
                    });
                   
                    /*collection.update({
                        _id : structData._id
                    }, {
                        __clientId : structData.__clientId
                    })*/
                    doReactiveProcess = false;
                } else {
                    collection.add(structData);
                    doReactiveProcess = true;    
                }
            } else if (struct.type == 'delete'){
                var structData = struct['cnt'];
                //属于server下发的删除，只做remove即可，因为不知道到底是数据被删除，还是仅因为不符合pubfunc规则而被移除了
                
                collection.remove({
                    'smr_id IN' : structData //这里已经是经过server变换的smr_id数组了
                });
                doReactiveProcess = true;
                
            } else if (struct.type == 'update'){

                var model = collection.find({
                    smr_id    :  struct.id
                });

                if(model.length>0){
                    model = model[0];
                }else{
                    continue;
                }
                var structData = mergeModel(model,struct['cnt']);
                /*var updateMap = {};
          
                updateMap = structData;
                //FIXME 这里是setdirty唯一的问题，服务器下发的update会把dirty位搞脏。但不造成实际bug影响，因会触发diff，发现并无实质更新
                collection.update(updateMap, {
                    smr_id    :  struct.id
                });*/
                doReactiveProcess = true;
            }
            //更新client collection version
            collection.setVersion(serverVersion);
        }
        return doReactiveProcess;
    }


    function deltaProcess (collection, delta) {
        
        var i = [];   //inserted item
        var d = [];   //deleted item
        var u = [];   //updated item

        delta.forEach(function(item){

            if (item.type === 'insert') {
                i.push(item.cnt);
            } else if (item.type === 'delete') {
                item.cnt.forEach(function(smr_id){
                    d.push(smr_id);    
                });
            } else if (item.type === 'update') {
                var cnt = item.cnt;
                var smr_id = item.id;
                item.cnt.forEach(function(upd){
                    u.push({
                        cnt : upd.cnt,
                        smr_id : smr_id
                    });
                });
            }

        });

        if(i.length){ collection.onInsert && collection.onInsert(i); }
        if(d.length){ collection.onDelete && collection.onDelete(d); }
        if(u.length){ collection.onUpdate && collection.onUpdate(u); }

    }
	
	function syncCollection(type, pubname, val, item, isPlainStruct, serverVersion){
	    var collection = item.collection,
            doReactiveProcess = false,
            delta = [];
        
        if(isPlainStruct){//publish callback是传过来的data是个简单对象。不是一个collection
            collection = val;
            doReactiveProcess = true;
        }else{
            if(type == 'data_write_from_server_delta'){
                delta = val;
                doReactiveProcess = mergeCollection(collection, delta, serverVersion);
            } else {
                //全量
                if(!collection._isSynced() || collection.stringify() !== JSON.stringify(val)){
                    collection.setData(val);
                    collection.setVersion(serverVersion);
                    doReactiveProcess = true;
                }
            }
        }
        
        if(!isPlainStruct)collection._takeSnapshot();


        //onInser, onUpdate, onDelete callback
        deltaProcess(collection, delta);

        if(doReactiveProcess === true){
            
            //因为JS的单线程执行，只要callback中没有setTimeout等异步调用，全局变量tapped_blocks就不会产生类似多进程同时写的冲突。
            var tapped_blocks = [];
            _controller && _controller.__reg('_tapped_blocks', tapped_blocks, true);
            
            var byPageSegment = new RegExp('@@_sumeru_@@_page_([\\d]+)'),
            ifPageMatch = pubname.match(byPageSegment);
            if (ifPageMatch) {
                item.callback(collection, {
                    //delta : delta,  FIXME 待端=>云的协议与云=>端的协议统一后，统一提供增量的delta给subscribe
                    page  : ifPageMatch[1]
                });  //额外传递一个页码page 
            } else {
                item.callback(collection, {
                    delta : delta //FIXME 待端=>云的协议与云=>端的协议统一后，统一提供增量的delta给subscribe
                });

            }
            
            //每个Controller的render方法会保证局部渲染一定等待主渲染流程完成才开始。
            _controller && _controller.reactiveRender(tapped_blocks);
        }
        
        //a flag tells if data have been stored remotely
        if(!isPlainStruct)collection._setSynced(true);
    }
    
    /*
     * 因为collection执行hold方法而延迟执行的数据同步队列
     * 结构：
     * [{
     *     collection : 
     *     runner :
     * },{},...]
     */
    var postponeQueue = fw.pubsub._postponeQueue;
    
    
    // ==========  消息处理  ============
    
    /**
     * 接收到全局消息
     */
    var onGlobalMessage = function(data) {
        if (fw.onGlobalMessage) {
            fw.onGlobalMessage(data);
        } else {
            fw.dev("GLOBAL MESSAGE : " + data);
        }
    };
    
    /**
     * 接收到全局错误消息
     */
    var onGlobalError = function(data,target){
	var msg = target == 'data_auth_from_server' ? 'auth faild' : data;
	if(fw.onGlobalError ){
	    fw.onGlobalError(msg);
	}else{
	    fw.log("GLOBAL ERROR : " + msg);
	}
    };
    
    /**
     * 认证消息的数据
     * 当接收到服务端产生的认证失败消息时被触发，用于通知对应的controller认证失败，未获到有效数据
     */
    var onError_data_auth_from_server = function(data){
        if(!data.needAuth){
            var pubName = data.pubname;
            //candidates is array of collections
            var candidates = fw.pubsub._subscribeMgr[pubName].stub;
            
            //each stub
            //[{collection:@, onComplete : @}]
            
            var isSend = false;
            candidates.forEach(function(item, i){
                if(item.env.onerror){
                    item.env.onerror("auth failed");
                    isSend = true || isSend;
                }else{
                    /*
                     * FIXME , 当找到任何controll的onError,都认为错误消息派送成功
                     * 唯一派送失败的可能是，数据中没有pubname，或没有任何controller订阅当前pubname的数据.
                     */
                    isSend = false || isSend;
                }
            });
            // 如果当前消息没有成功的接收者，将转往globalError
            return isSend;
        }
    };

    var onError_data_write_from_server_dberror = function(data){

            var pubName = data.pubname;
            //candidates is array of collections
            var candidates = fw.pubsub._subscribeMgr[pubName].stub;
            
            //each stub
            //[{collection:@, onComplete : @}]
            
            var isSend = false;
            candidates.forEach(function(item, i){
                if(item.env.onerror){
                    item.env.onerror("dberror:"+data.data.stringify());
                    isSend = true || isSend;
                }else{
                    /*
                     * FIXME , 当找到任何controll的onError,都认为错误消息派送成功
                     * 唯一派送失败的可能是，数据中没有pubname，或没有任何controller订阅当前pubname的数据.
                     */
                    isSend = false || isSend;
                }
            });
            // 如果当前消息没有成功的接收者，将转往globalError
            return isSend;
    };

    var onError_data_write_from_server_validation = function(data){
        
        var pubName = data.pubname;
        var pilotId = data['pilotid'];
        if(pubName){
            //candidates is array of collections
            var candidates = fw.pubsub._subscribeMgr[pubName].stub;
            
            //each stub
            //[{collection:@, onComplete : @}]
            
            var isSend = false;
            candidates.forEach(function(item, i){
                if(item.collection.onValidation){
                    var resultObjs = data.data;
                    if(data.modelchain!=''){
                        for(var i=0,ilen=resultObjs.length;i<ilen;i++){
                            resultObjs[i]['key'] = data.modelchain+'.'+resultObjs[i]['key'];
                        }
                    }
                    item.collection.onValidation.call(item.collection,resultObjs.length>0?false:true, 'server', resultObjs);
                    isSend = true || isSend;
                }else{
                    /*
                     * FIXME , 当找到任何controll的onError,都认为错误消息派送成功
                     * 唯一派送失败的可能是，数据中没有pubname，或没有任何controller订阅当前pubname的数据.
                     */
                    isSend = false || isSend;
                }
            });
            // 如果当前消息没有成功的接收者，将转往globalError
            return isSend;
        }else{
            var _pilot = fw.msgpilot.getPilot(pilotId);
            var isSend = false;
            if(_pilot.stub.onValidation){
                var resultObjs = data.data;
                _pilot.stub.onValidation.call(_pilot.stub,resultObjs.length>0?false:true, 'server', resultObjs);
                isSend = true || isSend;
            }else{
                isSend = false || isSend;
            }
            return isSend;
        }
    };
    
    /**
     * 接收到服务端返回的echo信息
     * 1.同步时间
     * 2.添加了从服务器接收公钥
     */
    var onMessage_echo_from_server = function(data){
    	var localTimeStamp = (new Date()).valueOf(); 
    	serverTimeStamp = data.timestamp;
    	
    	if (typeof data.swappk !="undefined"){
    	    fw.myrsa.setPk2(data.swappk);
    	    //fw.log('从server获得新pk2',data.swappk);
        }
    	var getTimeStamp = function(){
    	    var now = (new Date()).valueOf(),
    	    delta = now - localTimeStamp,
    	    serverTimeNow = delta + serverTimeStamp;  
    	    return serverTimeNow;
    	};
    	
    	fw.utils.__reg('getTimeStamp', getTimeStamp);
    	
    	Library.objUtils.extend(sumeru.pubsub._publishModelMap, data.pubmap);
    	
        fw.netMessage.sendLocalMessage({}, 'after_echo_from_server');
    };
    
    /**
     * 接收到从服务端写过来的数据订阅消息
     */
    var onMessage_data_write_from_server = function(data,type){
        /**
         * format : 
         * name : pub name
         * val  : value object
         */
        var pubName = data['pubname'];
        var pilotId = data['pilotid'],
        	uk = data['uk']||"",
            val = data['data'],
            serverVersion = data['version'];

        if(pubName){
            if (!(pubName in fw.pubsub._subscribeMgr)) {
                return;
            };
            
            if (type == 'data_write_from_server' 
                && fw.pubsub._subscribeMgr[pubName].topPriority == true
                && typeof fw.pubsub._priorityAsyncHandler != 'undefined') {
                //如果是prioritySubscribe的全量写回（即第一次的返回），又存在fw.pubsub._priorityAsyncHandler(是redo)
                fw.pubsub._priorityAsyncHandler.decrease();
            };
            
            //candidates is array of collections
            var candidates = fw.pubsub._subscribeMgr[pubName].stub;


            var isPlainStruct = sumeru.pubsub._publishModelMap[pubName.replace(/@@_sumeru_@@_page_([\d]+)/, '')]['plainstruct'];
            //each stub
            //[{collection:@, onComplete : @}]
            for(var i=0,len=candidates.length,item;i<len;i++){
        		item = candidates[i];
        		if (uk && uk!=item.id) {
                	continue;
                }
        	    var collection = item.collection;

                if(isPlainStruct){
                    syncCollection(type, pubName, val, item, isPlainStruct, serverVersion);
                }else{
                    if (collection.__smr__.isHolding) {
                        postponeQueue.push({
                            collection : collection,
                            runner : function(){syncCollection(type, pubName, val, item, false, serverVersion);}
                        });
                    } else {
                        syncCollection(type, pubName, val, item, false, serverVersion);
                    }
                }
            };
        }else{
            /*暂无此类调用*/
            var _pilot = sumeru.msgpilot.getPilot(pilotId);
            if(_pilot.type==='model'){

            }else{
                syncCollection(type, pilotId, val, item, false, serverVersion);
            }
        }

    };
    
    /**
     * 服务端发来的错误消息
     */
    var onError = function(data,type){
        
        var pubName = data['pubname'];
        //candidates is array of collections
        var candidates = fw.pubsub._subscribeMgr[pubName].stub;
        
        //each stub
        //[{collection:@, onComplete : @}]
        
        var isSend = false;
        candidates.forEach(function(item, i){
            
            if(item.env.onerror){
                item.env.onerror("auth failed");
                isSend = true || isSend;
            }else{
                /*
                 * FIXME , 当找到任何controll的onError,都认为错误消息派送成功
                 * 唯一派送失败的可能是，数据中没有pubname，或没有任何controller订阅当前pubname的数据.
                 */
                isSend = false || isSend;
            }
        });
        // 如果当前消息没有成功的接收者，将转往globalError
        return isSend;
    };
    
    /**
     * 从本地发来的消息
     */
    var onLocalMessage_data_write_latency = function(data,type){
	   var pubName = data['pubname'];
        //candidates is array of collections
        var candidates = fw.pubsub._subscribeMgr[pubName].stub;        
        //each stub
        //[{collection:@, onComplete : @}]
        candidates.forEach(function(item, i){
            var collection = item.collection;
            
            //因为JS的单线程执行，只要callback中没有setTimeout等异步调用，全局变量tapped_blocks就不会产生类似多进程同时写的冲突。
            var tapped_blocks = [];
            _controller.__reg('_tapped_blocks', tapped_blocks, true);
            item.callback(collection, { delta : [] });
            
            //每个Controller的render方法会保证局部渲染一定等待主渲染流程完成才开始。
            _controller.reactiveRender(tapped_blocks);
        });
    };


    
    var onMessage_config_write_from_server = function(data, type){
    	if(data && typeof data === "object"){   
    	    for(var ob in data){ 			    
    		fw.config.set(ob,data[ob]);
    	    }
    	}
    	fw.config.commit();
    };
    
    
    /**
     * 绑定服务下发消息处理
     */
    fw.netMessage.setReceiver({
    	onMessage : {
            overwrite : true,
    	    target : 'config_write_from_server',
    	    handle : onMessage_config_write_from_server
    	},
    	onLocalMessage : {
    		target : 'config_write_from_server',
    	    handle : onMessage_config_write_from_server
    	}
    });

    
    fw.netMessage.setReceiver({
    	onMessage : {
            overwrite : true,
    	    target : 'echo_from_server',
    	    handle : onMessage_echo_from_server
    	},
    	onLocalMessage:{
            overwrite : true,
    	    target : ['data_write_latency'],
    	    handle : onLocalMessage_data_write_latency
    	}
    });
    
    
    fw.netMessage.setReceiver({
    	onMessage:{
            overwrite : true,
    	    target:['data_write_from_server','data_write_from_server_delta'],
    	    handle : onMessage_data_write_from_server
    	},
    	onLocalMessage:{
            overwrite : true,
    	    target:['data_write_from_server','data_write_from_server_delta'],
    	    handle : onMessage_data_write_from_server
    	},
    	onError:onError,
    	onGlobalError:onGlobalError,
    	onGlobalMessage:onGlobalMessage
    });
    
    fw.netMessage.setReceiver({
        onError:{
            //该标记只有服务端认证失败时才返回
            overwrite : true,
            target:['data_auth_from_server'],           
            handle : onError_data_auth_from_server
        },
    });
    fw.netMessage.setReceiver({
        onError:{
            //该标记只有服务端DB操作失败时才返回
            overwrite : true,
            target:['data_write_from_server_dberror'],           
            handle : onError_data_write_from_server_dberror
        },
    });
    fw.netMessage.setReceiver({
        onError:{
            //该标记只有服务端model验证失败时才返回
            overwrite : true,
            target:['data_write_from_server_validation'],           
            handle : onError_data_write_from_server_validation
        },
    });
}
if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{//这里是前端
    runnable(sumeru);
};var globalConfig = function(fw){
    
    var httpServerPort = 8080;
    var whiteList = ['websocket', 'xdr-streaming', 'xhr-streaming', 'iframe-eventsource', 'iframe-htmlfile', 'xdr-polling', 'xhr-polling', 'iframe-xhr-polling', 'jsonp-polling'];	
    var view_from_cache = false;
    // BAE CONFIG    
    if (typeof process !== 'undefined' && typeof process.BAE !== 'undefined'){
        httpServerPort = 0;
        whiteList = ['xhr-streaming'];
        view_from_cache = true;
    }
   
    fw.config.defineModule('cluster');
    fw.config.cluster({
        enable : true,
        cluster_mgr : '127.0.0.1',
        cluster_mgr_port : 6379
    });
   
    fw.config({
    	httpServerPort: httpServerPort,
    	protocols_whitelist : whiteList,
    	view_from_cache:view_from_cache
    });

    fw.config({
        clientValidation: true,
        serverValidation: true
    });
    
    if (typeof location != 'undefined') {

    	fw.config({
                selfGroupManagerAddr:'0.0.0.0',
                selfGroupManagerPort:'8089',
    	});
    };
    
    if (typeof exports != 'undefined' && typeof module !='undefined'){
    	var configPath = process.dstDir + '/server/tmp/config';
    	fw.config({
    	    configPath : configPath,
    	});
    }
    
    var viewConfig = fw.config.defineModule('view');
    viewConfig({path : '/'});
}
//for node
if(typeof module !='undefined' && module.exports){
    module.exports = globalConfig;
}else{
    globalConfig(sumeru);
};/**
 * @file router.js
 * @author wangsu01
 * 
 * 操作url中的hash部份，在url的变化时，将程序导入不同的controller.
 * 
 * URL操作结构
 * 　
 *   　　URI#controller路径及名称?调用参数&SESSION结构 
 * 
 * 各部份具体样式及说明
 * 
 *   Index.html                                           // 正常资源URL
 *   #                                                    // hash部分分隔符
 *   /ControllerPath/ControllerName                       // controller目录结构及名称
 *   ?                                                    // 参数部份分隔符
 *   a=b&c=d&                                             // 用户参数，使用正常URL风格
 *   _smr_ignore=true&                                    // 忽略本次url变化
 *   _smr_ses_dat{                                        // SESSION 部份使用JSON风格，由‘SES_DAT{’定义开始边界，‘}’定义结束边界，中间部份统一使用ＵＲＩ编码一次，防止中文等特殊字符出错。
 *      ‘controllerPath1/controllerName1’ : {             // 每个session对像，KEY与[controller目结构及名称]部份相同，用于标记归属。
 *          key1:value1,
 *          key2:value2,
 *          …
 *          keyN:valueN
 *      },
 *      ‘controllerPath2/controllerName2’:{
 *          key1:value1,
 *          key2:value2,
 *          …
 *   　　　 keyN:valueN
 *       }
 *   }
 */
var SUMERU_ROUTER = SUMERU_ROUTER === undefined ? true : SUMERU_ROUTER;
(function(fw){
    var router = fw.addSubPackage('router');
    
    var uriParts;//存储此router的uri
    
    // var isInternalJoin = false;
    var isControllerChange = true, isParamsChange  = true, isSessionChange = true;
    var lastController = null ,lastParams = null,lastSession = null,lastOneSession=null;
    var isIgnore = false , isforce = false;
    
    var objToUrl = function(session){
    	var sessionObj = (typeof session == 'object') ?session:JSON.parse(session);
    	var hash = [];
        for (var name in sessionObj) {
        	hash.push(name + "=" + sessionObj[name]);
        }
        return hash.join("&");
        
    }
    /**
     * 将session部份,拼入hash
     * 修改by孙东，此函数作为session改造的一部分，在压入url的session只能压入本controller的内容
     * 可能会有子controller的问题，，FIXME TODO
     */
    router.__reg('joinSessionToHash',function (serializeDat){
        //uriParts.params 与 uriParts.session 进行整合
    	isSessionChange = lastOneSession != serializeDat;
    	lastOneSession = serializeDat;
        
        if (isSessionChange) {
        	var hash = serializeDat?("?"+objToUrl(serializeDat)):"";
        	if (hash){
        		hash = uriParts.path + uriParts.controller + hash;
        	}
        	History.replaceState(serializeDat, document.title, hash);
        }
        
    },true);
    
    router.__reg('redirect',function(urlHash,_isforce,type){
        
        var iParts = fw.uri.getInstance(urlHash);//更新path，更新controller
        //session 要体现在url中
        fw.dev("redirect....",iParts.controller);
        var other = fw.session.getSessionByController(iParts.controller);
        var hash = "";
        isforce = !!_isforce;
        
        if ( typeof iParts.params === 'object' && !Library.objUtils.isEmpty(iParts.params) ) {
        	var objstring="?";
        	if (other){
        		if (typeof other == 'string'){
        			other = JSON.parse(other);
        		}
    			for( var t in other){
        			if (!iParts.params[t]) {//从session中提取url中没有的参数
    					objstring = objstring + t +"="+other[t]+"&" 
        				
        			}else if (iParts.params[t] != other[t]){
        				isforce = true;
        			}
        			
        		}
        	}
        	hash = objstring + objToUrl(iParts.params);
        }
        if (typeof type =='string' &&type=='replace'){
        	History.replaceState(lastSession, document.title, uriParts.path+iParts.controller + hash);
        }else{
        	History.pushState(lastSession, document.title, uriParts.path+iParts.controller + hash);
        }
		
    });
    
    
    /**
     * 监测url中hash的变化
     * 
     * 当前规则如下:
     *  controller部份变化 : 进入其它controller
     *  session变化 : 将变化推入session工厂
     *  params变化 : 进入一个新的当前controller
     * 
     */
    function __router(locationurl){
        
        uriParts = fw.uri.getInstance(locationurl);
        
        //处理session change 
        isSessionChange = lastSession != uriParts.session;
        lastSession = uriParts.session;
        //处理controller change 
        isControllerChange = uriParts.controller != lastController;
        lastController = uriParts.controller;

        fw.dev('isControllerChange :' + isControllerChange);
        fw.dev('isSessionChange :' + isSessionChange);
        fw.dev('parts of hash:' , uriParts);
        
        // 如果session序列化发生变化,并用不是内部拼接的(理论上此时应只有复制url产生),将变化的对像合并入session工厂.
        if(isSessionChange || isControllerChange){
            fw.session.setResume(lastSession,lastController);
        }
        
        if(isIgnore == false && (isControllerChange || isParamsChange)){
            // 进入目标controller.
            fw.init((function(contr, params){
                    return function(){
                        fw.controller.dispatch(contr, params,isforce);
                        isforce = false;
                    };
            })(lastController, uriParts.contr_argu));//objToUrl(uriParts.params)
        }
        
        // 还原标记为false
        isIgnore  = isControllerChange = isSessionChange = lastOneSession = isParamsChange = false;
    }
    
     fw.event.domReady(function() {
     	if (typeof location ==='object'	){//前端渲染
     		
	         if(SUMERU_ROUTER){
	         	
	             History.Adapter.bind(window,'statechange',function(){ // Note: We are using statechange instead of onhashchange
					// Log the State
					var State = History.getState(); // Note: We are using History.getState() instead of event.state
					History.log('statechange:', State.data, State.title, State.cleanUrl);
					__router(State.cleanUrl.substr(location.origin.length));
				});
	            __router((location.href.replace(/&?_suid=\d*/g,"")).substr(location.origin.length));
	            
	         }
     	}
         
        
    });
   
})(sumeru);
;var runnable = function(sumeru){
    
    var routerMap = [];
    
    var addRouter = function(obj /*, obj1, obj2..*/){
        var rule;
        for (var i = 0, l = arguments.length; i < l; i++){
            rule = arguments[i];
            if (Library.objUtils.isObject(rule) && typeof rule.pattern != 'undefined') {
                if (rule.type=='file') {
                    routerMap.push({
                        path : rule.pattern,
                        type : rule.type,
                        action : rule.action,
                        server_render : false
                    });
                }else if (rule.action){
                    routerMap.push({
                        path : rule.pattern,
                        action : rule.action,
                        server_render : (rule.server_render!==false)
                    });
                }
                
            };
        }
    };
    
    var getAll = function(){
        return routerMap;
    };
    
    var setDefault = function(action){
        if (action) {
            var check_render = true;
            for(var i=0,len=routerMap.length;i<len;i++){
                if (routerMap[i].action == action){
                    check_render = routerMap[i].server_render;
                }
            }
            addRouter({
                pattern : '',
                action : action,
                server_render:check_render
            });  
        };
        return true;
    };
    
    var externalProcessorMap = [];
    sumeru.router.addSubPackage('externalProcessor');
    
    var addExternalProcessor = function(func /*,func1, func2*/){
       var processor;
        for (var i = 0, l = arguments.length; i < l; i++){
            processor = arguments[i];
            if (typeof processor == 'function') {
                externalProcessorMap.push(processor);
            };
        } 
    };
    
    var getAllExternalProcessor = function(){
        return externalProcessorMap;
    };
    
    sumeru.router.__reg('add', addRouter);
    sumeru.router.__reg('getAll', getAll);
    sumeru.router.__reg('setDefault', setDefault);
    
    sumeru.router.externalProcessor.__reg('add', addExternalProcessor);
    sumeru.router.externalProcessor.__reg('getAll', getAllExternalProcessor);
    
    
};
//)(sumeru);
if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{//这里是前端
    runnable(sumeru);
};(function(fw){
    fw.addSubPackage('historyCache');
    
    // var maxCache = 10;//
    var _cache = [];//用数组
    
    //hitUrl 用于查找是否在历史记录里面，如果是，则返回，并且删除
    //data形如【0：url，1：render方式】
    var hitUrl = function(data, isForce) {
        if ( isForce ) {
            setUrl(data);
            return false;
        }
        
        var getit = false;
        for (var i = _cache.length - 1; i >= 0; i--) {
            if (_cache[i] && _cache[i][0] === data[0]) {
                getit = true;
                break;
            }
        }
        if (!getit) {
            setUrl(data);
            return false;
        } else if ( i === (_cache.length - 1) ) {//说明是url没变，自己刷新自己
            return false;
        } else {//清空缓存吧
            for (var j = _cache.length - 1; j > i; j--) {
                _cache.pop();//弹出，不占空间
            }
            //我还要给它进行转换，又入场到出场,这里不让他传递引用，防止污染我的内部cache变量
            var ret = JSON.stringify(_cache[i]);
            return JSON.parse(ret);
        }
    };
    var getCache = function() {
        return _cache;
    }
    var setUrl = function(data) {//这里都是自己人的调用，没做数据校验
        if ( data && data[0] && data[1] ) {//js太恶心，都是引用，所以这里我要分别赋值
            _cache.push( data );
        }
    };

        
    fw.historyCache.__reg('hitUrl', hitUrl);
    fw.historyCache.__reg('getCache', getCache);

    
})(sumeru);;/**
 * reachability package
 * 
 * provide detecting of network status
 * 
 * todo: should have provide wifi / 3G / Edge detection with native support
 * @author tongyao@baidu.com
 */
var runnable = function(sumeru){
    
    var STATUS_OFFLINE = 0x00;
    var STATUS_CONNECTING = 0x10;
    var STATUS_CONNECTED = 0x100;
    
    var TYPE_WIFI = 0x01;
    var TYPE_3G = 0x11;
    var TYPE_EDGE = 0x111;
    var TYPE_GPRS = 0x1111;
    
    var status_ = STATUS_OFFLINE; //默认离线
    var type_ = 0x00; //默认没有网络类型，暂未实现type的识别
    
    if(sumeru.reachability){
        return;
    }
    
    var api = sumeru.addSubPackage('reachability');
    
    var functionstack  = {};
    
    var trigger_reachability = function(status){
        if (status === STATUS_OFFLINE) {
            functionstack.offline && functionstack.offline();
        }else if(status === STATUS_CONNECTING) {
            functionstack.connecting && functionstack.connecting();
        }else if(status === STATUS_CONNECTED) {
            functionstack.online && functionstack.online();
        }
    }
    var setEvent  = function(type,func){
        functionstack[type] = func;
    }
    var setStatus = function(status){
        trigger_reachability(status);
        status_ = status;
        return status_;
    };
    
    var getStatus = function(){
        return status_;  
    };
    
    api.STATUS_OFFLINE = STATUS_OFFLINE;
    api.STATUS_CONNECTING = STATUS_CONNECTING;
    api.STATUS_CONNECTED = STATUS_CONNECTED;
    //FIXME 完善在线功能，添加trigger online、offline方法。
    //因为断线有两种可能，一种是与server中断（可能server故障），第二种是失去网络连接
    
    if (typeof module =='undefined' ||  !module.exports) {
        //前端绑定
        window.addEventListener("offline", function(){
            sumeru.reachability.setStatus_(STATUS_OFFLINE);
            sumeru.closeConnect && sumeru.closeConnect();//重连
        }, false);
        window.addEventListener("online", function(){
            //trigger socket reconnect...
            sumeru.reconnect && sumeru.reconnect();//重连
        }, false);
    }
    
    api.__reg('setStatus_', setStatus, 'private');
    api.__reg('getStatus', getStatus, 'private');
    api.__reg('setEvent', setEvent, 'private');
};

if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
    
}

;/**
 * writeBuffer package
 * 
 * @author tongyao@baidu.com
 */
var runnable = function(sumeru){
    
    if(sumeru.writeBuffer_){
        return;
    }
    
    var api = sumeru.addSubPackage('writeBuffer_');
    
    var reachability = sumeru.reachability,
        output_,
        buffer = [];
    
    var setOutput = function(output){
        output_ = output;    
    }
    
    var write = function(msgObj, onerror, onsuccess){
        buffer.push({
            msg : msgObj,
            onError : onerror,
            onSuccess : onsuccess
        });
        sendOut();
    };
    
    
    var sendOut = function(){
        if (buffer.length == 0) {
            return true;        
        };

        var current;
        
        while(reachability.getStatus() == reachability.STATUS_CONNECTED 
            && (current = buffer.shift())){
            output_(current.msg, current.onError, current.onSuccess);
        }
    }
    
    api.__reg('write', write, 'private');
    api.__reg('setOutput', setOutput, 'private');
    api.__reg('resume', sendOut, 'private');
};

if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
}

;/*
 * message pilot, 自动生成pilot
 */
var runnable = function(sumeru){

    var pilot = {};
    var counter = 0;
    var createPilotId = function(){
        return "pilot"+counter++;
    }

    var setPilot = function(obj,type){
        var type = type || 'model';
        if(!obj._getPilotId()){
            var pilotid = createPilotId();
            pilot[pilotid] = {
                type:type,
                stub:obj
            };
            obj._setPilotId(pilotid);
        }
    }

    var getPilot = function(pilotid){
        return pilot[pilotid];
    }


    if(sumeru.msgpilot){
        return;
    }
    
    var api = sumeru.addSubPackage('msgpilot');
    api.__reg('setPilot', setPilot, 'private');
    api.__reg('getPilot', getPilot, 'private');

};

if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{
    runnable(sumeru);
};/**
 * @file uri.js
 * @author sundong
 * 
 * 操作url
 * 
 * URL操作结构
 * 　
* 各部份具体样式及说明
 * 
 *   
 */
var runnable = function(fw,runfromServer){
    var fwuri = fw.addSubPackage('uri');
    var _uri = function(){
    	this.path = null;// {/debug.html}/hi-login?asdlfkj
    	this.params = null;// /debug.html{/hi-login}?asdlfkj
    	this.controller = null;
    	this.original = null;
    	this.session="";
    	this.type;
    	this.contr_argu = [];
    };
    var routerObj = null;
    
    // var parseFileFromUrl = function(filePath){// all files
    	// //1.  ?后的一切都不是file的name
		// if ( filePath.indexOf('?') != -1 ) {
            // filePath = filePath.substring(0,filePath.indexOf("?"));
        // }
        // //文件直接读取,使用baseurl，已经彻底解决此问题
        // if (filePath.match(/\.\w+$/) ) {
        	// if (filePath.indexOf('.html/') != -1){
        		// filePath = filePath.substring(filePath.indexOf(".html/")+5);
        	// }
        	// //检测controller的去减
        	// // if (!routerObj){
	    		// // routerObj = fw.router.getAll();
	    	// // }
// 	    	
        // }
    	// //2. /的前面如果有.html也舍弃后面的
    	// if ( filePath.indexOf('.html/') != -1) {
    		// filePath = filePath.substring(0,filePath.indexOf('.html/')+5);
    	// }
    	// //3. /前面没有.html，且匹配了定义的router,则返回index.html
    	// if ( !filePath.match(/\.\w+$/) ) {//文件直接读取
        	// filePath = "/index.html";
        // }
//     	
    	// return filePath;
    // };
    var parseFromUrl = function(filePath){
    	//0. 去掉#号
    	if (filePath.indexOf("#")!= -1) {
    		filePath = filePath.replace("#","");
    	};
    	filePath = filePath.replace(/\/+/g,"/");
    	
    	// hack to support no base_url router eg. debug.html/js/src/sumeru.js could be js/src/sumeru.js
        if (filePath.indexOf('.html/') != -1){
            if (filePath.match(/\.\w+$/) || filePath.match(/\.\w+\?/) ) {//static file
                filePath = filePath.substring(filePath.indexOf(".html/")+5);              
            }
        }
        
    	//1.  ?后的一切都不是file的name
    	var _filePath  = filePath;
    	var params="",controller="";
		if ( _filePath.search(/[?#!]/) != -1 ) {
			params = _filePath.substring(_filePath.search(/[?#!]/) + 1);//保留? #
			
		    _filePath = _filePath.substring(0,_filePath.search(/[?#!]/));
        }
        //2. /的前面如果有.html也舍弃后面的
    	if ( _filePath.indexOf('.html') != -1) {
    		controller = _filePath.substring(_filePath.indexOf('.html')+5);
    		_filePath = _filePath.substring(0,_filePath.indexOf('.html')+5);
    	}else if ( !_filePath.match(/\.\w+$/) ) {
    		//3. /前面没有.html，并且在?之前存在controller,则默认读取index.html,且设置controller
    		controller = _filePath;
    		_filePath = "/";
        }
        //判断静态文件
        if (filePath.match(/\.\w+/) && !filePath.match(/\.html/)) {//static file
            this.controller = null;
            this.path = _filePath;
            return this;
        }
        if (!routerObj){
    		routerObj = fw.router.getAll();
    	}
    	var contr_argu = [];//这个是controller后面带的参数
    	//check for controller
		var matchTmp,longest=-1,q=-1;//q 是记录第几个
		for(var i=0,len=routerObj.length;i<len;i++){
			
			if ((routerObj[i].path.toString().length>longest) && (matchTmp = controller.match(routerObj[i].path))){//由于match controller正则可能导致，只匹配一半
    			longest = routerObj[i].path.toString().length;
    			q = i;
    		}
    		
    	}
    	if (q>-1){// HAS MATCH ROUTER
    		if (runfromServer && !routerObj[q].server_render) {
    		    if (routerObj[q].type === 'file'){
    		        fw.log("router:fileUpload matche.",routerObj[q].path);
    		    }else{
    		        fw.log("router:server_render is false.",routerObj[q].path);
                }
    			controller = null;
    		}else{
    			if (longest == 0){//最长的就是空白
	    			if (controller.indexOf("/") == 0){
	    				controller=controller.substr(1);
	    			}
	    			contr_argu = controller.split("/");
		    		contr_argu.unshift("");
		    		controller = "";
	    		}else{
	    			matchTmp = controller.match(routerObj[q].path);
		    		contr_argu = controller.replace(routerObj[q].path,"");
					controller = matchTmp[0];
					contr_argu = contr_argu.split("/");
					contr_argu[0] = controller;
	    		}
    		}
    		
    		if (routerObj[q].type==='file'){
    		    this.type = routerObj[q].type;
    		    controller = null;//上传文件不需要server渲染
    		}
    	}else{// NO MATCH ROUTER
    		controller = null;
    		contr_argu.push("");
    	}
    	
    	var paramsObj = fw.utils.uriParamToMap(params);
    	//session begin
    	var identifier = controller + "!" ;
    	var sessionObj = {};
    	sessionObj[identifier] = JSON.stringify(paramsObj) ;
    	sessionObj = JSON.stringify(sessionObj);
    	var session = (sessionObj.substring(1,sessionObj.length - 1));
        
    	//TODO REMOVE paramstring LATER
    	
    	this.path = _filePath;
        this.params = paramsObj;
        this.controller = controller;
        this.session  = session;
        this.contr_argu = contr_argu;
    	return this;//{path:_filePath,params:paramsObj,controller:controller,session:session,contr_argu:contr_argu};
		
		
    };
    
    _uri.prototype = {
        parseFromUrl :parseFromUrl,
    	init : function(filePath){
    		this.original = filePath;
    		this.parseFromUrl(filePath);
    		
    	},
    	
    };
    fwuri.__reg("getInstance",function(url){
    	var uri = new _uri();
    	uri.init(url);
    	return uri;
    });
    // fwuri.__reg("parseFileFromUrl",parseFileFromUrl);
   
};

if(typeof module !='undefined' && module.exports){
    module.exports = function(fw){
    	runnable(fw,true);
    };
}else{
    runnable(sumeru);
};(function(fw){
	
	var inited = false;
	
	var cookie = Library.cookie;
	var socket = null;
	var reachability = fw.reachability;
	var config = fw.config;
	var netMessage = fw.netMessage;
	var myrsa = fw.myrsa;
	var writeBuffer_ = fw.writeBuffer_;
	
	
    if(!cookie.getCookie('clientId')){
        cookie.addCookie('clientId',sumeru.utils.randomStr(12) , 24*365*20);
    }
    
    if(!cookie.getCookie('OPEN_STICKY_SESSION')){
        cookie.addCookie('OPEN_STICKY_SESSION',1);
    }
    
    netMessage.addOutFilter(function(msg){
        msg.sessionId = cookie.getCookie('sessionId');
        msg.clientId = cookie.getCookie('clientId');
        msg.passportType = cookie.getCookie('passportType');
        return msg;
    },0);
    
	var __socketInit = function(counter,callback){
	    
	    var socketId = fw.__random();
	    
	    // 如果开启rsa,将在每次建立连接的时候同步加密信息,所以将config状态放在每次初始化连接的时候.
    	var rsa_enable = config.get("rsa_enable");
    	
    	// 除非当前是断线状态,否则绝不建立连接
	    if(reachability.getStatus() != reachability.STATUS_OFFLINE){
	        fw.dev('Another connection still open, stop connect');
	        return;
	    }

        if( ( counter = counter || 0 ) > 500){ //70次是(1+70) * 70 / 2 = 41分钟重连时间
            throw "Fail to connect to network";
        }
	    
		var clientSocketServer;
		
		if (config.get('httpServerPort') && config.get('httpServerPort') != "80" && location.hostname.indexOf('.duapp.com')==-1){
			clientSocketServer = location.hostname + ':' + config.get('httpServerPort') + '/socket/';
		}else{
			clientSocketServer = location.hostname + '/socket/';
		}
		//for bae long connection
		clientSocketServer = clientSocketServer.replace('.duapp.com', '.sx.duapp.com');
		//创建一个Socket通道
		fw.dev("OPEN : " +  clientSocketServer);
		reachability.setStatus_(reachability.STATUS_CONNECTING);
		
		socket = new SockJS("http://" + clientSocketServer, undefined, {
		    protocols_whitelist : config.get('protocols_whitelist')
		});
		
		socket.onmessage = function(e){
		    //FIXME RSA client
		    netMessage.onData( rsa_enable ? myrsa.decrypt(e.data) :  e.data);
		};
		
		socket.onopen = function(){
		    reachability.setStatus_(reachability.STATUS_CONNECTED);
		    
			//发送链接标示符
			var identifier = {};
			var SUMERU_APP_UUID = 'sumeru_app_uuid';
			
			if (!rsa_enable) {//默认
			    identifier = {
                    socketId : socketId,
                    uuid    :   SUMERU_APP_UUID
                };
			}else{
			    
                if ( counter === 0 ) { //第一次初始化直接从config的js中下载，同时生成客户端的密钥对
                    myrsa.setPk2( config.get("rsa_pk") );//先设置server的pk，马上本地会重新生成
                    myrsa.generate();
                } else {//断线重连的时候，server端的公钥私钥可能已经发生变化，要重新拉取。
                    identifier.swappk = myrsa.getPk();//有此标识，通讯信息不会加密
                    myrsa.setPk2('');//删除原有pk2，重新获取pk2
                }
                
                identifier.socketId = socketId;
                identifier.uuid = SUMERU_APP_UUID;
                identifier.pk   = myrsa.getPk();
           }
			
			fw.dev("ON OPEN : " + socket.readyState + " : " + JSON.stringify(identifier));
			
			netMessage.sendMessage(identifier, 'echo');
		};
		
		socket.onclose = function(reason){
		    var reconnectTimer = null;
		    
		    fw.log("Socket has been closed : " , reason.reason);
		    reachability.setStatus_(reachability.STATUS_OFFLINE);
		    
		    // 正常关闭时不重连
	        if(reason.code == 1000){
	            return;
	        }
	        
            reconnectTimer = setTimeout(function(){
                // 只有在在线的情况下发生断线,才进行重连,否则交收online事件触发重连..
                // 断开之后在重建之前,检查在线状态,如果不在线,则不重连,并将重连交给online事件.
                if(navigator.onLine === true){
                    __socketInit(++counter);  
                }else{
                    clearTimeout(reconnectTimer);
                }
            }, 1000);
		};
		
		//FIXME RSA,this is client
		var sendMessage = function(data,onerror,onsuccess){
		    
		    if(socket.readyState === 0){
                setTimeout(function(){
                    sendMessage(data,onerror,onsuccess);
                }, 50);
                return;
            }
            
            var data2;
            if ( !rsa_enable || data.match(/"target":"echo"/) !== null ) {
                data2 = data;
            }else{
                data2 = myrsa.encrypt(data);
            }
            
            try {
		        socket.send(data2);
            } catch (e) {
                // TODO: handle exception
                fw.log("error : "+socket.readyState + " " + data);
                onerror && onerror(e);
            }
            
            onsuccess && onsuccess();
		};
		
	    netMessage.setReceiver({
	        onLocalMessage:{
	            target : ['after_echo_from_server'],
	            overwrite : true,
	            handle : function(){
	                fw.auth.init(function(){
	                    inited = true;
	                    callback && callback();
	                    
	                    writeBuffer_.resume();
	                                                    
	                    if(counter > 0){
	                        counter = 0;
	                        fw.pubsub.__load('_redoAllSubscribe')();
	                    }
	                });                            
	            }
	        }
	    });
		
	    writeBuffer_.setOutput(sendMessage);
		netMessage.setOutput(writeBuffer_.write);
        
		return;
	};
	
	fw.init = function(callback){
		if(!inited){
			__socketInit(0, callback);
		}else{
		    callback && callback();
		}
		fw.transition._init();
		//fw.Controller.__load('_load').apply(this, arguments);
	};
	
	fw.reconnect = function(){
        __socketInit(1);
    };
    
    fw.closeConnect = function(){
        socket && socket.close();
    };
	
})(sumeru);;var runnable = function(fw){
    
    var tpls = fw.addSubPackage('render');
    
    //所有分子粒度模板的容器
    var MAIN = 'main_tpl';
    
    /*
     *　//　模版的ID,'view/' + tplName 产生 
     * tplId:{
     *  // 如果不是MAIN，就认为是子controller使用.销毁主controller时，应同时销毁子controller　
     *  type:{String}
     *  // 指向页面DOM的ID
     *  domId: {String}
     *  //使用当前模版的controllerId数组
     *  usering : [controllerId],
     * } 
     */
    var tplContentToController = {};
    
    /**
     * 从一个tplName得到tplId
     */
    var getTplId = function(tplName){
        return 'view/' + tplName;
    };
    /**
     * 从一个tplName取得tplContentId
     */
    var getTplContentId = function(tplName){
        return getTplId(tplName) + "@@content";
    };
    
    var escapeRegex = function(str){
    	return (str+'').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
    }
    tpls.__reg("_buildRender",function(session,source,Handlebars){
        var tplName = session.__currentTplName;
        var isSub = session.__isSubController;
        var __UK = session.__UK + "_";
        var tplId = getTplId(tplName);
        
        var recordId = (isSub ? __UK : "") + tplId;     // 不能变更tplId，因为tplId将用于在缓存模版的script中取值
        
        var tplContentId = (isSub ? __UK : "") + getTplContentId(tplName);
        
        var controllerId = session.__getId();           //　session与controller共用相同ID.
        var tplContentDom;

        if(tplContentToController[recordId] === undefined){
            tplContentToController[recordId] = {
                    type:MAIN,
                    domId:'',
                    usering:[]
            };
        }
        
        var tpl = tplContentToController[recordId];
        
        // 如果是子controller，则通过session取得父，并获取ID
        tpl.type = session.__isSubController ? session.getMain().__getId() : MAIN;
        
        tpl.domId = tplContentId;
        
        if(tpl.usering.indexOf(controllerId) == -1){
            tpl.usering.push(controllerId);
        }
        
        if(tpl.usering.length > 1){
            fw.controller.findAndDestroy(tpl.usering,controllerId);
        }
        
        // 解析
        
        //FIXME tplContent和renderBone似乎没有被调用
        var tpl = {
            tplContent:null,
            renderBone:null,
            renderBlock:{},
            blocksRelation : {}
        };
        tpl.domId = tplContentId;
        
        
        /**
         * 重用模版的根结点.
         */
        
        var reg_replaceUK = /(<[\s]*block[^>]+tpl-id=['"])(.+)(['"][^>]*>)/gm;
        // var parserElement = document.createElement('div');
        
        // var source = document.getElementById(tplId).innerHTML;
        
        //===================
        
        //　渲染方法
        source = source.replace(reg_replaceUK,function(match, p1, p2, p3){
            var rv = p1 + __UK + p2 + p3;
            return rv;
        });
        
        /**
         * blocksRelation
         * 存储嵌套模板关系的数据结构 
         * {
         *  tpl-id : {
         *          tpl-id : {空对象代表无下层嵌套view}，
         *          ...
         *      },
         * 
         *  tpl-id2 : ....
         * }
         */
        var blocksRelation = {};
        
        var blockPairStart = /(<[\s]*block[^>]+tpl-id=['"]([^'"\s]+)['"][^>]*>)([\s\S]*)/mi,
            blockPairEnd = /<[\s]*\/[\s]*block[\s]*>/mi,
            nearbyBlockPairEnd = /(<[\s]*\/[\s]*block[\s]*>)[\s\S]*/mi; //最近的一个结束符
        
        //source = source + ' ';  //加一个空格是为了兼容readBlockRelation的正则
        var source_ = source,
            relationLevelStack = [blocksRelation];
        
        //这个函数匹配之后做什么
        //匹配<block>后用handlebars进行了渲染
        var readBlockRelation = function(){
            var pairStartMatcher,
                pairStartPos,
                pairStartLength,
                pairEndPos,
                match_tplid,
                nextPairStartPos;
                
            while (pairStartMatcher = source_.match(blockPairStart)){
                
                //读取当前匹配的tpl-id
                match_tplid = pairStartMatcher[2];
                
                //计算<block标签的长度
                pairStartLength = pairStartMatcher[1].length;
                
                //计算<block标签的index
                pairStartPos = source_.indexOf(pairStartMatcher[1]);
                
                //寻找第一个出现的结束标签
                pairEndPos = source_.search(blockPairEnd);
                
                if (pairEndPos == -1) {
                    //语法存在错误，少一个</block>的情况
                    pairEndPos = source_.length;
                };
                
                if (pairEndPos < pairStartPos) {
                    //如果在当前开头之前还有没处理的关闭标签，就退出这一层递归，交由上一层处理
                    return;
                };                
                
                //在关系表中记录当前匹配的tplid
                var relationStack = relationLevelStack[relationLevelStack.length - 1];
                relationStack[match_tplid] = {};
                
                //截取模板代码，只取当前匹配的<block标签的后面
                source_ = source_.substr(pairStartPos + pairStartLength);
                pairEndPos -= pairStartPos + pairStartLength;
                
                //寻找下一个出现的<block标签
                nextPairStartPos = source_.search(blockPairStart);
                
                
                relationLevelStack.push(relationStack[match_tplid]);
                
                //如果存在嵌套的下一个block开始标签
                if (nextPairStartPos != -1 && nextPairStartPos < pairEndPos) {
                    //递归进去读取子block
                    readBlockRelation(relationStack[match_tplid]);
                    
                    relationLevelStack.pop();
                    
                    //递归结束后，找到结束的</block>与当前等待的开始标签匹配
                    var nextPairEndMatcher = source_.match(nearbyBlockPairEnd);
                    if (nextPairEndMatcher) {
                        
                        var nextPairEndMatcherPos = source_.search(nearbyBlockPairEnd),
                            nextPairEndMatcherLength = nextPairEndMatcher[1].length;
                        
                        //截取模板代码，只取当前匹配的</block>标签的后面
                        source_ = source_.substr(nextPairEndMatcherPos + nextPairEndMatcherLength);
                        
                        //构造一个正则 从原始的source中提取出这一段html
                        var tmp_reg = new RegExp('<[\\s]*block[^>]+tpl-id=[\'"]' + match_tplid  + '[\'"][^>]*>([\\s\\S]+)<[\\s]*\/[\\s]*block[\\s]*>' + escapeRegex(source_) + '$', 'mi');
                        //注意这里使用的是原始的source
                        var tmp_match = source.match(tmp_reg);
                        if (tmp_match) {
                            tpl.renderBlock[match_tplid] = Handlebars.compile(tmp_match[1]);
                        };
                    };
                    
                } else {
                    relationLevelStack.pop();
                    tpl.renderBlock[match_tplid] = Handlebars.compile(source_.substr(0, pairEndPos));
                
                    //截取模板代码，只取当前匹配的</block>标签的后面
                    var nextPairEndMatcher = source_.match(nearbyBlockPairEnd);
                    if (nextPairEndMatcher) {
                        
                        var nextPairEndMatcherPos = source_.search(nearbyBlockPairEnd),
                            nextPairEndMatcherLength = nextPairEndMatcher[1].length;
                       
                        source_ = source_.substr(nextPairEndMatcherPos + nextPairEndMatcherLength);
                    }
                }
            }    
        }
        
        readBlockRelation();
        
        delete relationLevelStack;

        tpl.blocksRelation = blocksRelation;
        
        //使用非贪婪匹配正则，去掉block中的元素
        source = source.replace(/(<block[^>]*>)[\s\S]*?(<\/block>)/ig,"\$1\$2");
        //先把骨头架子渲染出来，不带有具体的block内容
        var renderFunc = tpl.renderBone = Handlebars.compile(source);
        //recycle
        // parserElement = null;
        tpl.tplContent = renderFunc({});
        
        return tpl;
    },true);
    
}
if(typeof module !='undefined' && module.exports){
    module.exports = runnable;
}else{//这里是前端
    runnable(sumeru);
};(function(fw){
    
    var tpls = fw.render;
    
    //所有分子粒度模板的容器
    var tplMap = {};
    var tplMapCallbackStack = {};
    
    /*
     *　//　模版的ID,'view/' + tplName 产生 
     * tplId:{
     *  // 如果不是MAIN，就认为是子controller使用.销毁主controller时，应同时销毁子controller　
     *  type:{String}
     *  // 指向页面DOM的ID
     *  domId: {String}
     *  //使用当前模版的controllerId数组
     *  usering : [controllerId],
     * } 
     */
    tplContentToController = {};
    
    
    var cleanCSS = {
            top:'',
            left:'',
            right:'',
            bottom:'',
            width:'',
            height:'',
            display:'',
            position:'',
            margin:'',
            padding:'',
    };
    
    /**
     * 从一个tplName得到tplId
     */
    var getTplId = function(tplName){
        return 'view/' + tplName;
    };
    
    /**
     * 从一个tplName取得tplContentId
     */
    var getTplContentId = function(tplName){
        return getTplId(tplName) + "@@content";
    };
    
    var getTplContent = tpls.__reg('getTplContent',function(session){
        var id = getTplContentId(session.__currentTplName);
        if(session.__isSubController){
            id = session.__UK + "_" + id;
        }
        return document.getElementById(id);
    });
    
    var clearTplContent = tpls.__reg('clearTplContent',function(session){
        var dom = getTplContent(session);
        
        if(dom){
            dom.innerHTML = '';
            /**
             * 如果当前的session是一个子controller的session，那么当前session所指向的controller所操
             * 作的dom，将为一个私有的dom，即只有当前controller会操作，所以，在销毁的时候，将记录一并销毁.
             */
            if(session.__isSubController){
                var __UK = session.__UK + "_";
                var recordId = __UK + getTplId(session.__currentTplName);
                tplContentToController[recordId] = null;
                delete tplContentToController[recordId];
                
                dom.parentElement.removeChild(dom);
            }else{
                /**
                 * 如果不是子controller，则保留dom及使用记录对像
                 */
                fw.utils.setStyles(dom,cleanCSS);
            }
        }
    });
    tpls.__reg('buildRender',function(session){
    	//begin
    	var tplName = session.__currentTplName;
        var isSub = session.__isSubController;
        var __UK = session.__UK + "_";
        var tplId = getTplId(tplName);
        var tplContentId = (isSub ? __UK : "") + getTplContentId(tplName);
        var tplContentDom;
        
		var source = document.getElementById(tplId).innerHTML;
        //From build render base
    	var tpl = tpls._buildRender(session,source,Handlebars);
    	
    	//after
    	if(!(tplContentDom = document.getElementById(tplContentId))){
    		var container;
    		
	        if(session.__isSubController){
	            container = getTplContentId(session.getMain().__currentTplName);
	        }else{
	            container = '_smr_runtime_wrapper';
	        }
            //创建根结点
            tplContentDom = document.createElement('section');
            tplContentDom.id = tplContentId;
          
            // 插入
            document.getElementById(container).appendChild(tplContentDom);
        }
        tplContentDom.innerHTML = tpl.tplContent;//renderFunc({});
        
        return tpl;
    	
    });
    tpls.__reg("getTplStatus",function(tplName){
        var tplId = getTplId(tplName)
        return tplMap[tplId];
    });
    tpls.__reg("delTpl",function(tplName){
        var tplId = getTplId(tplName)
        delete tplMap[tplId];
    });
    // 从server端获取一个模版，并编译处渲染方法
    tpls.__reg("getTpl",function(tplName,session,oncomplete){
        var tplId = getTplId(tplName);
        var __UK = session.__UK + "_";
        
        if(typeof tplMap[tplId] !== 'undefined'){
        	//server render NEEDS HTML as STRING
	        //设计思路 BY sundong
	        //nodejs的优势在于可以嵌套callback，异步的执行
	        //使用event trigger替代轮巡检查settimeout，如有bug请指出
        	if (tplMap[tplId] === 'loading'){
        		tplMapCallbackStack[tplId].push(oncomplete);
        	}else{
        		oncomplete();
        	}
       		
        } else {
            var net = Library.net;
            tplMap[tplId] = 'loading';
            tplMapCallbackStack[tplId] = new Array();
            tplMapCallbackStack[tplId].push(oncomplete);
            
            net.get({
                url : sumeru.config.view.get('path') + tplId + '.html',
                callback : function(data){
                    tplMap[tplId] = 'loaded';
                    
                    var node = document.createElement('script');
                    
                    node.id = tplId;
                    node.type = 'text/x-sumeru-template';
                    node.innerHTML = data;
                    // 
                    document.getElementById('_smr_runtime_wrapper').appendChild(node);
                    for(var i =0;i<tplMapCallbackStack[tplId].length;i++){
                    	tplMapCallbackStack[tplId][i]();
                    }
                    // oncomplete();
                }
            });
        }
    },true);
})(sumeru);;Model = Model || {};
Model.smrAuthModel = function(exports){    
	exports.config = {
		fields: [
			{name: 'token',  type: 'string'},
			{name: 'password',   type: 'string'},
			{name: 'sessionId', type: 'string'},
			{name: 'info', type: 'object'},
			{name: 'status', type: 'string', defaultValue: '0'},
			{name: 'clientId', type: 'string'},
			{name: 'secretKey', type: 'string'},
			{name: 'passportType', type: 'string', defaultValue: 'local'},
			{name: 'vCodeStr', type: 'string'},
			{name: 'verifyCode', type: 'string'},//verifyCode image url.
		]
	};
};

Model.smrLoginModel = function(exports){    
	exports.config = {
		fields: [
			{name: 'clientId',  type: 'string'},
			{name: 'token',   type: 'string'},
			{name: 'sessionId', type: 'string'},
			{name: 'time', type: 'string'},
			{name: 'userId', type: 'string'},
			{name: 'lastRequestTime', type: 'string'},
			{name: 'isLogin', type: 'string', defaultValue: '1'},
			{name: 'info', type: 'object'},
            {name: 'expires', type: 'int'}
		]
	};
};;(function(fw){
    var auth = fw.addSubPackage('auth');
    auth.addSubPackage('tpa');
	auth.addSubPackage('baidu');
	
	var _isAuth = false, 
	    _isInit = false,
		detectCallback = [],
		authstatus = {},
		passportTypeList = {},
		sessionTimeout = 24*365*20,//20年
		pubsub = new fw.pubsub._pubsubObject();
	
	authstatus.LOGOUT = '0';//未登录
	authstatus.LOGIN = '1';//已登陆
	authstatus.LOGIN_UNKNOW = '2';//登录用户名或密码错误
	authstatus.LOGIN_TIMEOUT = '3';//登陆过期
	authstatus.LOGIN_PASSWORD_UPDATE = '4';//密码更改
	authstatus.LOGIN_VERIFY_CODE = '5';//需要输入验证码
	
	authstatus.UPSERT_SUCC = '10';//注册或更新成功
	authstatus.UPSERT_FAIL = '11';//注册或更新未知的失败
	authstatus.UPSERT_REPEAT = '12';//TOKEN 重复
	
	passportTypeList.local = 'LOCAL';
	passportTypeList.baidu = 'BAIDU';
	passportTypeList.tpa = 'tpa'; // 3rd party account
	
	var authModel = fw.model.create('Model.smrAuthModel');
	var baiduCodeBaseUrl = "http://passport.baidu.com/cgi-bin/genimage?";
	
	var _init = function( callback ){
	    var self = this;
		var cookie = Library.cookie;
	    var sessionId = cookie.getCookie('sessionId');
		var clientId = cookie.getCookie('clientId');
		var passportType = cookie.getCookie('passportType');
		
		if(!sessionId){
		    authModel.set('status', authstatus.LOGOUT);
		}
		if(clientId){
		    authModel.set('clientId', clientId);
		}
		
		pubsub.subscribe('auth-init', sessionId, clientId, passportType, function(collection){
			var item = collection.get(0);
			if(sessionId && sessionId === item.get('sessionId')){
				authModel.set('status', authstatus.LOGIN);
				authModel.set('token', item.get('token'));
                authModel.set('info', item.get('info'));
                authModel.set('passportType', item.get('passportType'));
				_isAuth = true;
			}
			//authModel.set('clientId', item.get('clientId'));
			//only set once
			if(!clientId){
			    Library.cookie.addCookie('clientId', item.get('clientId'), sessionTimeout);
			}
			
			if(detectCallback && detectCallback.length > 0){
			    detectCallback.forEach(function(item){
				   item();
				});
			}
			_isInit = true;
			callback && callback.call(self, authModel.get('status'));
		});
	};
	
	var _handlerLogin = function(collection, callback){
	    var status = authstatus.LOGOUT;
		//后端一定返回一个model
		if(collection.length > 0){
			var model = collection.get(0);
			status = model.get('status');
			//保存登陆返回的状态
			authModel.set('status', status);
			sumeru.model._extend(authModel, model)
			
			if(status === authstatus.LOGIN){
				//设置前端为登陆状态
				_isAuth = true;
				//永久存储信息到cookie， 用户删除除外。
				Library.cookie.addCookie('sessionId', model.get('sessionId'), sessionTimeout);
				Library.cookie.addCookie('passportType', model.get('passportType'), sessionTimeout);
			}
			
			if(model.get('passportType') === passportTypeList.baidu){
			    authModel.set('verifyCode', baiduCodeBaseUrl + model.get('vCodeStr'));
			}
		}
		callback && callback.call(this, {
			success: (status === authstatus.LOGIN),
			status: status
		});

		if(status === authstatus.LOGIN){
			sumeru.auth.success && sumeru.auth.success();
		}
		
	};
	
	/**
     *本地帐户登录
     *两种参数给定的方式：
     *1：{token: 'name', password: 'cryption', callback: function,expires: 1000}
     *2: function(token, password, expires, callback)
     */
	var _login = function(){
        if(arguments.length === 0){
            throw 'Please specified local token or password.';
        }
        
        var token, password, expires, callback;
        var clientId = Library.cookie.getCookie('clientId');
        if(arguments.length === 1 && 
          typeof arguments[0] === 'object'){
            var userinfo = arguments[0];
            token = userinfo.token;
            password = userinfo.password;
            callback = userinfo.callback;
            expires = userinfo.expires;
        }else{
            token = arguments[0];
            password = arguments[1];
            if(arguments.length <= 3){
               callback = arguments[2];
            }else{
               expires = arguments[2]
               callback = arguments[3];
            }
        }
        
	    pubsub.prioritySubscribe('auth-login', 
          token, password, clientId, expires, function(collection){
		    _handlerLogin.call(fw.auth, collection, callback);
		});
	};
	
	/**
     *百度账户登录
     *两种接受参数的方式
     *1：{token: 'name', 
     *    password: 'cryption', 
     *    verifyCode: 'code',
     *    callback: function
     *   }
     *2:function(token, password, veryfycode, callback)
     */
	var _loginWithBaidu = function(){
        if(arguments.length === 0){
            throw 'Please specify the token or password with baidu account';
        }
	    var clientId, token, password, verifyCode, expires, callback;
	    clientId = Library.cookie.getCookie('clientId');
		
		if(arguments.length === 1 &&
          typeof arguments[0] === 'object'){
            var userinfo = arguments[0];
		    token = userinfo.token;
            password = userinfo.password;
            callback = userinfo.callback;
            expires = userinfo.expires;
            verifyCode = userinfo.verifyCode;
		}else {
		    token = arguments[0];
			password = arguments[1];
			if(arguments.length === 3){
				callback = arguments[2];
			}else if(arguments.length > 3){
				verifyCode = arguments[2];
				callback = arguments[3];
			}
		}
		
	    pubsub.prioritySubscribe('auth-login-baidu', 
		    clientId, token, password, authModel.get('vCodeStr'), 
            verifyCode, expires, function(collection){
		    _handlerLogin.call(fw.auth, collection, callback);
		});
	};
	
	//使用第三方账户登录
	var _loginWithOther = function(){
	    var token, password, argstr, callback;
	    var clientId = Library.cookie.getCookie('clientId');
	    
	    if(arguments.length < 2){
	        throw 'Please specify the token or password with baidu account';
	    }else {
	        token = arguments[0];
	        password = arguments[1];
	        if(arguments.length === 3){
	            argstr = '';
	            callback = arguments[2];
	        }else if(arguments.length > 3){
	            argstr = arguments[2];
	            callback = arguments[3];
	        }
	    }
	    
	    pubsub.prioritySubscribe('other-login',token, password,argstr, clientId, function(collection){
	        _handlerLogin.call(fw.auth, collection, callback);
	    });
	};
	
	//插入账户到本地数据库
	var _upsert = function(token, password, info, callback){
	    var clientId = Library.cookie.getCookie('clientId');
		
	    pubsub.subscribe('auth-register', token, password, info, clientId, function(collection){
		    //后端一定会返回一个model
			var item = collection.get(0);
			var status  = item.get('status');
			
			callback.call(fw.auth, {success: status === authstatus.UPSERT_SUCC, status : status });
		});
	};
	
	//更新某用户信息
	var _update = function(newInfo, callback){
	    if(_isAuth){
		    var clientId = Library.cookie.getCookie('clientId');
		    var sessionId = Library.cookie.getCookie('sessionId');
			
			pubsub.subscribe('auth-update', sessionId, clientId, newInfo, function(collection){
				//后端一定会返回一个model
				var item = collection.get(0);
				var status  = item.get('status');
				
				callback.call(fw.auth, {success: status === authstatus.UPSERT_SUCC, status : status });
			});
		}
	};
	
	var _register = function(token, password, info, callback){
	    _upsert(token, password, info, callback);
	}
	
	var _logout = function(callback){
	    var sessionId = Library.cookie.getCookie('sessionId');
		var clientId = Library.cookie.getCookie('clientId');
		
		pubsub.subscribe('auth-logout', sessionId, clientId, function(collection){
		    var item = collection.get(0);
			if(item.status === authstatus.LOGOUT){
			    authModel.status = authstatus.LOGOUT;
			    authModel.sessionId = '';
			    Library.cookie.deleteCookie('sessionId');
			}
			callback && callback.call(fw.auth, 
			    {success: (item.status === authstatus.LOGOUT), status: item.status});
		});
	};
	
	var _isLogin = function(callback){
	    var self = this;
	    if(_isInit){
		    callback && callback.call(this, authModel.get('status'));
		}else{
		    callback && detectCallback.push(function(){
			    callback.call(self, authModel.get('status'));
			});
		}
		return (authModel.get('status') === authstatus.LOGIN);
	};
	
	var _getToken = function(){
	    return (_isAuth ? authModel.get('token') : '');
	};
	
	var _getModel = function(){
	    return sumeru.model._extend(sumeru.model.create('Model.smrAuthModel'), authModel);
        //return (_isAuth ? sumeru.model._extend(sumeru.model.create('Model.smrAuthModel'), authModel) : null);
	};
	
	var _getVerifyCode = function(){
	    var status = authModel.get('status');
	    if(status === authstatus.LOGIN_VERIFY_CODE){
		    return authModel.get('verifyCode');
		}
		return null;
	}
	
	fw.auth.__reg('init', _init, 'private');
	
	fw.auth.__reg('login', _login);
	fw.auth.__reg('logout', _logout);
	fw.auth.__reg('register', _register);
	fw.auth.__reg('update', _update);
    fw.auth.__reg('getToken', _getToken);
    fw.auth.__reg('getModel', _getModel);
	fw.auth.__reg('isLogin', _isLogin);
	
	fw.auth.__reg('getVerifyCode', _getVerifyCode);//获取图片验证码
	
	fw.auth.tpa.__reg('login', _loginWithOther);
	//百度api
	fw.auth.baidu.__reg('login', _loginWithBaidu);
})(sumeru);