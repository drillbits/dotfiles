### Langage
#
export LANG=ja_JP.UTF-8
export LESSCHARSET=utf-8


### Paths
#
export PATH=/usr/local/bin:/usr/local/sbin:$HOME/node_modules/.bin:$PATH


### Colors
#
autoload -U colors
colors
local Default=$'%{\e[0m%}'
local Yellow=$'%{\e[33m%}'
local Pink=$'%{\e[35m%}'
local Blue=$'%{\e[34m%}'
local Green=$'%F{green}'
local Red=$'%F{red}'
#
# 直前のコマンドの終了ステータスが0以外のときは赤くする
# ${MY_MY_PROMPT_COLOR}はprecmdで変化させている数値
local MY_COLOR="$ESCX"'%(0?.${MY_PROMPT_COLOR}.31)'m
local NORMAL_COLOR="$ESCX"m
#
# エラーメッセージ本文出力に色付け
e_normal=`echo -e "¥033[0;30m"`
e_RED=`echo -e "¥033[1;31m"`
e_BLUE=`echo -e "¥033[1;36m"`


### Prompt
#
# Left-side
#local Mami=$'┻┳︻▄ξ(✿ ❛‿❛)ξ▄︻┻┳ '
local Mami=$'ξ(✿ ❛◡❛)ξ'
local Tanuon=$'三╹ｗ╹）'
local Yuno=$'X / _ / X < '
local Tiro=$'ξ(✿＞◡❛)ξ▄︻▇▇〓〓'
case ${OSTYPE} in
darwin*)
    export PROMPT=$Yellow$Mami$Default':'$Blue'%1~'$Default'$ '
    ;;
*)
    export PROMPT=$Yellow$Mami$Default$Pink'[%m]'$Default':'$Blue'%1~'$Default'$ '
    ;;
esac
export PROMPT2=$Yellow$Tiro$Default' '$Blue'%_ '$Default'> '
export SPROMPT=$Yellow$Mami$Default' < '$Red'%r is correct? [n,y,a,e]'$Default': '

#
# Right-side with VCS info
setopt prompt_subst
autoload -Uz add-zsh-hook
autoload -Uz vcs_info
zstyle ':vcs_info:*' formats '(%s)-[%b]'
zstyle ':vcs_info:*' actionformats '(%s)-[%b|%a]'
zstyle ':vcs_info:*' get-revision false  # true
zstyle ':vcs_info:*' check-for-changes true
zstyle ':vcs_info:*' max-exports 6
function _precmd_vcs_info () {
    psvar=()
    LANG=en_US.UTF-8 vcs_info
    [[ -n "$vcs_info_msg_0_" ]] && psvar[1]="$vcs_info_msg_0_"
}
add-zsh-hook precmd _precmd_vcs_info
RPROMPT=$Blue'[%~]'$Default'%1(v|%F{green}%1v%f|)'
setopt transient_rprompt


### Completion
bindkey -e
#
#fpath=(~/.zsh/functions/Completion ${fpath})
autoload -U compinit
compinit #-u
#
# ディレクトリ名でcd
#setopt auto_cd
#
# cdしたディレクトリの一覧を表示する
setopt auto_pushd
#
# タブ補完時に大文字小文字を無視
zstyle ':completion:*' matcher-list '' 'm:{a-z}={A-Z}' '+m:{A-Z}={a-z}'
#
# 入力したコマンド名が間違っている場合には修正
setopt correct
#
# コマンドラインの引数で --prefix=/usr などの = 以降でも補完できる
setopt magic_equal_subst
#
# sudoも補完の対象
zstyle ':completion:*:sudo:*' command-path /usr/local/sbin /usr/local/bin /usr/sbin /usr/bin /sbin /bin
#
# sshのホスト名をknown_hostsから補完する
function print_known_hosts (){
  if [ -f $HOME/.ssh/known_hosts ]; then
    cat $HOME/.ssh/known_hosts | tr ',' ' ' | cut -d' ' -f1
  fi
}
_cache_hosts=($( print_known_hosts ))
#
# 補完候補を詰めて表示する
setopt list_packed
#
# 色付きで補完する
zstyle ':completion:*' list-colors di=34 fi=0
#zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}
#
# Prediction configuration
autoload predict-on



### Command history configuration
#
HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
#
# 登録済コマンド行は古い方を削除
setopt hist_ignore_all_dups
#
# historyの共有
setopt share_history
#
# 余分な空白は詰める
setopt hist_reduce_blanks
#
# history (fc -l) コマンドをヒストリリストから取り除く。
setopt hist_no_store
#
# 履歴検索機能のショートカット
autoload history-search-end
zle -N history-beginning-search-backward-end history-search-end
zle -N history-beginning-search-forward-end history-search-end
bindkey "^P" history-beginning-search-backward-end
bindkey "^N" history-beginning-search-forward-end


### Editor
#
# Viキーバインド
#bindkey -v
export EDITOR=/usr/bin/vim
export VIM=/usr/share/vim/vimcurrent
export VIMRUNTIME=$VIM


### .pyc ファイルを作らない
export PYTHONDONTWRITEBYTECODE=1


### virtualenv
#
export VIRTUALENV_USE_DISTRIBUTE=true
export WORKON_HOME=$HOME/.virtualenvs
source `which virtualenvwrapper.sh`


### 分割したzshrcファイルの読み込み
#
# alias
[ -f ~/.zshrc.alias ] && source ~/.zshrc.alias
#
case "${OSTYPE}" in
# Mac OS X
darwin*)
    [ -f ~/.zshrc.osx ] && source ~/.zshrc.osx
    ;;
# Linux
linux*)
    [ -f ~/.zshrc.linux ] && source ~/.zshrc.linux
    ;;
esac
#
# local固有
[ -f ~/.zshrc.local ] && source ~/.zshrc.local
