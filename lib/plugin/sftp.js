var Connection = require('ssh2');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var glob = require('glob');
var async = require('async')

/**
 * 
 * edy -s sftp://id:pw@test.com/hello -r /home/dir/hello
 * 
 * edy -r /home/dir/project -t sftp://id:pw@test.com/hello
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
	var source_dir 		= edy.root 
	var parsedsource = edy.parsedSource;
	
	if (parsedSource.auth) {
		var auth 				= parsedSource.auth.split(":");
		var username 		= auth.shift();
		var password 		= auth.join(":");				
		var creds 			= { user : username, password : '"' + password + '"' };
		
		parsedSource.username = username;
		parsedSource.password = password; 
	} else {
		var creds = null;
	}
	
	var cwd 			= source_dir;

	parsedSource.source_dir = source_dir;
	
	tree(edy, function(client, sftp, obj) {
		
		if (obj.list.length == 0) {
			sftp.end();
			client.end();
			// 완료후 list callback 으로 전달 
			edy.emit('done', 'download', 'sftp', {msg : 'sftp file list is empty'}, obj.list)
			return;
		}		
		
			var root = parsedSource.path;
			var local_dir = parsedSource.source_dir;		
		
			mkdirp.sync(local_dir);
  		edy.emit('mkdir', 'download', 'sftp', null, local_dir);				
			
			obj.list.forEach(function(file) {
				var isdir = (file.type == 'd');
				var real_file = path.join(local_dir, file.root.replace(root.replace("./", ""), ''), file.filename);
				var ftp_file = path.join(root, file.root.replace(root.replace("./", ""), ''), file.filename)
				
				if (isdir) {
					
					mkdirp.sync(real_file);
					edy.emit('mkdir', 'download', 'sftp', null, real_file);
					obj.download++;
				} else {
					sftp.fastGet(ftp_file, real_file, {
						
						step : function(total_transferred, chunk, total) {
							edy.emit('step', 'download', 'sftp', null, { source : ftp_file, target : real_file, total : total, size : total_transferred, chunk : chunk });
						}
						
					},function(err) {
						if (err) throw err;
						
						obj.download++;
						edy.emit('end', 'download', 'sftp', null, { source : ftp_file, target : real_file, download : obj.download });
							//console.log(ftp_file + " => " + real_file)
							
						if (obj.download == obj.list.length) {
							sftp.end();
							client.end();
							// 완료후 list callback 으로 전달 
							edy.emit('done', 'download', 'sftp', null, obj.list)
						}
						
					})
				}
				
			})		
		
	})
}

function tree(edy, callback) {
	
	var parsedSource = edy.parsedSource;
	var root = parsedSource.path;
	var local_dir = parsedSource.source_dir;
	var client = new Connection();
	var list = [];
	var obj = { 
		list : [], 
		count : 0, 
		download : 0, 
		callback : function(sftp) {
			callback(client, sftp, this);
		}
	}
	
	client.on('connect', function() {
		
	})
	client.on('ready', function() {
		
		client.sftp(function(err, sftp) {
			if (err) throw err;
			//root = root.indexOf('/') == 0 ? '.' + root : root;
			traverse(sftp, root, obj);	
		})
		
			
	})
	
	var config = {
		host : parsedSource.host,
		port : parsedSource.port,
		username : parsedSource.username,
		password : parsedSource.password
	}
	
	client.connect(config)
	
}

function traverse(sftp, root, obj) {
	obj.count++;
	
	sftp.opendir(root, function(err, handle) {
		
		sftp.readdir(handle, function(err, arr) {
			
			arr.forEach(function(file){
				
				if (file.filename == '..' || file.filename == '.' ) {
					
				} else {
					file.root = root;
					if (file.longname.substr(0,1) == 'd') {
						file.filename
						file.type = 'd';
						obj.list.push(file);
						traverse(sftp, path.join(root, file.filename), obj);	
					} else {
						file.type = '-';
						obj.list.push(file);	
					}					
				}
				
				//console.log('path : ' + _path);			
			})
			
			obj.count--;
			//console.log('count : ' + obj.count);
	
			if (obj.count == 0) {
				obj.callback(sftp);
			}			
		})

	})
}


Component.prototype.upload = function(edy) {
	var source_dir 	= edy.root;
	var parsedTarget = edy.parsedTarget;
	
	if (parsedTarget.auth) {
		var auth 				= parsedTarget.auth.split(":");
		delete parsedTarget.auth;
		var username 	= auth.shift();
		var password 	= auth.join(":");				
		
		parsedTarget.username = username; 
		parsedTarget.password = password; 
	} else {
		var creds = null;
	}
	//console.log(source_dir);
	var root = parsedTarget.pathname;
	
	var client = new Connection();
	var list = [];
	
	client.on('connect', function() {
		
	})
	client.on('ready', function() {
		
		client.sftp(function(err, sftp) {
			
			upload_files(client, sftp, edy);
				
		})
		
			
	})
	
	var config = {
		host : parsedTarget.host,
		port : parsedTarget.port,
		username : parsedTarget.username,
		password : parsedTarget.password
	}
	
	client.connect(config)	

	
}

function sftp_mkdir(sftp, root, cb) {

	var arr = root.split("/");
	var list = [];
	for(var i = 1, len = arr.length; i < len; i++) {
		list.push(arr.slice(0, i+1).join("/"));
	}
	
	async.eachSeries(list, function(item, callback) { 
			sftp.opendir(item, function(err, handle) {
				if (err) {
					sftp.mkdir(item, function(e) {
						if (e) {
							callback(e);	
						} else {
							callback(null, item);
						}
						
					});					
				} else {
					callback(null, item);
				}
			})
	
	}, function(err, results){
		cb(err);		
	})
}


function upload_one_file(client, sftp, edy) {
	var parsedTarget = edy.parsedTarget;
	var local_path = edy.root; 
	var name = path.basename(local_path)
	var remote_path = path.join(parsedTarget.pathname , name);
		
	sftp.fastPut(
		local_path, 
		remote_path, 
		{ 
			step : function(total_transferred, chunk, total) {
				edy.emit('step', 'upload', 'sftp', null, { source : local_path, target : remote_path, total : total, size : total_transferred, chunk : chunk });
		 	}
		}, 
		function(err) {
			if (err) {
				throw err
			} else {
				sftp.end();
				client.end();
				edy.emit('end', 'upload', 'sftp', null, { source : local_path, target : remote_path });
			}
		} 
	);	
}

function upload_files(client, sftp, edy) {
	var source_dir = edy.root;
	var parsedTarget = edy.parsedTarget;	
	var root = parsedTarget.pathname;
	
	
	// TODO: ftp mkdir 
	sftp_mkdir(sftp, root, function(err) {
		edy.emit('mkdir', 'upload', 'sftp', null, root);
		
		if (fs.statSync(source_dir).isFile()) {
			upload_one_file(client, sftp, edy);
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
						sftp.opendir(remote_path, function(opendir_err) {
							if (opendir_err) {
								sftp.mkdir(remote_path, function(e) {
										if (e) {
											callback({ error : e, remote_path : remote_path} );	
										} else {
											edy.emit('mkdir', 'upload', 'sftp', null, remote_path);
											callback(null, remote_path)
										}
								});								
							} else {
								callback(null, remote_path);
							}
						})

					} else {
						edy.emit('start', 'upload', 'sftp', null, { source : local_path, target : remote_path });
						sftp.fastPut(
							local_path, 
							remote_path, 
							{ 
								step : function(total_transferred, chunk, total) {
									edy.emit('step', 'upload', 'sftp', null, { source : local_path, target : remote_path, total : total, size : total_transferred, chunk : chunk });
							 	}
							}, 
							function(err) {
								if (err) {
									callback(err);
								} else {
									callback(null, remote_path)
									edy.emit('end', 'upload', 'sftp', null, { source : local_path, target : remote_path  });
								}
							} 
						);	
					}
					
				} else {
					callback();
				}
				
				
			}, function(errs, results){
				sftp.end();
				client.end();
				edy.emit('done', 'upload', 'sftp', errs, results)
			})

		})		
	})
	

}

module.exports = Component;