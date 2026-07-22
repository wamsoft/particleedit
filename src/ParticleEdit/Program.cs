using System.IO.Compression;
using ParticleEdit;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
var app = builder.Build();

// 書き込むものはすべてコンテンツルートの下に置く。dotnet run なら
// src/ParticleEdit/、publish したものなら実行ファイルの隣になる。
var dataRoot = app.Environment.ContentRootPath;
EffectBuilder.Initialize(Path.Combine(dataRoot, "work"));
ImageStore.Initialize(Path.Combine(dataRoot, "images"));
var projects = new ProjectStore(Path.Combine(dataRoot, "projects"));
var userTemplates = new ProjectStore(Path.Combine(dataRoot, "templates"));

app.UseDefaultFiles();
app.UseStaticFiles();

// エフェクトのバイナリには "Texture/xxx.png" という相対パスが埋まっており、
// effekseer.js の既定のリソースローダーがページ基準で取りに来るので、そのパスで配る。
// ファイル名は形の内容から決まるので、形を変えれば URL も変わる (キャッシュ対策)。
app.MapGet("/Texture/{name}.png", (string name) =>
{
	var bytes = EffectBuilder.ReadTexture(name + ".png");
	return bytes == null ? Results.NotFound() : Results.Bytes(bytes, "image/png");
});

// 形のプリセット一覧 (UI のボタン用)
app.MapGet("/api/shapes", () =>
	ShapeRenderer.Presets.Select(p => new { name = p.Name, shape = p.Shape }));

// 形だけのプレビュー画像。形状エディタの見本表示に使う。
app.MapPost("/api/shape.png", (ShapeSpec shape) =>
	Results.Bytes(ShapeRenderer.GetPng(shape), "image/png"));

// ---------------------------------------------------------------- 画像の取り込み
// ブラウザ側で 2 の冪サイズへ整えた PNG が送られてくる前提。
// ID は内容のハッシュなので、同じ画像を何度入れても増えない。

app.MapPost("/api/images", async (HttpRequest request) =>
{
	using var ms = new MemoryStream();
	await request.Body.CopyToAsync(ms);
	var bytes = ms.ToArray();

	if (bytes.Length < 8 || bytes[0] != 0x89 || bytes[1] != 'P' || bytes[2] != 'N' || bytes[3] != 'G')
		return Results.BadRequest("PNG ではありません");

	var id = ImageStore.Add(bytes);
	return Results.Ok(new { id });
});

app.MapGet("/api/images/{id}.png", (string id) =>
{
	var bytes = ShapeRenderer.GetImage(id);
	return bytes == null ? Results.NotFound() : Results.Bytes(bytes, "image/png");
});

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

// ---------------------------------------------------------------- テンプレート
// 組み込み (コード定義) とユーザー追加 (templates/ の zip) を 1 つのリストで返す。
// 同じ名前があればユーザー側を優先する。

app.MapGet("/api/templates", () =>
	BuiltinTemplates.All
		.Select(t => new { name = t.Name, builtin = true, modified = (DateTime?)null })
		.Where(t => userTemplates.List().All(u => u.Name != t.name))
		.Concat(userTemplates.List()
			.Select(t => new { name = t.Name, builtin = false, modified = (DateTime?)t.Modified }))
		.ToList());

app.MapGet("/api/templates/{name}", (string name) =>
{
	if (!ProjectStore.IsValidName(name)) return Results.BadRequest("invalid name");

	// ユーザーが同名で上書きしていればそちらを使う
	var user = userTemplates.Load(name);
	if (user != null) return Results.Ok(user.Spec);

	var builtin = BuiltinTemplates.Find(name);
	return builtin == null ? Results.NotFound() : Results.Ok(builtin);
});

app.MapPut("/api/templates/{name}", (string name, EffectSpec spec) =>
{
	if (!ProjectStore.IsValidName(name)) return Results.BadRequest("invalid name");
	userTemplates.Save(name, spec);
	return Results.Ok();
});

app.MapDelete("/api/templates/{name}", (string name) =>
{
	if (!ProjectStore.IsValidName(name)) return Results.BadRequest("invalid name");
	// 組み込みは消せない
	return userTemplates.Delete(name) ? Results.Ok() : Results.NotFound();
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
		// エフェクト本体を先に入れる (プラグインは最初の .efkefc を本体とみなす)
		AddEntry(zip, effectEntry, effectBytes!);
		AddEntry(zip, result.TextureRelativePath, ShapeRenderer.GetPng(spec.Shape));

		// 動的パラメータの名前と、軌道の一覧。組み込み先が要るときだけ入る。
		if (!ExportManifest.IsEmpty(spec))
		{
			AddEntry(zip, ExportManifest.FileName, ExportManifest.Build(spec, effectEntry));
			foreach (var motion in spec.Motions.Where(m => m.IsUsable))
			{
				AddEntry(zip, ExportManifest.MotionPath(motion), ExportManifest.BuildMotion(motion));
			}
		}
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
