# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal dotfiles repository for Arch Linux (primary) and macOS. Dotfiles are managed by symlinking them from this repo to `$HOME`.

## Commands

```sh
# Symlink all dotfiles to $HOME
make link

# Full setup: link + init
make install
```

`make link` symlinks every file matching `.??*` to `$HOME`, excluding `.DS_Store`, `.git`, `.gitmodules`, `.config`, `.claude`, `.local`, `.ssh`. It also explicitly symlinks `.config/git/ignore`, `.config/herdr/config.toml`, `.config/mise/config.toml`, `.config/starship.toml`, `.config/tmux/tmux.conf`, `.ssh/config`, all files under `.config/zsh/`, all files under `.local/bin/` (file by file, since `~/.local/bin` also holds untracked binaries like mise), and creates `~/.config/zsh/`, `~/.local/bin/` and `~/.terraform.d/plugin-cache`. On Linux it also links `.local/share/applications/herdr.desktop` so herdr appears in the desktop app launcher.

`.ssh/config` in the repo holds shared defaults only (keepalive, `AddKeysToAgent`). Host entries (names, IPs, users) must never be committed — the repo is public; they belong in the untracked `~/.ssh/config.local`, loaded via `Include`.

## Architecture

### Shell

Primary shell is **zsh**. Load order: `.zshenv` (all invocations) → `.zshrc` (interactive only).

- `.zshenv` — sets `ZDOTDIR=$HOME/.config/zsh` (must be first, before XDG vars), XDG base dirs, `$PATH` via `typeset -U path`, SSH agent export, cross-platform `pbcopy`/`pbpaste`
- `.config/zsh/.zshrc` — completion (compinit with XDG cache), history with `SHARE_HISTORY`, fzf keybindings, `ghq_fzf` (`Ctrl+]`), aliases (eza/bat), starship prompt init
- `.config/zsh/` — all zsh dotfiles (`.zprofile`, `.zlogin`, etc.) live here; `make link` symlinks them via wildcard
- `.config/starship.toml` — minimal prompt, git status, gcloud module, language modules disabled

Because `ZDOTDIR` is set, zsh reads `.zshrc` and other startup files from `~/.config/zsh/` rather than `$HOME`. `.zshenv` is canonically at `$HOME/.zshenv`, but zsh only reads it from `$HOME` when `ZDOTDIR` is *not yet* in the environment (the very first shell in a process tree). Any nested zsh invocation that inherits an already-exported `ZDOTDIR` (subshells, `zsh -c`, VS Code's integrated terminal/extensions, etc.) looks for `.zshenv` inside `$ZDOTDIR` instead — so `.zshenv` is also symlinked to `$HOME/.config/zsh/.zshenv` (`make link`) to make sure it's found either way.

Bash files use the same stub pattern — `$HOME/.bash_profile` and `$HOME/.bashrc` are thin stubs that source from `~/.config/bash/`:

- `.config/bash/profile` — actual login shell config (was `.bash_profile`)
- `.config/bash/rc` — actual interactive shell config (was `.bashrc`)
- `.config/bash/profile.darwin` — macOS-only overrides
- `.config/bash/git-prompt.sh` / `.config/bash/git-completion.bash` — sourced from `profile`

### Vim

Config is a single plugin-less file at `.config/vim/vimrc` (XDG layout; no `~/.vimrc`). Loaded via `VIMINIT` exported from `.zshrc`, so any vim launched from zsh reads it regardless of version; vim 9.1.0327+ also finds it natively via XDG, covering launch paths that don't inherit `VIMINIT` (GUI launchers, sudo). Backup/swap/undo go to `~/.cache/vim/`, viminfo to `~/.local/state/vim/`, netrw history to `~/.local/share/vim/`. Machine-local overrides go in `~/.config/vim/vimrc.local` (not tracked).

### tmux

Config lives at `.config/tmux/tmux.conf` (XDG layout; there is no `~/.tmux.conf` — old tmux loads only the first config it finds, so keep a single file). Prefix is `Ctrl+t`. Uses [tpm](https://github.com/tmux-plugins/tpm) (cloned to `~/.config/tmux/plugins/tpm`) with `tmux-resurrect` and `tmux-continuum` (auto-restore on).

Clipboard: `mouse on` + `set-clipboard on` — tmux sends every copy (mouse drag, `y`/`Enter` in copy-mode-vi) to the outer terminal via OSC 52, which works locally and over SSH (wezterm supports it). No `xclip`/`wl-copy` piping. The Linux console (VT) supports neither OSC 52 nor a clipboard; only tmux-internal paste works there.

### herdr

Terminal workspace manager for coding agents, installed via mise. Config at `.config/herdr/config.toml` holds only deviations from herdr defaults: prefix aligned with tmux (`Ctrl+t`), `prefix+Space` for next tab, pane keys matching tmux (`prefix+|` split side by side, `prefix+o` next pane; the notification-target action moves to `prefix+shift+o` to free `o`), toast notifications delivered through the outer terminal (works over SSH, same idea as the OSC 52 clipboard). Runs alongside tmux, not nested inside it — nesting requires double-pressing the prefix and breaks terminal-delivered notifications.

`.local/share/applications/herdr.desktop` puts herdr in the GNOME app launcher (Linux only, linked by `make link`). It runs `mise x -- herdr` inside a dedicated wezterm window (`--class herdr`, so the dock shows it as its own app) because the desktop session's PATH has `~/.local/bin` but not mise's shims, and because terminal-delivered toasts need wezterm rather than GNOME's default terminal.

### Scripts

Small helper scripts live in `.local/bin/` and are linked into `~/.local/bin` (already on `$PATH` via `.zshenv`).

- `audio-output-toggle` — cycles the default audio sink to the next one (PipeWire via pipewire-pulse, or PulseAudio; uses `pactl` so it works on both Arch and Ubuntu). Device names are never hard-coded. Intended to be bound to a GNOME custom shortcut or a Stream Deck button (OpenDeck "Run Command"); those don't run through zsh, so reference it by absolute path.

### Git

- `ghq root` is `~/go/src`
- All commits are GPG-signed (`commit.gpgsign = true`)
- `https://github.com/` URLs are rewritten to `git@github.com:` via `url` config
- Useful aliases: `st`, `co`, `sw`, `ci`, `di`, `ds`, `pp`, `vacuum` (delete merged branches), `home` (fast-forward a branch from origin)

### Tool versions

- Node: managed with `nodenv`
- Go: `/usr/local/go/bin`, `GOPATH` bins added to PATH
- Python: `PYTHONUSERBASE=~/.local`, bytecode disabled
