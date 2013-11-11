var client = require('scp2');
var url = require('url');
var mkdirp = require('mkdirp');

/**
 * 
 * edy -s scp://id:pw@host.com/test/project/a.txt -r /home/dir/project
 * 
 * @param {Object} command
 * @param {Object} edy
 * @param {Object} parsedSource
 * @param {Object} cb
 */
function Component (command, edy) {
	var cmd = this[command];
	
	if (cmd) {
		cmd.call(this, edy);
	} else {
		new Error('invalid command git : ' + command);
	}
}

Component.prototype.download = function(edy) {
	var source_dir 	= edy.root;
	var parsedSource 	= edy.parsedSource;
	if (parsedSource.auth) {
		var auth 				= parsedSource.auth.split(":");
		delete parsedSource.auth;
		var username 	= auth.shift();
		var password 	= auth.join(":");				 
	} else {
		var creds = null;
	}
	
	var source 		= parsedSource.pathname ;
	  
  mkdirp.sync(source_dir);
	edy.emit('mkdir', 'download', 'scp', null, source_dir);  
  
  var scp_opt = {
    host: parsedSource.host,
    username: username,
    password: password,
    path: parsedSource.pathname
  }
  
  client.scp(scp_opt, source_dir, function(err) {
  	client.close();
  	edy.emit('done', 'download', 'scp', err, {  source : scp_opt.path, target : source_dir });
  })
  
}

Component.prototype.upload = function(edy) {
	var source_dir 	= edy.root;
	var parsedTarget = edy.parsedTarget;
	
	if (parsedTarget.auth) {
		var auth 				= parsedTarget.auth.split(":");
		delete parsedTarget.auth;
		var username 	= auth.shift();
		var password 	= auth.join(":");				 
	} else {
		var creds = null;
	}

	  
  var scp_opt = {
    host: parsedTarget.host,
    username: username,
    password: password,
    path: parsedTarget.pathname
  }
  
  client.scp(source_dir, scp_opt, function(err) {
  	client.close();
  	edy.emit('done', 'download', 'scp', err, {  source : source_dir , target : scp_opt.path});
  })
  
}

module.exports = Component;