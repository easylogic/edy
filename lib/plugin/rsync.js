var Rsync = require('rsync');
var url = require('url');
var fs = require('fs');
var mkdirp = require('mkdirp');

/**
 * 
 * edy -s rsync://host.com/test/project/ -r /home/dir/project
 * edy -s rsync://host.com/test/project/test.js -r /home/dir/project/test.js
 * edy -p rsync -s /test/project -r /home/dir/project
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
	var parsedSource = edy.parsedSource;
	if (parsedSource.auth) {
		var auth 				= parsedSource.auth.split(":");
		delete parsedSource.auth;
		var username 	= auth.shift();
		var password 	= auth.join(":");				
		var creds = { user : username, password : '"' + password + '"' }; 
	} else {
		var creds = null;
	}
	
	var source 		= (parsedSource.hostname ?  parsedSource.hostname + ":" : "") + parsedSource.pathname ;
	
	if (username) {
		source = username + "@" + source;
	}
	  
  //mkdirp.sync(source_dir);
  //console.log(source, parsedSource);
  var rsync_opt = {
    source:       source,
    destination: edy.root ,
    exclude:     ['.git', '.svn', "node_modules"],
    flags:       'avz',
    shell:       'ssh'
  }
  
  var rsync = Rsync.build(rsync_opt)
   rsync.set('delete');
  
  edy.emit('start', 'download', 'rsync', null, { command : rsync.command() });
   
  rsync.execute(function(error, stdout, stderr) {
    edy.emit('done', 'download', 'rsync', error, { command : rsync.command(), output : stdout + stderr });
  }); 

}

Component.prototype.upload = function(edy) {
	var source_dir 	= edy.root;
	var parsedTarget = edy.parsedTarget;
	
	if (parsedTarget.auth) {
		var auth 				= parsedTarget.auth.split(":");
		delete parsedTarget.auth;
		var username 	= auth.shift();
		var password 	= auth.join(":");				
		var creds = { user : username, password : '"' + password + '"' }; 
	} else {
		var creds = null;
	}
	
	var destination 		= (parsedTarget.hostname ?  parsedTarget.hostname + ":" : "") + parsedTarget.pathname ;
	
  //console.log(source, parsedSource);
  var rsync_opt = {
    source:       source_dir,
    destination: destination,
    exclude:     ['.git', '.svn', 'node_modules'],
    flags:       'avz',
    shell:       'ssh'
  }
  
  var rsync = Rsync.build(rsync_opt)
   rsync.set('delete');
  
  edy.emit('start', 'upload', 'rsync', null, { command : rsync.command() });
   
  rsync.execute(function(error, stdout, stderr) {
    edy.emit('done', 'upload', 'rsync', null, { command : rsync.command(), output : stdout + stderr });
  });
}


module.exports = Component;