# Platform
is_darwin() {
  [ "$(uname)" == 'Darwin' ]
}

# Prompt
source ~/.git-prompt.sh
source ~/.git-completion.bash
GIT_PS1_SHOWDIRTYSTATE=true

if [ -z "$PS1" ]; then
  return
else
  PS1='\[\033[32m\]\u@\h\[\033[00m\]% \[\033[34m\]\W\[\033[31m\]$(__git_ps1)\[\033[00m\]\$ '
fi

# ssh host completion
function _compreply_ssh(){
  COMPREPLY=(`cat ~/.ssh/config | grep -i -e '^host' | cut -d " " -f 2 | grep -E "$2"`)
}
complete -F _compreply_ssh ssh

# MacPorts bash completion
if is_darwin; then
  export PATH="/opt/local/bin:/opt/local/sbin:$PATH"
  # bash completion
  if [ -f /opt/local/etc/profile.d/bash_completion.sh ]; then
    . /opt/local/etc/profile.d/bash_completion.sh
  fi
fi

# Git
export PATH=$PATH:/usr/local/share/git-core/contrib/diff-highlight

# Vim
if is_darwin; then
  export EDITOR=/Applications/MacVim.app/Contents/MacOS/Vim
else
  export EDITOR=$(which vim)
fi

# Go
export GOROOT="$HOME/src/github.com/golang/go"
export GOPATH="$HOME"
export PATH="$GOPATH/src/github.com/golang/go/bin:$HOME/bin:$PATH"

# Node
export PATH="$HOME/node_modules/.bin:$PATH"

# Python
export PYTHONDONTWRITEBYTECODE=1
export PYTHONUSERBASE=~/.local
export PATH="$PYTHONUSERBASE/bin:$PATH"

# GAE/Go
export GAEGO_HOME="$HOME/go_appengine"

# The next line updates PATH for the Google Cloud SDK.
test -r ~/google-cloud-sdk/path.bash.inc && . ~/google-cloud-sdk/path.bash.inc

# The next line enables shell command completion for gcloud.
test -r ~/google-cloud-sdk/completion.bash.inc && . ~/google-cloud-sdk/completion.bash.inc

# Load local
test -r ~/.bash_profile.local && . ~/.bash_profile.local

# Load rc
test -r ~/.bashrc && . ~/.bashrc
