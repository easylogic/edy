var url = require('url');
var fs = require('fs');


function Shell(edy) {
	this.exec(edy);
}

Shell.prototype.exec = function(edy) {
	var protocol = edy.parsedSource.protocol + "";
	var p = edy.protocol;
	
	if (!p) { p = protocol.split(":")[0].split("+")[0] ; }
	if (!p) { p = 'local'; }
	
	var Component = global.exec[p];		// default Local source
	
	new Component('exec', edy);
}

Shell.run = function(edy) {
	new Shell(edy)
}

module.exports = Shell;