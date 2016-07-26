var async = require('async');
var minimatch = require('minimatch');
var url = require('url');

/**
 * Protocol 
 * 
 * each protocol file manager 
 *  
 * file {
 *  type : 'd', '-',
 *  name : '',
 *  root : '',
 *  own : '',
 *  group : '',
 *  mtime : '',
 *  size  : ''  
 * }
 * 
 */



function Protocol (resource) {
  this.setResource(resource);
}

Protocol.prototype.setResource = function(resource) {
  if (resource.auth) {
    var auth        = resourcea.auth.split(":");
    var username    = auth.shift();
    var password    = auth.join(":");       
    
    resourcea.username = username;
    resourcea.password = password; 
  } else {
    var creds = null;
  }  
  
  this.resource = resource;
}

Protocol.prototype.pipe = function(target) {
  this.target = target;
  this.start();
}

Protocol.prototype.start = function() {
  var self = this; 
  
  async.waterfall([
    
    function(callback) {
      self.connect(callback);
    },
    
    function(callback) {
      self.tree(callback);
    },
    
    function(files, callback) {
      self.send(files, callback)
    }
    
  ], function(err, results) {
    
  })
}

Protocol.prototype.send = function(files, cb) {
  var self = this; 
  if (files.length == 0) {
    this.end();
    //this.emit('done', 'download', this.type, msg : 'list is empty', files);
    return;
  }
  
  var send_count = 0;
  var root = this.resource.pathname;
  
  async.waterfall([
    function(callback) {
      self.target.mkdir(callback);
    },
    function(callback) {
      async.eachSeries(files, function(file, fn) {
        
        var isdir = (file.type == 'd');
        var local_path = path.join(file.root, file.name);
        var target_path = file_path.replace(root, "");
        
        
        if (isdir) {
          self.target.mkdir(file.relative_path, function(err) {
            fn(err, file.relative_path);
          });
        } else {
          self.get(file.real_path, function(err1, stream) {
            
            if (err1) {
              fn(err1, file.real_path);
            } else {
              self.target.put(file.relative_path, stream, function(err2) {
                fn(err2, {source : file.real_path, target : file.relative_path});
              });
            }
            

          })
        }
        
        
      }, callback)
    }
  ], function(err, results){
    self.end();
  })
  
}



Protocol.prototype.tree = function(cb) {
  
  var root = this.resource.pathname;
  var dir = root.split("/").pop().trim() == "";
  
  var obj = {
    list : [],
    count : 0,
    callback : function() {
      cb(this.list);
    }
  }
  
  this.traverse(root, obj);
  
}

Protocol.prototype.traverse = function(root, obj) {
  var self = this; 
    
  obj.count++;

  this.list(root, function(err, files) {
    files.forEach(function(file) {
      
      self.filter(file, function(err, isFile) {
        if (isFile) {
          if (file.type == 'd') {
            obj.list.push(file);
            self.traverse(path.join(root, file.name), obj);
          } else {
            obj.list.push(file);
          }          
        } else  {
          // TODO: no actions
        }
      })
      

    })
    
    obj.count--;
    
    if (obj.count == 0) {
      obj.callback();
    }
  })
}


Protocol.prototype.filter = function(file, cb) {
  
  
  var exclude = this.exclude || [];

  var real = file.real_path
  var count = 0;
  async.some(exclude, function(ex, callback) { 
    callback(minimatch(real, ex, {matchBase : true}));
  }, function(result) {
    if (result) {
      cb(null, false);
    } else {
      cb(null, true);
    }
  })
}


/**
 * implements 
 *  
 */

/**
 * connect 
 */
Protocol.prototype.connect = function(cb) {
  cb && cb(null)
}

Protocol.prototype.end = function(cb) {
  cb && cb(null);
}

Protocol.prototype.mkdir = function(path, cb) {
  cb && cb(null);
}

Protocol.prototype.remove = function(path, cb) {
  cb && cb(null);
}

Protocol.prototype.list = function(path, cb) {
  cb && cb(null, []);
}

Protocol.prototype.isDirectory = function(path) {

	var file = path.trim().split("/").pop();
	
	return file == '';
}

/**
 * get stream  
 */
Protocol.prototype.get = function(path, cb) {
  cb && cb(null, null);
}

/**
 * put stream  
 */
Protocol.prototype.put = function(path, cb) {
  cb && cb(null, null);
}

module.exports = Protocol;
