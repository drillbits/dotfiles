# Copyright 2023 drillbits
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

is_darwin() {
  [[ "$(uname)" == 'Darwin' ]]
}

#
# Aliases
#
alias ll='ls -laG'
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'
alias t='tmux'
# macOS-like commands
if [[ ! is_darwin ]]; then
  alias open='xdg-open'
  alias pbcopy='xclip -selection c'
  alias pbpaste='xclip -selection c -o'
fi

#
# Functions
#

# Share bash history
# see: https://piro.sakura.ne.jp/latest/blosxom.cgi/webtech/2018-03-04_history-nodup-with-tmux.htm
share_history() {
  history -a
  tac ~/.bash_history | awk '!a[$0]++' | tac > ~/.bash_history.tmp
  [ -f ~/.bash_history.tmp ] &&
    mv ~/.bash_history{.tmp,} &&
    history -c &&
    history -r
}
PROMPT_COMMAND='share_history'
shopt -u histappend

# Change the working directory to selected Git repository with ghq + peco
cd_git_repo() {
  local sel=$(ghq list -p | peco --query "${LBUFFER}")
  if [[ -n "${sel}" ]]; then
    if [[ -t 1 ]]; then
      cd "${sel}"
    fi
  fi
}
bind -x '"\201": cd_git_repo'
bind '"\C-]":"\201\C-m"'

# SSH host completion
compreply_ssh(){
  COMPREPLY=(`cat ~/.ssh/config | grep -i -e '^host' | cut -d " " -f 2 | grep -E "$2"`)
}
complete -F compreply_ssh ssh

# disable stop(Ctrl+s), start(Ctrl+q)
if [[ -t 0 ]]; then
  stty stop undef
  stty start undef
fi

#
# Load local
#
test -r ~/.bashrc.local && . ~/.bashrc.local
