#!/bin/bash
 
FILES=`git ls-tree --name-only HEAD $1` 
for f in $FILES; do 

    if [ -d "./$f" ]; then
        str3="dir"
    else
        str3="file"
    fi

    str=$(git log -1 --decorate --pretty=format:"%cr" $f)
    str2=$(git log -1 --decorate --pretty=format:"%h|%s|%ce|%cn" $f)

    printf "%s|%s|%s|%s\n" "$str3" "$f" "$str" "$str2"
done
