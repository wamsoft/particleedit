namespace ParticleEdit;

/// <summary>
/// 組み込みのパーティクル用テクスチャを実行時に生成する。
/// Effekseer はテクスチャベースなので、Particle Develop のベクター図形に相当するものを
/// あらかじめラスタライズして持っておく必要がある。
/// 色は白 (RGB=255) 固定で、着色はエフェクト側の頂点カラーで行う。
/// </summary>
public static class ShapeTextures
{
	const int Size = 128;

	public static IReadOnlyList<string> Names { get; } = new[]
	{
		"blur_circle", "circle", "ring", "star", "square",
	};

	static readonly Dictionary<string, byte[]> Cache = new();

	/// <summary>未知の名前が来ても落ちないように、組み込みの形状名へ丸める。</summary>
	public static string Resolve(string? name)
		=> name != null && Names.Contains(name) ? name : Names[0];

	public static byte[] GetPng(string name)
	{
		lock (Cache)
		{
			if (Cache.TryGetValue(name, out var cached)) return cached;
			var png = Png.Encode(Size, Size, Render(name));
			Cache[name] = png;
			return png;
		}
	}

	static byte[] Render(string name)
	{
		var rgba = new byte[Size * Size * 4];
		const float half = Size / 2f;

		for (var y = 0; y < Size; y++)
		{
			for (var x = 0; x < Size; x++)
			{
				// 中心を原点、半径 1.0 に正規化した座標
				var nx = (x + 0.5f - half) / half;
				var ny = (y + 0.5f - half) / half;
				var alpha = name switch
				{
					"blur_circle" => BlurCircle(nx, ny),
					"circle" => Circle(nx, ny),
					"ring" => Ring(nx, ny),
					"star" => Star(nx, ny),
					"square" => Square(nx, ny),
					_ => BlurCircle(nx, ny),
				};

				var i = (y * Size + x) * 4;
				rgba[i + 0] = 255;
				rgba[i + 1] = 255;
				rgba[i + 2] = 255;
				rgba[i + 3] = (byte)Math.Clamp((int)MathF.Round(alpha * 255f), 0, 255);
			}
		}

		return rgba;
	}

	// 中心が濃く外周へ滑らかに消える、いちばん汎用的な粒
	static float BlurCircle(float x, float y)
	{
		var d = MathF.Sqrt(x * x + y * y);
		if (d >= 1f) return 0f;
		var t = 1f - d;
		return t * t; // 二乗で中心寄りに寄せる
	}

	static float Circle(float x, float y)
	{
		var d = MathF.Sqrt(x * x + y * y);
		return Aa(0.92f - d);
	}

	static float Ring(float x, float y)
	{
		var d = MathF.Sqrt(x * x + y * y);
		return Aa(0.92f - d) * Aa(d - 0.6f);
	}

	static float Star(float x, float y)
	{
		// 5 芒星: 極座標で内接半径と外接半径を交互に取る
		var d = MathF.Sqrt(x * x + y * y);
		if (d < 1e-5f) return 1f;
		var a = MathF.Atan2(y, x) + MathF.PI / 2f; // 頂点を上に
		const float points = 5f;
		var seg = a * points / (MathF.PI * 2f);
		var frac = seg - MathF.Floor(seg);
		var tri = MathF.Abs(frac - 0.5f) * 2f;   // 0..1 の三角波
		var radius = 0.42f + 0.5f * tri;         // 内接 0.42 / 外接 0.92
		return Aa(radius - d);
	}

	static float Square(float x, float y)
	{
		var d = MathF.Max(MathF.Abs(x), MathF.Abs(y));
		return Aa(0.85f - d);
	}

	/// <summary>境界を数ピクセルぶんだけなめらかにする</summary>
	static float Aa(float signedDistance)
	{
		const float w = 2f / Size * 1.5f;
		return Math.Clamp(signedDistance / w + 0.5f, 0f, 1f);
	}
}
