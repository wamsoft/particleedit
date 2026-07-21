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

## 書き出し

| ボタン | 中身 |
|---|---|
| `.efk` | ランタイム用バイナリ単体 |
| `.efkefc` | 公式 Effekseer エディタで開けるプロジェクトファイル (中に `.efk` を含む) |
| `zip で書き出し` | 上記 2 つ + 使用テクスチャ + パラメータ JSON |

テクスチャは `Texture/<形状名>.png` という相対パスで参照される。ランタイムに読ませるときは
`.efk` と同じ階層に `Texture/` を置くこと。

## 開発用

- `POST /api/debug` … パラメータを渡すと、組み上がった Effekseer 側の値をテキストで返す
- `http://localhost:5188/?selftest=1` … プレビューの自己診断。パラメータを変えながら
  5 サイクル + 連打 1 サイクル回し、各回で実際に描画されたピクセルを `readPixels` で数えて
  `<pre id="selftest">` に JSON で書き出す。`"ok": true` なら全サイクル描画されている。
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
- プリセットがまだない

## ライセンス

`third_party/EffekseerCore` と `src/ParticleEdit/wwwroot/vendor` は
Effekseer Project の成果物 (MIT)。詳細は各ディレクトリの LICENSE / VENDOR.md を参照。
