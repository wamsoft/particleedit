namespace ParticleEdit;

/// <summary>
/// エミッタの動きを表す軌道 (タイムライン)。
///
/// 座標はエディタ内の他のパラメータと同じ「画面中央が原点 / +Y が画面上方向 / ピクセル」。
/// 書き出すときだけ組み込み先の流儀 (+Y が画面下方向) へ直す。
/// </summary>
public sealed class MotionSpec
{
	public string Name { get; set; } = "";

	/// <summary>全体の長さ (フレーム)。</summary>
	public int Frames { get; set; } = 60;

	/// <summary>終端まで来たら頭へ戻るか。</summary>
	public bool Loop { get; set; } = true;

	public List<MotionPoint> Points { get; set; } = new();

	/// <summary>キーが 1 つも無い軌道は「動かない」のと同じなので弾く。</summary>
	public bool IsUsable => Points.Count >= 2 && Frames >= 1;
}

public sealed class MotionPoint
{
	public int Frame { get; set; }
	public float X { get; set; }
	public float Y { get; set; }
}
