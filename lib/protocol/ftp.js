var Protocol = require('./protocol');
var util = require('util');
var ftp  = require('ftp');
var path = require('path')

function Component(resource) {
  Protocol.call(this, resource);
}


/**
 * connect 
 */
Protocol.prototype.connect = function(cb) {
  
  this.client = new ftp();
  
  this.client.on('ready', function() {
    cb && cb(null);
  })

  var config = {
    host : this.resource.host,
    port : this.resource.port,
    user : this.resource.username,
    password : this.resource.password
  }  
  
  this.client.connect(config);
}

Protocol.prototype.end = function(cb) {
  this.client.end();
  cb && cb(null);
}

Protocol.prototype.mkdir = function(p, cb) {
  
  if (arguments.length == 1) {
    cb = p;
    dir = this.resource.pathname;
  } else {
    dir = path.join(this.resource.pathname, p);
  }
  
  this.client.mkdir(dir, function(err) {
    cb(err, p);
  })
}

Protocol.prototype.remove = function(file, cb) {b

  if (file.type == 'd') {
    this.client.rmdir(file.real_path, cb)
  } else {
    this.client.delete(file.real_path, c)    
  }
  

}

Protocol.prototype.list = function(root, cb) {
 var original = this.resource.pathname;
 this.client.list(root, function(err, files) {
   
   files.forEach(function(file) {
     file.real_path = path.join(root, file.name);
     file.relative_path = path.join(root.replace(original, ""), file.name);
     
     if (file.type == 'd') {
       file.real_path += '/';
       file.relative_path += '/';
     }
   })
   
   cb(null, files);
   
 })
 
}

/**
 * get stream  
 */
Protocol.prototype.get = function(file, cb) {
  this.client.get(file.relative_path, cb);
}

/**
 * put stream  
 */
Protocol.prototype.put = function(file, stream, cb) {
  this.client.put(stream, file.relative_path, cb)
}

util.inherits(Component, Protocol);

module.exports = Component;



