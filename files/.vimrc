" NeoBundle で管理してるプラグインの読み込み
source ~/.vimrc.bundle

" 基本設定の読み込み
source ~/.vimrc.basic

" StatusLine 設定の読み込み
source ~/.vimrc.statusline

" インデント設定の読み込み
source ~/.vimrc.indent

" 表示関連設定の読み込み
source ~/.vimrc.apperance

"" 補完関連設定の読み込み
"source ~/.vimrc.completion

"" Tags 関連設定の読み込み
"source ~/.vimrc.tags

" 検索関連設定の読み込み
source ~/.vimrc.search

" 移動関連設定の読み込み
source ~/.vimrc.moving

" Color 関連設定の読み込み
source ~/.vimrc.colors

" 編集関連設定の読み込み
source ~/.vimrc.editing

" エンコーディング関連設定の読み込み
source ~/.vimrc.encoding

"" その他設定の読み込み
source ~/.vimrc.misc

" プラグインごとの設定の読み込み
source ~/.vimrc.plugin_settings

"" Vim で git のログをきれいに表示する - derisの日記
" http://deris.hatenablog.jp/entry/2013/05/10/003430
" source ~/.vimrc.gitlogviewer

" Local settings
let s:localrc = expand($HOME . '/.vimrc.local')
if filereadable(s:localrc)
  source ~/.vimrc.local
endif
