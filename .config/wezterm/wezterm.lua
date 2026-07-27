local wezterm = require 'wezterm'

wezterm.log_info("config: ", wezterm.config_file)

local function font_with_fallback(preferred, params)
  local names = {}
  for i = 1, #preferred do
    names[i] = preferred[i]
  end

  local fallbacks = {
    'Intel One Mono', 
    'Hack Nerd Font Mono', 
    'Noto Sans Mono CJK JP', 
  }
  if wezterm.target_triple == 'x86_64-pc-windows-msvc' then
    table.insert(fallbacks, 'Consolas')
    table.insert(fallbacks, 'Meiryo UI')
    table.insert(fallbacks, 'Yu Gothic UI')
  end
  if wezterm.target_triple == 'x86_64-apple-darwin' then
    table.insert(fallbacks, 'Monaco')
    table.insert(fallbacks, 'Menlo')
    table.insert(fallbacks, 'ヒラギノ丸ゴ ProN')
  end
  if wezterm.target_triple == 'x86_64-unknown-linux-gnu' then
    table.insert(fallbacks, 'Ubuntu Mono')
    table.insert(fallbacks, 'DejaVu Sans Mono')
    table.insert(fallbacks, 'Droid Sans Mono')
  end
  table.insert(fallbacks, 'monospace')
  
  for i = 1, #fallbacks do
    table.insert(names, fallbacks[i])
  end
  
  return wezterm.font_with_fallback(names, params)
end

return {
  automatically_reload_config = true,

  -- input
  use_ime = true,
  ime_preedit_rendering = 'System',

  -- fonts
  font = font_with_fallback { 'CommitMono' },
  font_size = 12.0,
  cell_width = 0.95,
  line_height = 1.20,

  -- theme
  color_scheme = 'Dracula',
  window_background_opacity = 0.9,
}

