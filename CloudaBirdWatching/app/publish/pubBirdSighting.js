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

module.exports = function(fw) {

    // topic 1: manipulate all data, so no query conditions in find(); for data in sightingListView.
    fw.publish('birdSightingModel', 'pubBirdSighting', function(callback) {
        var collection = this;
        collection.find({}, {sort:[['date',1]]}, function(err, items) {
            callback(items);
        });
    }, {
        // add the 4th param, to ensure using server time as date
        beforeInsert : function(serverCollection, structData, userinfo, callback) {
            structData.date = (new Date()).valueOf(); 
            callback(structData);

        }
    });

    // topic 2: look for single model by matching date filed; for data in sightingDetailView
    fw.publish('birdSightingModel', 'pubBirdSightingDetail', function(id,callback) {
        var collection = this;
        collection.find({'date':parseInt(id, 10)}, {sort:[['date',1]]}, function(err, items){
            callback(items);
        });
    });
};
