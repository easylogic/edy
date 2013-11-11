var SVN = require('node.svn');
var url = require('url');
var mkdirp = require('mkdirp');

/**
 * 
 * edy -p svn -s https://test.com/svn/trunk -r /home/dir/project 
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
		new Error('invalid command svn : ' + command);
	}
}

Component.prototype.download = function(edy) {
	var source_dir 	= edy.root
	var parsedSource = edy.parsedSource;
	var auth 				= parsedSource.auth.split(":");
	delete parsedSource.auth;
	
	var source 		= url.format(parsedSource);
	var cwd 			= source_dir;
	var username 	= auth.shift();
	var password 	= auth.join(":");  
	
	mkdirp.sync(source_dir);
  edy.emit('mkdir', 'download', 'svn', null, source_dir);
  			
	var svn = new SVN({ username : username, password : '"' + password + '"', cwd : source_dir });
		
	//console.log(command, edy, parsedSource);
	var command = [source].join(" ");
	svn.co(command, function(err, info) {
		edy.emit('done', 'download', 'svn', err, info) 
	})
	
}

module.exports = Component;