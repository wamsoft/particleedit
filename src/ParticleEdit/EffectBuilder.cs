using Effekseer;
using Effekseer.Data;

namespace ParticleEdit;

public sealed record BuildResult(byte[] Efk, byte[] Efkefc, string TextureRelativePath);

/// <summary>
/// <see cref="EffectSpec"/> を Effekseer のノードツリーへ変換し、.efk / .efkefc を書き出す。
///
/// Effekseer 公式エディタのコア (EffekseerCore) をそのまま使っているため、
/// バイナリフォーマットの自前実装は一切していない。ここでやっているのは
/// 「UI のパラメータ」→「Effekseer のデータモデル」のマッピングだけ。
///
/// EffekseerCore は静的な <see cref="Core"/> シングルトンを介して動くので、
/// ビルドは必ずロックの中で直列に行う。
/// </summary>
public static class EffectBuilder
{
	static readonly object Gate = new();
	static bool _initialized;
	static string _workDir = "";

	/// <summary>作業ディレクトリを用意する。</summary>
	public static void Initialize(string workDir)
	{
		lock (Gate)
		{
			if (_initialized) return;

			_workDir = workDir;
			Directory.CreateDirectory(Path.Combine(workDir, "Texture"));

			Core.Initialize("en");
			_initialized = true;
		}
	}

	/// <summary>
	/// 現在の形のテクスチャを作業ディレクトリへ書き出し、その相対パスを返す。
	/// ファイル名は形の内容から決まるので、形を変えればパスも変わる
	/// (プレビュー側でブラウザのキャッシュとぶつからない)。
	/// </summary>
	static string PrepareTexture(ShapeSpec shape)
	{
		var fileName = ShapeRenderer.FileName(shape);
		var path = Path.Combine(_workDir, "Texture", fileName);
		if (!File.Exists(path)) File.WriteAllBytes(path, ShapeRenderer.GetPng(shape));
		return "Texture/" + fileName;
	}

	/// <summary>プレビューが取りに来るテクスチャを作業ディレクトリから返す。</summary>
	public static byte[]? ReadTexture(string fileName)
	{
		if (fileName.Contains('/') || fileName.Contains('\\') || fileName.Contains("..")) return null;
		var path = Path.Combine(_workDir, "Texture", fileName);
		return File.Exists(path) ? File.ReadAllBytes(path) : null;
	}

	public static BuildResult Build(EffectSpec spec)
	{
		lock (Gate)
		{
			Core.New();

			var texturePath = PrepareTexture(spec.Shape);

			// テクスチャの相対パス解決の基準になる「プロジェクトファイルの場所」
			var projectPath = Path.Combine(_workDir, "effect.efkefc");
			Core.Root.SetFullPath(projectPath);

			// Core.New() が既定のノードを 1 つ作っているのでそれを使う
			var node = (Node)Core.Root.Children[0];
			node.Name.SetValue("Particle");
			ApplyCommon(node, spec);
			ApplyLocation(node, spec);
			ApplyScale(node, spec);
			ApplyRotation(node, spec);
			ApplyRenderer(node, spec, texturePath);

			var efk = new Effekseer.Binary.Exporter().Export(Core.Root, 1.0f);

			Core.SaveTo(projectPath);
			var efkefc = File.ReadAllBytes(projectPath);

			return new BuildResult(efk, efkefc, texturePath);
		}
	}

	/// <summary>組み立て結果を人が読める形で書き出す (デバッグ用)。</summary>
	public static string Describe(EffectSpec spec)
	{
		lock (Gate)
		{
			Build(spec);
			var node = (Node)Core.Root.Children[0];
			var pva = node.LocationValues.PVA;
			var ease = node.ScalingValues.Easing;
			var color = node.DrawingValues.ColorAll;
			var sb = new System.Text.StringBuilder();
			sb.AppendLine($"Name              = {node.Name.Value}");
			sb.AppendLine($"Life              = {node.CommonValues.Life.Min}..{node.CommonValues.Life.Max}");
			sb.AppendLine($"GenerationTime    = {node.CommonValues.Generation.GenerationTime.Min}..{node.CommonValues.Generation.GenerationTime.Max}");
			sb.AppendLine($"MaxGeneration.Inf = {node.CommonValues.MaxGeneration.Infinite.Value}");
			sb.AppendLine($"Location.Type     = {node.LocationValues.Type.Value}");
			sb.AppendLine($"  Location X      = {pva.Location.X.Min}..{pva.Location.X.Max}  ({pva.Location.X.DrawnAs})");
			sb.AppendLine($"  Velocity X      = {pva.Velocity.X.Min}..{pva.Velocity.X.Max}  ({pva.Velocity.X.DrawnAs})");
			sb.AppendLine($"  Velocity Y      = {pva.Velocity.Y.Min}..{pva.Velocity.Y.Max}");
			sb.AppendLine($"  Accel Y         = {pva.Acceleration.Y.Min}..{pva.Acceleration.Y.Max}");
			sb.AppendLine($"ForceField1       = {node.LocationAbsValues.LocalForceField1.Type.Value} gravity=({node.LocationAbsValues.LocalForceField1.Gravity.Gravity.X.Value}, {node.LocationAbsValues.LocalForceField1.Gravity.Gravity.Y.Value})");
			sb.AppendLine($"ForceField2       = {node.LocationAbsValues.LocalForceField2.Type.Value} power={node.LocationAbsValues.LocalForceField2.Power.Value}");
			sb.AppendLine($"Scale.Type        = {node.ScalingValues.Type.Value}");
			sb.AppendLine($"  Start X         = {ease.Start.X.Min}..{ease.Start.X.Max}");
			sb.AppendLine($"  End   X         = {ease.End.X.Min}..{ease.End.X.Max}");
			sb.AppendLine($"Rotation.Type     = {node.RotationValues.Type.Value}");
			sb.AppendLine($"  Angle  Z (deg)  = {node.RotationValues.PVA.Rotation.Z.Min}..{node.RotationValues.PVA.Rotation.Z.Max}");
			sb.AppendLine($"  Speed  Z (deg)  = {node.RotationValues.PVA.Velocity.Z.Min}..{node.RotationValues.PVA.Velocity.Z.Max}");
			sb.AppendLine($"Drawing.Type      = {node.DrawingValues.Type.Value}");
			sb.AppendLine($"Billboard         = {node.DrawingValues.Sprite.Billboard.Value}");
			sb.AppendLine($"ColorAll.Type     = {color.Type.Value}  space={color.Easing.Start.ColorSpace}");
			sb.AppendLine($"  Start HSVA      = H {color.Easing.Start.R.Min}..{color.Easing.Start.R.Max}  S {color.Easing.Start.G.Min}..{color.Easing.Start.G.Max}  V {color.Easing.Start.B.Min}..{color.Easing.Start.B.Max}  A {color.Easing.Start.A.Min}..{color.Easing.Start.A.Max}");
			sb.AppendLine($"  End   HSVA      = H {color.Easing.End.R.Min}..{color.Easing.End.R.Max}  A {color.Easing.End.A.Min}..{color.Easing.End.A.Max}");
			sb.AppendLine($"AlphaBlend        = {node.RendererCommonValues.AlphaBlend.Value}");
			sb.AppendLine($"ColorTexture      = {node.RendererCommonValues.ColorTexture.RelativePath}");
			return sb.ToString();
		}
	}

	// ------------------------------------------------------------------ 共通

	static void ApplyCommon(Node node, EffectSpec spec)
	{
		var cv = node.CommonValues;

		// 生成し続ける
		cv.MaxGeneration.Infinite.SetValue(true);
		cv.Removal.WhenLifeIsExtinct.SetValue(true);

		// 寿命 (フレーム)
		SetRange(cv.Life, spec.Life, spec.LifeVariance, min: 1);

		// 1 秒あたりの発生数 → 何フレームおきに 1 個生成するか
		var rate = Math.Max(spec.EmitRate, 0.01f);
		var interval = 60f / rate;
		SetRange(cv.Generation.GenerationTime, interval, 0f, min: 0.0001f);

		// 親 (= 再生側が動かすエフェクト本体) の位置をどう受けるか。
		// 既定の Already は「常に追従」なので、再生中にエミッターを動かすと
		// 生存中のパーティクルまで丸ごと移動してしまい軌跡が残らない。
		cv.LocationEffectType.SetValue(spec.LocationBind == "always"
			? TranslationParentEffectType.Already
			: TranslationParentEffectType.WhenCreating);
	}

	// ---------------------------------------------------------------- 位置系

	static void ApplyLocation(Node node, EffectSpec spec)
	{
		node.LocationValues.Type.SetValue(LocationValues.ParamaterType.PVA);
		var pva = node.LocationValues.PVA;

		// 発生位置と、そのばらつき (矩形)
		SetRange(pva.Location.X, spec.EmitterX, spec.SpawnRangeX);
		SetRange(pva.Location.Y, spec.EmitterY, spec.SpawnRangeY);
		SetRange(pva.Location.Z, 0f, 0f);

		// 初速: 角度 ± 広がり / 速さ ± ばらつき を XY の矩形範囲へ近似する。
		// Effekseer の PVA 速度は軸ごとの min/max しか持たないため、扇形は外接矩形で表す。
		// 広がりが狭いうちはほぼ一致し、360 度に近づくほど誤差が出る (既知の制限)。
		var (vxMin, vxMax, vyMin, vyMax) = VelocityBox(
			spec.Direction, spec.DirectionVariance,
			Math.Max(spec.Speed - spec.SpeedVariance * 0.5f, 0f),
			spec.Speed + spec.SpeedVariance * 0.5f);

		SetMinMax(pva.Velocity.X, vxMin, vxMax);
		SetMinMax(pva.Velocity.Y, vyMin, vyMax);
		SetRange(pva.Velocity.Z, 0f, 0f);

		// 重力はワールド空間の力として与える (PVA の加速度ではなくフォースフィールドを使う)
		if (spec.Gravity > 0f)
		{
			var ff = node.LocationAbsValues.LocalForceField1;
			ff.Type.SetValue(LocalForceFieldType.Gravity);
			var rad = spec.GravityDirection * MathF.PI / 180f;
			ff.Gravity.Gravity.X.SetValue(MathF.Cos(rad) * spec.Gravity);
			ff.Gravity.Gravity.Y.SetValue(MathF.Sin(rad) * spec.Gravity);
			ff.Gravity.Gravity.Z.SetValue(0f);
		}

		// 空気抵抗
		if (spec.Drag > 0f)
		{
			var ff = node.LocationAbsValues.LocalForceField2;
			ff.Type.SetValue(LocalForceFieldType.Drag);
			ff.Power.SetValue(spec.Drag);
		}
	}

	/// <summary>扇形 (角度範囲 × 速さ範囲) を包む XY の矩形を求める。</summary>
	static (float xMin, float xMax, float yMin, float yMax) VelocityBox(
		float directionDeg, float spreadDeg, float speedMin, float speedMax)
	{
		var half = Math.Clamp(spreadDeg, 0f, 360f) * 0.5f;
		var a0 = directionDeg - half;
		var a1 = directionDeg + half;

		float xMin = float.MaxValue, xMax = float.MinValue;
		float yMin = float.MaxValue, yMax = float.MinValue;

		// 角度を細かく刻んで外接矩形を取る (端点だけだと軸をまたぐ場合に外す)
		const int steps = 72;
		for (var i = 0; i <= steps; i++)
		{
			var a = (a0 + (a1 - a0) * i / steps) * MathF.PI / 180f;
			foreach (var speed in stackalloc[] { speedMin, speedMax })
			{
				var x = MathF.Cos(a) * speed;
				var y = MathF.Sin(a) * speed;
				xMin = MathF.Min(xMin, x); xMax = MathF.Max(xMax, x);
				yMin = MathF.Min(yMin, y); yMax = MathF.Max(yMax, y);
			}
		}

		return (xMin, xMax, yMin, yMax);
	}

	// ---------------------------------------------------------------- 大きさ

	static void ApplyScale(Node node, EffectSpec spec)
	{
		node.ScalingValues.Type.SetValue(ScaleValues.ParamaterType.Easing);
		var easing = node.ScalingValues.Easing;

		SetRange(easing.Start.X, spec.StartSize, spec.StartSizeVariance, min: 0f);
		SetRange(easing.Start.Y, spec.StartSize, spec.StartSizeVariance, min: 0f);
		SetRange(easing.Start.Z, 1f, 0f);

		SetRange(easing.End.X, spec.EndSize, spec.EndSizeVariance, min: 0f);
		SetRange(easing.End.Y, spec.EndSize, spec.EndSizeVariance, min: 0f);
		SetRange(easing.End.Z, 1f, 0f);
	}

	// ---------------------------------------------------------------- 回転

	/// <summary>
	/// 画面内での粒の回転。Effekseer は 3 軸持っているが、2D で見えるのは Z 軸だけ。
	/// 角度は度で持ち、書き出し時にラジアンへ変換される。
	/// </summary>
	static void ApplyRotation(Node node, EffectSpec spec)
	{
		node.RotationValues.Type.SetValue(RotationValues.ParamaterType.PVA);
		var pva = node.RotationValues.PVA;

		SetRange(pva.Rotation.Z, spec.Rotation, spec.RotationVariance);
		SetRange(pva.Velocity.Z, spec.RotationSpeed, spec.RotationSpeedVariance);
	}

	// ------------------------------------------------------------ 描画 / 色

	static void ApplyRenderer(Node node, EffectSpec spec, string texturePath)
	{
		node.DrawingValues.Type.SetValue(RendererValues.ParamaterType.Sprite);

		// 既定の「ビルボード」はカメラを向くだけでノードの回転を捨ててしまう。
		// 「回転ビルボード」ならカメラを向いたうえで Z 軸回転が乗る。
		// 平行投影の 2D では見た目が「固定」と同じで、3D へ持って行っても破綻しない。
		node.DrawingValues.Sprite.Billboard.SetValue(RendererValues.BillboardType.RotatedBillboard);

		// 色は HSV + アルファ。Effekseer は HSVA をランタイム側でネイティブに解釈するので、
		// 色相のばらつきがちゃんと「色相の帯」になる (RGB 個別ランダムにはならない)。
		var color = node.DrawingValues.ColorAll;
		color.Type.SetValue(StandardColorType.Easing);
		SetHsvaRange(color.Easing.Start, spec, spec.StartAlpha);
		SetHsvaRange(color.Easing.End, spec, spec.EndAlpha);

		var rc = node.RendererCommonValues;
		rc.AlphaBlend.SetValue(spec.Blend == "blend" ? AlphaBlendType.Blend : AlphaBlendType.Add);
		rc.ColorTexture.SetAbsolutePath(Path.Combine(_workDir, texturePath).Replace('\\', '/'));
	}

	static void SetHsvaRange(Effekseer.Data.Value.ColorWithRandom color, EffectSpec spec, float alpha)
	{
		color.SetColorSpace(ColorSpace.HSVA, isColorConverted: false, isCombined: false);

		// Effekseer の色相は 0..252 が 0..360 度に対応する
		var hue = spec.Hue / 360f * 252f;
		var hueVar = spec.HueVariance / 360f * 252f;
		SetByteRange(color.R, hue, hueVar, 0, 252);
		SetByteRange(color.G, spec.Saturation / 100f * 255f, spec.SaturationVariance / 100f * 255f, 0, 255);
		SetByteRange(color.B, spec.Brightness / 100f * 255f, spec.BrightnessVariance / 100f * 255f, 0, 255);
		SetByteRange(color.A, alpha * 255f, 0f, 0, 255);
	}

	// -------------------------------------------------------------- ヘルパ

	/// <summary>中心値 ± 幅/2 を min/max として設定する。</summary>
	static void SetRange(Effekseer.Data.Value.FloatWithRandom v, float center, float variance, float min = float.MinValue)
	{
		var lo = MathF.Max(center - variance * 0.5f, min);
		var hi = MathF.Max(center + variance * 0.5f, lo);
		SetMinMax(v, lo, hi);
	}

	static void SetMinMax(Effekseer.Data.Value.FloatWithRandom v, float lo, float hi)
	{
		v.DrawnAs = DrawnAs.MaxAndMin;
		// Max から先に上げないと Min > Max で弾かれることがある
		v.SetMax(MathF.Max(lo, hi));
		v.SetMin(MathF.Min(lo, hi));
	}

	static void SetRange(Effekseer.Data.Value.IntWithRandom v, int center, int variance, int min = int.MinValue)
	{
		var lo = Math.Max(center - variance / 2, min);
		var hi = Math.Max(center + variance / 2, lo);
		v.DrawnAs = DrawnAs.MaxAndMin;
		v.SetMax(hi);
		v.SetMin(lo);
	}

	static void SetByteRange(Effekseer.Data.Value.IntWithRandom v, float center, float variance, int min, int max)
	{
		var lo = (int)MathF.Round(Math.Clamp(center - variance * 0.5f, min, max));
		var hi = (int)MathF.Round(Math.Clamp(center + variance * 0.5f, min, max));
		v.DrawnAs = DrawnAs.MaxAndMin;
		v.SetMax(Math.Max(lo, hi));
		v.SetMin(Math.Min(lo, hi));
	}
}
