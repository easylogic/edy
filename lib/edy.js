var fs 			= require('fs');
var async 	= require('async');
var child_process = require('child_process');
var exec 		= child_process.exec;
var spawn 	= child_process.spawn;
var Source 	= require('./Source');
var Target 	= require('./Target');
var Shell 	= require('./Shell');
var util 		= require('util');
var url 		= require('url');
var events 	= require("events");

global.exec = {};
global.plugin = {};
 

function loadPlugin(type) {
	var path = __dirname + "/" + type;
	var arr = fs.readdirSync(path);
	
	for (var i in arr) {
	  var file = arr[i];
	  if (file.split(".").pop() != 'js') continue;
	  
	  file = file.replace(".js", "");
	  global[type][file.toLowerCase()] = require(path + "/" + file);
	}	
}

loadPlugin('plugin');
loadPlugin('exec'); 


function edy (opt, callback) {
	
	events.EventEmitter.call(this);
	
		
	console.log(opt);
	
	this.source 	= opt.source;
	this.root 		= opt.root || "/tmp/edy/" + (+new Date);
	this.protocol = opt.protocol;
	this.target 	= opt.target;
	this.exec = opt.exec;	
    this.sync       = opt.sync;
    this.exclude    = opt.exclude;
	
	//console.log(opt);
	
	if (this.source) this.parsedSource = url.parse(this.source, true, true);	
	if (this.target) this.parsedTarget = url.parse(this.target, true, true);
	this.callback = callback || {};
	
	//console.log(this);
	
	this.delivery();
	
	// delegate events
	for(var evt in this.callback) {
		this.on(evt, this.callback[evt].bind(this));
	}

}

util.inherits(edy, events.EventEmitter);

edy.prototype.delivery = function() {
	
	if (this.exec) {
		this.run_shell();
	} else if (this.source && this.target) {		// 소스와 타켓이 다 있을 때는
		
		if (!this.parsedTarget.protocol) {
			// target 이 로컬이면 source 의 root 처럼 동작한다. 
			this.root = this.target;
			this.run_download();

		} else if (!this.parsedSource.protocol) {
			// source 가 로컬이면 target 의 root 처럼 동작한다. 
			this.root = this.source;
			this.run_upload();
			
		} else {
			this.run_sync();	
		}
		
		
	} else if (this.source && !this.target) {
		this.run_download();
	} else if (!this.source && this.target) {
		this.run_upload();
	} else {	// 소스가 없을 때 
		console.log('source and target is not exists.')
	}
		
}

edy.prototype.run_shell = function() {
	new Shell(this)
}

// 여기는 개별 파일 실행하는 곳 
edy.prototype.run_sync = function(cb) {
	var self = this; 
	
	this.on('done', function(type) {
		if (type == 'download') {
			this.run_upload(function(){
				self.emit('done', 'sync', 'sync');
			});			
		}
	})
	
	this.run_download()
}

edy.prototype.run_upload = function() {
	new Target(this)
}

edy.prototype.run_download = function() {
	new Source(this)
}

edy.run = function(opt, callback) {
	return new edy(opt, callback);
}

module.exports = edy;
