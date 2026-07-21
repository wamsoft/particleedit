# Vendored: EffekseerCore

Effekseer 公式エディタのコア (GUI 非依存の純マネージド C# ライブラリ) をそのまま取り込んだもの。
このライブラリがエフェクトのデータモデルと `.efk` / `.efkefc` の書き出しを担当する。

- Upstream: https://github.com/effekseer/Effekseer  (`Dev/Editor/EffekseerCore`)
- Commit:   b6035eb24fa76e38d1c5fd22038b91808b105b7b (2026-07-20)
- Version:  Core.Version = 1.80.6
- License:  MIT (LICENSE 参照, Copyright (c) 2011 Effekseer Project)

## 変更点
`EffekseerCore.csproj` のみ以下を変更。C# ソースは upstream のまま無改変。

- `<Platforms>x64</Platforms>` を削除 (AnyCPU 化。Mac arm64 / Linux でもビルドするため)
- `<OutputPath>../../release</OutputPath>` と `<AppendTargetFrameworkToOutputPath>` を削除
  (リポジトリの外へ成果物を吐いてしまうため。標準の bin/ に戻した)
- upstream 由来の警告を `<NoWarn>` で抑制 (こちらのビルドログを汚さないため)

更新する場合は上記パスからそっくり入れ替えた上で、この 3 点を再適用し、commit を更新すること。
