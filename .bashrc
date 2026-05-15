_bash_config="${XDG_CONFIG_HOME:-$HOME/.config}/bash/rc"
[[ -r "$_bash_config" ]] && . "$_bash_config"
unset _bash_config
