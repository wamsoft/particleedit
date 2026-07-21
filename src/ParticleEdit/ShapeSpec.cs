using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace ParticleEdit;

/// <summary>
/// パーティクル 1 粒の形。
///
/// 手続き的に生成する (円 / 多角形 / 星 / 中抜き / ぼかし) か、
/// 取り込んだ画像を使うかの 2 通り。
/// 手続き的なほうは数値しか持たないのでプロジェクトが軽く、後から解像度も変えられる。
/// </summary>
public sealed class ShapeSpec
{
	/// <summary>"procedural" または "image"</summary>
	public string Type { get; set; } = "procedural";

	/// <summary>0 = 円、3 以上 = その辺数の多角形</summary>
	public int Sides { get; set; } = 0;

	/// <summary>1 = 正多角形、1 未満で星形 (内側の頂点の半径比)</summary>
	public float StarRatio { get; set; } = 1f;

	/// <summary>中抜きの半径比。0 で塗りつぶし</summary>
	public float Hole { get; set; } = 0f;

	/// <summary>縁のぼかし幅 (0 = くっきり、1 = 中心から外周まで滑らかに減衰)</summary>
	public float Blur { get; set; } = 1f;

	/// <summary>ぼかしの曲がり具合。大きいほど中心寄りに濃さが集まる</summary>
	public float Falloff { get; set; } = 2f;

	/// <summary>回転 (度)</summary>
	public float Rotation { get; set; } = 0f;

	/// <summary>テクスチャいっぱいに対する大きさ。余白の調整に使う</summary>
	public float Scale { get; set; } = 1f;

	/// <summary>Type = "image" のときに使う、取り込んだ画像の ID</summary>
	public string? ImageId { get; set; }

	/// <summary>
	/// 内容から決まる短い識別子。テクスチャのファイル名に使う。
	/// 形が変わればファイル名も変わるので、プレビュー時のキャッシュ衝突が起きない。
	/// </summary>
	public string Key()
	{
		if (Type == "image") return "img" + (ImageId ?? "none");

		var source = string.Join('_', new[]
		{
			Sides.ToString(CultureInfo.InvariantCulture),
			StarRatio.ToString("0.###", CultureInfo.InvariantCulture),
			Hole.ToString("0.###", CultureInfo.InvariantCulture),
			Blur.ToString("0.###", CultureInfo.InvariantCulture),
			Falloff.ToString("0.###", CultureInfo.InvariantCulture),
			Rotation.ToString("0.#", CultureInfo.InvariantCulture),
			Scale.ToString("0.###", CultureInfo.InvariantCulture),
		});

		var hash = MD5.HashData(Encoding.UTF8.GetBytes(source));
		return Convert.ToHexString(hash)[..8].ToLowerInvariant();
	}
}
