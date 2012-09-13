#!/bin/sh
cd $(dirname $0)
cd files
for dotfile in .?*
do
    if [ $dotfile != '..' ] && [ $dotfile != '.git' ]
    then
        ln -Fis "$PWD/$dotfile" $HOME
    fi
done

touch $HOME/.hgrc.local
