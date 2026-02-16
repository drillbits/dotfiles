#!/bin/sh

#export XDG_SESSION_TYPE=x11
#export GDK_BACKEND=x11
#exec gnome-session
exec dbus-run-session gnome-session

#eval $(/usr/bin/gnome-keyring-daemon --start --components=pkcs11,secrets,ssh,gpg)
#export SSH_AUTH_SOCK
