# edy = (E)asy-(D)eplo(Y)

edy is deploy library.

# Install 

``` npm install edy ```

# Module

```javascript
var edy = require('edy');

// send local_path to remote_path
edy.run({
	source : '/home/test',
	target : 'ftp://id:pw@host.com/test'
}, {
	done : function(type, protocol, err, info) {
		console.log(info);
	}
})

```

# Events

## done 
## step
## start
## end
## mkdir

# Command Line

## Download 

### git (clone)

```edy -p git https://host.com/test/test.git /home/dir/project```

```edy git+https://host.com/test/test.git /home/dir/project``` 

```edy git://host.com/test.test.git /home/dir/project```


### svn (checkout)

```edy -p svn https://id:password@svn.com/project/trunk /home/dir/project```

```edy svn+https://id:password@svn.com/project/trunk /home/dir/project``` 

```edy svn://id:password@svn.com/project/trunk /home/dir/project```

### ftp 

```edy ftp://id:password@host.com/project /home/dir/project``` 

### sftp 

```edy sftp://id:password@host.com/project /home/dir/project```

### scp 

```edy scp://id:password@host.com/project/test.txt /home/dir/project```

### rsync 

```edy rsync://host.com/project/test.txt /home/dir/project```

### zip(format : tar.gz, zip)

```edy zip:///home/projects/edy /home/project/edy.tar.gz```

```edy zip:///home/projects/edy /home/project/edy.zip```

### unzip 

```edy zip:///home/projects/edy.tar.gz /home/projects/edy```

```edy zip:///home/projects/edy.zip /home/projects/edy```


## Upload 

### ftp  
```edy /home/dir/files ftp://id:password@host.com/root/sub/```

### sftp
```edy /home/dir/files sftp://id:password@host.com/root/sub/```

### rsync
```edy /home/dir/files rsync://host.com/root/sub/```

### scp
```edy /home/dir/files scp://host.com/root/sub/```


## Remote command 
```edy -e "cd test; ./start.sh" ssh://id:password@host.com```


# License

MIT License 

Copyright (C) 2013 (cyberuls@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. 

