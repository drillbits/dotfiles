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
  export EDOTOR=$(which vim)
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

# swiftenv
export SWIFTENV_ROOT="$HOME/.swiftenv"
export PATH="$SWIFTENV_ROOT/bin:$PATH"
eval "$(swiftenv init -)"

# Load rc
test -r ~/.bashrc && . ~/.bashrc

export WMSJAVA_HOME="/Library/WowzaStreamingEngine-4.7.6/java"
