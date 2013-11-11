var Connection = require('ssh2');
var fs = require('fs');
var path = require('path');

function getLine(str) {
	return str.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
}

function Component (command, edy) {
	var cmd = this[command];
	
	if (cmd) {
		cmd.call(this, edy);
	} else {
		new Error('invalid command zip : ' + command);
	}
}

Component.prototype.exec = function(edy) {
	var parsedSource = edy.parsedSource;
	var exec = edy.exec;
	
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

	var client = new Connection();
	
	
	client.on('connect', function() {
		console.log('connect');
	})
	client.on('ready', function() {
		console.log('ready');
		client.exec(exec, function(err, stream) {
 			if (err) throw err;
 			
 			var stderr = [];
 			var stdout = [];
 			
	    stream.on('data', function(data, extended) {
	    	var is_error = (extended === 'stderr');
	    	if (is_error) {
					stderr.push(data);
					edy.emit('data', 'exec', 'ssh', getLine(data+""), null)	
	    	} else {
					stdout.push(data);
	    		edy.emit('data', 'exec', 'ssh', null, getLine(data+""))
	    	}
	    	
	    });
	    stream.on('end', function() {
	      edy.emit('end', 'exec', 'ssh', getLine(stderr.join("")), getLine(stdout.join("")));
	    });
	    stream.on('close', function() {
	      edy.emit('close', 'exec', 'ssh');
	    });
	    stream.on('exit', function(code, signal) {
	      client.end();
	    	edy.emit('done', 'exec', 'ssh', null, { code : code, signal: signal})	      
	    });			
		})
	})
	
	var config = {
		host : parsedSource.host,
		port : parsedSource.port || 22,
		username : parsedSource.username,
		password : parsedSource.password
	}
	
	client.connect(config)	

}

module.exports = Component;