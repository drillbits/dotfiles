export LANG=ja_JP.UTF-8
export LESSCHARSET=utf-8

### Colors
autoload -U colors
colors

local Default=$'%{\e[0m%}'
local Yellow=$'%{\e[33m%}'
local Pink=$'%{\e[35m%}'
local Blue=$'%{\e[34m%}'

### Prompt
#
# Left-side
#
#local Mami=$'┻┳︻▄ξ(✿ ❛‿❛)ξ▄︻┻┳ '
local Mami=$'ξ(✿ ❛◡❛)ξ'
local Tanuon=$'三╹ｗ╹）'
local Yuno=$'X / _ / X < '
local Tiro=$'ξ(✿＞◡❛)ξ▄︻▇▇〓〓'

export PS1=$Yellow$Mami$Default':'$Blue'%1~'$Default'$ '

#
# Right-side with VCS branch
#
autoload -Uz vcs_info
zstyle ':vcs_info:*' formats '(%s)-[%b]'
zstyle ':vcs_info:*' actionformats '(%s)-[%b|%a]'
precmd () {
    psvar=()
    LANG=en_US.UTF-8 vcs_info
    [[ -n "$vcs_info_msg_0_" ]] && psvar[1]="$vcs_info_msg_0_"
}
RPROMPT=$Blue'[%~]'$Default'%1(v|%F{green}%1v%f|)'


### Paths
# export PATH=/opt/local/bin:/opt/local/Library/Frameworks/Python.framework/Versions/Current/bin:/opt/local/sbin:$PATH
export PATH=$PATH:/opt/local/bin:/opt/local/sbin:/usr/local/bin:/usr/local/sbin


### タブ補完時に大文字小文字を無視
compctl -M 'm:{a-z}={A-Z}'


### sudoも補完の対象
zstyle ':completion:*:sudo:*' command-path /usr/local/sbin /usr/local/bin /usr/sbin /usr/bin /sbin /bin


### Editor
# MacVim-KaoriYa as Vim
export EDITOR=/Applications/MacVim.app/Contents/MacOS/Vim
alias vi='env LANG=ja_JP.UTF-8 /Applications/MacVim.app/Contents/MacOS/Vim "$@"'
alias vim='env LANG=ja_JP.UTF-8 /Applications/MacVim.app/Contents/MacOS/Vim "$@"'
export VIM=/Applications/MacVim.app/Contents/Resources/vim
export VIMRUNTIME=/Applications/MacVim.app/Contents/Resources/vim/runtime


### Aliases
alias ll='ls -laG'
alias mysql='mysql5 -u root'

alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'

alias chrome='open -a /Applications/Google\ Chrome.app'


### VirtualENV & VirtualENVWrapper
export WORKON_HOME=$HOME/.virtualenvs
source `which virtualenvwrapper.sh`


# 分割したzshrcファイルがあれば読み込む
ZSHHOME="${HOME}/.zsh"

if [ -d $ZSHHOME -a -r $ZSHHOME -a \
     -x $ZSHHOME ]; then
    for i in $ZSHHOME/*; do
        [[ ${i##*/} = *.zsh ]] &&
            [ \( -f $i -o -h $i \) -a -r $i ] && . $i
    done
fi
