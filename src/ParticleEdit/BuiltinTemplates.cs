namespace ParticleEdit;

/// <summary>
/// 組み込みのテンプレート。ユーザーが追加したテンプレート
/// (<see cref="ProjectStore"/> の templates 側) と一つのリストにして提示する。
///
/// ここはパラメータの塊でしかないので、ファイルではなくコードで持っている。
/// 「気に入った状態をテンプレートに追加」で作られるものはユーザー側に入る。
/// </summary>
public static class BuiltinTemplates
{
	public static readonly IReadOnlyList<(string Name, EffectSpec Spec)> All = new (string, EffectSpec)[]
	{
		("炎", new EffectSpec
		{
			EmitRate = 150, SpawnRangeX = 60, SpawnRangeY = 20,
			Speed = 3.2f, SpeedVariance = 2.2f, Direction = 90, DirectionVariance = 34,
			Gravity = 0.03f, GravityDirection = 90, Drag = 0.02f,
			Life = 45, LifeVariance = 24,
			StartSize = 120, StartSizeVariance = 45, EndSize = 0, EndSizeVariance = 0,
			Hue = 24, HueVariance = 34, Saturation = 95, SaturationVariance = 10,
			Brightness = 100, StartAlpha = 0.9f, EndAlpha = 0,
			Blend = "add", Shape = Shapes.BlurCircle,
		}),

		("噴水", new EffectSpec
		{
			EmitRate = 110, Speed = 5.5f, SpeedVariance = 3f,
			Direction = 90, DirectionVariance = 40,
			Gravity = 0.06f, GravityDirection = 270,
			Life = 70, LifeVariance = 30,
			StartSize = 64, StartSizeVariance = 26, EndSize = 0,
			Hue = 200, HueVariance = 30, Saturation = 70, Brightness = 100,
			Blend = "add", Shape = Shapes.BlurCircle,
		}),

		("爆発", new EffectSpec
		{
			EmitRate = 300, SpawnRangeX = 34, SpawnRangeY = 34,
			Speed = 14, SpeedVariance = 11, Direction = 90, DirectionVariance = 360,
			Gravity = 0.05f, GravityDirection = 270, Drag = 0.07f,
			Life = 40, LifeVariance = 24,
			StartSize = 86, StartSizeVariance = 38, EndSize = 0,
			Hue = 18, HueVariance = 40, Saturation = 95, Brightness = 100,
			Blend = "add", Shape = Shapes.BlurCircle,
		}),

		("雪", new EffectSpec
		{
			EmitRate = 55, SpawnRangeX = 1280, SpawnRangeY = 20,
			Speed = 1.1f, SpeedVariance = 0.8f, Direction = 270, DirectionVariance = 50,
			Gravity = 0.004f, GravityDirection = 270, Drag = 0.02f,
			Life = 240, LifeVariance = 60,
			StartSize = 24, StartSizeVariance = 14, EndSize = 24, EndSizeVariance = 14,
			Hue = 210, HueVariance = 20, Saturation = 12, Brightness = 100,
			StartAlpha = 0.9f, EndAlpha = 0,
			Blend = "blend", Shape = Shapes.Circle,
		}),

		("煙", new EffectSpec
		{
			EmitRate = 34, SpawnRangeX = 70, SpawnRangeY = 20,
			Speed = 1.8f, SpeedVariance = 1f, Direction = 90, DirectionVariance = 26,
			Gravity = 0.006f, GravityDirection = 90, Drag = 0.025f,
			Life = 130, LifeVariance = 50,
			StartSize = 90, StartSizeVariance = 34, EndSize = 280, EndSizeVariance = 90,
			Hue = 30, HueVariance = 10, Saturation = 6, Brightness = 45,
			StartAlpha = 0.45f, EndAlpha = 0,
			Blend = "blend", Shape = Shapes.BlurCircle,
		}),

		("きらめき", new EffectSpec
		{
			EmitRate = 45, SpawnRangeX = 1120, SpawnRangeY = 600,
			Speed = 0.25f, SpeedVariance = 0.25f, Direction = 90, DirectionVariance = 360,
			Gravity = 0, Drag = 0,
			Life = 46, LifeVariance = 30,
			StartSize = 62, StartSizeVariance = 34, EndSize = 0,
			RotationVariance = 360,
				Hue = 48, HueVariance = 70, Saturation = 60, SaturationVariance = 40,
			Brightness = 100, Blend = "add", Shape = Shapes.Star,
		}),

		("星屑", new EffectSpec
		{
			EmitRate = 120, SpawnRangeX = 70, SpawnRangeY = 70,
			Speed = 3.6f, SpeedVariance = 3f, Direction = 90, DirectionVariance = 360,
			Gravity = 0.02f, GravityDirection = 270, Drag = 0.03f,
			Life = 90, LifeVariance = 40,
			StartSize = 46, StartSizeVariance = 24, EndSize = 0,
			RotationVariance = 360, RotationSpeed = 2, RotationSpeedVariance = 4,
				Hue = 45, HueVariance = 40, Saturation = 80, Brightness = 100,
			Blend = "add", Shape = Shapes.Star,
		}),

		("泡", new EffectSpec
		{
			EmitRate = 30, SpawnRangeX = 1200, SpawnRangeY = 40,
			Speed = 1.7f, SpeedVariance = 1.1f, Direction = 90, DirectionVariance = 22,
			Gravity = 0.004f, GravityDirection = 90, Drag = 0.03f,
			Life = 200, LifeVariance = 70,
			StartSize = 52, StartSizeVariance = 32, EndSize = 60, EndSizeVariance = 32,
			Hue = 190, HueVariance = 34, Saturation = 45, Brightness = 100,
			StartAlpha = 0.75f, EndAlpha = 0,
			Blend = "blend", Shape = Shapes.Ring,
		}),

		("リング波", new EffectSpec
		{
			EmitRate = 6, Speed = 0, SpeedVariance = 0,
			Direction = 90, DirectionVariance = 0, Gravity = 0, Drag = 0,
			Life = 55, LifeVariance = 10,
			StartSize = 30, StartSizeVariance = 0, EndSize = 560, EndSizeVariance = 90,
			Hue = 190, HueVariance = 16, Saturation = 70, Brightness = 100,
			StartAlpha = 0.85f, EndAlpha = 0,
			Blend = "add", Shape = Shapes.Ring,
		}),

		("紙吹雪", new EffectSpec
		{
			EmitRate = 75, SpawnRangeX = 1280, SpawnRangeY = 30,
			Speed = 3.4f, SpeedVariance = 3f, Direction = 270, DirectionVariance = 90,
			Gravity = 0.03f, GravityDirection = 270, Drag = 0.025f,
			Life = 160, LifeVariance = 60,
			StartSize = 30, StartSizeVariance = 16, EndSize = 30, EndSizeVariance = 16,
			RotationVariance = 360, RotationSpeedVariance = 16,
				Hue = 0, HueVariance = 360, Saturation = 90, Brightness = 100,
			Blend = "blend", Shape = Shapes.Square,
		}),

		("光の玉", new EffectSpec
		{
			EmitRate = 16, SpawnRangeX = 280, SpawnRangeY = 200,
			Speed = 0.5f, SpeedVariance = 0.4f, Direction = 90, DirectionVariance = 360,
			Gravity = 0.004f, GravityDirection = 90, Drag = 0.01f,
			Life = 130, LifeVariance = 50,
			StartSize = 170, StartSizeVariance = 80, EndSize = 0,
			Hue = 285, HueVariance = 50, Saturation = 55, Brightness = 100,
			StartAlpha = 0.8f, EndAlpha = 0,
			Blend = "add", Shape = Shapes.BlurCircle,
		}),

		("魔法の粉", new EffectSpec
		{
			EmitRate = 150, SpawnRangeX = 520, SpawnRangeY = 460,
			Speed = 1.4f, SpeedVariance = 1.2f, Direction = 90, DirectionVariance = 360,
			Gravity = 0.008f, GravityDirection = 90, Drag = 0.02f,
			Life = 95, LifeVariance = 45,
			StartSize = 42, StartSizeVariance = 22, EndSize = 0,
			RotationVariance = 360, RotationSpeedVariance = 6,
				Hue = 150, HueVariance = 90, Saturation = 75, SaturationVariance = 25,
			Brightness = 100, Blend = "add", Shape = Shapes.Star,
		}),
	};

	/// <summary>組み込みテンプレートが使う形。ShapeRenderer.Presets から引く。</summary>
	static class Shapes
	{
		static ShapeSpec Of(string name)
		{
			foreach (var (n, shape) in ShapeRenderer.Presets)
			{
				// テンプレートごとに調整できるよう複製して渡す
				if (n == name) return Copy(shape);
			}
			return new ShapeSpec();
		}

		static ShapeSpec Copy(ShapeSpec s) => new()
		{
			Type = s.Type, Sides = s.Sides, StarRatio = s.StarRatio, Hole = s.Hole,
			Blur = s.Blur, Falloff = s.Falloff, Rotation = s.Rotation, Scale = s.Scale,
			ImageId = s.ImageId,
		};

		public static ShapeSpec BlurCircle => Of("ぼかし円");
		public static ShapeSpec Circle => Of("円");
		public static ShapeSpec Ring => Of("リング");
		public static ShapeSpec Star => Of("星");
		public static ShapeSpec Square => Of("四角");
	}

	public static EffectSpec? Find(string name)
	{
		foreach (var (n, spec) in All)
		{
			if (n == name) return spec;
		}
		return null;
	}
}
