ROOTPATH    := $(realpath $(dir $(lastword $(MAKEFILE_LIST))))
DOTFILES    := $(wildcard .??*)
EXCLUSIONS  := .DS_Store .git .gitmodules .config .claude .local .ssh
DOTFILES    := $(filter-out $(EXCLUSIONS), $(DOTFILES))
BASH_CONFIGS   := $(wildcard .config/bash/*)
ZSH_CONFIGS    := $(wildcard .config/zsh/.??*)
WEZTERM_CONFIGS := $(wildcard .config/wezterm/*)
LOCAL_BINS  := $(wildcard .local/bin/*)
CLAUDE_CONFIGS := CLAUDE.md agents rules settings.json
CLAUDE_DIRS := $(HOME)/.claude $(patsubst %/,%,$(wildcard $(HOME)/.claude-accounts/*/))
RELOAD      := $(source ~/.bash_profile)
UNAME_S     := $(shell uname -s)

all: install

link:
	@echo 'Link .files to home directory.'
	@$(foreach val, $(DOTFILES), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
	@mkdir -p $(HOME)/.config/bash
	@mkdir -p $(HOME)/.config/git
	@mkdir -p $(HOME)/.config/mise
	@mkdir -p $(HOME)/.config/tmux
	@mkdir -p $(HOME)/.config/herdr
	@mkdir -p $(HOME)/.config/vim
	@mkdir -p $(HOME)/.config/wezterm
	@mkdir -p $(HOME)/.config/zsh
	@mkdir -p $(HOME)/.local/bin
	@mkdir -p -m 700 $(HOME)/.ssh
	@mkdir -p $(HOME)/.terraform.d/plugin-cache
	@mkdir -p $(HOME)/.claude
	@$(foreach d, $(CLAUDE_DIRS), $(foreach val, $(CLAUDE_CONFIGS), ln -sfnv $(abspath .claude/$(val)) $(d)/$(val);))
	@ln -sfnv $(abspath .config/git/ignore) $(HOME)/.config/git/ignore
	@ln -sfnv $(abspath .config/mise/config.toml) $(HOME)/.config/mise/config.toml
	@ln -sfnv $(abspath .config/starship.toml) $(HOME)/.config/starship.toml
	@ln -sfnv $(abspath .config/tmux/tmux.conf) $(HOME)/.config/tmux/tmux.conf
	@ln -sfnv $(abspath .config/herdr/config.toml) $(HOME)/.config/herdr/config.toml
	@ln -sfnv $(abspath .config/vim/vimrc) $(HOME)/.config/vim/vimrc
	@ln -sfnv $(abspath .ssh/config) $(HOME)/.ssh/config
	@ln -sfnv $(abspath .zshenv) $(HOME)/.config/zsh/.zshenv
	@$(foreach val, $(BASH_CONFIGS), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
	@$(foreach val, $(WEZTERM_CONFIGS), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
	@$(foreach val, $(ZSH_CONFIGS), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
	@$(foreach val, $(LOCAL_BINS), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
ifeq ($(UNAME_S),Linux)
	@mkdir -p $(HOME)/.local/share/applications
	@ln -sfnv $(abspath .local/share/applications/herdr.desktop) $(HOME)/.local/share/applications/herdr.desktop
endif

claude-account:
	@test -n '$(NAME)' || { echo 'usage: make claude-account NAME=<name>' >&2; exit 2; }
	@sh scripts/claude-account '$(NAME)'

gnome-keys:
	@sh scripts/gnome-keys

herdr-integrations:
	@sh scripts/herdr-integrations

init:
	@echo 'TODO: initialize: install, build, configure apps, packages, etc...'

install: link init
	@echo 'Reload shell.'
	@echo $(RELOAD)
