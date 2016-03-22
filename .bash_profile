# Prompt
source ~/.git-completion.bash
source ~/.git-prompt.sh
GIT_PS1_SHOWDIRTYSTATE=true

if [ -z "$PS1" ]; then
  return
else
  PS1='\[\033[32m\]\h\[\033[00m\]% \[\033[34m\]\W\[\033[31m\] $(__git_ps1)\[\033[00m\]\$ '
fi

# Go
export GOROOT="$HOME/src/github.com/golang/go"
export GOPATH="$HOME"
export PATH="$GOROOT/bin:$HOME/bin:$PATH"

# Node
export PATH="$HOME/node_modules/.bin:$PATH"

# GCE
export PATH="$HOME/go_appengine:$PATH"
export PATH="$HOME/google-cloud-sdk/bin:$PATH"

# Load rc
test -r ~/.bashrc && . ~/.bashrc
