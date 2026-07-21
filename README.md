# ParticleEdit

Effekseer をバックエンドにした、簡素なパーティクルエディタ。
スライダーをいじると即座にプレビューへ反映され、作ったものは Effekseer の
データファイル (`.efk` / `.efkefc`) として書き出せる。書き出したファイルは
Unity / Unreal Engine / Godot / Cocos2d-x / DXLib / WebGL など、Effekseer の
各種ランタイムでそのまま再生できる。

参照した UI のスコープは ICS の [Particle Develop](https://ics-creative.github.io/project-particle-develop/)。

## 使い方

```
dotnet run --project src/ParticleEdit
```

ブラウザで http://localhost:5188 を開く。必要なのは .NET SDK だけで、
Node.js もバンドラも要らない。

## 構成

```
src/ParticleEdit/          エディタ本体 (ASP.NET Core minimal API)
  EffectSpec.cs            UI が扱うパラメータ定義
  EffectBuilder.cs         パラメータ -> Effekseer ノードツリー -> .efk / .efkefc
  ShapeTextures.cs         組み込みのパーティクル画像を実行時に生成
  Png.cs                   依存なしの最小 PNG エンコーダ
  wwwroot/                 UI (素の HTML/CSS/JS) と effekseer.js ランタイム
third_party/EffekseerCore/ Effekseer 公式エディタのコア (MIT, 無改変)
```

なぜこの形か:

- **バイナリフォーマットを自前実装していない。** `.efk` / `.efkefc` の書き出しは
  Effekseer 公式エディタのコア (`EffekseerCore`, 純マネージド C#) をそのまま呼んでいる。
  このプロジェクトが書いているのは「UI のパラメータ」→「Effekseer のデータモデル」の
  マッピングだけなので、フォーマットの追随コストがない。
- **プレビューは公式の WebGL ランタイム** (`effekseer.js` + `effekseer.wasm`) に任せている。
  サーバが返した `.efk` のバイト列を `loadEffect(ArrayBuffer)` にそのまま渡すため、
  ファイルの書き出しを挟まずに数十 ms で差し替わる。
- **触るツールは .NET SDK ひとつ。** 配布時は `dotnet publish -r <rid> --self-contained`
  で OS ごとに単一実行ファイルにできる。

## パラメータの追加のしかた

1. `src/ParticleEdit/EffectSpec.cs` にプロパティを足す
2. `src/ParticleEdit/EffectBuilder.cs` で Effekseer 側のどの値に対応させるか書く
3. `src/ParticleEdit/wwwroot/app.js` の `GROUPS` に 1 行足す (UI は自動生成)

## テンプレート

ヘッダの「テンプレート」から、サムネイル付きのグリッドで選べる。

- **組み込み** 12 種 (炎 / 噴水 / 爆発 / 雪 / 煙 / きらめき / 星屑 / 泡 / リング波 / 紙吹雪 / 光の玉 / 魔法の粉)。
  パラメータの塊でしかないのでファイルではなくコード (`BuiltinTemplates.cs`) で持っている
- **自分の** … 「現在の設定を追加」で `src/ParticleEdit/templates/<名前>.zip` に保存される。
  中身はプロジェクトと同じ形式。同じ名前の組み込みがあればユーザー側が優先される

サムネイルはプレビューとは**別の WebGL コンテキスト**でオフスクリーンに焼いているので、
一覧を開いても編集中のプレビューは止まらない。一度焼いたものはメモリにキャッシュされる。

## セーブ / ロード

ヘッダの「プロジェクト名 + 保存」で、編集状態を名前を付けて保存できる。
保存先はサーバ側の `src/ParticleEdit/projects/<名前>.zip`。隣のプルダウンから読み込む。

中身:

```
project.json    フォーマット版 + パラメータ + (将来) 形状定義
Texture/*.png   そのプロジェクトが使っているテクスチャ
```

**エクスポートと別建てにしている理由**: パラメータから Effekseer のデータモデルへの
変換は一方向で、逆算できない。たとえば「方向 90 度 ± 40 度」は速度の矩形範囲
`X: -1.28..1.28 / Y: 2.11..3.75` に潰れてしまい、そこから元の角度と広がりは復元できない。
つまり `.efk` / `.efkefc` を読み戻してもスライダーの位置は分からないので、
編集を再開するための状態はこの形式でしか持てない。

## エクスポート

配布用の一方向の書き出し。どの形式もテクスチャを同梱した ZIP になる。

| 形式 | 出力 | 中身 | 用途 |
|---|---|---|---|
| `efkzip` | `<名前>.efkzip` | `<名前>.efkefc` + `Texture/` | 吉里吉里プラグイン用 |
| `efk` | `<名前>.zip` | `<名前>.efk` + `Texture/` | ランタイムに直接読ませる最小構成 |
| `efkefc` | `<名前>.zip` | `<名前>.efkefc` + `Texture/` | 公式 Effekseer エディタで開いて作り込む |

`.efk` は再生専用バイナリ (`"SKFE"` + バージョン + 本体)、`.efkefc` はその `.efk` を
`BIN_` チャンクに丸ごと含んだうえで編集用の XML (`EDIT` チャンク) も持つコンテナ
(`"EFKE"`)。Effekseer のランタイムはどちらでもロードできる。

### efkzip について

吉里吉里プラグイン (`wamsoft_work/effekseer`) が読む形式。プラグインの実装
(`src/Effect.cpp` / `src/EffectZip.cpp`) に合わせてあり、要件は次の通り:

- 素の ZIP。マニフェストは不要
- エントリ名を指定しなければ、ZIP 内の**最初の `.efkefc`** (無ければ `.efk`) が本体になる
- 資材は `<zipのストレージ名>/<エフェクトからの相対パス>` として要求され、
  その prefix を除いたパスで ZIP 内を引く (見つからなければファイル名だけでフォールバック)

したがって「ルートに `.efkefc` を 1 つ + `Texture/`」で成立する。
エフェクトに埋まっているテクスチャパスと ZIP のエントリ名が一致していることが要点。

## 開発用

- `POST /api/debug` … パラメータを渡すと、組み上がった Effekseer 側の値をテキストで返す
- `http://localhost:5188/#templates` … テンプレート一覧を開いた状態で起動する
- `http://localhost:5188/?selftest=1` … 自己診断。パラメータを変えながら 5 サイクル +
  連打 1 サイクル回して各回で実際に描画されたピクセルを `readPixels` で数え、さらに
  プロジェクトの保存 → 読み込みでパラメータが往復するかを確認して、結果を
  `<pre id="selftest">` に JSON で書き出す。`"ok": true` なら全部通っている。
  ヘッドレスブラウザから機械的に確認できる:

  ```
  chrome --headless=new --disable-gpu --use-gl=angle --use-angle=swiftshader \
         --enable-unsafe-swiftshader --virtual-time-budget=40000 \
         --dump-dom "http://localhost:5188/?selftest=1"
  ```

## 現状わかっている制限

- **初速の「方向の広がり」は扇形を外接矩形で近似している。** Effekseer の PVA 速度は
  軸ごとの min/max しか持たないため。広がりが狭いうちはほぼ一致するが、
  360 度に近づくと本来の放射状ではなく四角い分布になる。
  (Effekseer 側には発生位置 Circle + 「回転を適用」で放射を作るやり方があるので、そちらへ寄せる余地あり)
- 発生基準位置をキャンバス上でドラッグして動かす UI はまだない (常に画面中央)
- 形状は組み込みの 5 種のみ。形状エディタとユーザー定義形状はこれから
  (プロジェクト形式には `shapes` の入れ物だけ用意してある)

## ライセンス

`third_party/EffekseerCore` と `src/ParticleEdit/wwwroot/vendor` は
Effekseer Project の成果物 (MIT)。詳細は各ディレクトリの LICENSE / VENDOR.md を参照。
