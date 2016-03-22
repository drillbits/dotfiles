function! s:loadVimrc(name)
  let rc = expand($HOME . '/.vimrc.' . a:name)
  if filereadable(rc)
    execute ':source ~/.vimrc.' . a:name
  endif
endfunction

let names = ["basic", "statusline", "moving", "local"]

for name in names
  call s:loadVimrc(name)
endfor

