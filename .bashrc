# Platform
is_darwin() {
  [ "$(uname)" == 'Darwin' ]
}

# Alias
alias ll='ls -laG'
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'
alias t='tmux'
alias d='docker'
if is_darwin; then
  alias vi='env LANG=ja_JP.UTF-8 /Applications/MacVim.app/Contents/MacOS/Vim "$@"'
  alias vim='env LANG=ja_JP.UTF-8 /Applications/MacVim.app/Contents/MacOS/Vim "$@"'
  alias oyakata='say -v cellos e ma gah wa yah cut tar yah cut tar yah cut tar e ma gah wa yah cut tar oh yah cut tar sammah'
else
  alias open='xdg-open'
fi

# ghq + peco
select-ghq-repo-by-peco() {
  cd $(ghq list -p | peco)
}
bind -x '"\C-]": select-ghq-repo-by-peco'

# share bash history
# see: https://piro.sakura.ne.jp/latest/blosxom.cgi/webtech/2018-03-04_history-nodup-with-tmux.htm
function share_history {
  history -a
  tac ~/.bash_history | awk '!a[$0]++' | tac > ~/.bash_history.tmp
  [ -f ~/.bash_history.tmp ] &&
    mv ~/.bash_history{.tmp,} &&
    history -c &&
    history -r
}
PROMPT_COMMAND='share_history'
shopt -u histappend

# Load local
test -r ~/.bashrc.local && . ~/.bashrc.local
