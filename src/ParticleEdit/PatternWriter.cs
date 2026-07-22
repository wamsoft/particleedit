using System.IO.Compression;
using System.Text;
using System.Text.Json;

namespace ParticleEdit;

/// <summary>
/// ブラウザが焼いたコマ (RGBA) を、配布できる形にまとめる。
///
/// コマそのものはブラウザ側で作る。エフェクトを描けるのが effekseer.js しか無く、
/// それが WebGL の上でしか動かないため。ここは受け取ったビットマップを
/// 並べたり詰めたりするだけ。
/// </summary>
public static class PatternWriter
{
	public sealed record Result(string FileName, byte[] Bytes, string Note);

	public static Result Write(PatternRequest request, IReadOnlyList<byte[]> frames)
	{
		var name = ProjectStore.IsValidName(request.Name) ? request.Name : "effect";

		return request.Format switch
		{
			"amv" => WriteAmv(request, frames, name),
			"frames" => WriteFrames(request, frames, name),
			_ => WriteSheet(request, frames, name),
		};
	}

	// ------------------------------------------------------------ シート 1 枚

	static Result WriteSheet(PatternRequest request, IReadOnlyList<byte[]> frames, string name)
	{
		var columns = Math.Clamp(request.Columns, 1, frames.Count);
		var rows = (frames.Count + columns - 1) / columns;
		var sheetWidth = columns * request.Width;
		var sheetHeight = rows * request.Height;

		var sheet = new byte[sheetWidth * sheetHeight * 4];
		for (var i = 0; i < frames.Count; i++)
		{
			var originX = i % columns * request.Width;
			var originY = i / columns * request.Height;
			for (var y = 0; y < request.Height; y++)
			{
				Array.Copy(
					frames[i], y * request.Width * 4,
					sheet, ((originY + y) * sheetWidth + originX) * 4,
					request.Width * 4);
			}
		}

		var png = Png.Encode(sheetWidth, sheetHeight, sheet);
		var bytes = Zip(zip =>
		{
			AddEntry(zip, $"{name}.png", png);
			AddEntry(zip, "pattern.json", Manifest(request, frames.Count, columns, rows));
		});

		return new Result($"{name}-sheet.zip", bytes,
			$"{columns}×{rows} コマ / {sheetWidth}×{sheetHeight} px");
	}

	// -------------------------------------------------------------- 連番 PNG

	static Result WriteFrames(PatternRequest request, IReadOnlyList<byte[]> frames, string name)
	{
		var bytes = Zip(zip =>
		{
			for (var i = 0; i < frames.Count; i++)
				AddEntry(zip, $"{name}{i:0000}.png", Png.Encode(request.Width, request.Height, frames[i]));
			AddEntry(zip, "pattern.json", Manifest(request, frames.Count, 1, frames.Count));
		});

		return new Result($"{name}-frames.zip", bytes, $"{frames.Count} 枚");
	}

	// -------------------------------------------------------------- .amv

	static Result WriteAmv(PatternRequest request, IReadOnlyList<byte[]> frames, string name)
	{
		var bytes = AmvEncoder.Encode(frames, request.Width, request.Height, request.Fps, request.Quality);
		return new Result($"{name}.amv", bytes,
			$"{frames.Count} コマ / {request.Width}×{request.Height} px / {bytes.Length / 1024} KB");
	}

	// ---------------------------------------------------------------- 目録

	/// <summary>組み込み先が読む用。コマの並びと、エディタ上のどこを写したかを書く。</summary>
	static byte[] Manifest(PatternRequest request, int count, int columns, int rows)
	{
		var manifest = new
		{
			frameWidth = request.Width,
			frameHeight = request.Height,
			frameCount = count,
			columns,
			rows,
			fps = request.Fps,
			// 何フレームおきに 1 コマ焼いたか。周期はエディタのフレーム数。
			step = request.Step,
			periodFrames = request.PeriodFrames,
			// コマの中心がエディタのどの座標にあたるか (画面中央が原点 / +Y は画面上方向)
			centerX = request.CenterX,
			centerY = request.CenterY,
			blend = request.Blend,
			alpha = "straight",
			loop = true,
		};

		var json = JsonSerializer.Serialize(manifest,
			new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true });
		return Encoding.UTF8.GetBytes(json);
	}

	// ---------------------------------------------------------------- ヘルパ

	static byte[] Zip(Action<ZipArchive> fill)
	{
		using var ms = new MemoryStream();
		using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true)) fill(zip);
		return ms.ToArray();
	}

	static void AddEntry(ZipArchive zip, string path, byte[] bytes)
	{
		using var s = zip.CreateEntry(path, CompressionLevel.Optimal).Open();
		s.Write(bytes, 0, bytes.Length);
	}
}

/// <summary>アニメパターン書き出しの注文。ブラウザから JSON で来る。</summary>
public sealed class PatternRequest
{
	/// <summary>"sheet" (1 枚に並べる) / "frames" (連番) / "amv" (吉里吉里の AlphaMovie)</summary>
	public string Format { get; set; } = "sheet";

	public string Name { get; set; } = "effect";

	/// <summary>1 コマの大きさ (px)。</summary>
	public int Width { get; set; }
	public int Height { get; set; }

	/// <summary>シートに並べるときの横の枚数。</summary>
	public int Columns { get; set; } = 8;

	/// <summary>.amv のフレームレートと JPEG 品質。</summary>
	public int Fps { get; set; } = 60;
	public int Quality { get; set; } = 92;

	/// <summary>ループの周期 (フレーム) と、何フレームおきに 1 コマ焼いたか。</summary>
	public int PeriodFrames { get; set; }
	public int Step { get; set; } = 1;

	/// <summary>コマの中心にあたるエディタ上の座標。</summary>
	public float CenterX { get; set; }
	public float CenterY { get; set; }

	/// <summary>"add" / "blend"。組み込み先での合成方法の目安。</summary>
	public string Blend { get; set; } = "add";
}
