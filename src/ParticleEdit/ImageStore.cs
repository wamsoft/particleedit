using System.Security.Cryptography;

namespace ParticleEdit;

/// <summary>
/// 取り込んだ画像をディスクに置いておく。ID は内容のハッシュなので、
/// 同じ画像を何度取り込んでも 1 つにまとまる。
/// 実際の参照は <see cref="ShapeRenderer"/> のメモリ上のテーブル経由で行い、
/// ここはその永続化 (再起動しても残る) を担当する。
/// </summary>
public static class ImageStore
{
	static string _root = "";

	public static void Initialize(string root)
	{
		_root = root;
		Directory.CreateDirectory(_root);

		// 起動時に読み戻す
		foreach (var file in Directory.GetFiles(_root, "*.png"))
		{
			ShapeRenderer.PutImage(Path.GetFileNameWithoutExtension(file), File.ReadAllBytes(file));
		}
	}

	public static string Add(byte[] png)
	{
		var id = Convert.ToHexString(MD5.HashData(png))[..12].ToLowerInvariant();
		ShapeRenderer.PutImage(id, png);

		var path = Path.Combine(_root, id + ".png");
		if (!File.Exists(path)) File.WriteAllBytes(path, png);
		return id;
	}

	/// <summary>プロジェクトから復元された画像を取り込む (すでにあれば何もしない)。</summary>
	public static void Restore(string id, byte[] png)
	{
		if (ShapeRenderer.HasImage(id)) return;
		ShapeRenderer.PutImage(id, png);

		var path = Path.Combine(_root, id + ".png");
		if (!File.Exists(path)) File.WriteAllBytes(path, png);
	}
}
