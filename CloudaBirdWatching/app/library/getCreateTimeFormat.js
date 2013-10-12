/**
 * Copyright (c) 2013 Oliver Luan (luanyanqiang01@baidu.com) Gan Xun (ganxun@baidu.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

Library.createTimeFormat = sumeru.Library.create(function(exports){
    exports.formatTime = function(time){
        var createTime = new Date(time);
        var currentTime = new Date();

        getMinutes = createTime.getMinutes();
        if(getMinutes === 0){
            //get Minutes
            getMinutes = getMinutes +"0";

        }else{
            if(getMinutes > 0 && getMinutes < 10){
                //formate Minutes
                getMinutes = "0" + getMinutes;
            }
        }

        if(createTime.getYear() == currentTime.getYear()){
            return (createTime.getMonth()+1)+"-"+createTime.getDate()+"  "+createTime.getHours()+":"+getMinutes;
        }else{

            return createTime.getYear()+"-"+(createTime.getMonth()+1)+"-"+createTime.getDate()+"  "+createTime.getHours()+":"+getMinutes;
        }
    };
    return exports;
});
