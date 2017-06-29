# Prompt
source ~/.git-completion.bash
source ~/.git-prompt.sh
GIT_PS1_SHOWDIRTYSTATE=true

if [ -z "$PS1" ]; then
  return
else
  PS1='\[\033[32m\]\u@\h\[\033[00m\]% \[\033[34m\]\W\[\033[31m\]$(__git_ps1)\[\033[00m\]\$ '
fi

# Completion
# brew install bash-completion
if [ -f $(brew --prefix)/etc/bash_completion ]; then
  . $(brew --prefix)/etc/bash_completion
fi

# Git
export PATH=$PATH:/usr/local/share/git-core/contrib/diff-highlight

# Vim
export EDITOR=/Applications/MacVim.app/Contents/MacOS/Vim

# Go
export GOROOT="$HOME/src/github.com/golang/go"
export GOPATH="$HOME"
export PATH="$GOPATH/src/github.com/golang/go/bin:$HOME/bin:$PATH"

# Node
export PATH="$HOME/node_modules/.bin:$PATH"

# Python
export PYTHONDONTWRITEBYTECODE=1

# GAE/Go
export GAEGO_HOME="$HOME/go_appengine"

# The next line updates PATH for the Google Cloud SDK.
test -r ~/google-cloud-sdk/path.bash.inc && . ~/google-cloud-sdk/path.bash.inc

# The next line enables shell command completion for gcloud.
test -r ~/google-cloud-sdk/completion.bash.inc && . ~/google-cloud-sdk/completion.bash.inc

# Load rc
test -r ~/.bashrc && . ~/.bashrc
