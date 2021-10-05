# Platform
is_darwin() {
  [ "$(uname)" == 'Darwin' ]
}

# Prompt
source ~/.git-prompt.sh
source ~/.git-completion.bash
GIT_PS1_SHOWDIRTYSTATE=true

# The next line updates PATH for the Google Cloud SDK.
test -r ~/google-cloud-sdk/path.bash.inc && . ~/google-cloud-sdk/path.bash.inc
# The next line enables shell command completion for gcloud.
test -r ~/google-cloud-sdk/completion.bash.inc && . ~/google-cloud-sdk/completion.bash.inc
# Get GCP Project ID
# gcp_ps1=$(gcloud config get-value project 2> /dev/null)
# gcp_symbol=$'\u2601 '
# source ~/src/github.com/drillbits/gcloud-ps1/gcloud-ps1.sh

if [ -z "$PS1" ]; then
  return
else
  PS1=''
  PS1=$PS1'\[\033[32m\]\u@\h\[\033[00m\]'                 # user@host
  PS1=$PS1'% '                                            # %
  PS1=$PS1'\[\033[34m\]\W\[\033[00m\]'                    # workdir
  PS1=$PS1'\[\033[31m\]$(__git_ps1)\[\033[00m\] '         # Git branch
  # PS1=$PS1'\[\033[36m\]$gcp_symbol $gcp_ps1\[\033[00m\] ' # GCP Project ID
  # PS1=$PS1'$(gcloud_ps1) '                              # GCP Project ID
  # PS1=$PS1'$(kube_ps1) '
  PS1=$PS1'\[\033[00m\]\$ '                               # $ 
fi

# ssh host completion
function _compreply_ssh(){
  COMPREPLY=(`cat ~/.ssh/config | grep -i -e '^host' | cut -d " " -f 2 | grep -E "$2"`)
}
complete -F _compreply_ssh ssh

# MacPorts bash completion
if is_darwin; then
  export PATH="/opt/local/bin:/opt/local/sbin:$PATH"
  # kubectl completion
  kubectl completion bash > /opt/local/etc/bash_completion.d/kubectl
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
export GOPATH="$HOME"
export PATH="$GOPATH/bin:$PATH"
export GO111MODULE=on

# Node
export PATH="$HOME/node_modules/.bin:$PATH"
eval "$(nodenv init -)"

# Python
export PYTHONDONTWRITEBYTECODE=1
export PYTHONUSERBASE=~/.local
# export PATH="$PYTHONUSERBASE/bin:$PATH"
export PATH="$HOME/.poetry/bin:$PATH"

# GAE/Go
export GAEGO_HOME="$HOME/go_appengine"

# Docker
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Load local
test -r ~/.bash_profile.local && . ~/.bash_profile.local

# Load rc
test -r ~/.bashrc && . ~/.bashrc

export PATH="$HOME/.poetry/bin:$PATH"
