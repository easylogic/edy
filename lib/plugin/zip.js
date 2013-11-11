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
 * @param {Object} parsed
 * @param {Object} cb
 */
function Component (command, edy) {
	var cmd = this[command];
	
	if (cmd) {
		cmd.call(this, edy);
	} else {
		new Error('invalid command zip : ' + command);
	}
}

Component.prototype.download = function(edy) {
	
	// TODO: implement native bz2 and 7z? 
	var target = edy.root;
	var parsedSource = edy.parsedSource;
	var source = parsedSource.pathname;
	
	if (source.match(/\.tar\.gz$/)) {
		this.ungz(source, target, cb);	
	} else if (source.match(/\.zip$/)) {
		this.unzip(source, target, cb);
	} else {
		
		if (target.match(/\.tar\.gz$/)) {
			this.gz(source, target, cb);
		} else if (target.match(/\.zip$/)) {
			this.zip(source, target, cb);
		} else {
			new Error('unsupport file format : ' + source);
		}		
	}

}

Component.prototype.upload = function(edy) {
	
	var source = edy.root;
	var parsedTarget = edy.parsedTarget;
	var target = parsedTarget.pathname;	
	
	if (target.match(/\.tar\.gz$/)) {
		this.gz(source, target, cb);	
	} else if (target.match(/\.zip$/)) {
		this.zip(source, target, cb);
	} else {
		
		if (source.match(/\.tar\.gz$/)) {
			this.ungz(source, target, cb);
		} else if (source.match(/\.zip$/)) {
			this.unzip(source, target, cb);
		} else {
			new Error('unsupport file format : ' + source);
		}		
	}	
}

Component.prototype.zip = function(source, target, cb) {
	
	var zip = new EasyZip();
	
	zip.zipFolder(source, function() {
		zip.writeToFile(target);
		edy.emit('done', 'zip', 'zip', null, { source : source, target : target})
	})
	
}

Component.prototype.gz = function(source, target, cb) {
	var compress = new targz().compress(source, target, function(err){
		edy.emit('done', 'zip', 'gz', err, { source : source, target : target})		
	});
}

Component.prototype.unzip = function(source, target, cb) {
	
	mkdirp.sync(target);
	edy.emit('mkdir', 'unzip', 'zip', null, target);
	
	fs.createReadStream(source).pipe(unzip.Extract({ path: target }))
	edy.emit('done', 'unzip', 'zip', null, { source : source, target : target})	
}

Component.prototype.ungz = function(source, target, cb) {
	mkdirp.sync(target);
	edy.emit('mkdir', 'unzip', 'gz', null, target);
		
	var compress = new targz().extract(source, target, function(err){
		edy.emit('done', 'unzip', 'gz', null, { source : source, target : target})
	});
}


module.exports = Component;