using System.Text.Json;

namespace ParticleEdit;

/// <summary>
/// 書き出した ZIP に同梱する目録 (effect.json)。
///
/// エフェクトのバイナリには動的パラメータの「名前」が残らない (既定値と
/// コンパイル済みのコードだけ) ので、名前と入力番号の対応はここで配る。
/// 軌道もここに一覧が出る。組み込み先はこれを読めば、何を差し込めるのかと、
/// どの軌道が入っているのかが分かる。
///
/// 座標は組み込み先の流儀に合わせて「画面中央が原点 / +Y が画面下方向 / ピクセル」。
/// エディタ内部は +Y が上なので、ここへ書き出すときに反転している。
/// </summary>
public static class ExportManifest
{
	// 吉里吉里プラグインはこの名前を決め打ちで読む。特定のツール名は付けない。
	public const string FileName = "effect.json";
	public const string MotionDirectory = "motion";

	static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
	{
		WriteIndented = true,
	};

	/// <summary>同梱するものが何も無ければ true。目録ごと省ける。</summary>
	public static bool IsEmpty(EffectSpec spec) =>
		spec.EmitterMotion != "dynamic" && spec.Motions.Count == 0;

	public static byte[] Build(EffectSpec spec, string effectEntry)
	{
		var manifest = new Dictionary<string, object?>
		{
			["format"] = 1,
			["effect"] = effectEntry,
			["emitterMotion"] = spec.EmitterMotion,
		};

		if (spec.EmitterMotion == "dynamic")
		{
			// 発生位置を差し込むための入力。名前で引けるようにするための対応表。
			manifest["dynamicInputs"] = new[]
			{
				new { index = EffectBuilder.DynamicInputX, name = $"{EffectBuilder.DynamicEquationName}.x" },
				new { index = EffectBuilder.DynamicInputY, name = $"{EffectBuilder.DynamicEquationName}.y" },
			};
		}

		if (spec.EmitterMotion == "baked" && spec.MotionName.Length > 0)
		{
			manifest["bakedMotion"] = spec.MotionName;
		}

		if (spec.Motions.Count > 0)
		{
			manifest["motions"] = spec.Motions
				.Where(m => m.IsUsable)
				.Select(m => new
				{
					name = m.Name,
					file = MotionPath(m),
					frames = m.Frames,
					loop = m.Loop,
				})
				.ToArray();
		}

		return JsonSerializer.SerializeToUtf8Bytes(manifest, Json);
	}

	public static string MotionPath(MotionSpec motion) =>
		$"{MotionDirectory}/{motion.Name}.json";

	/// <summary>軌道 1 本ぶん。組み込み先が読んで発生位置に流し込む前提の形。</summary>
	public static byte[] BuildMotion(MotionSpec motion)
	{
		var body = new
		{
			name = motion.Name,
			frames = motion.Frames,
			loop = motion.Loop,
			// f = フレーム、x / y = 画面中央からのピクセル (y は下向き)
			points = motion.Points
				.OrderBy(p => p.Frame)
				.Select(p => new { f = p.Frame, x = p.X, y = -p.Y })
				.ToArray(),
		};
		return JsonSerializer.SerializeToUtf8Bytes(body, Json);
	}
}
