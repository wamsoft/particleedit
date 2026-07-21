namespace ParticleEdit;

/// <summary>
/// <see cref="ShapeSpec"/> からパーティクル用のテクスチャ (RGBA8 PNG) を作る。
/// 色は白固定で、着色はエフェクト側の頂点カラーが行う。
///
/// 形は「角度 θ ごとの境界までの半径 R(θ)」として表し、
/// 各ピクセルを d = r / R(θ) に正規化してから縁の処理をする。
/// こうすると円も多角形も星も同じ 1 本の式で扱える。
/// </summary>
public static class ShapeRenderer
{
	public const int Size = 128;

	/// <summary>UI に出す既定の形。名前と ShapeSpec の対。</summary>
	public static readonly IReadOnlyList<(string Name, ShapeSpec Shape)> Presets = new (string, ShapeSpec)[]
	{
		("ぼかし円", new ShapeSpec { Sides = 0, Blur = 1f, Falloff = 2f, Scale = 1f }),
		("円",       new ShapeSpec { Sides = 0, Blur = 0.08f, Falloff = 1f, Scale = 0.92f }),
		("リング",   new ShapeSpec { Sides = 0, Hole = 0.65f, Blur = 0.08f, Falloff = 1f, Scale = 0.92f }),
		("星",       new ShapeSpec { Sides = 5, StarRatio = 0.45f, Blur = 0.08f, Falloff = 1f, Rotation = 90f, Scale = 0.94f }),
		("四角",     new ShapeSpec { Sides = 4, Blur = 0.06f, Falloff = 1f, Rotation = 45f, Scale = 0.86f }),
		("六角",     new ShapeSpec { Sides = 6, Blur = 0.06f, Falloff = 1f, Rotation = 90f, Scale = 0.9f }),
		("光芒",     new ShapeSpec { Sides = 4, StarRatio = 0.06f, Blur = 0.35f, Falloff = 1.4f, Rotation = 90f, Scale = 1f }),
	};

	static readonly Dictionary<string, byte[]> Cache = new();

	/// <summary>取り込んだ画像。ID -> PNG のバイト列。</summary>
	static readonly Dictionary<string, byte[]> Images = new();

	public static void PutImage(string id, byte[] png)
	{
		lock (Cache) Images[id] = png;
	}

	public static bool HasImage(string id)
	{
		lock (Cache) return Images.ContainsKey(id);
	}

	public static byte[]? GetImage(string id)
	{
		lock (Cache) return Images.TryGetValue(id, out var bytes) ? bytes : null;
	}

	/// <summary>形の PNG を得る。同じ形なら焼き直さない。</summary>
	public static byte[] GetPng(ShapeSpec shape)
	{
		var key = shape.Key();
		lock (Cache)
		{
			if (Cache.TryGetValue(key, out var cached)) return cached;

			byte[] png;
			if (shape.Type == "image")
			{
				// 取り込んだ画像が行方不明なら、目印になる形にフォールバックする
				png = (shape.ImageId != null && Images.TryGetValue(shape.ImageId, out var image))
					? image
					: Render(Presets[2].Shape);
			}
			else
			{
				png = Render(shape);
			}

			Cache[key] = png;
			return png;
		}
	}

	/// <summary>ファイル名に使う名前。エフェクトのバイナリにこの相対パスが埋まる。</summary>
	public static string FileName(ShapeSpec shape) => $"particle_{shape.Key()}.png";

	// ------------------------------------------------------------------ 生成

	static byte[] Render(ShapeSpec shape)
	{
		var rgba = new byte[Size * Size * 4];
		const float half = Size / 2f;

		var vertices = BuildVertices(shape);
		var scale = Math.Clamp(shape.Scale, 0.05f, 1f);
		var hole = Math.Clamp(shape.Hole, 0f, 0.95f);
		var falloff = Math.Clamp(shape.Falloff, 0.1f, 8f);

		// 1 ピクセル分の幅。ぼかしを 0 にしてもジャギらない下限として使う
		const float aa = 1.5f / half;
		var width = MathF.Max(Math.Clamp(shape.Blur, 0f, 1f), aa);

		for (var y = 0; y < Size; y++)
		{
			for (var x = 0; x < Size; x++)
			{
				var nx = (x + 0.5f - half) / half;
				var ny = (y + 0.5f - half) / half;

				var r = MathF.Sqrt(nx * nx + ny * ny);
				// 画像の y は下向きなので、角度を数学の向き (反時計回り・90 度が上) へ直す。
				// こうすると「回転」スライダーが画面上の見た目と一致する。
				var boundary = BoundaryRadius(vertices, MathF.Atan2(-ny, nx)) * scale;
				var d = boundary > 1e-6f ? r / boundary : 999f;

				var outer = MathF.Pow(Math.Clamp((1f - d) / width, 0f, 1f), falloff);
				var inner = hole > 0f ? Math.Clamp((d - hole) / width, 0f, 1f) : 1f;
				var alpha = outer * inner;

				var i = (y * Size + x) * 4;
				rgba[i + 0] = 255;
				rgba[i + 1] = 255;
				rgba[i + 2] = 255;
				rgba[i + 3] = (byte)Math.Clamp((int)MathF.Round(alpha * 255f), 0, 255);
			}
		}

		return Png.Encode(Size, Size, rgba);
	}

	/// <summary>
	/// 多角形 / 星の頂点を作る。円 (Sides = 0) の場合は null を返し、R(θ) = 1 とする。
	/// 頂点は角度について等間隔に並ぶので、θ から所属する辺を直接求められる。
	/// </summary>
	static (float X, float Y)[]? BuildVertices(ShapeSpec shape)
	{
		if (shape.Sides < 3) return null;

		var sides = Math.Min(shape.Sides, 32);
		var star = Math.Clamp(shape.StarRatio, 0.02f, 1f);
		var rotation = shape.Rotation * MathF.PI / 180f;

		var isStar = star < 0.999f;
		var count = isStar ? sides * 2 : sides;
		var stepAngle = MathF.PI * 2f / count;

		var vertices = new (float X, float Y)[count];
		for (var i = 0; i < count; i++)
		{
			var angle = rotation + stepAngle * i;
			var radius = (isStar && i % 2 == 1) ? star : 1f;
			vertices[i] = (MathF.Cos(angle) * radius, MathF.Sin(angle) * radius);
		}
		return vertices;
	}

	/// <summary>角度 θ の向きに進んだとき、輪郭に当たるまでの距離。</summary>
	static float BoundaryRadius((float X, float Y)[]? vertices, float theta)
	{
		if (vertices == null) return 1f;

		var count = vertices.Length;
		var stepAngle = MathF.PI * 2f / count;

		// 頂点 0 の角度を基準に、θ がどの辺の区間にあるかを求める
		var baseAngle = MathF.Atan2(vertices[0].Y, vertices[0].X);
		var relative = theta - baseAngle;
		relative -= MathF.Floor(relative / (MathF.PI * 2f)) * (MathF.PI * 2f);
		var index = (int)MathF.Floor(relative / stepAngle) % count;

		var p = vertices[index];
		var q = vertices[(index + 1) % count];

		// 原点から方向 D への半直線と線分 PQ の交点までの距離
		var dx = MathF.Cos(theta);
		var dy = MathF.Sin(theta);
		var ex = q.X - p.X;
		var ey = q.Y - p.Y;

		var denominator = dx * ey - dy * ex;
		if (MathF.Abs(denominator) < 1e-9f) return 1f;

		return MathF.Abs((p.X * ey - p.Y * ex) / denominator);
	}
}
