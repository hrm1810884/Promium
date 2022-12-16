# Tohoken

## やったことをアピールする欄

何かやったらここに書いていきましょう．コードを書いた場合は `main` にマージしたコミットの URL とかを貼り付けておくと便利な気がします．

<!-- 
### の前後には１個ずつ空行を置いてください（warning が大量に出てくるので）
-->

### hrm1810884

- 現時点ではwebpackを利用してブラウザ上で`ps auxww`を実行できるように試行錯誤中  
ローカル上ではすでにjavascriptからLinuxコマンドを実行できるようにはなりました.
- git galleryから今回の作品に使えそうなプログラムとしてsun burstを選び, d3.jsがv4で書かれていたので, プリントデバッグを行いながらエラー箇所をv7対応となるように書き換えを行いました.  
[index.heml](https://gist.github.com/hrm1810884/f1683981dac1dc126e251a1bebc4de94/revisions)  
[sequences.js_1](https://gist.github.com/hrm1810884/6977ad57e0cfac5e37a3c7d56dc3b19a/revisions)
[sequences.js_2](https://github.com/takepedia/sunburst/commit/82bd4dea60bc3842d6bb529f2ade5a4ce9901d9e)
- これまでwebからとってきたテストデータだったものをプロセスの情報に対応できるようにpsコマンドの結果から親子関係を導き出し,tsvをjsonに変換し,表示できるようにした.
[プロセスデータに対応](https://github.com/InfovisHandsOn/B-Tohoken/commit/bde525023d9fe6b831ad05e9a74dcbfa64bbf599)
- pythonでサーバを立ててブラウザからの要求に応じて,ファイルを送信する[プログラム](https://github.com/InfovisHandsOn/B-Tohoken/commit/fe4e5848eb79a6d75b04cec4d09bf2a8fc657e23)を作成した.データを要求された際にはサーバサイドで`ps auxf`を実行し,データを取得した後に表示する.

### LEEANHUA

- gitの扱いについてtakepにご教授頂いた。branchの仕組みについてある程度理解し、作業用branch(create_test_data)を作成した。
- データ作成用に1個の親プロセスから大量の子プロセスを生成するプログラムを作成([manychild.py](https://github.com/InfovisHandsOn/B-Tohoken/commit/8342cc4b3509e59fde55f0bf4dfe7a6d44a94a90))
- sunburstのLegendボタンについて
  - mouseoverするとデータをハイライト表示する機能を追加([コミット](https://github.com/InfovisHandsOn/B-Tohoken/commit/7d0b474728818a57a5879f0148641cdea893e181))
  - プロセスの状態に対応させた([コミット](https://github.com/InfovisHandsOn/B-Tohoken/commit/aede949629d1c0240d2291b297503cccf15f9682))
  - 各項目をわかりやすく変更([コミット](https://github.com/InfovisHandsOn/B-Tohoken/commit/ccc71b45be58f5a79224d715cb029e0d616244b7))
  - ([機能を拡張した](https://github.com/InfovisHandsOn/B-Tohoken/commit/aa6bc86a89e54bcb96a9eeb9b79c64ad5d388cb7))

  が、sunburstを使わないことになった
- タブでCPU使用率のグラフとメモリ使用率のグラフを切り替えられるようにした

### takep

- Git について LEEANHUA にお教えした．
- sunburst について
  - [バグを修正した](https://github.com/InfovisHandsOn/B-Tohoken/commit/cbe4bc66faba535a96f358d9c968e739967aa559)．
  - 別レポジトリで作業していた sunburst についてのファイルを history を保ったままこのレポジトリに移動した．
  - ツリーのモックを作成した．
- issue を用いた開発を主導している．
- ツリーについて
  - [ツリーを実装した](https://github.com/InfovisHandsOn/B-Tohoken/commit/08c094f9f11df1b053414c8a9cdaf4cfe52014bd)
  - [ツリーをまともにした](https://github.com/InfovisHandsOn/B-Tohoken/pull/37)
- チャートを変えるのを手伝った（[プルリク](https://github.com/InfovisHandsOn/B-Tohoken/pull/44)）
- デザインを変更している（[プルリク](https://github.com/InfovisHandsOn/B-Tohoken/pull/48)）
- デザインを変更している（[#52](https://github.com/InfovisHandsOn/B-Tohoken/pull/52)，[#54](https://github.com/InfovisHandsOn/B-Tohoken/pull/54)，[#55](https://github.com/InfovisHandsOn/B-Tohoken/pull/55)，[#64](https://github.com/InfovisHandsOn/B-Tohoken/pull/64)
- 最近はプルリクが来たら見てリファクタしてからマージしている

## 開発にあたって

- コミットには可能な限りコミットメッセージを残しましょう
  - 後で誰が何をやったのか確認する時に便利です
  - `add` / `fix` / `doc` などのプレフィックスを付けましょう
    - 例：`add: 関数 hogeFunc を実装`
- 頼むからフォーマットしてからコミットしてください
- 機能開発を行う際は必ず適当な名前のブランチを切って，そこで作業を行ってマージするようにしてください
  - **sunburst についての作業を行うブランチは必ず `sunburst/` というプレフィックスを付けてください**
  - ブランチを切る根本は `main` などの適切なブランチにしてください
- 必要のないゴミをアップロードしないように気をつけてください
  - .DS_Store
  - C 言語の実行ファイルなど，実行に必要のないファイル
  - テストファイル
