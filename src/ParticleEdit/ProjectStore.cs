using System.IO.Compression;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ParticleEdit;

/// <summary>
/// このアプリ固有のプロジェクト (セーブ/ロード) を扱う。
///
/// エクスポート (.efk / .efkefc / efkzip) が「配布用・一方向」なのに対して、
/// こちらは「編集を再開するための往復できる形式」。
/// パラメータから Effekseer のデータモデルへの変換は一方向で逆算できない
/// (例: 方向 90 度 ± 40 度 は速度の矩形範囲に潰れて元に戻せない) ため、
/// 編集状態はこの形式でしか復元できない。
///
/// 実体はディレクトリ配下の zip:
///   project.json      … フォーマット版 + パラメータ + (将来) 形状定義
///   Texture/*.png     … そのプロジェクトが使っているテクスチャ
/// テクスチャを同梱しているので、プロジェクト単体で完結する。
/// </summary>
public sealed class ProjectStore
{
	public const int FormatVersion = 1;

	static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

	// パス区切りや相対参照を弾く。日本語のファイル名は許す。
	static readonly Regex InvalidName = new(@"[\\/:*?""<>|]|^\.|\.\.", RegexOptions.Compiled);

	readonly string _root;

	public ProjectStore(string root)
	{
		_root = root;
		Directory.CreateDirectory(_root);
	}

	public sealed record Entry(string Name, DateTime Modified);

	public sealed class Document
	{
		public int FormatVersion { get; set; } = ProjectStore.FormatVersion;
		public EffectSpec Spec { get; set; } = new();
		/// <summary>将来、形状エディタで作ったパーツ定義を入れる場所。</summary>
		public List<object> Shapes { get; set; } = new();
	}

	public static bool IsValidName(string name)
		=> !string.IsNullOrWhiteSpace(name) && name.Length <= 64 && !InvalidName.IsMatch(name);

	string PathOf(string name) => Path.Combine(_root, name + ".zip");

	public IEnumerable<Entry> List()
		=> new DirectoryInfo(_root)
			.GetFiles("*.zip")
			.OrderByDescending(f => f.LastWriteTimeUtc)
			.Select(f => new Entry(Path.GetFileNameWithoutExtension(f.Name), f.LastWriteTimeUtc));

	public void Save(string name, EffectSpec spec)
	{
		var document = new Document { Spec = spec };

		using var ms = new MemoryStream();
		using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
		{
			WriteEntry(zip, "project.json", JsonSerializer.SerializeToUtf8Bytes(document, Json));

			// 使っているテクスチャを同梱してプロジェクト単体で完結させる。
			// 取り込んだ画像を使っている場合、これが無いと別環境で開けない。
			var shape = spec.Shape ?? new ShapeSpec();
			WriteEntry(zip, "Texture/" + ShapeRenderer.FileName(shape), ShapeRenderer.GetPng(shape));
		}

		// 書き込み中に落ちても既存を壊さないよう、一時ファイル経由で差し替える
		var target = PathOf(name);
		var temp = target + ".tmp";
		File.WriteAllBytes(temp, ms.ToArray());
		File.Move(temp, target, overwrite: true);
	}

	public Document? Load(string name)
	{
		var path = PathOf(name);
		if (!File.Exists(path)) return null;

		using var zip = ZipFile.OpenRead(path);
		var entry = zip.GetEntry("project.json");
		if (entry == null) return null;

		Document? document;
		using (var s = entry.Open())
		{
			document = JsonSerializer.Deserialize<Document>(s, Json);
		}
		if (document == null) return null;

		// 取り込んだ画像を使っているのに手元に無ければ、同梱されているものを復元する
		var shape = document.Spec.Shape;
		if (shape.Type == "image" && shape.ImageId != null && !ShapeRenderer.HasImage(shape.ImageId))
		{
			var texture = zip.GetEntry("Texture/" + ShapeRenderer.FileName(shape));
			if (texture != null)
			{
				using var ts = texture.Open();
				using var ms = new MemoryStream();
				ts.CopyTo(ms);
				ImageStore.Restore(shape.ImageId, ms.ToArray());
			}
		}

		return document;
	}

	public bool Delete(string name)
	{
		var path = PathOf(name);
		if (!File.Exists(path)) return false;
		File.Delete(path);
		return true;
	}

	static void WriteEntry(ZipArchive zip, string path, byte[] bytes)
	{
		using var s = zip.CreateEntry(path, CompressionLevel.Optimal).Open();
		s.Write(bytes, 0, bytes.Length);
	}
}
