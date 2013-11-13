var Connection = require('ssh2');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var glob = require('glob');
var async = require('async')
var rimraf = require('rimraf')

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
	
	edy.download = (command == 'download');
  if (edy.sync) command = 'sync_' + command;	
	
	var cmd = this[command];
	
	if (cmd) {
		cmd.call(this, edy);
	} else {
		new Error('invalid command sftp : ' + command);
	}
}

///////////////////////////////////////////
//
// default sftp commander
//
//////////////////////////////////////////

function sftp_connect(edy, callback) {
	
	var connectConfig = edy.download ? edy.parsedSource : edy.parsedTarget;
	
	if (connectConfig.auth) {
		var auth 				= connectConfig.auth.split(":");
		var username 		= auth.shift();
		var password 		= auth.join(":");				
		var creds 			= { user : username, password : '"' + password + '"' };
		
		connectConfig.username = username;
		connectConfig.password = password; 
	} else {
		var creds = null;
	}	
	
	
	var client = new Connection();
	client.on('connect', function() {
		
	})
	client.on('ready', function() {
		
		client.sftp(function(err, sftp) {
			if (err) throw err;
			edy.emit('ready', 'connect', 'sftp');
			sftp.client = client;			
			callback(sftp);
		})
			
	})
	
	var config = {
		host : connectConfig.host,
		port : connectConfig.port,
		username : connectConfig.username,
		password : connectConfig.password
	}
	
	client.connect(config)
		
}


function sftp_download(edy, sftp, obj, __callback) {
	//console.log(edy);
	var parsedSource = edy.parsedSource;
	
	if (obj.list.length == 0) {
		sftp.end();
		sftp.client.end();
		// 완료후 list callback 으로 전달 
		edy.emit('done', 'download', 'sftp', {msg : 'sftp file list is empty'}, obj.list)
		__callback && __callback();
		return;
	}		
	
	var root = parsedSource.path;
	var local_dir = edy.root;		
		
	mkdirp.sync(local_dir);
	edy.emit('mkdir', 'download', 'sftp', null, local_dir);
	
	async.map(obj.list, function(file, callback) {
		
		var isdir = (file.type == 'd');
		var real_file = path.join(local_dir, file.root.replace(root.replace("./", ""), ''), file.filename);
		var ftp_file = path.join(root, file.root.replace(root.replace("./", ""), ''), file.filename)
		
		if (isdir) {
			
			mkdirp.sync(real_file);
			edy.emit('mkdir', 'download', 'sftp', null, real_file);
			obj.download++;
			callback(null, real_file)
		} else {
			edy.emit('start', 'download', 'sftp', null, { source : ftp_file, target : real_file});
			
			var dir = path.dirname(real_file);
			mkdirp.sync(dir);
			edy.emit('mkdir', 'download', 'sftp', null, dir);
			
			sftp.fastGet(ftp_file, real_file, {
				
				step : function(total_transferred, chunk, total) {
					edy.emit('step', 'download', 'sftp', null, { source : ftp_file, target : real_file, total : total, size : total_transferred, chunk : chunk });
				}
				
			},function(err) {
				
				obj.download++;
				edy.emit('end', 'download', 'sftp', null, { source : ftp_file, target : real_file, download : obj.download });				
				
				if (err) {
					callback(err, real_file);					
				} else {
					callback(null, real_file);	
				}
				
			})
		}
		
	}, function(err, results) {
		sftp.end();
		sftp.client.end();
		
		edy.emit('done', 'download', 'sftp', null, obj.list)
		__callback && __callback();		
	})			
	
	
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

function sftp_rmdir(sftp, path, cb) {
	sftp.rmdir(path, function(err) {
		cb(err);
	})
}

function sftp_delete(sftp, path, cb) {
	sftp.unlink(path, function(err) {
		cb(err);
	})	
}


function sftp_upload(edy, sftp, files, __callback) {
	var source_dir = edy.root;
	var parsedTarget = edy.parsedTarget;
	var root = parsedTarget.pathname;
	
	sftp_mkdir(sftp, root, function() {
		async.map(files, function(file, callback) { 
			var local_path = file; 
			var name = file.replace(source_dir, "");
			var remote_path = path.join(root , name);
			
			if (name != '') {
				var stat = fs.statSync(local_path);
				
				if (stat.isDirectory()) {
					sftp_mkdir(sftp, remote_path, function() {
						edy.emit('mkdir', 'upload', 'sftp', null, remote_path);
						callback(null, remote_path)						
					})
				} else {
					var dir = path.dirname(remote_path);
					
					sftp_mkdir(sftp, dir, function() {
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
					})					
				}
				
			} else {
				callback();
			}
			
			
		}, function(errs, results){
			sftp.end();
			sftp.client.end();
			edy.emit('done', 'upload', 'sftp', errs, results)
			__callback && __callback();
		})

	})	
	

}

function sftp_tree(edy, callback) {
	
	var connectConfig = (edy.download) ? edy.parsedSource : edy.parsedTarget;
	var root 					= connectConfig.pathname;
	
	var obj = { 
		list : [], 
		count : 0, 
		download : 0, 
		callback : function(sftp) {
			callback(sftp, this);
		}
	}

	sftp_connect(edy, function(sftp){
		sftp_traverse(sftp, root, obj);
	})
	
}

function sftp_traverse(sftp, root, obj) {
	obj.count++;
	
	sftp.opendir(root, function(err, handle) {
		
		if (err) {
			obj.count--;
			//console.log('count : ' + obj.count);
	
			if (obj.count == 0) {
				obj.callback(sftp);
			}		
			return;
		}
		
		sftp.readdir(handle, function(err, arr) {
			
			arr.forEach(function(file){
				
				if (file.filename == '..' || file.filename == '.' ) {
					
				} else {
					var remote_path = path.join(root, file.filename)
					file.root = root;					
					file.name = file.filename;
					
					if (file.attrs.isDirectory()) {
						file.type = 'd';
						obj.list.push(file);
						sftp_traverse(sftp, remote_path, obj);
					} else {
						file.type = '-';
						obj.list.push(file);						
					}

					//console.log(file);
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



function sftp_upload_one_file(sftp, edy) {
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
				sftp.client.end();
				edy.emit('end', 'upload', 'sftp', null, { source : local_path, target : remote_path });
			}
		} 
	);	
}

////////////////////////////////////////////////
//
// sync download
//
///////////////////////////////////////////////

Component.prototype.sync_download = function(edy) {
  sync_download_start(edy);
}	

function sync_download_start(edy) {
    edy.emit('start', 'sync_download', 'sftp', null, edy.parsedSource);
    
    sync_download_traverse(edy);
}


function sync_download_traverse(edy) {
	var parsedSource = edy.parsedSource;
	var root = parsedSource.pathname;
	var source_dir = edy.root;
	
	async.waterfall([
		function(callback) {
			
			sftp_tree(edy, function(sftp, obj) {
				
				//console.log(obj);
				
				var keys = {};
				obj.list.forEach(function(file){
					
					if (file.type == 'd') {
						var key = path.join(file.root.replace(root, ""), file.name.replace(/\/$/, '')); 
					} else {
						var key = path.join(file.root.replace(root, ""), file.name);
					}
					
					keys[key] = true;
				})
				
				
				callback(null, sftp, obj, keys)
			})
			
		}, 
		
		function(sftp, obj, keys, callback) {
			
			glob(edy.root.replace(/\/$/, '') + "/**", {stat : true}, function (er, files) {

				files.shift();		// except own directory 

				// select delete files
				var real_files = []; 
				async.map(files, function(file, cb) {
					
					var name = file.replace(source_dir, "");
					
					if (!keys[name]) {
						console.log('delete file : ' + file);
						rimraf(file, cb)
					} else {
						real_files.push(file);
						cb(null, file);
					}
				}, function(err, results) {
					callback(null, sftp, obj, real_files)					
				})

			})
		},
		
		function(sftp, obj, files, callback) {
			sftp_download(edy, sftp, obj, function() {
				callback(null, 'done');	
			});
		}
		
	], function(err, result) {
		console.log(result);
			
	})
 
}


///////////////////////////////////////////
//
// basic download 
//
//////////////////////////////////////////

Component.prototype.download = function(edy) {
	sftp_tree(edy, function(sftp, obj) {
		sftp_download(edy, sftp, obj);
	})
}


///////////////////////////////////////////////////
//
// sync upload
//
///////////////////////////////////////////////////

Component.prototype.sync_upload = function(edy) {
  sync_upload_start(edy);
	
}


function sync_upload_start(edy) {
    edy.emit('start', 'sync_upload', 'sftp', null, edy.parsedTarget);
    
    sync_upload_traverse(edy);
}


function sync_upload_traverse(edy) {
	var source_dir = edy.root;
	var parsedTarget = edy.parsedTarget;
	var root = parsedTarget.pathname;
			
	async.waterfall([
		function(callback) {
			
			sftp_tree(edy, function(sftp, obj) {
				
				callback(null, sftp, obj)
			})
			
		}, 
		
		function(sftp, obj, callback) {
			
			glob(source_dir.replace(/\/$/, '') + "/**", {stat : true}, function (er, files) {

				files.shift();		// except own directory
				
				var keys = {};
				
				files.forEach(function(file) {
					var name = file.replace(source_dir + "/", "");
					keys[name] = true;
				})				
				
				// 뒤로 정렬한다. 이유는 ftp 디렉토리를 정상적으로 지우기 위해서 
				obj.list.sort(function(a, b){
					var a_path = path.join(a.root, a.name) 
					var b_path = path.join(b.root, b.name) 
					return a_path > b_path ? 1 : -1;
				})
			
				async.eachSeries(obj.list, function(file, cb){
					var name = path.join(file.root.replace(root, ""), file.name);
					
					if (!keys[name]) {
						
						var remote_path = path.join(file.root, file.name)
						
						if (file.type == 'd') {
							sftp_rmdir(client, remote_path, cb);
						}  else {
							sftp_delete(client, remote_path, cb);
						}
						
						console.log('delete file : ' + remote_path);
						
					} else {
						cb(null, file);
					}
				}, function(err, results){
					callback(null, sftp, files)
				})
				
			})
		},
		
		function(sftp, files, callback) {
			sftp_upload(edy, sftp, files, function() {
				callback(null, 'done');	
			});
		}
		
	], function(err, result) {
		console.log(result);
	})
 
}


///////////////////////////////////////////
//
// basic upload 
//
//////////////////////////////////////////

Component.prototype.upload = function(edy) {
	var source_dir 	= edy.root;
	
	sftp_connect(edy, function(sftp) {
		upload_traverse(sftp, edy);
	})
	
}



function upload_traverse(client, sftp, edy) {
	var source_dir = edy.root;
	var parsedTarget = edy.parsedTarget;	
	var root = parsedTarget.pathname;
	
	
	// TODO: ftp mkdir 
	sftp_mkdir(sftp, root, function(err) {
		edy.emit('mkdir', 'upload', 'sftp', null, root);
		
		if (fs.statSync(source_dir).isFile()) {
			sftp_upload_one_file(client, sftp, edy);
			return;
		}		
		
		glob(source_dir.replace(/\/$/, '') + "/**", {}, function (er, files) {
			sftp_upload(edy, sftp, files);

		})		
	})
	

}

module.exports = Component;