using System.IO.Compression;
using System.Text.Json;
using ParticleEdit;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
var app = builder.Build();

var workDir = Path.Combine(AppContext.BaseDirectory, "work");
EffectBuilder.Initialize(workDir);

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
{
	var result = EffectBuilder.Build(spec);
	return Results.Bytes(result.Efk, "application/octet-stream");
});

// 書き出し: .efk / .efkefc 単体、または テクスチャ込みの zip。
app.MapPost("/api/export", (EffectSpec spec, string format) =>
{
	var result = EffectBuilder.Build(spec);

	switch (format)
	{
		case "efk":
			return Results.Bytes(result.Efk, "application/octet-stream", "effect.efk");
		case "efkefc":
			return Results.Bytes(result.Efkefc, "application/octet-stream", "effect.efkefc");
		case "zip":
			{
				using var ms = new MemoryStream();
				using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
				{
					Add(zip, "effect.efk", result.Efk);
					Add(zip, "effect.efkefc", result.Efkefc);
					Add(zip, result.TextureRelativePath, ShapeTextures.GetPng(spec.Shape));
					Add(zip, "params.json", JsonSerializer.SerializeToUtf8Bytes(spec, JsonOpts));
				}
				return Results.Bytes(ms.ToArray(), "application/zip", "effect.zip");
			}
		default:
			return Results.BadRequest("unknown format");
	}
});

Console.WriteLine();
Console.WriteLine("  ParticleEdit  ->  http://localhost:5188");
Console.WriteLine();

app.Run("http://localhost:5188");

static void Add(ZipArchive zip, string path, byte[] bytes)
{
	var entry = zip.CreateEntry(path, CompressionLevel.Optimal);
	using var s = entry.Open();
	s.Write(bytes, 0, bytes.Length);
}

public partial class Program
{
	internal static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };
}
