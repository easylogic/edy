var ftp = require('ftp');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var async = require('async')
var glob = require('glob')
var rimraf = require('rimraf')

/**
 * 
 * edy -s ftp://id:pw@test.com/hello -r /home/dir/hello
 * 
 */
function Component (command, edy) {

	edy.download = (command == 'download');
  if (edy.sync) command = 'sync_' + command;
  
	var cmd = this[command];
	
	if (cmd) {
		cmd.call(this, edy);
	} else {
		new Error('invalid command ftp : ' + command);
	}
}


///////////////////////////////////////////
//
// default ftp commander
//
//////////////////////////////////////////

function ftp_connect(edy, callback) {
	
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
	
	var client = new ftp();
	client.on('ready', function() {
		edy.emit('ready', 'connect', 'ftp');
		callback(client);
	})
	
	var config = {
		host : connectConfig.host,
		port : connectConfig.port,
		user : connectConfig.username,
		password : connectConfig.password
	}
	
	client.connect(config)
}

function ftp_download (edy, client, obj, callback) {
	var parsedSource = edy.parsedSource;
	
	if (obj.list.length == 0) {
		client.end();
		// 완료후 list callback 으로 전달 
		edy.emit('done', 'download', 'ftp', {msg : 'ftp file list is empty'}, obj.list)
		callback && callback();
		return;
	}
	
	var root = parsedSource.pathname;
	var local_dir = edy.root;		

	mkdirp.sync(local_dir);
	edy.emit('mkdir', 'download', 'ftp', null, local_dir);			
	
	async.map(obj.list, function(file, callback) {
		
		var isdir = (file.type == 'd');
		var real_file = file.one ? path.join(local_dir, file.name) : path.join(local_dir, file.root.replace(root, ''), file.name);
		var ftp_file = file.one ? path.join(file.root, file.name) : path.join(root, file.root.replace(root, ''), file.name)
		
		if (isdir) {
			mkdirp.sync(real_file);
			edy.emit('mkdir', 'download', 'ftp', null, real_file);
			obj.download++;
			callback(null, real_file);
			
		} else {
			
			ftp_is_dir(client, ftp_file, function(isDir, bytes) {
        if (!isDir) { // if file 
          client.get(ftp_file, function(err2, stream) {

            if (err2) throw err2;
            
            stream.once('close', function() {
              obj.download++;
              //console.log(ftp_file + " => " + real_file)
              edy.emit('end', 'download', 'ftp', null, { source : ftp_file, target : real_file, download : obj.download });
              callback(null, real_file);
            })
            var size = 0; 
            
            stream.on('data', function(chunk) {
              size += chunk.length;
              edy.emit('step', 'download', 'ftp', null, { source : ftp_file, target : real_file, total : bytes, size : size, chunk : chunk.length });
            })
            stream.pipe(fs.createWriteStream(real_file))
            edy.emit('start', 'download', 'ftp', null, { source : ftp_file, target : real_file, total : bytes });
          })            
          
        }			  
			})
		}
		
	}, function(err, results) {
		client.end();
		// 완료후 list callback 으로 전달 
		edy.emit('done', 'download', 'ftp', null, obj.list)
		callback && callback();
		
	})		
}


function ftp_delete(client, path, cb) {
	client.delete(path, function(err) {
		cb(err);
	})
}

function ftp_rmdir(client, path, cb) {

	client.rmdir(path, function(err) {
		cb(err);
	})
}


function ftp_mkdir(client, path, cb) {

	client.mkdir(path, true, function(err) {
		cb(err);
	})
}

function ftp_is_dir(client, ftp_file, cb) {
  
  client.size(ftp_file, function(err, bytes) {
    if (err) {
      cb(true, bytes);
    } else {
      cb(false, bytes);
    }
  })  

}


function ftp_upload(edy, client, files, __callback) {
	var source_dir = edy.root;
	var parsedTarget = edy.parsedTarget;
	var root = parsedTarget.pathname;
	
	ftp_mkdir(client, root, function() {
		async.map(files, function(file, callback) { 
			var local_path = file; 
			var name = file.replace(source_dir, "");
			var remote_path = path.join(root , name);
			
			if (name != '') {
				var stat = fs.statSync(local_path);
				
				if (stat.isDirectory()) {
					
					ftp_mkdir(client, remote_path, function() {
						edy.emit('mkdir', 'upload', 'ftp', null, remote_path);
						callback(null, remote_path)
					})
					
				} else {
					
					var dir = path.dirname(remote_path);
					
					ftp_mkdir(client, dir, function() {
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
					})
					

				}
				
			} else {
				callback();
			}
			
			
		}, function(errs, results){
			client.end();			
			edy.emit('done', 'upload', 'ftp', errs, results)	
			__callback && __callback();
		})
	})
	

}



function ftp_tree(edy, callback) {
	
	var connectConfig = (edy.download) ? edy.parsedSource : edy.parsedTarget;
	
	var root 					= connectConfig.path;

	var obj = { 
		list : [], 
		count : 0, 
		download : 0, 
		callback : function() {
			callback(obj.client, this);
		}
	};	
	
	ftp_connect(edy, function(client){
		obj.client = client;
		
		ftp_is_dir(client, root, function(isDir) {
		  if (isDir) {
	     	ftp_traverse(client, root, obj);    
		  } else {
        ftp_traverse_file(client, root, obj);
		  }
		})
		
		
	})

}

function ftp_traverse_file(client, root, obj) {
  obj.count = 1; 
  client.list(root, function(err, arr) {
    arr.forEach(function(file) {
      file.root = path.dirname(root);
      file.one = true; 
      obj.list.push(file);
    })
    
    obj.callback();
  })
}


function ftp_traverse(client, root, obj) {
	obj.count++;
	
	//console.log('count : ' + obj.count);
	client.list(root, function(err, arr) {
		arr.forEach(function(file){
			file.root = root;
			
			if (file.type == 'd') {
				file.name += '/'
				obj.list.push(file);
				ftp_traverse(client, path.join(root, file.name), obj);	
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

function ftp_upload_one_file(client, edy) {
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

////////////////////////////////////////////////
//
// sync download
//
///////////////////////////////////////////////


Component.prototype.sync_download = function(edy) {
  sync_download_start(edy);
}	

function sync_download_start(edy) {
    edy.emit('start', 'sync_download', 'ftp', null, edy.parsedSource);
    
    sync_download_traverse(edy);
}

function sync_download_traverse(edy) {
	var parsedSource = edy.parsedSource;
	var root = parsedSource.pathname;
	var source_dir = edy.root;
	
	async.waterfall([
		function(callback) {
			
			ftp_tree(edy, function(client, obj) {
				
				var keys = {};
				obj.list.forEach(function(file){
					
					var key = path.join(file.root.replace(root, ""), file.name).replace(/^\/|\/$/g, '');
					
					keys[key] = true;
				})
				
				
				callback(null, client, obj, keys)
			})
			
		}, 
		
		function(client, obj, keys, callback) {
			
			glob(edy.root.replace(/\/$/, '') + "/**", {stat : true}, function (er, files) {

				files.shift();		// except own directory 

				// select delete files
				var real_files = []; 
				async.map(files, function(file, cb) {
					
					var name = file.replace(source_dir, "").replace(/^\/|\/$/g, '');
					
					if (!keys[name]) {
						console.log('delete file : ' + file);
						rimraf(file, cb)
					} else {
						real_files.push(file);
						cb(null, file);
					}
				}, function(err, results) {
					callback(null, client, obj, real_files)					
				})

			})
		},
		
		function(client, obj, files, callback) {
			ftp_download(edy, client, obj, function() {
				callback(null, 'done');	
			});
		}
		
	], function(err, result) {
		console.log(result);
			
	})
 
}

///////////////////////////////////////////////////////////////////
//
// basic download
//
/////////////////////////////////////////////////////////////

Component.prototype.download = function(edy) {
	ftp_tree(edy, function(client, obj) {
		ftp_download(edy, client, obj);
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
    edy.emit('start', 'sync_upload', 'ftp', null, edy.parsedTarget);
    
    sync_upload_traverse(edy);
}

function sync_upload_traverse(edy) {
	var source_dir = edy.root;
	var parsedTarget = edy.parsedTarget;
	var root = parsedTarget.pathname;
			
	async.waterfall([
		function(callback) {
			
			ftp_tree(edy, function(client, obj) {
				
				callback(null, client, obj)
			})
			
		}, 
		
		function(client, obj, callback) {
			
			glob(source_dir.replace(/\/$/, '') + "/**", {stat : true}, function (er, files) {

				files.shift();		// except own directory
				
				var keys = {};
				
				files.forEach(function(file) {
					var name = file.replace(source_dir + "/", "").replace(/^\/|\/$/g, '');
					keys[name] = true;
				})				
				
				// 뒤로 정렬한다. 이유는 ftp 디렉토리를 정상적으로 지우기 위해서 
				obj.list.sort(function(a, b){
					var a_path = path.join(a.root, a.name) 
					var b_path = path.join(b.root, b.name) 
					return a_path > b_path ? 1 : -1;
				})
			
				async.eachSeries(obj.list, function(file, cb){
					var name = path.join(file.root.replace(root, ""), file.name).replace(/^\/|\/$/g, '');
					
					if (!keys[name]) {
						
						var remote_path = path.join(file.root, file.name)
						
						if (file.type == 'd') {
							ftp_rmdir(client, remote_path, cb);
						}  else {
							ftp_delete(client, remote_path, cb);
						}
						
						console.log('delete file : ' + remote_path);
						
					} else {
						cb(null, file);
					}
				}, function(err, results){
					callback(null, client, files)
				})
				
			})
		},
		
		function(client, files, callback) {
			ftp_upload(edy, client, files, function() {
				callback(null, 'done');	
			});
		}
		
	], function(err, result) {
		console.log(result);
	})
 
}

/////////////////////////////////////////////
//
// basic upload
//
//////////////////////////////////////////////

Component.prototype.upload = function(edy) {
	
	ftp_connect(edy, function(client){
		upload_traverse(client, edy);
	})
	
}

function upload_traverse(client, edy) {
	var source_dir = edy.root;
	var parsedTarget = edy.parsedTarget;
	var root = parsedTarget.pathname;
	
	// TODO: ftp mkdir 
	ftp_mkdir(client, root, function(err) {
		edy.emit('mkdir', 'upload', 'ftp', null, root);
		
		if (fs.statSync(source_dir).isFile()) {
			ftp_upload_one_file(client, edy, parsedTarget);
			return;
		}		
		
		glob(source_dir.replace(/\/$/, '') + "/**", {}, function (er, files) {
			ftp_upload(edy, client, files)
		})		
	})
	

}

module.exports = Component;
