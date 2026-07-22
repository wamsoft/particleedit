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
			var spawn = (Node)Core.Root.Children[0];
			spawn.Name.SetValue("Spawn");
			ApplySpawn(spawn, spec);

			var particle = spawn.AddChild();
			particle.Name.SetValue("Particle");
			ApplyParticle(particle, spec, texturePath);

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
			var spawn = (Node)Core.Root.Children[0];
			var node = (Node)spawn.Children[0];
			var spawnPva = spawn.LocationValues.PVA;
			var pva = node.LocationValues.PVA;
			var circle = node.GenerationLocationValues.Circle;
			var ease = node.ScalingValues.Easing;
			var color = node.DrawingValues.ColorAll;
			var sb = new System.Text.StringBuilder();
			sb.AppendLine($"[{spawn.Name.Value}]  (描画なし)");
			sb.AppendLine($"  Life            = {spawn.CommonValues.Life.Min}..{spawn.CommonValues.Life.Max}");
			sb.AppendLine($"  GenerationTime  = {spawn.CommonValues.Generation.GenerationTime.Min}..{spawn.CommonValues.Generation.GenerationTime.Max}");
			sb.AppendLine($"  LocationEffect  = {spawn.CommonValues.LocationEffectType.Value}");
			sb.AppendLine($"  Location X      = {spawnPva.Location.X.Min}..{spawnPva.Location.X.Max}");
			sb.AppendLine($"  Location Y      = {spawnPva.Location.Y.Min}..{spawnPva.Location.Y.Max}");
			sb.AppendLine($"[{node.Name.Value}]");
			sb.AppendLine($"  Life            = {node.CommonValues.Life.Min}..{node.CommonValues.Life.Max}");
			sb.AppendLine($"  MaxGeneration   = {node.CommonValues.MaxGeneration.Value.Value}");
			sb.AppendLine($"  Emission        = {node.GenerationLocationValues.Type.Value} rotation={node.GenerationLocationValues.EffectsRotation.Value}");
			sb.AppendLine($"    Angle (deg)   = {circle.AngleStart.Min} noize {circle.AngleNoize.Min}..{circle.AngleNoize.Max}");
			sb.AppendLine($"  Location.Type   = {node.LocationValues.Type.Value}");
			sb.AppendLine($"    Velocity Y    = {pva.Velocity.Y.Min}..{pva.Velocity.Y.Max}");
			sb.AppendLine($"  ForceField1     = {node.LocationAbsValues.LocalForceField1.Type.Value} gravity=({node.LocationAbsValues.LocalForceField1.Gravity.Gravity.X.Value}, {node.LocationAbsValues.LocalForceField1.Gravity.Gravity.Y.Value})");
			sb.AppendLine($"  ForceField2     = {node.LocationAbsValues.LocalForceField2.Type.Value} power={node.LocationAbsValues.LocalForceField2.Power.Value}");
			sb.AppendLine($"  Scale.Type      = {node.ScalingValues.Type.Value}");
			sb.AppendLine($"    Start X       = {ease.Start.X.Min}..{ease.Start.X.Max}");
			sb.AppendLine($"    End   X       = {ease.End.X.Min}..{ease.End.X.Max}");
			sb.AppendLine($"  Rotation.Type   = {node.RotationValues.Type.Value}");
			sb.AppendLine($"    Angle Z (deg) = {node.RotationValues.PVA.Rotation.Z.Min}..{node.RotationValues.PVA.Rotation.Z.Max}");
			sb.AppendLine($"    Speed Z (deg) = {node.RotationValues.PVA.Velocity.Z.Min}..{node.RotationValues.PVA.Velocity.Z.Max}");
			sb.AppendLine($"  Drawing.Type    = {node.DrawingValues.Type.Value}");
			sb.AppendLine($"  Billboard       = {node.DrawingValues.Sprite.Billboard.Value}");
			sb.AppendLine($"  ColorAll.Type   = {color.Type.Value}  space={color.Easing.Start.ColorSpace}");
			sb.AppendLine($"    Start HSVA    = H {color.Easing.Start.R.Min}..{color.Easing.Start.R.Max}  S {color.Easing.Start.G.Min}..{color.Easing.Start.G.Max}  V {color.Easing.Start.B.Min}..{color.Easing.Start.B.Max}  A {color.Easing.Start.A.Min}..{color.Easing.Start.A.Max}");
			sb.AppendLine($"    End   HSVA    = H {color.Easing.End.R.Min}..{color.Easing.End.R.Max}  A {color.Easing.End.A.Min}..{color.Easing.End.A.Max}");
			sb.AppendLine($"  AlphaBlend      = {node.RendererCommonValues.AlphaBlend.Value}");
			sb.AppendLine($"  ColorTexture    = {node.RendererCommonValues.ColorTexture.RelativePath}");
			return sb.ToString();
		}
	}

	// -------------------------------------------------------- 発生ノード (親)
	// 描画しない。粒 1 つにつき 1 インスタンスできて、その粒の「発生した場所」を持つ。
	//
	// 発生位置を子から分けているのは、子で使う「生成位置 = 円 + 回転を適用」が
	// 位置のオフセットまで一緒に回してしまうため。分けておけば、回るのは
	// 子の (常に 0 の) ローカル位置だけになり、発生位置は素直に効く。

	static void ApplySpawn(Node node, EffectSpec spec)
	{
		var cv = node.CommonValues;

		// 生成し続ける
		cv.MaxGeneration.Infinite.SetValue(true);
		cv.Removal.WhenLifeIsExtinct.SetValue(true);

		// 子 (粒) より先に消えないよう、寿命は粒の最大寿命に合わせる
		var maxLife = spec.Life + Math.Abs(spec.LifeVariance) / 2;
		SetRange(cv.Life, maxLife, 0, min: 1);

		// 1 秒あたりの発生数 → 何フレームおきに 1 個生成するか
		var rate = Math.Max(spec.EmitRate, 0.01f);
		SetRange(cv.Generation.GenerationTime, 60f / rate, 0f, min: 0.0001f);

		// 再生側がエフェクトを動かしたとき、この粒が付いてくるかどうか。
		// Effekseer の既定は「常に」なので、何もしないと軌跡が残らない。
		cv.LocationEffectType.SetValue(spec.LocationBind == "always"
			? TranslationParentEffectType.Already
			: TranslationParentEffectType.WhenCreating);

		node.DrawingValues.Type.SetValue(RendererValues.ParamaterType.None);

		// 発生位置と、そのばらつき (矩形)
		node.LocationValues.Type.SetValue(LocationValues.ParamaterType.PVA);
		var pva = node.LocationValues.PVA;
		SetRange(pva.Location.X, spec.EmitterX, spec.SpawnRangeX);
		SetRange(pva.Location.Y, spec.EmitterY, spec.SpawnRangeY);
		SetRange(pva.Location.Z, 0f, 0f);
	}

	// ---------------------------------------------------------- 粒ノード (子)

	static void ApplyParticle(Node node, EffectSpec spec, string texturePath)
	{
		var cv = node.CommonValues;

		// 親 1 つにつき 1 粒。親が湧いた瞬間に出る。
		cv.MaxGeneration.Infinite.SetValue(false);
		cv.MaxGeneration.Value.SetValue(1);
		SetRange(cv.Generation.GenerationTime, 1f, 0f, min: 0.0001f);
		SetRange(cv.Life, spec.Life, spec.LifeVariance, min: 1);
		cv.Removal.WhenLifeIsExtinct.SetValue(true);
		cv.LocationEffectType.SetValue(TranslationParentEffectType.Already);

		ApplyEmission(node, spec);
		ApplyForces(node, spec);
		ApplyScale(node, spec);
		ApplyRotation(node, spec);
		ApplyRenderer(node, spec, texturePath);
	}

	/// <summary>
	/// 初速。「方向 ± 広がり」の扇形を、生成位置の円 (半径 0) と「回転を適用」で作る。
	///
	/// この設定にすると粒ごとに Z 軸まわりの回転が入るので、局所 +Y 方向へ出した
	/// 初速がその向きへ回る。速度の大きさは向きに依らず一定に保たれる
	/// (軸ごとの min/max しか持たない PVA では扇形を表せない)。
	/// </summary>
	static void ApplyEmission(Node node, EffectSpec spec)
	{
		var generation = node.GenerationLocationValues;
		generation.Type.SetValue(GenerationLocationValues.ParameterType.Circle);
		generation.EffectsRotation.SetValue(true);

		var circle = generation.Circle;
		circle.AxisDirection.SetValue(AxisType.ZAxis);
		circle.Type.SetValue(GenerationLocationValues.CircleType.Random);
		// 分割数で角度を刻まれると向きが飛び飛びになるので 1 にして、
		// 連続な「角度のゆらぎ」のほうでばらつかせる
		circle.Division.SetValue(1);
		SetRange(circle.Radius, 0f, 0f);

		// 円の角度は 0 が +Y (画面の上)。こちらの「方向」は 0 が +X なので 90 度ずらす。
		// 回る向きはどちらも反時計回りで一致している。
		var center = spec.Direction - 90f;
		SetRange(circle.AngleStart, center, 0f);
		SetRange(circle.AngleEnd, center, 0f);
		SetRange(circle.AngleNoize, 0f, Math.Clamp(spec.DirectionVariance, 0f, 360f));

		node.LocationValues.Type.SetValue(LocationValues.ParamaterType.PVA);
		var pva = node.LocationValues.PVA;

		// 位置は親 (発生ノード) が持っている。ここは 0。
		SetRange(pva.Location.X, 0f, 0f);
		SetRange(pva.Location.Y, 0f, 0f);
		SetRange(pva.Location.Z, 0f, 0f);

		// 局所 +Y へ出す。向きは上の回転が担当する。
		SetRange(pva.Velocity.X, 0f, 0f);
		SetRange(pva.Velocity.Y, spec.Speed, spec.SpeedVariance, min: 0f);
		SetRange(pva.Velocity.Z, 0f, 0f);
	}

	/// <summary>重力と空気抵抗。どちらもワールド空間の力として与える。</summary>
	static void ApplyForces(Node node, EffectSpec spec)
	{
		if (spec.Gravity > 0f)
		{
			var ff = node.LocationAbsValues.LocalForceField1;
			ff.Type.SetValue(LocalForceFieldType.Gravity);
			var rad = spec.GravityDirection * MathF.PI / 180f;
			ff.Gravity.Gravity.X.SetValue(MathF.Cos(rad) * spec.Gravity);
			ff.Gravity.Gravity.Y.SetValue(MathF.Sin(rad) * spec.Gravity);
			ff.Gravity.Gravity.Z.SetValue(0f);
		}

		if (spec.Drag > 0f)
		{
			var ff = node.LocationAbsValues.LocalForceField2;
			ff.Type.SetValue(LocalForceFieldType.Drag);
			ff.Power.SetValue(spec.Drag);
		}
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

	/// <summary>回転のパラメータが 1 つでも使われているか。</summary>
	static bool UsesRotation(EffectSpec spec) =>
		spec.Rotation != 0f || spec.RotationVariance != 0f
		|| spec.RotationSpeed != 0f || spec.RotationSpeedVariance != 0f;

	// ------------------------------------------------------------ 描画 / 色

	static void ApplyRenderer(Node node, EffectSpec spec, string texturePath)
	{
		node.DrawingValues.Type.SetValue(RendererValues.ParamaterType.Sprite);

		// 素の「ビルボード」はカメラを向くだけでノードの回転を丸ごと捨てる。
		// 「回転ビルボード」はカメラを向いたうえで Z 軸回転が乗る。
		//
		// 放射のために入れている生成位置の回転もここに乗ってしまうので、回転を
		// 使っていないときは素のビルボードにして、粒が画面に対して立ったままに
		// なるようにしておく。回転を使うときは「進行方向からの角度」になる。
		node.DrawingValues.Sprite.Billboard.SetValue(UsesRotation(spec)
			? RendererValues.BillboardType.RotatedBillboard
			: RendererValues.BillboardType.Billboard);

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
