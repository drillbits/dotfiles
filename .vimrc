function! s:loadVimrc(name)
  let rc = expand($HOME . '/.vimrc.' . a:name)
  if filereadable(rc)
    execute ':source ~/.vimrc.' . a:name
  endif
endfunction

let names = ["basic", "statusline", "moving", "color", "local"]

for name in names
  call s:loadVimrc(name)
endfor

