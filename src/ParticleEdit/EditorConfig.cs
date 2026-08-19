using System.Text.Json;

namespace ParticleEdit;

/// <summary>
/// 実行ファイルの隣に置く particleedit.json。
///
/// 置き場所をプロジェクト側の都合に合わせるためのもの。無くても動く
/// (その場合は下の既定値がそのまま使われる)。パスは設定ファイルからの相対で、
/// 絶対パスも書ける。
///
/// <code>
/// {
///   "port": 5188,
///   "projects": "../../resources/effect",
///   "export": "../../data/effect"
/// }
/// </code>
/// </summary>
public sealed class EditorConfig
{
	public const string FileName = "particleedit.json";

	/// <summary>待ち受けポート。</summary>
	public int Port { get; set; } = 5188;

	/// <summary>プロジェクト (編集を再開できる形式) の置き場。</summary>
	public string Projects { get; set; } = "projects";

	/// <summary>ユーザーが追加したテンプレートの置き場。</summary>
	public string Templates { get; set; } = "templates";

	/// <summary>取り込んだ画像の置き場。</summary>
	public string Images { get; set; } = "images";

	/// <summary>
	/// テクスチャを組み立てる作業用。消しても作り直される中間物しか置かないので、
	/// 空にしておくと OS のテンポラリを使う (実行ファイルの隣を汚さない)。
	/// </summary>
	public string? Work { get; set; }

	/// <summary>
	/// 書き出し先。指定するとエクスポートがここへ直接ファイルを置く。
	/// 空ならブラウザのダウンロードになる (ブラウザからは保存先を選べないので、
	/// 置き場が決まっているならこちらのほうが手数が少ない)。
	/// </summary>
	public string? Export { get; set; }

	/// <summary>
	/// 組み込み先 (吉里吉里のゲーム) の WebServer。設定すると
	/// **「ゲームで再生」**が使える — 書き出したものをそのままゲーム画面に出して、
	/// 実際の絵に重ねて確かめられる。例: "http://127.0.0.1:8898"。
	/// 空なら書き出しだけ (ボタンも出ない)。
	/// </summary>
	public string? Game { get; set; }

	/// <summary>
	/// 組み込み先から見た素材フォルダ名。ゲームへ渡すパスは
	/// "&lt;ここ&gt;/&lt;名前&gt;.efkzip" になる。
	/// 空なら書き出し先のフォルダ名をそのまま使う (data/effect → "effect")。
	/// </summary>
	public string? GameDir { get; set; }

	/// <summary>設定ファイルからの相対パスを絶対パスへ直したもの。</summary>
	public string Root { get; private set; } = "";

	public string ProjectsPath => Resolve(Projects);
	public string TemplatesPath => Resolve(Templates);
	public string ImagesPath => Resolve(Images);
	public string WorkPath => string.IsNullOrWhiteSpace(Work)
		? Path.Combine(Path.GetTempPath(), "ParticleEdit", "work")
		: Resolve(Work);
	public string? ExportPath => string.IsNullOrWhiteSpace(Export) ? null : Resolve(Export);

	/// <summary>組み込み先の URL (末尾のスラッシュは落とす)。未設定なら null。</summary>
	public string? GameUrl => string.IsNullOrWhiteSpace(Game) ? null : Game!.TrimEnd('/');

	/// <summary>ゲームへ渡すパスの先頭 (既定は書き出し先のフォルダ名)。</summary>
	public string GameDirName
	{
		get
		{
			if (!string.IsNullOrWhiteSpace(GameDir)) return GameDir!.Trim('/', '\\');
			var export = ExportPath;
			if (export == null) return "effect";
			return Path.GetFileName(export.TrimEnd(Path.DirectorySeparatorChar,
			                                       Path.AltDirectorySeparatorChar));
		}
	}

	string Resolve(string path) => Path.GetFullPath(Path.Combine(Root, path));

	/// <summary>設定ファイルがあれば読む。壊れていても既定値で動かす。</summary>
	public static EditorConfig Load(string root, out string? note)
	{
		note = null;
		var path = Path.Combine(root, FileName);
		var config = new EditorConfig { Root = root };

		if (!File.Exists(path)) return config;

		try
		{
			var loaded = JsonSerializer.Deserialize<EditorConfig>(
				File.ReadAllText(path), new JsonSerializerOptions(JsonSerializerDefaults.Web));
			if (loaded == null) return config;
			loaded.Root = root;
			note = $"{FileName} を読みました";
			return loaded;
		}
		catch (Exception e)
		{
			note = $"{FileName} を読めませんでした ({e.Message})。既定値で動かします";
			return config;
		}
	}
}
