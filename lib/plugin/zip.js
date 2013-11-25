var targz = require('tar.gz');
var EasyZip = require('easy-zip').EasyZip;
var unzip = require('unzip');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');


/**
 * edy -s zip:///home/projects/edy -r /home/project/edy.tar.gz
 * edy -s zip:///home/projects/edy.tar.gz -r /home/projects/edy
 * 
 * support format : tar.gz, zip 
 * 
 * 
 * 
 * @param {Object} command
 * @param {Object} edy
 */
function Component (command, edy) {
	var cmd = this[command];
	this.edy = edy;
	
	if (cmd) {
		cmd.call(this, edy);
	} else {
		new Error('invalid command zip : ' + command);
	}
}

Component.prototype.download = function(edy) {
	
	// TODO: implement native bz2 and 7z? 
	var source = edy.homedir(edy.parsedSource.pathname);
	var target = edy.homedir(edy.root);
	
	if (source.match(/\.tar\.gz$/)) { 
		this.ungz(source, target);	
	} else if (source.match(/\.zip$/)) {
		this.unzip(source, target);
	} else {
		
		if (target.match(/\.tar\.gz$/)) {
			this.gz(source, target);
		} else if (target.match(/\.zip$/)) {
			this.zip(source, target);
		} else {
			new Error('unsupport file format : ' + source);
		}		
	}

}

Component.prototype.upload = function(edy) {
	
	var source = edy.homedir(edy.parsedTarget.pathname);
	var target = edy.homedir(edy.root);
	
	if (target.match(/\.tar\.gz$/)) {
		this.gz(source, target);	
	} else if (target.match(/\.zip$/)) {
		this.zip(source, target);
	} else {
		
		if (source.match(/\.tar\.gz$/)) {
			this.ungz(source, target);
		} else if (source.match(/\.zip$/)) {
			this.unzip(source, target);
		} else {
			new Error('unsupport file format : ' + source);
		}		
	}	
}

Component.prototype.zip = function(source, target) {
	
	var zip = new EasyZip();
	var self = this; 
	zip.zipFolder(source, function() {
		zip.writeToFile(target);
		self.edy.emit('done', 'zip', 'zip', null, { source : source, target : target})
	})
	
}

Component.prototype.gz = function(source, target) {
	var self = this; 	
	var compress = new targz().compress(source, target, function(err){
		self.edy.emit('done', 'zip', 'gz', err, { source : source, target : target})		
	});
}

Component.prototype.unzip = function(source, target) {
	var self = this; 	
	mkdirp.sync(target);
	self.edy.emit('mkdir', 'unzip', 'zip', null, target);
	
	fs.createReadStream(source).pipe(unzip.Extract({ path: target }))
	self.edy.emit('done', 'unzip', 'zip', null, { source : source, target : target})	
}

Component.prototype.ungz = function(source, target) {
	var self = this; 	
	mkdirp.sync(target);
	self.edy.emit('mkdir', 'unzip', 'gz', null, target);
		
	var compress = new targz().extract(source, target, function(err){
		self.edy.emit('done', 'unzip', 'gz', null, { source : source, target : target})
	});
}


module.exports = Component;