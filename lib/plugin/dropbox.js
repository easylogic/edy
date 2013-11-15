var dropbox = require('dropbox');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var Dropbox = require('dropbox');
var async = require('async')
var glob = require('glob');
var rimraf = require('rimraf')


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

///////////////////////////////////////////
//
// default dropbox commander
//
//////////////////////////////////////////

/**
 * dropbox://id:password:key:secret@mail.com/path/to/the/project
 * dropbox://id:password@mail.com/key/secret/path/to/the/project
 * 
 * @param {Object} edy
 * @param {Object} callback
 */
function dropbox_connect(edy, callback) {
  var connectionConfig = edy.download ? edy.parsedSource : edy.parsedTarget;
  
  if (connectionConfig.auth) {
    var auth        = connectionConfig.auth.split(":");
    
    if (auth.length == 4) {
	    var username    = auth.shift();
	    var secret			= auth.pop();
	    var key					= auth.pop();
	    var password    = auth.join(":");    	
    } else {
    	var username    = auth.shift();
    	var password    = auth.join(":");
    	
		  var arr = connectionConfig.pathname.split("/");
		  
		  arr.shift();
		  var key = arr.shift();
		  var secret = arr.shift();    	
			arr.unshift("");  
		
		  connectionConfig.pathname = arr.join("/");		  
    }
    
    var creds       = { user : username, password : '"' + password + '"' };
    
    connectionConfig.username = username;
    connectionConfig.password = password; 
    connectionConfig.key = key;
    connectionConfig.secret = secret;
  } else {
    var creds = null;
  } 
  
  var email = connectionConfig.username + "@" + connectionConfig.hostname;
  var password = connectionConfig.password;
  
  if (edy.download) {
  	edy.parsedSource = connectionConfig;
  } else {
  	edy.parsedTarget = connectionConfig;
  }
  
  var client = new Dropbox.Client({
      key: key,
      secret: secret,
      sandbox : false
  });
  
  Dropbox.AuthDriver.NodeServer.prototype.openBrowser = function(url) {
    var exec = require('child_process').exec;
    var cmd  = 'phantomjs shell/dropbox_login.js ' + encodeURIComponent(url) + ":::" + encodeURIComponent(email) + ":::" + encodeURIComponent(password)
    exec(cmd, function(err, stdout, stderr) {
      //console.log(err, stdout, stderr);
    })  
  };  
  
  client.authDriver(new Dropbox.AuthDriver.NodeServer(8912));
  
  client.authenticate(function(err, client) {
    
    if (err) {
      throw err;
    }
    
    client._driver.closeServer();
    
    client.end = function(cb) {
    	this.signOut({mustInvalidate : true}, cb)
    }
    
    callback && callback(client);
  })  
}


function dropbox_download (edy, client, obj, callback) {
	var parsedSource = edy.parsedSource;
	
	if (obj.list.length == 0) {
		client.end(function(err) {
			// 완료후 list callback 으로 전달 
			edy.emit('done', 'download', 'dropbox', {msg : 'dropbox file list is empty'}, obj.list)
			callback && callback();			
		});
		return;
	}
	
	var root = parsedSource.pathname;
	var local_dir = edy.root;		

	mkdirp.sync(local_dir);
	edy.emit('mkdir', 'download', 'dropbox', null, local_dir);			
	
	//console.log(obj.list);
	
	async.map(obj.list, function(file, callback) {
		
		var isdir = (file.type == 'd');
		var real_file = path.join(local_dir, file.root.replace(root, ''), file.name);
		var dropbox_file = path.join(root, file.root.replace(root, ''), file.name)
		
		if (isdir) {
			mkdirp.sync(real_file);
			edy.emit('mkdir', 'download', 'dropbox', null, real_file);
			obj.download++;
			callback(null, real_file);
			
		} else {
      var total_transfered = 0;			
			var xhrListener = function(dbXhr) {
        dbXhr.xhr.addEventListener("progress", function(event) {
            total_transferred += event.loaded;
            edy.emit('step', 'download', 'dropbox', null, { source : dropbox_file, target : real_file, total_transferd : total_transferred, chunk : event.loaded, total : event.total, download : obj.download });
        });
        return true;  
      };
			client.onXhr.addListener(xhrListener);
			var xhr = client.readFile(dropbox_file, { buffer : true}, function(err, buffer, stat){
				edy.emit('start', 'download', 'dropbox', null, { source : dropbox_file, target : real_file, total : stat.size });
				fs.writeFile(real_file, buffer, function(err) {
						obj.download++;
						//console.log(dropbox_file + " => " + real_file)
						edy.emit('end', 'download', 'dropbox', null, { source : dropbox_file, target : real_file, download : obj.download });
						callback(null, real_file);
				})				
			})
			client.onXhr.removeListener(xhrListener);

		}
		
	}, function(err, results) {
		client.end();
		// 완료후 list callback 으로 전달 
		edy.emit('done', 'download', 'dropbox', null, obj.list)
		callback && callback();
		
	})		
}

function dropbox_delete(client, path, cb) {
	client.remove(path, cb)
}

function dropbox_rmdir(client, path, cb) {

	client.remove(path, cb)
}

/**
 * 
 * 
 * @param {Object} client
 * @param {Object} path
 * @param {Object} cb
 * @return XMLHttpRequest
 */
function dropbox_mkdir(client, path, cb) {

	return client.mkdir(path, cb)
}


function dropbox_upload(edy, client, files, __callback) {
	var source_dir = edy.root;
	var parsedTarget = edy.parsedTarget;
	var root = parsedTarget.pathname;
	
	dropbox_mkdir(client, root, function() {
		async.map(files, function(file, callback) { 
			var local_path = file; 
			var name = file.replace(source_dir, "");
			var remote_path = path.join(root , name);
			
			if (name != '') {
				var stat = fs.statSync(local_path);
				
				if (stat.isDirectory()) {
					
					dropbox_mkdir(client, remote_path, function() {
						edy.emit('mkdir', 'upload', 'dropbox', null, remote_path);
						callback(null, remote_path)
					})
					
				} else {
					
					var dir = path.dirname(remote_path);
					
					dropbox_mkdir(client, dir, function() {
						edy.emit('start', 'upload', 'dropbox', null, { source : local_path, target : remote_path });
						
						fs.readFile(local_path, function(err, buffer){
              var total_transferred = 0;						  
						  var xhrListener = function(dbXhr) {
                dbXhr.xhr.upload.onprogress("progress", function(event) {
                  total_transferred += event.loaded;
                  edy.emit('step', 'upload', 'dropbox', null, { source : local_path, target : remote_path, total : event.total, size : total_transferred, chunk : event.loaded });
                });
                return true;  
              };
              client.onXhr.addListener(xhrListener);
						  
							client.writeFile(remote_path, buffer, function(err, stat) {
									if (err) {
										callback(err);
									} else {
										callback(null, remote_path)
										edy.emit('end', 'upload', 'dropbox', null, { source : local_path, target : remote_path  });
									}
								} 
							)
							
							client.onXhr.removeListener(xhrListener);								
							
							
						})
						
					})
					

				}
				
			} else {
				callback();
			}
			
			
		}, function(errs, results){
			client.end();			
			edy.emit('done', 'upload', 'dropbox', errs, results)	
			__callback && __callback();
		})
	})
	

}

function dropbox_tree(edy, callback) {
	var connectConfig = (edy.download) ? edy.parsedSource : edy.parsedTarget;
	
	var obj = { 
		list : [], 
		count : 0, 
		download : 0, 
		callback : function() {
			callback(obj.client, this);
		}
	};	
	
  dropbox_connect(edy, function(client){
  	obj.client = client;
  	
		var root 					= connectConfig.pathname;  	
  	
    console.log('login success', (+new Date))
    //console.log(client);
    dropbox_traverse(client, root, obj);
  })
}

function dropbox_traverse(client, root, obj) {
	obj.count++;
	
	client.readdir(root, function(err, files, stat, stats) {
		stats.forEach(function(s){
			var file = {
				root : root,
				type : s.isFolder ? 'd' : '-',
				name : s.name,
				mtime : s.modifiedAt,
				size : s.size
			}
			
			if (file.type == 'd') {
				file.name += '/'
				obj.list.push(file);
				dropbox_traverse(client, path.join(root, file.name), obj);	
			} else {
				obj.list.push(file);	
			}

		})
		
		obj.count--;
		
		if (obj.count == 0) {
			obj.callback();
		}
	})
}

function dropbox_upload_one_file(client, edy) {
	var local_path = edy.root; 
	var name = path.basename(local_path)
	var remote_path = path.join(edy.parsedTarget.pathname , name);
	
	fs.readFile(local_path, function(err, data) {
		if (err) throw err;
		
    var total_transferred = 0;              
    var xhrListener = function(dbXhr) {
      dbXhr.xhr.upload.onprogress("progress", function(event) {
        total_transferred += event.loaded;
        edy.emit('step', 'upload', 'dropbox', null, { source : local_path, target : remote_path, total : event.total, size : total_transferred, chunk : event.loaded });
      });
      return true;  // otherwise, the XMLHttpRequest is canceled
    };
    client.onXhr.addListener(xhrListener);		
		
		client.writeFile(remote_path, data, function(err) {
				if (err) {
					throw err
				} else {
					client.signOut({ mustInvalidate : true }, function() {
						edy.emit('end', 'upload', 'dropbox', null, { source : local_path, target : remote_path });	
					});
				}
			} 
		);
		
		client.onXhr.removeListener(xhrListener);   			
	})

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
    edy.emit('start', 'sync_download', 'dropbox', null, edy.parsedSource);
    
    sync_download_traverse(edy);
}

function sync_download_traverse(edy) {
	
	async.waterfall([
		function(callback) {
			
			dropbox_tree(edy, function(client, obj) {
				var parsedSource = edy.parsedSource;
				var root = parsedSource.pathname;
							
				var keys = {};
				obj.list.forEach(function(file){
					
					var _root = file.root.replace(root, "");
					var key = path.join(_root, file.name); 
					
					key = key.replace(/^\/|\/$/g, '')
					
					keys[key] = true;
				})
				
				
				callback(null, client, obj, keys)
			})
			
		}, 
		
		function(client, obj, keys, callback) {
			var parsedSource = edy.parsedSource;
			var root = parsedSource.pathname;
			var source_dir = edy.root;			
			
			glob(edy.root.replace(/\/$/, '') + "/**", {stat : true}, function (er, files) {

				files.shift();		// except own directory 

				// select delete files
				var real_files = []; 
				async.map(files, function(file, cb) {
					
					var name = file.replace(source_dir, "").replace(/^\/|\/$/g, '')
					
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
			dropbox_download(edy, client, obj, function() {
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
	dropbox_tree(edy, function(client, obj) {
		dropbox_download(edy, client, obj);
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
    edy.emit('start', 'sync_upload', 'dropbox', null, edy.parsedTarget);
    
    sync_upload_traverse(edy);
}

function sync_upload_traverse(edy) {
	async.waterfall([
		function(callback) {
			
			dropbox_tree(edy, function(client, obj) {
				callback(null, client, obj)
			})
			
		}, 
		
		function(client, obj, callback) {
			var source_dir = edy.root;
			var parsedTarget = edy.parsedTarget;
			var root = parsedTarget.pathname;			
			
			glob(source_dir.replace(/\/$/, '') + "/**", {stat : true}, function (er, files) {

				files.shift();		// except own directory
				
				var keys = {};
				
				files.forEach(function(file) {
					var name = file.replace(source_dir + "/", "").replace(/^\/|\/$/g, '');
					keys[name] = true;
				})				
				
				// 뒤로 정렬한다. 이유는 dropbox 디렉토리를 정상적으로 지우기 위해서 
				obj.list.sort(function(a, b){
					var a_path = path.join(a.root, a.name) 
					var b_path = path.join(b.root, b.name) 
					return a_path > b_path ? 1 : -1;
				})
				
				async.map(obj.list, function(file, cb){
					
					var _root = file.root.replace(root, "");
				
					if (_root == '') {
						var name = file.name;
					} else {
						var name = path.join(_root, file.name);	
					}
					
					name = name.replace(/^\/|\/$/g, '')
					
					if (!keys[name]) {
						
						var remote_path = path.join(file.root, file.name)
						
						if (file.type == 'd') {
							dropbox_rmdir(client, remote_path, cb);
						}  else {
							dropbox_delete(client, remote_path, cb);
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
			dropbox_upload(edy, client, files, function() {
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
	
	dropbox_connect(edy, function(client){
		upload_traverse(client, edy);
	})
	
}

function upload_traverse(client, edy) {
	var source_dir = edy.root;
	var parsedTarget = edy.parsedTarget;
	var root = parsedTarget.pathname;
	
	// TODO: dropbox mkdir 
	dropbox_mkdir(client, root, function(err, stat) {
		console.log(err, stat);
		edy.emit('mkdir', 'upload', 'dropbox', null, root);
		
		if (fs.statSync(source_dir).isFile()) {
			dropbox_upload_one_file(client, edy, parsedTarget);
			return;
		}		
		
		glob(source_dir.replace(/\/$/, '') + "/**", {}, function (er, files) {
			dropbox_upload(edy, client, files)
		})		
	})
	

}

module.exports = Component;