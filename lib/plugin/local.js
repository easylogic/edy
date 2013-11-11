var ftp = require('ftp');
var fs = require('fs');
var path = require('path');


function Component (command, opt, parsed, cb) {
	var cmd = this[command];
	
	if (cmd) {
		cmd.call(this, opt, parsed, cb);
	} else {
		new Error('invalid command local : ' + command);
	}
}

Component.prototype.download = function(opt, parsedSource, cb) {
	cb('local', null, null)
}

Component.prototype.upload = function(opt, parsedTarget, cb) {
	cb('local', null, null)
}


module.exports = Component;