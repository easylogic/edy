var ftp = require('ftp');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var async = require('async')
var glob = require('glob')

/**
 * 
 * edy -s ftp://id:pw@test.com/hello -r /home/dir/hello
 * 
 */
function Component (command, edy) {
	var cmd = this[command];
	
	if (cmd) {
		cmd.call(this, edy);
	} else {
		new Error('invalid command ftp : ' + command);
	}
}

Component.prototype.download = function(edy) {
	var source_dir 		= edy.root;
	var parsedSource  = edy.parsedSource;
	
	if (parsedSource.auth) {
		var auth 				= parsedSource.auth.split(":");
		var username 		= auth.shift();
		var password 		= auth.join(":");				
		var creds 			= { user : username, password : '"' + password + '"' };
		
		parsedSource.user = username;
		parsedSource.password = password; 
	} else {
		var creds = null;
	}
	
	var cwd 			= source_dir;

	parsedSource.source_dir = source_dir;
	

	tree(edy, function(client, obj) {
		
		if (obj.list.length == 0) {
			client.end();
			// 완료후 list callback 으로 전달 
			edy.emit('done', 'download', 'ftp', {msg : 'ftp file list is empty'}, obj.list)
			return;
		}
		
			var root = parsedSource.path;
			var local_dir = parsedSource.source_dir;		
		
			mkdirp.sync(local_dir);
  		edy.emit('mkdir', 'download', 'ftp', null, local_dir);			
  		
  		//console.log(obj.list);
			
			obj.list.forEach(function(file) {
				
				var isdir = (file.type == 'd');
				var real_file = path.join(local_dir, file.root.replace(root, ''), file.name);
				var ftp_file = path.join(root, file.root.replace(root, ''), file.name)
				if (isdir) {
					
					mkdirp.sync(real_file);
					edy.emit('mkdir', 'download', 'ftp', null, real_file);
					obj.download++;
				} else {
					
					client.size(ftp_file, function(err, bytes){
						if (err) throw err; 
						
						client.get(ftp_file, function(err2, stream) {
							if (err2) throw err2;
							
							stream.once('close', function() {
								obj.download++;
								//console.log(ftp_file + " => " + real_file)
								edy.emit('end', 'download', 'ftp', null, { source : ftp_file, target : real_file, download : obj.download });
							
								if (obj.download == obj.list.length) {

									client.end();
									// 완료후 list callback 으로 전달 
									edy.emit('done', 'download', 'ftp', null, obj.list)
								}
							})
							var size = 0; 
							
							stream.on('data', function(chunk) {
								size += chunk.length;
								edy.emit('step', 'download', 'ftp', null, { source : ftp_file, target : real_file, total : bytes, size : size, chunk : chunk.length });
							})
							stream.pipe(fs.createWriteStream(real_file))
							edy.emit('start', 'download', 'ftp', null, { source : ftp_file, target : real_file, total : bytes });
						})						
					})
					

				}
				
			})		
		
	})
}

function tree(edy, callback) {
	
	var parsedSource 	= edy.parsedSource;
	var root 					= parsedSource.path;
	var local_dir 		= parsedSource.source_dir;
	
	var client = new ftp();
	var list = [];
	var obj = { 
		list : [], 
		count : 0, 
		download : 0, 
		callback : function() {
			callback(client, this);
		}
	}
	client.on('ready', function() {
		edy.emit('ready', 'download', 'ftp');
		traverse(client, root, obj);	
	})
	
	var config = {
		host : parsedSource.host,
		port : parsedSource.port,
		user : parsedSource.user,
		password : parsedSource.password
	}
	
	client.connect(config)
	edy.emit('ready', 'download', 'ftp');	
}

function traverse(client, root, obj) {
	obj.count++;
	//console.log('count : ' + obj.count);
	client.list(root, function(err, arr) {

		arr.forEach(function(file){
			file.root = root;
			if (file.type == 'd') {
				file.name += '/'
				obj.list.push(file);
				traverse(client, path.join(root, file.name), obj);	
			} else {
				obj.list.push(file);	
			}
			
			//console.log('path : ' + _path);			
		})
		
		obj.count--;
		//console.log('count : ' + obj.count);

		if (obj.count == 0) {
			obj.callback();
		}
	})
}


Component.prototype.upload = function(edy) {
	
	var parsedTarget = edy.parsedTarget;
	if (parsedTarget.auth) {
		var auth 				= parsedTarget.auth.split(":");
		var username 		= auth.shift();
		var password 		= auth.join(":");				
		var creds 			= { user : username, password : '"' + password + '"' };
		
		parsedTarget.username = username;
		parsedTarget.password = password; 
	} else {
		var creds = null;
	}
		

	var client = new ftp();
	
	client.on('ready', function() {
		upload_files(client, edy);	
	})
	
	var config = {
		host : parsedTarget.host,
		port : parsedTarget.port,
		user : parsedTarget.username,
		password : parsedTarget.password
	}
	
	client.connect(config)
	
}



function ftp_mkdir(client, root, cb) {

	client.mkdir(root, true, function(err) {
		cb(err);
	})
}


function upload_one_file(client, edy) {
	var local_path = edy.root; 
	var name = path.basename(local_path)
	var remote_path = path.join(edy.parsedTarget.pathname , name);
		
	client.put(local_path, remote_path, function(err) {
			if (err) {
				throw err
			} else {
				client.end();
				edy.emit('end', 'upload', 'ftp', null, { source : local_path, target : remote_path });
			}
		} 
	);	
}

function upload_files(client, edy) {
	var source_dir = edy.root;
	var parsedTarget = edy.parsedTarget;
	var root = parsedTarget.pathname;
	
	// TODO: ftp mkdir 
	ftp_mkdir(client, root, function(err) {
		edy.emit('mkdir', 'upload', 'ftp', null, root);
		
		if (fs.statSync(source_dir).isFile()) {
			upload_one_file(client, edy, parsedTarget);
			return;
		}		
		
		glob(source_dir.replace(/\/$/, '') + "/**", {}, function (er, files) {
			
			async.eachSeries(files, function(file, callback) { 
				var local_path = file; 
				var name = file.replace(source_dir, "");
				var remote_path = root + name;
				
				if (name != '') {
					var stat = fs.statSync(local_path);
					
					if (stat.isDirectory()) {
						client.size(remote_path, function(opendir_err, size) {
							if (opendir_err || size == 0) {
								client.mkdir(remote_path, true, function(e) {
										if (e) {
											callback({ error : e, remote_path : remote_path} );	
										} else {
											edy.emit('mkdir', 'upload', 'ftp', null, remote_path);
											callback(null, remote_path)
										}
								});								
							} else {
								callback(null, remote_path);
							}
						})

					} else {
						edy.emit('start', 'upload', 'ftp', null, { source : local_path, target : remote_path });
						client.put(local_path, remote_path, function(err) {
								if (err) {
									callback(err);
								} else {
									callback(null, remote_path)
									edy.emit('end', 'upload', 'ftp', null, { source : local_path, target : remote_path  });
								}
							} 
						);	
					}
					
				} else {
					callback();
				}
				
				
			}, function(errs, results){
				client.end();			
				edy.emit('done', 'upload', 'ftp', errs, results)	
			})

		})		
	})
	

}

module.exports = Component;