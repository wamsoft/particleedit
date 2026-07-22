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

	/// <summary>設定ファイルからの相対パスを絶対パスへ直したもの。</summary>
	public string Root { get; private set; } = "";

	public string ProjectsPath => Resolve(Projects);
	public string TemplatesPath => Resolve(Templates);
	public string ImagesPath => Resolve(Images);
	public string WorkPath => string.IsNullOrWhiteSpace(Work)
		? Path.Combine(Path.GetTempPath(), "ParticleEdit", "work")
		: Resolve(Work);
	public string? ExportPath => string.IsNullOrWhiteSpace(Export) ? null : Resolve(Export);

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
