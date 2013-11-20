" vim: foldmethod=marker
" vim: foldcolumn=3
" vim: foldlevel=0

" Basics {{{
" =====================================================================
set nocompatible
set scrolloff=5                  " スクロール時の余白確保
set textwidth=0                  " 一行に長い文章を書いていても自動折り返しをしない
set nobackup                     " バックアップ取らない
set autoread                     " 他で書き換えられたら自動で読み直す
set noswapfile                   " スワップファイル作らない
set hidden                       " 編集中でも他のファイルを開けるようにする
set backspace=indent,eol,start   " バックスペースでなんでも消せるように
set formatoptions=lmoq           " テキスト整形オプション，マルチバイト系を追加
set vb t_vb=                     " ビープをならさない
set whichwrap=b,s,h,l,<,>,[,]    " カーソルを行頭、行末で止まらないようにする
set showcmd                      " コマンドをステータス行に表示
set showmode                     " 現在のモードを表示
set viminfo='50,<1000,s100,\"50  " viminfoファイルの設定
"set modelines                    " モードラインは有効
"set modelines=3                  " 3行目までをモードラインとして検索する
set nomodeline

" OSのクリップボードを使用する
set clipboard+=unnamed
set clipboard+=autoselect

" ターミナルでマウスを使用できるようにする
if has('kaoriya')
  set mouse=
endif
set guioptions+=a
set ttymouse=xterm2

" ファイルタイプ判定をoff
filetype off

" NeoBundleの初期化
set rtp+=~/.vim/neobundle.vim
if has('vim_starting')
  set runtimepath+=~/.vim/neobundle.vim
  call neobundle#rc(expand('~/.vim/bundle/'))
endif

NeoBundle 'thinca/vim-ref'
NeoBundle 'tpope/vim-surround'
NeoBundle 'Shougo/unite.vim'
NeoBundle 'thinca/vim-quickrun'
NeoBundle 'basyura/jslint.vim'
NeoBundle 'python_fold'
NeoBundle 'mattn/webapi-vim'
NeoBundle 'heavenshell/vim-connpass'
NeoBundle 'YankRing.vim'
NeoBundle 'm4i/YankRingSync'
NeoBundle 'kchmck/vim-coffee-script'
NeoBundle 'tpope/vim-fugitive'
NeoBundle 'glidenote/memolist.vim'
NeoBundle 'drillbits/nyan-modoki.vim'
NeoBundle 'undx/vim-gocode'
NeoBundle 'mako.vim'
NeoBundle 'dag/vim2hs'
NeoBundle 'Shougo/vimproc', {
  \ 'build' : {
    \ 'windows' : 'make -f make_mingw32.mak',
    \ 'cygwin' : 'make -f make_cygwin.mak',
    \ 'mac' : 'make -f make_mac.mak',
    \ 'unix' : 'make -f make_unix.mak',
  \ },
\ }
NeoBundle 'eagletmt/ghcmod-vim'
" powerline
" NeoBundle 'alpaca-tc/alpaca_powertabline'
" NeoBundle 'Lokaltog/powerline', { 'rtp' : 'powerline/bindings/vim'}
NeoBundle 'kakkyz81/evervim'
NeoBundle 'rhysd/accelerated-jk'
let g:accelerated_jk_acceleration_table = [10,5,3]
nmap j <Plug>(accelerated_jk_gj)
nmap k <Plug>(accelerated_jk_gk)

" ファイルタイプ判定をon
filetype on
syntax on
filetype indent on
filetype plugin on

autocmd BufRead,BufNewFile *.go set filetype=go
autocmd BufRead,BufNewFile *.mako set filetype=mako

set helpfile=$VIMRUNTIME/doc/help.txt
" }}}
" StatusLine {{{
" =====================================================================
set laststatus=2 " 常にステータスラインを表示

" カーソルが何行目の何列目に置かれているかを表示する
set ruler

" ステータスラインに文字コードと改行文字を表示する
"set statusline=%<[%n]%m%r%h%w%{'['.(&fenc!=''?&fenc:&enc).':'.&ff.']'}%y\ %F%=[%{GetB()}]\ %l,%c%V%8P
set statusline=%<%m%r%h%w%{'['.(&fenc!=''?&fenc:&enc).']'}%y\ %f\ %{g:NyanModoki()}%=\ %l,%c\ %8P
" (＞ワ＜≡＞ワ＜)コシコシコシ
" set statusline=%{g:NyanModoki()}
let g:nyan_modoki_select_cat_face_number = 6
let g:nayn_modoki_animation_enabled= 1
" }}}
" Apperance {{{
" =====================================================================
set showmatch         " 括弧の対応をハイライト
set number            " 行番号表示
set list              " 不可視文字表示
set listchars=tab:>.,trail:_,extends:>,precedes:< " 不可視文字の表示形式
set display=uhex      " 印字不可能文字を16進数で表示

autocmd FileType go set nolist

" 全角スペースの表示
highlight ZenkakuSpace cterm=underline ctermfg=lightblue guibg=darkgray
match ZenkakuSpace /　/

" カーソル行をハイライト
set cursorline
" カレントウィンドウにのみ罫線を引く
augroup cch
autocmd! cch
autocmd WinLeave * set nocursorline
autocmd WinEnter,BufRead * set cursorline
augroup END

:hi clear CursorLine
:hi CursorLine gui=underline
highlight CursorLine ctermbg=black guibg=black

" コマンド実行中は再描画しない
:set lazyredraw

" }}}
" Indent {{{
" =====================================================================
set autoindent   " 自動でインデント
set paste        " ペースト時にautoindentを無効に
set smartindent  " 新しい行を開始したときに、新しい行のインデントを現在行と同じ量にする。

" softtabstopはTabキー押し下げ時の挿入される空白の量，0の場合はtabstopと同じ，BSにも影響する
set tabstop=4 shiftwidth=4 softtabstop=0

if has("autocmd")
  " ファイルタイプの検索を有効にする
  filetype plugin on
  " そのファイルタイプにあわせたインデントを利用する
  filetype indent on
  " これらのftではインデントを無効に
  " autocmd FileType php filetype indent off
  autocmd FileType python setl autoindent
  autocmd FileType python setl smartindent cinwords=if,elif,else,for,while,try,except,finally,def,class
  autocmd FileType python setl expandtab tabstop=4 shiftwidth=4 softtabstop=4

  autocmd FileType ruby setl autoindent
  autocmd FileType ruby setl expandtab tabstop=2 shiftwidth=2 softtabstop=2

  autocmd FileType javascript setl autoindent
  autocmd FileType javascript setl expandtab tabstop=2 shiftwidth=2 softtabstop=2

  autocmd FileType html setl autoindent
  autocmd FileType html setl expandtab tabstop=2 shiftwidth=2 softtabstop=2

  autocmd FileType htmldjango setl autoindent
  autocmd FileType htmldjango setl expandtab tabstop=2 shiftwidth=2 softtabstop=2

  autocmd FileType go setl autoindent
  autocmd FileType go setl noexpandtab tabstop=4 shiftwidth=4 softtabstop=4

  autocmd FileType haskell setl autoindent
  autocmd FileType haskell setl expandtab tabstop=2 shiftwidth=2 softtabstop=2
endif

" }}}
" Search {{{
" =====================================================================
"set wrapscan   " 最後まで検索したら先頭へ戻る
set ignorecase " 大文字小文字無視
set smartcase  " 検索文字列に大文字が含まれている場合は区別して検索する
set incsearch  " インクリメンタルサーチ
set hlsearch   " 検索文字をハイライト
" Escの2回押しでハイライト消去
nmap <ESC><ESC> :nohlsearch<CR><ESC>

" }}}
" Move {{{
" =====================================================================
" tabで分割ウィンドウ間を移動
nnoremap <silent><tab>  <C-w>w

" matchit.vim有効化
source $VIMRUNTIME/macros/matchit.vim

" }}}
" Encoding {{{
" =====================================================================
set ffs=unix,dos,mac  " 改行文字
set encoding=utf-8    " デフォルトエンコーディング

" 文字コードの自動認識
" @see ずんWiki http://www.kawaz.jp/pukiwiki/?vim#cb691f26
if &encoding !=# 'utf-8'
  set encoding=japan
  set fileencoding=japan
endif
if has('iconv')
  let s:enc_euc = 'euc-jp'
  let s:enc_jis = 'iso-2022-jp'
  " iconvがeucJP-msに対応しているかをチェック
  if iconv("\x87\x64\x87\x6a", 'cp932', 'eucjp-ms') ==# "\xad\xc5\xad\xcb"
    let s:enc_euc = 'eucjp-ms'
    let s:enc_jis = 'iso-2022-jp-3'
  " iconvがJISX0213に対応しているかをチェック
  elseif iconv("\x87\x64\x87\x6a", 'cp932', 'euc-jisx0213') ==# "\xad\xc5\xad\xcb"
    let s:enc_euc = 'euc-jisx0213'
    let s:enc_jis = 'iso-2022-jp-3'
  endif
  " fileencodingsを構築
  if &encoding ==# 'utf-8'
    let s:fileencodings_default = &fileencodings
    let &fileencodings = s:enc_jis .','. s:enc_euc .',cp932'
    let &fileencodings = &fileencodings .','. s:fileencodings_default
    unlet s:fileencodings_default
  else
    let &fileencodings = &fileencodings .','. s:enc_jis
    set fileencodings+=utf-8,ucs-2le,ucs-2
    if &encoding =~# '^\(euc-jp\|euc-jisx0213\|eucjp-ms\)$'
      set fileencodings+=cp932
      set fileencodings-=euc-jp
      set fileencodings-=euc-jisx0213
      set fileencodings-=eucjp-ms
      let &encoding = s:enc_euc
      let &fileencoding = s:enc_euc
    else
      let &fileencodings = &fileencodings .','. s:enc_euc
    endif
  endif
  " 定数を処分
  unlet s:enc_euc
  unlet s:enc_jis
endif
" 日本語を含まない場合は fileencoding に encoding を使うようにする
if has('autocmd')
  function! AU_ReCheck_FENC()
    if &fileencoding =~# 'iso-2022-jp' && search("[^\x01-\x7e]", 'n') == 0
      let &fileencoding=&encoding
    endif
  endfunction
  autocmd BufReadPost * call AU_ReCheck_FENC()
endif
" 改行コードの自動認識
set fileformats=unix,dos,mac
"" □とか○の文字があってもカーソル位置がずれないようにする
if exists('&ambiwidth')
  set ambiwidth=double
endif

" ファイルごとの文字コード設定
"autocmd FileType python :set fileencoding=utf-8

" 指定文字コードで強制的にファイルを開くコマンド
command! Cp932 edit ++enc=cp932
command! Eucjp edit ++enc=euc-jp
command! Iso2022jp edit ++enc=iso-2022-jp
command! Utf8 edit ++enc=utf-8
command! Jis Iso2022jp
command! Sjis Cp932

" }}}
" Colors {{{
" =====================================================================
" ハイライト on
syntax enable

" 折りたたみの色指定
" xxx term=standout ctermfg=4 ctermbg=7 guifg=DarkBlue guibg=LightGrey
hi Folded term=standout ctermfg=4 ctermbg=0 guifg=DarkBlue guibg=LightGrey
hi FoldColumn ctermfg=4 ctermbg=0 guifg=DarkBlue guibg=LightGrey

" Python と rst は80行目を強調表示
autocmd FileType python :set colorcolumn=80
autocmd FileType rst :set colorcolumn=80
hi ColorColumn ctermbg=0

" 補完候補の色指定
hi Pmenu        ctermfg=black ctermbg=gray
hi PmenuSel     ctermbg=darkblue
hi PmenuSbar    ctermbg=blue

" vimdiff の色指定
hi DiffAdd      ctermfg=black ctermbg=green
hi DiffChange   ctermfg=black ctermbg=yellow
hi DiffDelete   ctermfg=black ctermbg=darkblue
hi DiffText     ctermfg=black ctermbg=gray

" go~
au BufRead,BufNewFile *.go setf go

" }}}
" Edit {{{
" =====================================================================
" Tabキーを空白に変換
autocmd FileType python set expandtab
autocmd FileType html set expandtab
autocmd FileType htmldjango set expandtab
autocmd FileType javascript set expandtab
autocmd FileType go set noexpandtab
autocmd FileType haskell set expandtab
" 保存時に行末の空白を除去する
autocmd FileType python autocmd BufWritePre * :%s/\s\+$//ge
autocmd FileType html autocmd BufWritePre * :%s/\s\+$//ge
autocmd FileType htmldjango autocmd BufWritePre * :%s/\s\+$//ge
autocmd FileType javascript autocmd BufWritePre * :%s/\s\+$//ge
autocmd FileType go autocmd BufWritePre * :%s/\s\+$//ge
autocmd FileType haskell autocmd BufWritePre * :%s/\s\+$//ge
" 保存時にtabをスペースに変換する
autocmd FileType python autocmd BufWritePre * :%s/\t/  /ge
" flake8
autocmd FileType python autocmd BufWritePost <buffer> :!flake8 %
" pyflakes & pep8
"autocmd FileType python autocmd BufWritePost <buffer> :!pyflakes %
"autocmd FileType python autocmd BufWritePost <buffer> :!pep8 %
" ghcmod
autocmd FileType haskell autocmd! BufWritePost <buffer> GhcModCheckAsync
" 保存時にgofmtを実行する
autocmd FileType go autocmd BufWritePost <buffer> :!gofmt -w %
" JSON整形
map <Leader>j !python -m json.tool<CR>
" JSLint
"if executable('rhino')
"  let $JS_CMD='rhino'
"endif
"augroup MyGroup
"  autocmd! MyGroup
"  autocmd FileType javascript call s:javascript_filetype_settings()
"augroup END
"function! s:javascript_filetype_settings()
"  autocmd BufLeave     <buffer> call jslint#clear()
"  autocmd BufWritePost <buffer> call jslint#check()
"  autocmd CursorMoved  <buffer> call jslint#message()
"endfunction
"autocmd FileType javascript call s:javascript_filetype_settings()
" Go
set rtp+=$GOROOT/misc/vim
exe "set rtp+=".globpath($GOPATH, "src/github.com/nsf/gocode/vim")
set completeopt=menu,preview
" }}}

" Local settings {{{
" =====================================================================
let s:localrc = expand($HOME . '/.vimrc.local')
if filereadable(s:localrc)
  source ~/.vimrc.local
endif
" }}}
