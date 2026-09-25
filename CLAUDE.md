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

# Register GNOME custom keyboard shortcuts (Linux/GNOME only; idempotent)
make gnome-keys

# Install herdr's Claude Code integration hook (idempotent; re-run after `herdr update`)
make herdr-integrations
```

`make link` symlinks every file matching `.??*` to `$HOME`, excluding `.DS_Store`, `.git`, `.gitmodules`, `.config`, `.claude`, `.local`, `.ssh`. It also explicitly symlinks `.config/git/ignore`, `.config/herdr/config.toml`, `.config/mise/config.toml`, `.config/starship.toml`, `.config/tmux/tmux.conf`, `.ssh/config`, all files under `.config/zsh/`, all files under `.local/bin/` (file by file, since `~/.local/bin` also holds untracked binaries like mise), and creates `~/.config/zsh/`, `~/.local/bin/` and `~/.terraform.d/plugin-cache`. On Linux it also links `.local/share/applications/herdr.desktop` so herdr appears in the desktop app launcher.

Claude Code's user-level config is tracked under `.claude/` and linked into `~/.claude/`: `CLAUDE.md`, `agents/`, `rules/` and `settings.json`. Claude Code itself writes to `settings.json` (e.g. when a permission is allowed permanently), so the repo will show such edits to commit or discard.

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

`herd DIR` (see Scripts) is the `code DIR` equivalent: it opens a directory as a workspace in the running herdr, launching that window first if needed.

`make herdr-integrations` (`scripts/herdr-integrations`) runs `herdr integration install claude`, which writes the herdr-managed hook script `~/.claude/hooks/herdr-agent-state.sh` (untracked: herdr overwrites it on reinstall or update) and adds a `SessionStart` entry to `settings.json` calling it by absolute path. Because `settings.json` is tracked and the repo is public, the script then replaces herdr's entry with an equivalent one that goes through `$HOME` (hook commands run through a shell, so it expands). herdr only recognizes its own form and re-adds it on every install, so the cleanup is part of the target; never run `herdr integration install claude` by hand. The hook is a no-op outside herdr panes; inside one it reports the Claude Code session id so herdr can resume the session after a server restart. Re-run the target after `herdr update` to pick up a newer integration version.

### Scripts

Small helper scripts live in `.local/bin/` and are linked into `~/.local/bin` (already on `$PATH` via `.zshenv`).

- `audio-output-toggle` — cycles the default audio sink to the next one (PipeWire via pipewire-pulse, or PulseAudio; uses `pactl` so it works on both Arch and Ubuntu). Device names are never hard-coded. Intended to be bound to a GNOME custom shortcut or a Stream Deck button (OpenDeck "Run Command"); those don't run through zsh, so reference it by absolute path. `make gnome-keys` registers it on `Super+F9`.
- `herd [DIR]` — opens a directory in herdr the way `code DIR` does in VS Code (DIR defaults to `.`). Focuses the workspace that already has a pane launched in DIR, otherwise creates one over the socket API (herdr labels it by basename), then raises the herdr window via GNOME Shell's `FocusApp`. If no server is running it launches herdr in a wezterm window with the same command line as `herdr.desktop` plus `--cwd DIR` (keep the two in sync), waits for the socket and for the client's first workspace, and then does the same focus-or-create step — needed because a restored session brings back its old workspaces rather than opening DIR. Run it from a shell: it needs `herdr` and `jq` on `$PATH`.

`scripts/gnome-keys` holds the GNOME custom shortcuts as `set_key NAME COMMAND BINDING` lines and applies them with gsettings. It is idempotent: an entry with the same name is updated in place, a new one takes the lowest free `customN` slot, and shortcuts with other names (registered by hand or by other apps) are left alone. gsettings state is per machine, so run it on each GNOME box after `make link`.

### Git

- `ghq root` is `~/go/src`
- All commits are GPG-signed (`commit.gpgsign = true`)
- `https://github.com/` URLs are rewritten to `git@github.com:` via `url` config
- Useful aliases: `st`, `co`, `sw`, `ci`, `di`, `ds`, `pp`, `vacuum` (delete merged branches), `home` (fast-forward a branch from origin)

### Tool versions

- Node: managed with `nodenv`
- Go: `/usr/local/go/bin`, `GOPATH` bins added to PATH
- Python: `PYTHONUSERBASE=~/.local`, bytecode disabled
