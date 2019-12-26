ROOTPATH   := $(realpath $(dir $(lastword $(MAKEFILE_LIST))))
DOTFILES   := $(wildcard .??*)
EXCLUSIONS := .DS_Store .git .gitmodules
DOTFILES   := $(filter-out $(EXCLUSIONS), $(DOTFILES))
RELOAD     := $(source ~/.bash_profile)

all: install

link:
	@echo 'Link .files to home directory.'
	@$(foreach val, $(DOTFILES), ln -sfnv $(abspath $(val)) $(HOME)/$(val);)

ifeq  ($(shell uname),Darwin)
alias:
		@ln -sfnv $(abspath .vscode/settings.json) $(HOME)/Library/Application\ Support/Code/User/settings.json
else
alias:
		@ln -sfnv $(abspath .vscode/settings.json) $(HOME)/.config/Code\ -\ OSS/User/settings.json
endif

init:
	@echo 'TODO: initialize: install, build, configure apps, packages, etc...'

install: link alias init
	@echo 'Reload shell.'
	@echo $(RELOAD)
