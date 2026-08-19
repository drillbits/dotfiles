# 新しいマシンへのセットアップ

このリポジトリを新しいマシンに適用する手順。
`make link` はシンボリックリンクを張るだけで、リンクされる設定ファイルは外部ツールと鍵の存在を前提にしている。
そのため、リンクの前後に以下の準備が要る。
手順は依存関係の順に並べてある。

## 1. パッケージのインストール

最初に、clone と以降の手順に必要なコマンドをパッケージマネージャで入れる。
CLI ツール（fzf、eza、bat、starship、jq、uv、terraform、ghq）は OS のパッケージではなく mise で一括管理するので、ここでは入れない（手順 7）。
mise と nodenv とフォントは入れ方に注意があるので別の節で扱う。

### Arch Linux

```sh
sudo pacman -S --needed git openssh gnupg zsh vim tmux make unzip curl \
  github-cli xclip wl-clipboard
```

クリップボード連携（`pbcopy`/`pbpaste` 互換関数）は、`.zshenv` が wl-copy の存在を先に調べ、なければ xclip に切り替える。
セッション種別ではなくコマンドの有無で決まるため、X11 専用のマシンでは wl-clipboard を入れず xclip だけにする。

### macOS

```sh
brew install git gnupg zsh vim tmux make unzip gh
```

`pbcopy`/`pbpaste` は OS 標準のものがそのまま使われる。

### Ubuntu / Debian

```sh
sudo apt install git openssh-client gnupg zsh vim tmux make unzip curl \
  xclip wl-clipboard
```

apt では次の点に注意する。

- **gh**：公式の apt リポジトリ（cli.github.com）から入れる
- **クリップボード**：X11 専用のマシンでは wl-clipboard を入れず xclip だけにする（前述のとおり wl-copy があると優先されるため）

## 2. SSH 鍵の作成と GitHub への登録

```sh
ssh-keygen -t ed25519 -C "$(whoami)@$(hostname)"
```

公開鍵 `~/.ssh/id_ed25519.pub` を GitHub の Settings > SSH and GPG keys に登録する。

この手順は、dotfiles に push しない場合でも省略できない。
`.gitconfig` に `https://github.com/` を `git@github.com:` へ書き換える設定があり、`make link` 後は GitHub との通信が clone や fetch を含めてすべて SSH になるためである。

鍵のファイル名は `id_ed25519` のままにしておく。
bash 側の設定が `ssh-add ~/.ssh/id_ed25519` を前提にしている。

登録できたか確認する。

```sh
ssh -T git@github.com
```

## 3. GPG 署名サブキーの発行

鍵の運用モデルは「プライマリキーは保管場所のみ、各マシンは自分専用の署名サブキー」とする。

- **プライマリキー**（`45D211D4E836F921F86C0ECA6F99A1C407AD0472`、ed25519、証明専用）：安全な保管場所にだけ置き、日常のマシンには秘密鍵を残さない。保管ファイルにはプライマリキーの秘密鍵だけを入れ、サブキーの秘密鍵を含めない。失効証明書も同じ場所に保管する
- **署名サブキー**：マシンごとにプライマリキーから発行する。コミット署名はこれで行う

`.gitconfig` の `signingkey` はプライマリキーのフィンガープリント指定なので、gpg がそのマシンにある署名サブキーを自動選択する。
マシンごとに設定を変える必要はない。
サブキーが 1 つもないと、リンク後はすべての `git commit` が失敗する。

保管してあるプライマリキーを取り込み、信頼度を設定する。
この時点では dotfiles が未リンクで `GPG_TTY` が設定されていないため、先に設定しておく。
設定がないと、サブキー発行や export での passphrase 入力（pinentry）が失敗することがある。

```sh
export GPG_TTY=$(tty)
gpg --import /path/to/primary-key.asc
gpg --edit-key 45D211D4E836F921F86C0ECA6F99A1C407AD0472
# gpg> trust → 5 (ultimate) → save
```

このマシン用の署名サブキーを発行する（有効期限 2 年の例）。

```sh
gpg --quick-add-key 45D211D4E836F921F86C0ECA6F99A1C407AD0472 ed25519 sign 2y
```

プライマリキーの秘密鍵をこのマシンから外し、サブキーの秘密鍵だけを残す。

```sh
gpg --export-secret-subkeys --armor 45D211D4E836F921F86C0ECA6F99A1C407AD0472 > /tmp/subkeys.asc
gpg --show-keys /tmp/subkeys.asc
# ssb が表示されることを確認してから先へ進む。
# export は passphrase 入力（pinentry）に失敗すると空ファイルを作るだけなので、
# 確認せずに delete すると、このマシンのサブキーの秘密鍵を失う。
gpg --delete-secret-keys 45D211D4E836F921F86C0ECA6F99A1C407AD0472
gpg --import /tmp/subkeys.asc
shred -u /tmp/subkeys.asc
gpg -K
# プライマリキーの行が `sec#` と表示されれば、プライマリキーの秘密鍵が無い状態になっている
```

他のマシンのサブキーの公開部分を GitHub から取り込む。
このマシンの keyring には他のマシンのサブキーが存在しないため、取り込まずに export した公開鍵で再登録すると、他のマシンの署名が Unverified になる。

```sh
curl -s https://github.com/drillbits.gpg | gpg --import
```

全サブキーを含む公開鍵を GitHub に登録し直す。

```sh
gpg --armor --export 45D211D4E836F921F86C0ECA6F99A1C407AD0472
```

出力を GitHub の Settings > SSH and GPG keys に登録する。
GitHub はアップロード済みの公開鍵に含まれるサブキーの署名だけを Verified にするため、サブキーを発行するたびに既存のエントリを削除して登録し直す。

マシンを手放すときは、保管してあるプライマリキーでそのマシンのサブキーを失効させ（`gpg --edit-key` → `key N` → `revkey`）、公開鍵を再登録する。

## 4. リポジトリの clone

ghq の root を `~/go/src` に設定してあるので、その配置規約に合わせて clone する。

```sh
mkdir -p ~/go/src/github.com/drillbits
cd ~/go/src/github.com/drillbits
git clone git@github.com:drillbits/dotfiles.git
cd dotfiles
```

## 5. make link

```sh
make link
```

`.??*` にマッチするファイルを `$HOME` へシンボリックリンクし、`.config` 配下の zsh、bash、wezterm、git、starship の設定と `.claude` を個別にリンクする。
`~/.terraform.d/plugin-cache` などの必要なディレクトリもここで作られる。

`make install` は `link` に加えて `init` を実行するが、`init` は現状 TODO の echo だけなので、実質 `make link` と同じ。

なお、Makefile のワイルドカードが `.config/zsh/.` と `..` にもマッチするため、`cannot overwrite directory` というエラーが 2 行表示される。
リンク自体は成功しており、無害。

## 6. デフォルトシェルの変更

```sh
chsh -s "$(command -v zsh)"
```

zsh のパスが `/etc/shells` に載っていることを確認しておく。
反映には再ログインが必要。

この時点では手順 7 と 8 が未完了のため、zsh の起動時に mise と nodenv のエラーが表示される。
無害であり、7 と 8 を終えれば消える。

## 7. mise のインストールと CLI ツールの一括導入

`.zshrc` が `~/.local/bin/mise` をパス直指定で実行するため、公式インストーラで入れる。
パッケージマネージャ経由だと `/usr/bin/mise` に入り、この参照と一致しない。

```sh
curl https://mise.run | sh
```

グローバルに使う CLI ツールは `.config/mise/config.toml` で管理していて、`make link` で `~/.config/mise/config.toml` にリンク済み。
リンクの実体がリポジトリ内にあるため、初回は trust してからインストールする。

```sh
~/.local/bin/mise trust ~/go/src/github.com/drillbits/dotfiles/.config/mise/config.toml
~/.local/bin/mise install
```

共有ツールを増やすときは `mise use -g <tool>@latest` を実行する。
シンボリックリンク越しにリポジトリの config.toml が書き換わるので、それを commit すれば全マシンに共有される。
Terraform の plugin cache ディレクトリ（`~/.terraform.d/plugin-cache`）は `make link` が作成済み。

## 8. nodenv のインストール（Node を使うマシンのみ）

`.zshrc` と bash の `profile` は nodenv があるときだけ `eval "$(nodenv init -)"` を実行するので、Node が不要なマシン（サーバーなど）では何もしなくてよい。
使うマシンでは、Arch は AUR の `nodenv`、macOS は `brew install nodenv`、それ以外は公式 README の git clone 手順で入れる。

Node のバージョン管理を mise に寄せるなら、nodenv をやめて `mise use -g node@<version>` に移行する（その場合はこの節ごと不要になる）。

## 9. フォント

WezTerm の設定は CommitMono を第一候補にし、フォールバックとして Intel One Mono、Hack Nerd Font Mono、Noto Sans Mono CJK JP を指定している。
最低限、CommitMono と Hack Nerd Font と日本語表示用の Noto Sans Mono CJK JP を入れる。
eza の `--icons` 表示も Nerd Font のグリフに依存する。

- **Arch Linux**：`sudo pacman -S ttf-hack-nerd noto-fonts-cjk`。CommitMono は AUR か[公式サイト](https://commitmono.com/)から
- **macOS**：`brew install --cask font-commit-mono font-hack-nerd-font`
- **その他**：公式サイトから取得して `~/.local/share/fonts` に置き、`fc-cache -f` を実行する

## 10. tmux プラグインマネージャ（tpm）

tpm は手動で clone する必要がある。
tmux 設定は XDG レイアウト（`~/.config/tmux/tmux.conf`）なので、tpm も `~/.config/tmux/plugins/` に置く。

```sh
git clone https://github.com/tmux-plugins/tpm ~/.config/tmux/plugins/tpm
```

tmux を起動し、`Ctrl+t` `I` でプラグイン（tmux-resurrect、tmux-continuum）をインストールする。
prefix は `Ctrl+t` に変更してある。

旧レイアウト（`~/.tmux.conf` + `~/.tmux/plugins/`）のマシンを移行する場合は、clone の代わりに以下を実行する。
古い `~/.tmux.conf` を残すと、tmux のバージョンによって新設定が読まれなかったり（3.4 以前は最初に見つけた 1 ファイルのみ）、二重に読まれたり（3.7 以降は両方読む）するため、必ず消す。

```sh
rm -f ~/.tmux.conf
mkdir -p ~/.config/tmux
mv ~/.tmux/plugins ~/.config/tmux/plugins
```

resurrect の保存データ（`~/.tmux/resurrect`）はそのままでよい。新しい場所のプラグインもそこを優先して読むため、セッション履歴は失われない。

## 11. Vim 設定の配置

`.zshrc` は `VIMINIT` で `~/.config/vim/vimrc` を読み込むよう設定しているが、このファイルはリポジトリで管理されていない。
旧マシンからコピーして置く。
置かないと、zsh から vim を起動するたびに読み込みエラーが出る。

リポジトリにある `.vimrc` と `.vimrc.*`（dein 使用）は `$HOME` にリンクされるものの、`VIMINIT` が設定された環境では読まれない。
`~/.config/vim/vimrc` をリポジトリに取り込んで管理するのが今後の課題。

## 12. 環境に応じて入れるもの

以下は設定側にガードがあるか、PATH の追加だけなので、使うマシンにだけ入れればよい。

- **Go**：zsh 側の PATH 追加は `~/go/bin`（GOPATH の bin）だけで、`/usr/local/go/bin` を足すのは bash 側の設定のみ。zsh で使うならパッケージマネージャの go を入れるか、公式 tarball の場合は `.zshrc.local` で PATH を足す
- **Google Cloud SDK**：`~/.local/opt/google-cloud-sdk` に展開すると `.zshrc` が PATH と補完を読み込む。なければ何も起きない
- **GitHub CLI（gh）**：`.gitconfig` の credential helper が `/usr/bin/gh` を参照する。GitHub への HTTPS 認証を使う場面があるなら `gh auth login` まで済ませておく
- **Docker、Pulumi**：環境変数と PATH の追加だけ

## 13. マシンローカルの上書き

各設定は、リポジトリで追跡しないローカルファイルを末尾で読みに行く。
マシン固有の設定はこちらへ書く。

- **~/.config/zsh/.zshrc.local**：zsh の追加設定。マシン固有の PATH 追加や環境変数はここに書く
- **~/.config/mise/conf.d/*.toml**：マシン固有の mise ツール。共有の config.toml に加えて読み込まれる
- **~/.vimrc.local**：vim（`.vimrc` 経由で起動する場合）
- **~/.bash_profile.local と ~/.bashrc.local**：bash

`.gitconfig` はリンクで全マシン共通のため、マシンごとにコミットのメールアドレスや署名鍵を変える仕組みは今のところない。
必要になったら `[include]` でローカルファイルを読む対応を入れる。

## 14. 動作確認

- 新しいターミナルを開き、エラーなしで zsh が起動して starship のプロンプトが出る
- `mise ls` で config.toml のツールがすべてインストール済みになっている
- `ls` が eza、`cat` が bat で表示され、アイコンが化けない
- `Ctrl+]` で ghq のリポジトリ切り替えが開く（fzf と ghq を使う）
- `Ctrl+R` で fzf の履歴検索が開く
- `git commit --allow-empty -m "chore: test signing"` が通り、`git log --show-signature -1` で署名を確認できる
- tmux で `Ctrl+t` `I` によりプラグインが入る
- `vim` がエラーなしで起動する
