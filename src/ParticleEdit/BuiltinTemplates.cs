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
			EmitRate = 70, SpawnRangeX = 26, SpawnRangeY = 8,
			Speed = 1.8f, SpeedVariance = 1.2f, Direction = 90, DirectionVariance = 34,
			Gravity = 0.03f, GravityDirection = 90, Drag = 0.02f,
			Life = 45, LifeVariance = 24,
			StartSize = 46, StartSizeVariance = 18, EndSize = 0, EndSizeVariance = 0,
			Hue = 24, HueVariance = 34, Saturation = 95, SaturationVariance = 10,
			Brightness = 100, StartAlpha = 0.9f, EndAlpha = 0,
			Blend = "add", Shape = "blur_circle",
		}),

		("噴水", new EffectSpec
		{
			EmitRate = 40, Speed = 3, SpeedVariance = 1.5f,
			Direction = 90, DirectionVariance = 40,
			Gravity = 0.06f, GravityDirection = 270,
			Life = 70, LifeVariance = 30,
			StartSize = 28, StartSizeVariance = 12, EndSize = 0,
			Hue = 200, HueVariance = 30, Saturation = 70, Brightness = 100,
			Blend = "add", Shape = "blur_circle",
		}),

		("爆発", new EffectSpec
		{
			EmitRate = 300, SpawnRangeX = 20, SpawnRangeY = 20,
			Speed = 8, SpeedVariance = 7, Direction = 90, DirectionVariance = 360,
			Gravity = 0.05f, GravityDirection = 270, Drag = 0.07f,
			Life = 40, LifeVariance = 24,
			StartSize = 34, StartSizeVariance = 16, EndSize = 0,
			Hue = 18, HueVariance = 40, Saturation = 95, Brightness = 100,
			Blend = "add", Shape = "blur_circle",
		}),

		("雪", new EffectSpec
		{
			EmitRate = 30, SpawnRangeX = 900, SpawnRangeY = 20,
			Speed = 0.7f, SpeedVariance = 0.5f, Direction = 270, DirectionVariance = 50,
			Gravity = 0.004f, GravityDirection = 270, Drag = 0.02f,
			Life = 240, LifeVariance = 60,
			StartSize = 9, StartSizeVariance = 6, EndSize = 9, EndSizeVariance = 6,
			Hue = 210, HueVariance = 20, Saturation = 12, Brightness = 100,
			StartAlpha = 0.9f, EndAlpha = 0,
			Blend = "blend", Shape = "circle",
		}),

		("煙", new EffectSpec
		{
			EmitRate = 22, SpawnRangeX = 36, SpawnRangeY = 10,
			Speed = 1.1f, SpeedVariance = 0.6f, Direction = 90, DirectionVariance = 26,
			Gravity = 0.006f, GravityDirection = 90, Drag = 0.025f,
			Life = 130, LifeVariance = 50,
			StartSize = 34, StartSizeVariance = 14, EndSize = 96, EndSizeVariance = 30,
			Hue = 30, HueVariance = 10, Saturation = 6, Brightness = 45,
			StartAlpha = 0.45f, EndAlpha = 0,
			Blend = "blend", Shape = "blur_circle",
		}),

		("きらめき", new EffectSpec
		{
			EmitRate = 26, SpawnRangeX = 460, SpawnRangeY = 320,
			Speed = 0.25f, SpeedVariance = 0.25f, Direction = 90, DirectionVariance = 360,
			Gravity = 0, Drag = 0,
			Life = 46, LifeVariance = 30,
			StartSize = 26, StartSizeVariance = 14, EndSize = 0,
			Hue = 48, HueVariance = 70, Saturation = 60, SaturationVariance = 40,
			Brightness = 100, Blend = "add", Shape = "star",
		}),

		("星屑", new EffectSpec
		{
			EmitRate = 55, SpawnRangeX = 40, SpawnRangeY = 40,
			Speed = 2.2f, SpeedVariance = 1.8f, Direction = 90, DirectionVariance = 360,
			Gravity = 0.02f, GravityDirection = 270, Drag = 0.03f,
			Life = 90, LifeVariance = 40,
			StartSize = 18, StartSizeVariance = 10, EndSize = 0,
			Hue = 45, HueVariance = 40, Saturation = 80, Brightness = 100,
			Blend = "add", Shape = "star",
		}),

		("泡", new EffectSpec
		{
			EmitRate = 18, SpawnRangeX = 620, SpawnRangeY = 30,
			Speed = 1.1f, SpeedVariance = 0.7f, Direction = 90, DirectionVariance = 22,
			Gravity = 0.004f, GravityDirection = 90, Drag = 0.03f,
			Life = 200, LifeVariance = 70,
			StartSize = 22, StartSizeVariance = 14, EndSize = 26, EndSizeVariance = 14,
			Hue = 190, HueVariance = 34, Saturation = 45, Brightness = 100,
			StartAlpha = 0.75f, EndAlpha = 0,
			Blend = "blend", Shape = "ring",
		}),

		("リング波", new EffectSpec
		{
			EmitRate = 5, Speed = 0, SpeedVariance = 0,
			Direction = 90, DirectionVariance = 0, Gravity = 0, Drag = 0,
			Life = 55, LifeVariance = 10,
			StartSize = 14, StartSizeVariance = 0, EndSize = 230, EndSizeVariance = 40,
			Hue = 190, HueVariance = 16, Saturation = 70, Brightness = 100,
			StartAlpha = 0.85f, EndAlpha = 0,
			Blend = "add", Shape = "ring",
		}),

		("紙吹雪", new EffectSpec
		{
			EmitRate = 45, SpawnRangeX = 820, SpawnRangeY = 20,
			Speed = 2.2f, SpeedVariance = 2f, Direction = 270, DirectionVariance = 90,
			Gravity = 0.03f, GravityDirection = 270, Drag = 0.025f,
			Life = 160, LifeVariance = 60,
			StartSize = 13, StartSizeVariance = 7, EndSize = 13, EndSizeVariance = 7,
			Hue = 0, HueVariance = 360, Saturation = 90, Brightness = 100,
			Blend = "blend", Shape = "square",
		}),

		("光の玉", new EffectSpec
		{
			EmitRate = 9, SpawnRangeX = 120, SpawnRangeY = 90,
			Speed = 0.5f, SpeedVariance = 0.4f, Direction = 90, DirectionVariance = 360,
			Gravity = 0.004f, GravityDirection = 90, Drag = 0.01f,
			Life = 130, LifeVariance = 50,
			StartSize = 66, StartSizeVariance = 30, EndSize = 0,
			Hue = 285, HueVariance = 50, Saturation = 55, Brightness = 100,
			StartAlpha = 0.8f, EndAlpha = 0,
			Blend = "add", Shape = "blur_circle",
		}),

		("魔法の粉", new EffectSpec
		{
			EmitRate = 80, SpawnRangeX = 220, SpawnRangeY = 220,
			Speed = 0.9f, SpeedVariance = 0.8f, Direction = 90, DirectionVariance = 360,
			Gravity = 0.008f, GravityDirection = 90, Drag = 0.02f,
			Life = 95, LifeVariance = 45,
			StartSize = 16, StartSizeVariance = 9, EndSize = 0,
			Hue = 150, HueVariance = 90, Saturation = 75, SaturationVariance = 25,
			Brightness = 100, Blend = "add", Shape = "star",
		}),
	};

	public static EffectSpec? Find(string name)
	{
		foreach (var (n, spec) in All)
		{
			if (n == name) return spec;
		}
		return null;
	}
}
