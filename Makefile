ROOTPATH   := $(realpath $(dir $(lastword $(MAKEFILE_LIST))))
DOTFILES   := $(wildcard .??*)
EXCLUSIONS := .DS_Store .git .gitmodules .config
DOTFILES   := $(filter-out $(EXCLUSIONS), $(DOTFILES))
RELOAD     := $(source ~/.bash_profile)

all: install

link:
	@echo 'Link .files to home directory.'
	@$(foreach val, $(DOTFILES), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)
	@mkdir -p $(HOME)/.config/git
	@ln -sfnv $(abspath .config/git/ignore) $(HOME)/.config/git/ignore

init:
	@echo 'TODO: initialize: install, build, configure apps, packages, etc...'

install: link init
	@echo 'Reload shell.'
	@echo $(RELOAD)
