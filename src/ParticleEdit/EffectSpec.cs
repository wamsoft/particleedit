using System.Text.Json.Serialization;

namespace ParticleEdit;

/// <summary>
/// エディタ UI が扱うパラメータ一式。ParticleJS / Particle Develop のパラメータ構成を踏襲した
/// フラットな構造で、これを <see cref="EffectBuilder"/> が Effekseer のノードツリーへ変換する。
/// 角度の単位は度、+X 軸から反時計回り (画面上方向が 90 度)。
/// </summary>
public sealed class EffectSpec
{
	// --- エミッター ---
	/// <summary>1 秒あたりの発生数</summary>
	public float EmitRate { get; set; } = 80f;

	/// <summary>
	/// 発生位置。画面中央が原点、+Y が画面上方向 (このファイルの角度と同じ向き)。
	/// エフェクトデータに埋め込まれるので、組み込み先でも同じ場所から出る。
	/// </summary>
	public float EmitterX { get; set; } = 0f;
	public float EmitterY { get; set; } = 0f;

	/// <summary>発生位置のばらつき (px)。矩形分布。</summary>
	public float SpawnRangeX { get; set; } = 0f;
	public float SpawnRangeY { get; set; } = 0f;

	/// <summary>初速 (px/frame)</summary>
	public float Speed { get; set; } = 3f;
	public float SpeedVariance { get; set; } = 1f;

	/// <summary>初速の向き (度) と、その広がり (度)</summary>
	public float Direction { get; set; } = 90f;
	public float DirectionVariance { get; set; } = 30f;

	/// <summary>重力の強さと向き (度)</summary>
	public float Gravity { get; set; } = 0.05f;
	public float GravityDirection { get; set; } = 270f;

	/// <summary>空気抵抗。0 で無効。</summary>
	public float Drag { get; set; } = 0f;

	/// <summary>
	/// 発生位置を再生中に動かしたとき、すでに出ているパーティクルがどうなるか。
	/// "spawn" … 生成された場所に置き去りになる (動かすと軌跡が残る)
	/// "always" … エミッターに剛体追従する (かたまりごと移動する)
	/// 発生位置を動かさないなら見た目は変わらない。
	/// </summary>
	public string LocationBind { get; set; } = "spawn";

	// --- パーティクル ---
	/// <summary>寿命 (フレーム)</summary>
	public int Life { get; set; } = 60;
	public int LifeVariance { get; set; } = 20;

	/// <summary>大きさ (px)。生存中に開始値から終了値へ補間される。</summary>
	public float StartSize { get; set; } = 64f;
	public float StartSizeVariance { get; set; } = 26f;
	public float EndSize { get; set; } = 0f;
	public float EndSizeVariance { get; set; } = 0f;

	/// <summary>発生時の角度 (度) と、その幅。反時計回り。</summary>
	public float Rotation { get; set; } = 0f;
	public float RotationVariance { get; set; } = 0f;

	/// <summary>1 フレームあたりの回転量 (度) と、その幅。正で反時計回り。</summary>
	public float RotationSpeed { get; set; } = 0f;
	public float RotationSpeedVariance { get; set; } = 0f;

	// --- 色 ---
	/// <summary>
	/// 色相 (0-360) / 彩度 (0-100) / 明度 (0-100)。ばらつきは全体の幅。
	/// Effekseer が HSVA をネイティブに解釈するので HSV でそのまま持つ。
	/// </summary>
	public float Hue { get; set; } = 30f;
	public float HueVariance { get; set; } = 20f;
	public float Saturation { get; set; } = 90f;
	public float SaturationVariance { get; set; } = 10f;
	public float Brightness { get; set; } = 100f;
	public float BrightnessVariance { get; set; } = 0f;

	public float StartAlpha { get; set; } = 1f;
	public float EndAlpha { get; set; } = 0f;

	// --- 描画 ---
	/// <summary>"add" (加算) または "blend" (通常)</summary>
	public string Blend { get; set; } = "add";

	/// <summary>パーティクル 1 粒の形。</summary>
	public ShapeSpec Shape { get; set; } = new();

	// --- エディタ専用 (エフェクトデータには入らない) ---
	// プロジェクトには保存されるが、.efk / .efkefc には一切影響しない。

	public string BackgroundColor { get; set; } = "#101014";

	/// <summary>組み込み先の画面サイズ。プレビューに枠として重ねて、大きさの当たりを付ける。</summary>
	public int FrameWidth { get; set; } = 1280;
	public int FrameHeight { get; set; } = 720;
	public bool ShowFrame { get; set; } = true;
}
