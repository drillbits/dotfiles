#
# ~/.zshrc
#
# Interactive shell configuration.
# Loaded only for interactive zsh sessions.
#

# ============================================================
# Platform detection
# ============================================================

is_macos() {
  [[ "$OSTYPE" == darwin* ]]
}

# ============================================================
# Terminal key bindings (terminfo-based)
# ------------------------------------------------------------
# Bind common editing and navigation keys using terminfo
# instead of hard-coded escape sequences. This improves
# portability across terminal emulators, Linux console,
# SSH sessions, and tmux.
# ============================================================

zmodload zsh/terminfo

# Editing keys
[[ -n "${terminfo[kbs]}"   ]] && bindkey "${terminfo[kbs]}" backward-delete-char
[[ -n "${terminfo[kdch1]}" ]] && bindkey "${terminfo[kdch1]}" delete-char

# Line navigation
[[ -n "${terminfo[khome]}" ]] && bindkey "${terminfo[khome]}" beginning-of-line
[[ -n "${terminfo[kend]}"  ]] && bindkey "${terminfo[kend]}" end-of-line

# ============================================================
# Tools
# ============================================================

# GPG needs the current TTY for pinentry when using tmux/ssh
if [[ -o interactive ]]; then
  export GPG_TTY=$(tty)
fi

# Vim
# Use XDG-based configuration
export VIMINIT="source ${XDG_CONFIG_HOME}/vim/vimrc"

# mise
eval "$(~/.local/bin/mise activate zsh)"    

# nodenv
eval "$(nodenv init -)"

# ------------------------------------------------------------
# Google Cloud SDK
# ------------------------------------------------------------

if [[ -f "$HOME/.local/opt/google-cloud-sdk/path.zsh.inc" ]]; then
  source "$HOME/.local/opt/google-cloud-sdk/path.zsh.inc"
fi

if [[ -f "$HOME/.local/opt/google-cloud-sdk/completion.zsh.inc" ]]; then
  source "$HOME/.local/opt/google-cloud-sdk/completion.zsh.inc"
fi

# ============================================================
# Completion
# ============================================================

autoload -Uz compinit

# Ensure the cache directory exists (interactive only).
mkdir -p -- "${ZSH_CACHE_HOME}"

# -C: use cached dump file if present (faster startup)
# -d: specify dump file path
compinit -C -d "${ZSH_COMPDUMP}"

zstyle ':completion:*' menu select
setopt EXTENDED_GLOB

# ============================================================
# History
# ============================================================

HISTSIZE=50000
SAVEHIST=50000

# Ensure the history directory exists (interactive only).
mkdir -p -- "${ZSH_STATE_HOME}"

HISTFILE="${ZSH_HISTFILE}"

setopt EXTENDED_HISTORY
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_REDUCE_BLANKS
setopt HIST_EXPIRE_DUPS_FIRST
setopt INC_APPEND_HISTORY
setopt SHARE_HISTORY

bindkey '^P' history-beginning-search-backward
bindkey '^N' history-beginning-search-forward

# ============================================================
# fzf integration
# ============================================================

if [[ -f /usr/share/fzf/key-bindings.zsh ]]; then
  source /usr/share/fzf/key-bindings.zsh
fi

# ============================================================
# ghq + fzf project switcher
# ============================================================

ghq_fzf() {
  local root project_name project_full_path project_relative_path

  root="$(ghq root)" || return 1

  project_name="$(
    ghq list | sort | fzf \
      --prompt='ghq> ' \
      --preview-window='right:60%:wrap' \
      --preview "sh -lc 'bat --color=always --style=header,grid --line-range :80 \"${root}/{}/README\"* 2>/dev/null || ls -la \"${root}/{}\"'"
  )" || return 0

  [[ -n "$project_name" ]] || return 0

  project_full_path="${root}/${project_name}"
  project_relative_path="~/${project_full_path#$HOME/}"

  BUFFER="cd ${project_relative_path}"
  CURSOR=${#BUFFER}
}

zle -N ghq_fzf
bindkey '^\]' ghq_fzf

# ============================================================
# Aliases
# ============================================================

# modern ls replacements
alias ls='eza --icons=auto'
alias ll='eza -lha --git --icons=auto'
alias tree='eza --tree --icons=auto'

# viewing files
alias cat='bat --style=plain'
alias less='bat'

# searching
# alias grep='rg'
# alias find='fd'

# open command compatibility
if is_macos; then
  alias open='open'
else
  alias open='xdg-open'
fi

# mozc tool
alias mozc_tool='/usr/lib/mozc/mozc_tool'
alias mozc_config='/usr/lib/mozc/mozc_tool --mode=config_dialog'
alias mozc_dic='/usr/lib/mozc/mozc_tool --mode=dictionary_tool'

# ============================================================
# Prompt (Starship)
# ============================================================

if command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
fi

# ============================================================
# Local overrides (machine-specific, not tracked in this repo)
# ============================================================

if [[ -f "$ZDOTDIR/.zshrc.local" ]]; then
  source "$ZDOTDIR/.zshrc.local"
fi

