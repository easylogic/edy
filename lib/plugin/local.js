var ftp = require('ftp');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var wrench = require('wrench');


function Component (command, edy) {
	
	edy.download = (command == 'download');
  if (edy.sync) command = 'sync_' + command;	
	
	var cmd = this[command];
	
	if (cmd) {
		cmd.call(this, edy);
	} else {
		new Error('invalid command local : ' + command);
	}
}

Component.prototype.sync_download = function(edy) {
	mkdirp.sync(edy.root);	
	wrench.copyDirSyncRecursive(edy.parsedSource.pathname, edy.root, {
	    forceDelete: true
	});
}

Component.prototype.download = function(edy) {
	mkdirp.sync(edy.root);
	wrench.copyDirSyncRecursive(edy.parsedSource.pathname, edy.root, {
	    forceDelete: false
	});
}


module.exports = Component;