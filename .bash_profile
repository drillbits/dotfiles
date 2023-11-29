# Autostart X at login
# https://wiki.archlinux.org/title/Xinit#Autostart_X_at_login
if [[ -z "${DISPLAY}" ]] && [[ "${XDG_VTNR}" -eq 1 ]]; then
  exec startx
fi

# Load darwin
if [[ "$(uname)" == 'Darwin' ]]; then
  test -r ~/.bash_profile.darwin && . ~/.bash_profile.darwin
fi

# Bash
HISTSIZE=100000
HISTFILESIZE=100000
HISTTIMEFORMAT='%Y-%m-%dT%H:%M:%S '

# Editor
export EDITOR=vim

# Git
export PATH="${PATH}:/usr/local/share/git-core/contrib/diff-highlight"

# Python
export PYTHONDONTWRITEBYTECODE=1
export PYTHONUSERBASE=~/.local
# export PATH="${PATH}:${PYTHONUSERBASE}/bin"
export PATH="${PATH}:${HOME}/.poetry/bin"

# Go
export PATH="${PATH}:$(go env GOPATH)/bin"

# Node
export PATH="${PATH}:${HOME}/.local/bin"
export npm_config_prefix="$HOME/.local"
eval "$(nodenv init -)"

# Docker
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Google Cloud SDK
if [[ -r ~/google-cloud-sdk/path.bash.inc ]]; then
  . ~/google-cloud-sdk/path.bash.inc
fi
if [[ -r ~/google-cloud-sdk/completion.bash.inc ]]; then
  . ~/google-cloud-sdk/completion.bash.inc
fi

#
# Prompt
#
# Git
source ~/.git-prompt.sh
source ~/.git-completion.bash
GIT_PS1_SHOWDIRTYSTATE=true

if [[ -z "${PS1}" ]]; then
  return
else
  PS1=''
  PS1=${PS1}'\[\033[32m\]\u@\h\[\033[00m\]'                 # user@host
  PS1=${PS1}'% '                                            # %
  PS1=${PS1}'\[\033[34m\]\W\[\033[00m\]'                    # workdir
  PS1=${PS1}'\[\033[31m\]$(__git_ps1)\[\033[00m\] '         # Git branch
  PS1=${PS1}'\[\033[00m\]\$ '                               # $
fi

# Load local
test -r ~/.bash_profile.local && . ~/.bash_profile.local

# Load rc
test -r ~/.bashrc && . ~/.bashrc
