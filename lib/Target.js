var url = require('url');
var fs = require('fs');

/**
 * edy -r /home/dir/project -t rsync://host.com/home/dir/project
 * 
 * @param {Object} opt
 */

function Target(edy) {
  this.upload(edy);
  
}

Target.prototype.upload = function(edy) {
  var protocol = edy.parsedTarget.protocol + "";
  
  var p = protocol.split(":")[0].split("+")[0] ;
  if (!p) { p = 'local'; }
  
  var Component = global.plugin[p];   // default Local source
    
  new Component('upload', edy, edy.parsedTarget, function(type, err, info){
    edy.emit('done', 'upload', type, err, info);
  });
}

Target.run = function(edy) {
  new Target(edy)
}

module.exports = Target;