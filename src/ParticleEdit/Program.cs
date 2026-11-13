using System.IO.Compression;
using System.Text;
using System.Text.Json;
using ParticleEdit;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
// アニメパターンの書き出しは生のビットマップを丸ごと送りつけるので、
// 既定の 30MB では足りない。相手は同じ機械の中のブラウザなので上限は外す。
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = null);
var app = builder.Build();

// 置き場は particleedit.json で差し替えられる。基準はコンテンツルートで、
// dotnet run なら src/ParticleEdit/、publish したものなら実行ファイルの隣。
var config = EditorConfig.Load(app.Environment.ContentRootPath, out var configNote);
EffectBuilder.Initialize(config.WorkPath);
ImageStore.Initialize(config.ImagesPath);
var projects = new ProjectStore(config.ProjectsPath);
var userTemplates = new ProjectStore(config.TemplatesPath);
var scenes = new SceneStore(Path.Combine(config.ProjectsPath, "scenes"));

// 使われなくなったら自分を畳む番人 (裏に残り続けないように)。
// 心拍が途絶える / 標準入力が切れる、のどちらでも畳む。詳しくは Watchdog.cs。
var watchdog = new Watchdog(app.Lifetime);

app.UseDefaultFiles();
app.UseStaticFiles();

// ブラウザが生きているあいだ定期的に叩いてくる。閉じれば途絶える。
app.MapPost("/api/heartbeat", () => { watchdog.Beat(); return Results.Ok(); });
// タブを閉じるときに sendBeacon で送られてくる合図。早めに畳むためのもの。
app.MapPost("/api/bye", () => { watchdog.Bye(); return Results.Ok(); });

// エフェクトのバイナリには "Texture/xxx.png" という相対パスが埋まっており、
// effekseer.js の既定のリソースローダーがページ基準で取りに来るので、そのパスで配る。
// ファイル名は形の内容から決まるので、形を変えれば URL も変わる (キャッシュ対策)。
app.MapGet("/Texture/{name}.png", (string name) =>
{
	var bytes = EffectBuilder.ReadTexture(name + ".png");
	return bytes == null ? Results.NotFound() : Results.Bytes(bytes, "image/png");
});

// UI が知っておきたい設定 (書き出し先が決まっているか / ゲームへ送れるか)
app.MapGet("/api/config", () => new
{
	exportDirectory = config.ExportPath,
	projectDirectory = config.ProjectsPath,
	game = config.GameUrl,
	gameDirectory = config.GameDirName,
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
//
// cycle=one を付けると、ループの 1 周期ぶんだけ発生するものを返す。
// アニメパターンを焼くときに使う (下の /api/pattern の説明を参照)。
app.MapPost("/api/effect.efk", (EffectSpec spec, string? cycle) =>
	Results.Bytes(EffectBuilder.Build(spec, oneCycle: cycle == "one").Efk, "application/octet-stream"));

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

	return Deliver(PackZip(spec, result, effectEntry, effectBytes!), fileName!, "application/zip");
});

// ---------------------------------------------------------------- シーン
// 保存済みのプロジェクトをいくつか並べたもの (SceneSpec.cs)。
// 置き場はプロジェクトの下の scenes/。プロジェクトの一覧 (*.zip) とは混ざらない。

app.MapGet("/api/scenes", () => scenes.List());

app.MapGet("/api/scenes/{name}", (string name) =>
{
	if (!ProjectStore.IsValidName(name)) return Results.BadRequest("invalid name");
	var scene = scenes.Load(name);
	return scene == null ? Results.NotFound() : Results.Ok(scene);
});

app.MapPut("/api/scenes/{name}", (string name, SceneSpec scene) =>
{
	if (!ProjectStore.IsValidName(name)) return Results.BadRequest("invalid name");
	scenes.Save(name, scene);
	return Results.Ok();
});

app.MapDelete("/api/scenes/{name}", (string name) =>
{
	if (!ProjectStore.IsValidName(name)) return Results.BadRequest("invalid name");
	return scenes.Delete(name) ? Results.Ok() : Results.NotFound();
});

// シーンの書き出し。<name>.efkset と、並べたプロジェクトそれぞれの efkzip を出す。
// efkzip は**保存済みのプロジェクトから**作る (ブラウザは書き出す前に保存を済ませてくる)。
// 書き出し先が決まっていればそこへ並べて置き、無ければ 1 つの zip にしてダウンロードさせる。
app.MapPost("/api/scenes/{name}/export", (string name, SceneSpec scene) =>
{
	if (!ProjectStore.IsValidName(name)) return Results.BadRequest("invalid name");
	var items = EfksetWriter.Visible(scene);
	if (items.Count == 0) return Results.BadRequest("書き出すエフェクトがありません (隠したものは書き出しません)");

	var files = new List<(string fileName, byte[] bytes)>();
	foreach (var project in items.Select(i => i.Project).Distinct())
	{
		if (!ProjectStore.IsValidName(project)) return Results.BadRequest($"プロジェクト名が不正です: {project}");
		var document = projects.Load(project);
		if (document == null) return Results.BadRequest($"プロジェクトが見つかりません: {project}");
		var built = EffectBuilder.Build(document.Spec);
		files.Add(($"{project}.efkzip", PackZip(document.Spec, built, $"{project}.efkefc", built.Efkefc)));
	}
	var setName = name + EfksetWriter.Extension;
	files.Add((setName, EfksetWriter.Build(scene, name)));

	var directory = config.ExportPath;
	if (directory != null)
	{
		Directory.CreateDirectory(directory);
		foreach (var (fileName, bytes) in files)
			File.WriteAllBytes(Path.Combine(directory, fileName), bytes);
		return Results.Ok(new
		{
			path = Path.Combine(directory, setName),
			note = $"efkzip {files.Count - 1} 個も書き出しました",
		});
	}

	using var ms = new MemoryStream();
	using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
	{
		foreach (var (fileName, bytes) in files) AddEntry(zip, fileName, bytes);
	}
	return Results.Bytes(ms.ToArray(), "application/zip", $"{name}.zip");
});

// ---------------------------------------------------------------- ゲームで再生
// 組み込み先 (吉里吉里の rpgsys) へ efkzip を書き出し、**そのままゲーム画面に出させる**。
// エディタの黒地ではなく実際のマップやメッセージ窓に重ねて見えるので、
// 大きさと明るさの当たりを付けるのが早い。
//
// ブラウザから組み込み先を直に叩くと CORS に当たるため、**ここ (サーバ) から呼ぶ**。
// 組み込み先の口は POST /ed/fx (rpgsys の docs/particleedit-port.md)。

app.MapPost("/api/play", async (EffectSpec spec, string? name, string? where,
                                double? mag, double? dur, bool? front) =>
{
	var game = config.GameUrl;
	if (game == null)
		return Results.BadRequest("particleedit.json の \"game\" が未設定です "
			+ "(例: \"game\": \"http://127.0.0.1:8898\")");
	var directory = config.ExportPath;
	if (directory == null)
		return Results.BadRequest("particleedit.json の \"export\" が未設定です "
			+ "(ゲームが読める場所へ書き出す必要があります)");

	var baseName = ProjectStore.IsValidName(name ?? "") ? name! : "preview";
	var fileName = $"{baseName}.efkzip";
	var gamePath = $"{config.GameDirName}/{fileName}";
	Directory.CreateDirectory(directory);
	var path = Path.Combine(directory, fileName);

	using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

	async Task<(bool ok, string body)> Ask(object order)
	{
		var res = await http.PostAsync($"{game}/ed/fx",
			new StringContent(JsonSerializer.Serialize(order), Encoding.UTF8, "application/json"));
		var body = await res.Content.ReadAsStringAsync();
		// ゲーム側は 200 でも {"ok":false,"error":"..."} を返す (素材が読めない等)
		var ok = res.IsSuccessStatusCode
		         && !body.Contains("\"ok\":false") && !body.Contains("\"ok\": false");
		return (ok, body);
	}

	// **書き出す前に、ゲームにその素材を手放してもらう。**
	// Effekseer は読み込んだ .efkzip を開いたまま持つので、掴まれたままだと
	// ここの書き出しが「別のプロセスが使用中」で落ちる (実際に踏んだ)。
	try
	{
		await Ask(new { op = "release", file = gamePath });
	}
	catch (Exception e)
	{
		return Results.BadRequest($"ゲームにつながりません ({game}): {e.Message}");
	}

	// 書き出し (エクスポートの efkzip と同じもの)
	var result = EffectBuilder.Build(spec);
	var bytes = PackZip(spec, result, $"{baseName}.efkefc", result.Efkefc);
	try
	{
		await WriteWithRetry(path, bytes);
	}
	catch (IOException e)
	{
		return Results.BadRequest($"{fileName} を書き出せません ({e.Message})。"
			+ "ゲームがこのファイルを掴んだままの可能性があります "
			+ "(ゲーム側で「素材を読み直す」を押すか、ゲームを閉じてからもう一度)");
	}

	// ゲームへ「この素材をここに出して」と頼む。
	// reload = 書き出し直したので読み直させる (前の内容が残らないように)
	var order = new Dictionary<string, object?>
	{
		["file"] = gamePath,
		["where"] = string.IsNullOrWhiteSpace(where) ? "player" : where,
		["mag"] = mag ?? 1.0,
		["front"] = front ?? false,
		["reload"] = true,
	};
	if (dur is > 0) order["dur"] = dur;

	try
	{
		var (ok, body) = await Ask(order);
		if (!ok) return Results.BadRequest($"ゲームで再生できませんでした: {body}");
		return Results.Ok(new { path, played = true });
	}
	catch (Exception e)
	{
		return Results.BadRequest($"ゲームにつながりません ({game}): {e.Message}。"
			+ "書き出しだけは済んでいます: " + path);
	}
});

// 掴まれていることがあるので少し粘る (ゲームが手放すまでの数十 ms を吸収する)
static async Task WriteWithRetry(string path, byte[] bytes)
{
	for (var attempt = 0; ; attempt++)
	{
		try
		{
			await File.WriteAllBytesAsync(path, bytes);
			return;
		}
		catch (IOException) when (attempt < 9)
		{
			await Task.Delay(50);
		}
	}
}

// efkzip の中身を組み立てる (書き出しと「ゲームで再生」で同じもの)
byte[] PackZip(EffectSpec spec, BuildResult built, string effectEntry, byte[] effectBytes)
{
	using var ms = new MemoryStream();
	using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
	{
		// エフェクト本体を先に入れる (プラグインは最初の .efkefc を本体とみなす)
		AddEntry(zip, effectEntry, effectBytes);
		AddEntry(zip, built.TextureRelativePath, ShapeRenderer.GetPng(spec.Shape));

		// 動的パラメータの名前と、軌道の一覧。組み込み先が要るときだけ入る。
		if (!ExportManifest.IsEmpty(spec))
		{
			AddEntry(zip, ExportManifest.FileName, ExportManifest.Build(spec, effectEntry));
			foreach (var motion in ExportManifest.BundledMotions(spec))
			{
				AddEntry(zip, ExportManifest.MotionPath(motion), ExportManifest.BuildMotion(motion));
			}
		}
	}
	return ms.ToArray();
}

// ------------------------------------------------------ アニメパターンの書き出し
// エフェクトを絵の連なりに焼いたもの。ループの周期が分かっていれば、
// 継ぎ目のない繰りかえしにできる (詳しくは README「アニメパターンの焼きかた」)。
//
// コマを作るのはブラウザ。エフェクトを描けるのが WebGL の上の effekseer.js しか
// 無いため、ここへは焼き上がった RGBA が送られてくる。中身は
//   [注文の JSON の長さ (4 バイト)] [注文の JSON] [コマ 1] [コマ 2] ...
// で、コマは左上が原点・アルファ非乗算の RGBA。

app.MapPost("/api/pattern", async (HttpRequest request) =>
{
	using var ms = new MemoryStream();
	await request.Body.CopyToAsync(ms);
	var body = ms.ToArray();

	if (body.Length < 4) return Results.BadRequest("body が短すぎます");
	var jsonLength = BitConverter.ToInt32(body, 0);
	if (jsonLength < 0 || 4 + jsonLength > body.Length) return Results.BadRequest("body が壊れています");

	var order = JsonSerializer.Deserialize<PatternRequest>(
		Encoding.UTF8.GetString(body, 4, jsonLength),
		new JsonSerializerOptions(JsonSerializerDefaults.Web));
	if (order == null) return Results.BadRequest("注文を読めません");

	var frameBytes = order.Width * order.Height * 4;
	if (order.Width <= 0 || order.Height <= 0) return Results.BadRequest("コマの大きさが不正です");

	var offset = 4 + jsonLength;
	var count = (body.Length - offset) / frameBytes;
	if (count < 1) return Results.BadRequest("コマがありません");

	var frames = new List<byte[]>(count);
	for (var i = 0; i < count; i++)
	{
		var frame = new byte[frameBytes];
		Array.Copy(body, offset + i * frameBytes, frame, 0, frameBytes);
		frames.Add(frame);
	}

	try
	{
		var result = PatternWriter.Write(order, frames);
		return Deliver(result.Bytes, result.FileName, "application/octet-stream", result.Note);
	}
	catch (ArgumentException e)
	{
		return Results.BadRequest(e.Message);
	}
});

// 書き出し先が決まっているならそこへ置く。ブラウザからは保存先を選べないので、
// 置き場が決まっている運用ではこのほうが手数が少ない。
IResult Deliver(byte[] bytes, string fileName, string contentType, string? note = null)
{
	var directory = config.ExportPath;
	if (directory == null) return Results.Bytes(bytes, contentType, fileName);

	Directory.CreateDirectory(directory);
	var path = Path.Combine(directory, fileName);
	File.WriteAllBytes(path, bytes);
	return Results.Ok(new { path, note });
}

var url = $"http://localhost:{config.Port}";
Console.WriteLine();
if (configNote != null) Console.WriteLine("  " + configNote);
Console.WriteLine($"  ParticleEdit  ->  {url}");
Console.WriteLine($"  プロジェクト  :  {config.ProjectsPath}");
Console.WriteLine($"  書き出し先    :  {config.ExportPath ?? "(ブラウザのダウンロード)"}");
if (config.GameUrl != null)
	Console.WriteLine($"  ゲームで再生  :  {config.GameUrl}  (素材は {config.GameDirName}/ として渡す)");
Console.WriteLine();

watchdog.Start();
app.Run(url);

static void AddEntry(ZipArchive zip, string path, byte[] bytes)
{
	using var s = zip.CreateEntry(path, CompressionLevel.Optimal).Open();
	s.Write(bytes, 0, bytes.Length);
}
