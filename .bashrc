# Alias
alias ll='ls -laG'
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'
alias t='tmux'
alias d='docker'
alias oyakata='say -v cellos e ma gah wa yah cut tar yah cut tar yah cut tar e ma gah wa yah cut tar oh yah cut tar sammah'

# ghq + peco
select-ghq-repo-by-peco() {
  cd $(ghq list -p | peco)
}
bind -x '"\C-]": select-ghq-repo-by-peco'

# Load local
test -r ~/.bashrc.local && . ~/.bashrc.local
