using System.Globalization;
using System.Text;
using System.Text.Json;

namespace ParticleEdit;

/// <summary>
/// シーン: 保存済みのプロジェクトをいくつか並べたもの。
///
/// 1 つの画面に 2 つ 3 つのエフェクトを重ねて置いたときの見えかたを、
/// エディタの中で確かめるためのもの。並べたうちの 1 つを「アクティブ」にして
/// いつものつまみで編集し、残りはその背景として流し続ける。
///
/// 書き出すと吉里吉里プラグイン側の <c>.efkset</c> (エフェクトの並び) になり、
/// 1 つのオブジェクトで並べたまま再生できる。並べたエフェクトそれぞれの
/// <c>.efkzip</c> も一緒に書き出す。
///
/// 座標はゲームの画面と同じ流儀: 画面中央が原点、Y は下向き、回転は時計回り。
/// (エディタのワールドは Y 上向きなので、ブラウザ側で符号を直して使う)
/// </summary>
public sealed class SceneSpec
{
	public int FormatVersion { get; set; } = 1;
	public int Width { get; set; } = 1280;
	public int Height { get; set; } = 720;
	public List<SceneItem> Items { get; set; } = new();
}

public sealed class SceneItem
{
	/// <summary>並べるプロジェクトの名前 (projects の zip)。</summary>
	public string Project { get; set; } = "";
	/// <summary>位置 (ピクセル。画面中央原点・Y 下向き)。</summary>
	public double X { get; set; }
	public double Y { get; set; }
	/// <summary>拡大率 (%)。</summary>
	public double Zoom { get; set; } = 100;
	/// <summary>回転 (度、時計回り)。</summary>
	public double Angle { get; set; }
	/// <summary>再生速度 (倍)。</summary>
	public double Speed { get; set; } = 1;
	/// <summary>再生開始までの遅れ (ms)。</summary>
	public double Delay { get; set; }
	/// <summary>終わったら頭から流し直すか。</summary>
	public bool Loop { get; set; } = true;
	/// <summary>組み込み先で流す軌道の名前 (同梱した軌道から選ぶ)。空なら流さない。</summary>
	public string? Motion { get; set; }
	/// <summary>エディタで隠しているか。隠したものは書き出さない。</summary>
	public bool Hidden { get; set; }
}

/// <summary>シーンの保存 (projects/scenes/*.json)。</summary>
public sealed class SceneStore
{
	static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

	readonly string _root;

	public SceneStore(string root)
	{
		_root = root;
	}

	string PathOf(string name) => Path.Combine(_root, name + ".json");

	public IEnumerable<ProjectStore.Entry> List()
		=> Directory.Exists(_root)
			? new DirectoryInfo(_root)
				.GetFiles("*.json")
				.OrderByDescending(f => f.LastWriteTimeUtc)
				.Select(f => new ProjectStore.Entry(Path.GetFileNameWithoutExtension(f.Name), f.LastWriteTimeUtc))
			: Enumerable.Empty<ProjectStore.Entry>();

	public SceneSpec? Load(string name)
	{
		var path = PathOf(name);
		if (!File.Exists(path)) return null;
		return JsonSerializer.Deserialize<SceneSpec>(File.ReadAllText(path), Json);
	}

	public void Save(string name, SceneSpec scene)
	{
		Directory.CreateDirectory(_root);
		var target = PathOf(name);
		var temp = target + ".tmp";
		File.WriteAllBytes(temp, JsonSerializer.SerializeToUtf8Bytes(scene, Json));
		File.Move(temp, target, overwrite: true);
	}

	public bool Delete(string name)
	{
		var path = PathOf(name);
		if (!File.Exists(path)) return false;
		File.Delete(path);
		return true;
	}
}

/// <summary>
/// シーンを吉里吉里プラグイン側の <c>.efkset</c> に直す。
///
/// 中身は TJS の辞書 (UTF-8 BOM 付き)。ゲーム側は Scripts.evalStorage で読むので、
/// JSON ではなく TJS の書式で出す (json.dll を出荷物に足さずに済むように)。
/// 書式の正本はゲーム側の AffineSourceEffekseerSet.tjs の先頭。
/// </summary>
public static class EfksetWriter
{
	public const string Extension = ".efkset";

	/// <summary>書き出す対象 (隠したもの・プロジェクト未指定は除く)。</summary>
	public static List<SceneItem> Visible(SceneSpec scene)
		=> scene.Items.Where(i => !i.Hidden && !string.IsNullOrWhiteSpace(i.Project)).ToList();

	public static byte[] Build(SceneSpec scene, string sceneName)
	{
		var sb = new StringBuilder();
		sb.Append("// ParticleEdit のシーン「").Append(sceneName).Append("」から書き出したもの\r\n");
		sb.Append("// 書式: AffineSourceEffekseerSet.tjs の先頭を参照\r\n");
		sb.Append("%[\r\n");
		sb.Append("\t\"version\" => 1,\r\n");
		sb.Append($"\t\"width\" => {scene.Width}, \"height\" => {scene.Height},\r\n");
		sb.Append("\t\"items\" => [\r\n");

		var items = Visible(scene);
		var used = new HashSet<string>();
		for (var i = 0; i < items.Count; i++)
		{
			var item = items[i];
			var fields = new List<string>
			{
				Pair("name", Str(UniqueName(item.Project, used))),
				Pair("file", Str(item.Project + ".efkzip")),
				Pair("x", Num(item.X)),
				Pair("y", Num(item.Y)),
			};
			if (item.Zoom != 100) fields.Add(Pair("zoom", Num(item.Zoom / 100)));
			if (item.Angle != 0) fields.Add(Pair("angle", Num(item.Angle)));
			if (item.Speed != 1) fields.Add(Pair("speed", Num(item.Speed)));
			if (item.Delay > 0) fields.Add(Pair("delay", Num(item.Delay)));
			if (!item.Loop) fields.Add(Pair("loop", "0"));
			if (!string.IsNullOrWhiteSpace(item.Motion)) fields.Add(Pair("motion", Str(item.Motion!)));

			// TJS の配列は末尾のカンマが「空要素をもう 1 つ」の意味になるので付けない
			sb.Append("\t\t%[ ").Append(string.Join(", ", fields)).Append(" ]")
			  .Append(i < items.Count - 1 ? ",\r\n" : "\r\n");
		}

		sb.Append("\t]\r\n");
		sb.Append("]\r\n");

		var preamble = Encoding.UTF8.GetPreamble();
		var body = Encoding.UTF8.GetBytes(sb.ToString());
		return preamble.Concat(body).ToArray();
	}

	/// <summary>同じプロジェクトを 2 回並べたときに名前がぶつからないようにする。</summary>
	static string UniqueName(string project, HashSet<string> used)
	{
		var name = project;
		for (var n = 2; !used.Add(name); n++) name = $"{project}{n}";
		return name;
	}

	static string Pair(string key, string value) => $"\"{key}\" => {value}";

	static string Num(double v) => Math.Round(v, 3).ToString("0.###", CultureInfo.InvariantCulture);

	/// <summary>TJS の文字列リテラル。</summary>
	static string Str(string s)
	{
		var sb = new StringBuilder("\"");
		foreach (var c in s)
		{
			switch (c)
			{
				case '"': sb.Append("\\\""); break;
				case '\\': sb.Append("\\\\"); break;
				case '\n': sb.Append("\\n"); break;
				case '\r': sb.Append("\\r"); break;
				case '\t': sb.Append("\\t"); break;
				default: sb.Append(c); break;
			}
		}
		return sb.Append('"').ToString();
	}
}
