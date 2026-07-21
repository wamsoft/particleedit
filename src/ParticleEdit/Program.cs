using System.IO.Compression;
using ParticleEdit;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
var app = builder.Build();

EffectBuilder.Initialize(Path.Combine(AppContext.BaseDirectory, "work"));
var projects = new ProjectStore(Path.Combine(app.Environment.ContentRootPath, "projects"));

app.UseDefaultFiles();
app.UseStaticFiles();

// 組み込みテクスチャ。
// エフェクトのバイナリには "Texture/xxx.png" という相対パスが埋まっており、
// effekseer.js の既定のリソースローダーがページ基準で取りに来るので、そのパスで配る。
app.MapGet("/Texture/{name}.png", (string name) =>
	ShapeTextures.Names.Contains(name)
		? Results.Bytes(ShapeTextures.GetPng(name), "image/png")
		: Results.NotFound());

app.MapGet("/api/shapes", () => ShapeTextures.Names);

app.MapPost("/api/debug", (EffectSpec spec) => Results.Text(EffectBuilder.Describe(spec)));

// プレビュー用: パラメータを受け取って .efk のバイト列を返す。
// ブラウザ側はこれを ArrayBuffer のまま effekseer.js の loadEffect に渡す。
app.MapPost("/api/effect.efk", (EffectSpec spec) =>
	Results.Bytes(EffectBuilder.Build(spec).Efk, "application/octet-stream"));

// ---------------------------------------------------------------- プロジェクト
// このアプリ固有のセーブ/ロード。編集を再開できる往復可能な形式。

app.MapGet("/api/projects", () => projects.List());

app.MapGet("/api/projects/{name}", (string name) =>
{
	if (!ProjectStore.IsValidName(name)) return Results.BadRequest("invalid name");
	var document = projects.Load(name);
	return document == null ? Results.NotFound() : Results.Ok(document);
});

app.MapPut("/api/projects/{name}", (string name, EffectSpec spec) =>
{
	if (!ProjectStore.IsValidName(name)) return Results.BadRequest("invalid name");
	projects.Save(name, spec);
	return Results.Ok();
});

app.MapDelete("/api/projects/{name}", (string name) =>
{
	if (!ProjectStore.IsValidName(name)) return Results.BadRequest("invalid name");
	return projects.Delete(name) ? Results.Ok() : Results.NotFound();
});

// ---------------------------------------------------------------- エクスポート
// 配布用の一方向の書き出し。どの形式もテクスチャを同梱した ZIP にする。
//
// efkzip は吉里吉里プラグイン (wamsoft_work/effekseer) が読む形式。
// プラグインはエントリ名を指定されなければ ZIP 内の最初の .efkefc (無ければ .efk) を
// エフェクト本体とし、資材はエフェクトからの相対パスで ZIP 内を引く。
// したがって「ルートに .efkefc を 1 つ + Texture/」で成立する。マニフェストは不要。

app.MapPost("/api/export", (EffectSpec spec, string format, string? name) =>
{
	var baseName = ProjectStore.IsValidName(name ?? "") ? name! : "effect";
	var result = EffectBuilder.Build(spec);
	var shape = ShapeTextures.Resolve(spec.Shape);

	var (effectEntry, effectBytes, fileName) = format switch
	{
		// ランタイム用の最小構成
		"efk" => ($"{baseName}.efk", result.Efk, $"{baseName}.zip"),
		// 公式 Effekseer エディタで開ける形
		"efkefc" => ($"{baseName}.efkefc", result.Efkefc, $"{baseName}.zip"),
		// 吉里吉里プラグイン用
		"efkzip" => ($"{baseName}.efkefc", result.Efkefc, $"{baseName}.efkzip"),
		_ => (null, null, null),
	};

	if (effectEntry == null) return Results.BadRequest("unknown format");

	using var ms = new MemoryStream();
	using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
	{
		AddEntry(zip, effectEntry, effectBytes!);
		AddEntry(zip, $"Texture/{shape}.png", ShapeTextures.GetPng(shape));
	}

	return Results.Bytes(ms.ToArray(), "application/zip", fileName);
});

Console.WriteLine();
Console.WriteLine("  ParticleEdit  ->  http://localhost:5188");
Console.WriteLine();

app.Run("http://localhost:5188");

static void AddEntry(ZipArchive zip, string path, byte[] bytes)
{
	using var s = zip.CreateEntry(path, CompressionLevel.Optimal).Open();
	s.Write(bytes, 0, bytes.Length);
}
