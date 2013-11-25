var fs 			= require('fs')
		async 	= require('async'),
		path 	= require('path'),
		child_process = require('child_process'),
		exec 		= child_process.exec,
		spawn 	= child_process.spawn,
		Source 	= require('./Source'),
		Target 	= require('./Target'),
		Shell 	= require('./Shell'),
		util 		= require('util'),
		url 		= require('url'),
		events 	= require("events");

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

edy.prototype.homedir = function(local_path) {
	var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
	
	local_path = local_path.replace("~", home);
	
	if (fs.existsSync(local_path)) {
		return fs.realpathSync(local_path);
	} else {
		return local_path;
	}
}

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
  
  if (arguments.length == 2 && typeof arguments[0] == 'string' && typeof arguments[1] == 'string') {
    opt = {
      source : arguments[0],
      target : arguments[1]
    };
  } else if (arguments.length == 3 
    && typeof arguments[0] == 'string' 
    && typeof arguments[1] == 'string'
    && typeof arguments[2] == 'string'
  ) {
    opt = {
      source : arguments[0],
      root : arguments[1],
      target : arguments[2]
    };    
  }
  
	return new edy(opt, callback);
}

module.exports = edy;
