var ftp 		= require('ftp');
var fs 			= require('fs');
var path 		= require('path');
var mkdirp 	= require('mkdirp');
var async 	= require('async')
var glob 		= require('glob')
var url 		= require('url');
var request = require('request');

/**
 * 
 * edy -s http://id:pw@test.com/hello/test.zip -r /home/dir/hello
 * 
 */
function Component (command, edy) {
	var cmd = this[command];
	
	if (cmd) {
		cmd.call(this, edy);
	} else {
		new Error('invalid command http : ' + command);
	}
}

Component.prototype.download = function(edy) {
	var source_dir 		= edy.root;
	var parsedSource  = edy.parsedSource;
	if (parsedSource.auth) {
		var auth 				= parsedSource.auth.split(":");
		var username 		= auth.shift();
		var password 		= auth.join(":");				
		var creds 			= { user : username, password : password };
		
		parsedSource.user = username;
		parsedSource.password = password; 
	} else {
		var creds = {};
	}
	
	if (!fs.statSync(source_dir).isDirectory()) {
		var dir = path.dirname(source_dir)
		var is_dir = false;
	} else {
		var dir = source_dir;
		var is_dir = true; 
	}
		
	mkdirp.sync(dir);
	edy.emit('mkdir', 'download', 'ftp', null, dir);		
	
	var remote_path = url.format(parsedSource);
	
	var opt = {
	  url : remote_path,
	  method : parsedSource.query.method || 'get'
  }
  
  if (parsedSource.auth) {
  	opt.auth = creds;
  }
  
  if (is_dir) {
  	var filename = path.basename(parsedSource.pathname);
  	var local_file = path.join(source_dir, filename)	
  } else {
		var local_file = source_dir;  		
  }
  
	edy.emit('start', 'download', 'http', null, { source : remote_path, target : local_file });
	request(opt, function(err, response, body){
		edy.emit('done', 'download', 'http', err, { source : remote_path, target : local_file, response : response, body : body})
	}).pipe(fs.createWriteStream(local_file))
	
}

Component.prototype.upload = function(opt, parsedTarget, cb) {
	
	if (parsedTarget.auth) {
		var auth 				= parsedTarget.auth.split(":");
		var username 		= auth.shift();
		var password 		= auth.join(":");				
		var creds 			= { user : username, password : '"' + password + '"' };
		
		parsedTarget.username = username;
		parsedTarget.password = password; 
	} else {
		var creds = null;
	}

  var r = request({
   url : url.format(parsedTarget),
   method : parsedTarget.query.method || 'post' 
  })
  var form = r.form()
  
  form.append(parsedTarget.query.name || 'upload_file', fs.createReadStream(opt.root))
}

module.exports = Component;