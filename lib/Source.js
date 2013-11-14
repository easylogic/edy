var url = require('url');
var fs = require('fs');


function Source(edy) {
	this.download(edy);
}

Source.prototype.download = function(edy) {
	var protocol = edy.parsedSource.protocol;
	
	var p = edy.protocol;
	
	if (!p && protocol) { p = protocol.split(":")[0].split("+")[0] ; }
	if (!p) { p = 'local'; }
	
	var Component = global.plugin[p];		// default Local source
		
	new Component('download', edy);
}

Source.run = function(edy) {
	new Source(edy)
}

module.exports = Source;