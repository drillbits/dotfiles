ROOTPATH    := $(realpath $(dir $(lastword $(MAKEFILE_LIST))))
DOTFILES    := $(wildcard .??*)
EXCLUSIONS  := .DS_Store .git .gitmodules .config
DOTFILES    := $(filter-out $(EXCLUSIONS), $(DOTFILES))
BASH_CONFIGS := $(wildcard .config/bash/*)
ZSH_CONFIGS  := $(wildcard .config/zsh/.*)
RELOAD      := $(source ~/.bash_profile)

all: install

link:
	@echo 'Link .files to home directory.'
	@$(foreach val, $(DOTFILES), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
	@mkdir -p $(HOME)/.config/bash
	@mkdir -p $(HOME)/.config/git
	@mkdir -p $(HOME)/.config/zsh
	@mkdir -p $(HOME)/.terraform.d/plugin-cache
	@ln -sfnv $(abspath .config/git/ignore) $(HOME)/.config/git/ignore
	@ln -sfnv $(abspath .config/starship.toml) $(HOME)/.config/starship.toml
	@$(foreach val, $(BASH_CONFIGS), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
	@$(foreach val, $(ZSH_CONFIGS), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)

init:
	@echo 'TODO: initialize: install, build, configure apps, packages, etc...'

install: link init
	@echo 'Reload shell.'
	@echo $(RELOAD)
