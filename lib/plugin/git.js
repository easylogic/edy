var git = require('gitty');
var url = require('url');
var mkdirp = require('mkdirp');

/**
 * 
 * edy -p git -s https://github.com/id/project.git -r /home/dir/project
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
	
	var p = parsedSource.protocol.split("+").pop();
	
	if (p.indexOf('http') > -1) {
		parsedSource.protocol = p;
	}
	
	var source 		= url.format(parsedSource);
	var cwd 			= source_dir;
  
  mkdirp.sync(source_dir);
  edy.emit('mkdir', 'download', 'git', null, source_dir);
  //console.log(source, parsedSource);
	
	git.clone(cwd, source, function(err, success) {
		if (success) {
			success = success.split("\r")
		} 
		
		edy.emit('done', 'download', 'git', err, success)
 
	}, creds);

}

module.exports = Component;