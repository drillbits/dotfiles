#
# ~/.zshenv
#
# This file is sourced by *every* zsh invocation:
#   - interactive shells
#   - non-interactive shells
#   - tmux panes
#   - SSH commands
#   - scripts using /usr/bin/env zsh
#
# Therefore:
#   ✔ keep it FAST
#   ✔ avoid heavy external commands
#   ✔ define environment + universal utilities only
#

# ZDOTDIR must come before XDG so zsh finds .zshrc in ~/.config/zsh/
export ZDOTDIR="$HOME/.config/zsh"

# ============================================================
# XDG Base Directory Specification
# ------------------------------------------------------------
# Provide defaults when variables are unset.
# Many applications assume these paths implicitly,
# but shells do NOT auto-expand them.
# ============================================================

export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"

### zsh completion cache (XDG)
# Store compinit dump files under XDG cache to avoid cluttering $HOME.
export ZSH_CACHE_HOME="${ZSH_CACHE_HOME:-$XDG_CACHE_HOME/zsh}"
export ZSH_COMPDUMP="${ZSH_COMPDUMP:-$ZSH_CACHE_HOME/zcompdump}"

### zsh history location (XDG)
# Store shell history under XDG state directory.
export ZSH_STATE_HOME="${ZSH_STATE_HOME:-$XDG_STATE_HOME/zsh}"
export ZSH_HISTFILE="${ZSH_HISTFILE:-$ZSH_STATE_HOME/history}"

### less history location (XDG)
# Store less history under XDG cache directory (avoid ~/.lesshst in $HOME).
export LESSHISTFILE="${LESSHISTFILE:-$XDG_CACHE_HOME/less/history}"

# ============================================================
# PATH configuration
# ------------------------------------------------------------
# Use zsh's `path` array instead of editing PATH directly.
#
# Advantages:
#   - prevents duplicated entries
#   - preserves existing system order
#   - safe across subshell reloads
# ============================================================

typeset -U path

path=(
  "$HOME/.local/bin"   # user-local executables
  "$HOME/go/bin"       # Go install binaries
  $path
)

export PATH

### SSH agent consistency
# Ensure SSH_AUTH_SOCK is always exported so tmux panes and
# child shells can access the same SSH agent.
#
# Prefer the persistent GNOME Keyring ssh-agent socket (systemd
# user unit gcr-ssh-agent.socket) over spawning a new `ssh-agent`
# per shell. Keys added via ssh-add are remembered across shells.

_gcr_ssh_sock="$XDG_RUNTIME_DIR/gcr/ssh"

if [[ -S "$_gcr_ssh_sock" ]]; then
  export SSH_AUTH_SOCK="$_gcr_ssh_sock"
elif [[ -n "$SSH_AUTH_SOCK" ]]; then
  export SSH_AUTH_SOCK
fi

unset _gcr_ssh_sock

# ============================================================
# Cross-platform clipboard utilities
# ------------------------------------------------------------
# Provide macOS-like `pbcopy` / `pbpaste` everywhere.
#
# Supported environments:
#   macOS   → pbcopy / pbpaste
#   Wayland → wl-copy / wl-paste
#   X11     → xclip
#   Remote  → OSC52 escape sequence fallback
#
# Goal:
#   Same clipboard workflow across:
#     - local terminals
#     - tmux
#     - SSH sessions
#     - remote servers
#
# NOTE:
#   Functions are defined here but NOT executed,
#   keeping .zshenv lightweight.
# ============================================================

# Detect operating system (POSIX-safe)
_pb_os() {
  uname 2>/dev/null
}

# Check command availability
_pb_has() {
  command -v "$1" >/dev/null 2>&1
}

# OSC52 clipboard fallback
# Sends clipboard data to terminal emulator.
# Works over SSH/tmux if terminal supports OSC52.
_pbcopy_osc52() {
  if _pb_has base64; then
    base64 | tr -d '\n' \
      | sed 's/^/\033]52;c;/' \
      | sed 's/$/\a/'
  elif _pb_has openssl; then
    openssl base64 -A \
      | sed 's/^/\033]52;c;/' \
      | sed 's/$/\a/'
  else
    printf '%s\n' \
      "pbcopy: base64 or openssl required for OSC52 fallback" >&2
    return 1
  fi
}

# ------------------------------------------------------------
# pbcopy — write stdin to system clipboard
# ------------------------------------------------------------
pbcopy() {
  case "$(_pb_os)" in
    Darwin)
      if _pb_has pbcopy; then
        command pbcopy
        return
      fi
      ;;
  esac

  # Wayland clipboard
  if _pb_has wl-copy; then
    wl-copy
    return
  fi

  # X11 clipboard
  if _pb_has xclip; then
    xclip -selection clipboard
    return
  fi

  # Terminal fallback
  _pbcopy_osc52
}

# ------------------------------------------------------------
# pbpaste — read system clipboard to stdout
# ------------------------------------------------------------
pbpaste() {
  case "$(_pb_os)" in
    Darwin)
      if _pb_has pbpaste; then
        command pbpaste
        return
      fi
      ;;
  esac

  if _pb_has wl-paste; then
    wl-paste
    return
  fi

  if _pb_has xclip; then
    xclip -selection clipboard -o
    return
  fi

  printf '%s\n' \
    "pbpaste: clipboard read unsupported in this environment" >&2
  return 1
}

