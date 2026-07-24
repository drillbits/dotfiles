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

`make link` symlinks every file matching `.??*` to `$HOME`, excluding `.DS_Store`, `.git`, `.gitmodules`, `.config`. It also explicitly symlinks `.config/git/ignore`, `.config/starship.toml`, all files under `.config/zsh/`, and creates `~/.config/zsh/` and `~/.terraform.d/plugin-cache`.

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

`.vimrc` is a loader only — it sources `.vimrc.{plugin,basic,statusline,moving,color,local}` in order. Machine-local overrides go in `.vimrc.local` (not tracked).

### tmux

Prefix is `Ctrl+t`. Uses [tpm](https://github.com/tmux-plugins/tpm) with `tmux-resurrect` and `tmux-continuum` (auto-restore on).

### Git

- `ghq root` is `~/go/src`
- All commits are GPG-signed (`commit.gpgsign = true`)
- `https://github.com/` URLs are rewritten to `git@github.com:` via `url` config
- Useful aliases: `st`, `co`, `sw`, `ci`, `di`, `ds`, `pp`, `vacuum` (delete merged branches), `home` (fast-forward a branch from origin)

### Tool versions

- Node: managed with `nodenv`
- Go: `/usr/local/go/bin`, `GOPATH` bins added to PATH
- Python: `PYTHONUSERBASE=~/.local`, bytecode disabled
