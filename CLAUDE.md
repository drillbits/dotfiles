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

`make link` symlinks every file matching `.??*` to `$HOME`, excluding `.DS_Store`, `.git`, `.gitmodules`, `.config`. It also explicitly symlinks `.config/git/ignore` and creates `~/.terraform.d/plugin-cache`.

## Architecture

### Shell

- `.bash_profile` — entry point: SSH agent, PATH setup, prompt, loads `.bash_profile.darwin` on macOS, then `.bashrc`
- `.bash_profile.darwin` — macOS-only: MacPorts, Homebrew, iTerm2 integration
- `.bashrc` — aliases, functions (`ghq_fzf` via `Ctrl+]`, `share_history`), local overrides via `.bashrc.local`

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
