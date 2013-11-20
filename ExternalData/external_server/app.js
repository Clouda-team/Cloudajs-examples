var port = process.env.APP_PORT;

var http = require('http');
var url = require('url');
var dbconfig = require('./database.js');
var MongoClient = require('mongodb').MongoClient;

var dbpath = dbconfig.getDbPath();

var cols = {};
var colName = "demo";
var colRowsMax = 20;
MongoClient.connect(dbpath, function(err, db){
	
	if(err){ throw err;process.exit(1); }
	cols[colName] = db.collection(colName);
	
});


function parsePost(req, res, handler) {
	
	var data = '';
	
	req.on('data', function(chunk) {
		data += chunk;
	});
	
	req.on('end', function() {
		handler(req , res, data);
	});
	
}

function getHandler(req, res){
	
	var criteria = {};
	var retriveCallback = function(data){
	
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(data));
	};
	
	var ageParam = url.parse(req.url,true).query.age;
    ageParam = parseInt(ageParam); 
	var findWhere =  -1 < ageParam  ? {age:ageParam}: {};
        
	cols[colName].find(findWhere).toArray(function(err, records){
		retriveCallback(records)
	});

	
}

function postHandler(req, res, postdata) {
	
	var pathname = url.parse(req.url).pathname.replace(/\//g, "");
	
	var handlerHash = {
		"insert" : doInsert,
		"delete" : doDelete,
		"update" : doUpdate
	};
	
	if(!handlerHash[pathname]){
		res.writeHead(404, {"Content-Type": "text/html"});
		res.end("Page Not Found");
	}
	
	handlerHash[pathname](res, postdata);
	
}

function doInsert(res, postdata){
	postdata = decodeURIComponent(postdata);
	var data = JSON.parse(postdata);
	var insertCallback = function(data){
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end();
	}
	
	var newObj = {
		name : data.name,
		age  : data.age
	}

    cols[colName].count(function(err,count){
        if(colRowsMax > count) {
            cols[colName].insert(newObj, {safe: true}, function(err, records){
                if(err){ throw err; }
                insertCallback(records);
            });
        }
    });
}

function doDelete(res, postdata){
	postdata = decodeURIComponent(postdata);
	var data = JSON.parse(postdata);
	
	var deleteCallback = function(data){
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end();
	}
	
	var where = {
		name : data.name
	}
	
	cols[colName].remove(where, function(err, records){
		if(err){ throw err; }
		deleteCallback(records);
	});
	
}

function doUpdate(res, postdata){
	
	postdata = decodeURIComponent(postdata);
	var data = JSON.parse(postdata);
	
	var updateCallback = function(data){
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end();
	}
	
	var criteria = {
		name : data.name
	}
	
	cols[colName].update(criteria, {$set:{ age: data.age}}, {w:1}, function(err, records){
		if(err){ throw err; }
		updateCallback(records)
	});
	
}

var server = http.createServer(function(req, res){
	
	if(req.url.indexOf('/favicon.ico') >= 0){ return; }
	if(req.method === "POST"){
		parsePost(req, res, postHandler);
	}else{
		getHandler(req, res);
	}
	
});

server.listen(port);