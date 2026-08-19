ROOTPATH    := $(realpath $(dir $(lastword $(MAKEFILE_LIST))))
DOTFILES    := $(wildcard .??*)
EXCLUSIONS  := .DS_Store .git .gitmodules .config .claude
DOTFILES    := $(filter-out $(EXCLUSIONS), $(DOTFILES))
BASH_CONFIGS   := $(wildcard .config/bash/*)
ZSH_CONFIGS    := $(wildcard .config/zsh/.*)
WEZTERM_CONFIGS := $(wildcard .config/wezterm/*)
RELOAD      := $(source ~/.bash_profile)

all: install

link:
	@echo 'Link .files to home directory.'
	@$(foreach val, $(DOTFILES), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
	@mkdir -p $(HOME)/.config/bash
	@mkdir -p $(HOME)/.config/git
	@mkdir -p $(HOME)/.config/mise
	@mkdir -p $(HOME)/.config/tmux
	@mkdir -p $(HOME)/.config/wezterm
	@mkdir -p $(HOME)/.config/zsh
	@mkdir -p $(HOME)/.terraform.d/plugin-cache
	@mkdir -p $(HOME)/.claude
	@ln -sfnv $(abspath .claude/CLAUDE.md) $(HOME)/.claude/CLAUDE.md
	@ln -sfnv $(abspath .claude/agents) $(HOME)/.claude/agents
	@ln -sfnv $(abspath .claude/rules) $(HOME)/.claude/rules
	@ln -sfnv $(abspath .config/git/ignore) $(HOME)/.config/git/ignore
	@ln -sfnv $(abspath .config/mise/config.toml) $(HOME)/.config/mise/config.toml
	@ln -sfnv $(abspath .config/starship.toml) $(HOME)/.config/starship.toml
	@ln -sfnv $(abspath .config/tmux/tmux.conf) $(HOME)/.config/tmux/tmux.conf
	@ln -sfnv $(abspath .zshenv) $(HOME)/.config/zsh/.zshenv
	@$(foreach val, $(BASH_CONFIGS), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
	@$(foreach val, $(WEZTERM_CONFIGS), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
	@$(foreach val, $(ZSH_CONFIGS), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)

init:
	@echo 'TODO: initialize: install, build, configure apps, packages, etc...'

install: link init
	@echo 'Reload shell.'
	@echo $(RELOAD)
