using System.Buffers.Binary;
using System.IO.Compression;

namespace ParticleEdit;

/// <summary>
/// 吉里吉里の AlphaMovie プラグインが読む .amv (Alpha Movie) を書き出す。
///
/// 形式は krkrz_dev/src/plugins/AlphaMovie/AlphaMovie.cpp のデコーダに合わせてある。
/// あちらはオリジナル DLL の解析による再実装で、要点は次のとおり。
///
///   ヘッダ 'AJPM' + 量子化テーブル + 'FRAM' チャンクの列。
///   フレームには 2 経路あり、ここでは <b>zlib-alpha</b> のほうを書く。
///     ・アルファ … 8bit グレースケールを zlib で圧縮 (可逆)
///     ・色       … Cb, Cr, Y の 3 成分 4:2:0 ベースライン JPEG エントロピー
///
///   JPEG-alpha (アルファも JPEG に混ぜる) より作りが単純で、粒の縁が汚れない。
///
/// ふつうの JPEG と違うところ:
///
///   ・マーカーが一切無い。SOI も DQT も DHT も無く、エントロピー列がじかに入る。
///     量子化テーブルはファイルヘッダに、ハフマンテーブルは標準表の決め打ち。
///   ・<b>DC 予測子をハフマンテーブル単位で共有する</b>。つまり Cb と Cr が 1 本の
///     予測子を共有する (Y は自分だけ)。標準の JPEG は成分ごとに独立なので、
///     ここを間違えると色がずれていく。
///   ・幅・高さは 16 の倍数 (MCU 16x16) でなければならない。
/// </summary>
public static class AmvEncoder
{
	/// <summary>フレームの幅・高さに要求される倍数。</summary>
	public const int SizeUnit = 16;

	/// <param name="frames">
	/// 1 コマぶんの RGBA を並べたもの。左上が原点で、アルファは非乗算
	/// (吉里吉里のレイヤがそのまま受け取れる形)。
	/// </param>
	public static byte[] Encode(IReadOnlyList<byte[]> frames, int width, int height, int fps, int quality)
	{
		if (frames.Count == 0) throw new ArgumentException("コマがありません");
		if (width % SizeUnit != 0 || height % SizeUnit != 0)
			throw new ArgumentException($"幅と高さは {SizeUnit} の倍数にしてください");
		foreach (var frame in frames)
			if (frame.Length != width * height * 4) throw new ArgumentException("コマの大きさが合いません");

		var lumaQuant = ScaleQuantTable(BaseLuma, quality);
		var chromaQuant = ScaleQuantTable(BaseChroma, quality);

		// 先にコマを全部詰めてから、ヘッダの合計値を埋めて連結する
		var payloads = new List<byte[]>(frames.Count);
		for (var i = 0; i < frames.Count; i++)
			payloads.Add(EncodeFrame(frames[i], i, width, height, lumaQuant, chromaQuant));

		var frameTotal = payloads.Sum(p => p.Length);
		const int headerSize = 0x28 + 0x80;

		using var output = new MemoryStream(headerSize + frameTotal);
		var header = new byte[headerSize];
		header[0] = (byte)'A'; header[1] = (byte)'J'; header[2] = (byte)'P'; header[3] = (byte)'M';
		Put32(header, 0x04, (uint)(headerSize + frameTotal));   // ファイル全体の大きさ
		Put32(header, 0x08, 0);                                 // リビジョン (0 以外は弾かれる)
		Put32(header, 0x0c, headerSize);
		Put32(header, 0x10, (uint)frameTotal);                  // フレーム部の大きさ
		Put32(header, 0x14, (uint)frames.Count);
		Put32(header, 0x18, (uint)Math.Max(fps, 1));            // FPS = Scale / Rate
		Put32(header, 0x1c, 1);
		Put16(header, 0x20, (ushort)width);
		Put16(header, 0x22, (ushort)height);
		Put32(header, 0x24, 2);                                 // 2 = アルファは zlib

		// 量子化テーブルはジグザグ順で 64 バイトずつ。0 番が輝度、1 番が色差。
		lumaQuant.CopyTo(header.AsSpan(0x28));
		chromaQuant.CopyTo(header.AsSpan(0x28 + 64));

		output.Write(header);
		foreach (var payload in payloads) output.Write(payload);
		return output.ToArray();
	}

	// ------------------------------------------------------------------ 1 コマ

	static byte[] EncodeFrame(byte[] rgba, int number, int width, int height,
		byte[] lumaQuant, byte[] chromaQuant)
	{
		var y = new byte[width * height];
		var alpha = new byte[width * height];
		var cb = new byte[width / 2 * (height / 2)];
		var cr = new byte[width / 2 * (height / 2)];
		ToYCbCr(BleedColor(rgba, width, height), width, height, y, cb, cr, alpha);

		var alphaZlib = Deflate(alpha);
		var color = EncodeColorScan(y, cb, cr, width, height, lumaQuant, chromaQuant);

		// FRAM + size + number + left + top + w + h + アルファの長さ、のあとに
		// 「アルファ → 色」の順で中身が続く。size は number から後ろ全部。
		var chunk = new byte[24 + alphaZlib.Length + color.Length];
		chunk[0] = (byte)'F'; chunk[1] = (byte)'R'; chunk[2] = (byte)'A'; chunk[3] = (byte)'M';
		Put32(chunk, 0x04, (uint)(16 + alphaZlib.Length + color.Length));
		Put32(chunk, 0x08, (uint)number);
		Put16(chunk, 0x0c, 0);                  // left  (コマごとの部分更新は使わない)
		Put16(chunk, 0x0e, 0);                  // top
		Put16(chunk, 0x10, (ushort)width);
		Put16(chunk, 0x12, (ushort)height);
		Put32(chunk, 0x14, (uint)alphaZlib.Length);
		alphaZlib.CopyTo(chunk.AsSpan(24));
		color.CopyTo(chunk.AsSpan(24 + alphaZlib.Length));
		return chunk;
	}

	/// <summary>
	/// 透明なところへ隣の色をにじませた RGBA を作る。アルファはそのまま。
	///
	/// 透明な画素の色は真っ黒で入ってくる。色は 8x8 のかたまりで潰されるうえ
	/// 横も縦も半分に間引かれるので、そのまま圧縮すると黒が縁へ漏れて
	/// 粒のまわりに暗い輪郭が出る。先に埋めておけば漏れる色が地の色になる。
	/// </summary>
	static byte[] BleedColor(byte[] rgba, int width, int height)
	{
		const int passes = 6;   // 8x8 のかたまり + 半分の間引き、を覆えるだけ

		var result = (byte[])rgba.Clone();
		var known = new bool[width * height];
		var todo = 0;
		for (var i = 0; i < known.Length; i++)
		{
			known[i] = rgba[i * 4 + 3] > 0;
			if (!known[i]) todo++;
		}
		if (todo == 0 || todo == known.Length) return result;

		var filled = new List<int>();
		for (var pass = 0; pass < passes && todo > 0; pass++)
		{
			filled.Clear();
			for (var i = 0; i < known.Length; i++)
			{
				if (known[i]) continue;

				var x = i % width;
				var y = i / width;
				int sumR = 0, sumG = 0, sumB = 0, count = 0;
				if (x > 0) Take(i - 1);
				if (x < width - 1) Take(i + 1);
				if (y > 0) Take(i - width);
				if (y < height - 1) Take(i + width);
				if (count == 0) continue;

				result[i * 4] = (byte)(sumR / count);
				result[i * 4 + 1] = (byte)(sumG / count);
				result[i * 4 + 2] = (byte)(sumB / count);
				filled.Add(i);

				void Take(int neighbor)
				{
					if (!known[neighbor]) return;
					sumR += result[neighbor * 4];
					sumG += result[neighbor * 4 + 1];
					sumB += result[neighbor * 4 + 2];
					count++;
				}
			}

			// 同じ回のうちに埋めた色を種にしないよう、印は回の終わりにまとめて付ける
			foreach (var i in filled) known[i] = true;
			todo -= filled.Count;
		}

		return result;
	}

	/// <summary>RGBA を Y / Cb / Cr (4:2:0) とアルファへ分ける。</summary>
	static void ToYCbCr(byte[] rgba, int width, int height,
		byte[] y, byte[] cb, byte[] cr, byte[] alpha)
	{
		for (var i = 0; i < width * height; i++)
		{
			int r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
			y[i] = Clip8((int)MathF.Round(0.299f * r + 0.587f * g + 0.114f * b));
			alpha[i] = rgba[i * 4 + 3];
		}

		// 色差は 2x2 の平均で半分に間引く
		var cw = width / 2;
		for (var by = 0; by < height / 2; by++)
		{
			for (var bx = 0; bx < cw; bx++)
			{
				float sumB = 0, sumR = 0;
				for (var dy = 0; dy < 2; dy++)
				{
					for (var dx = 0; dx < 2; dx++)
					{
						var i = ((by * 2 + dy) * width + bx * 2 + dx) * 4;
						float r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
						sumB += -0.168736f * r - 0.331264f * g + 0.5f * b;
						sumR += 0.5f * r - 0.418688f * g - 0.081312f * b;
					}
				}
				cb[by * cw + bx] = Clip8((int)MathF.Round(sumB / 4f + 128f));
				cr[by * cw + bx] = Clip8((int)MathF.Round(sumR / 4f + 128f));
			}
		}
	}

	static byte[] Deflate(byte[] data)
	{
		using var ms = new MemoryStream();
		using (var z = new ZLibStream(ms, CompressionLevel.Optimal, leaveOpen: true)) z.Write(data);
		return ms.ToArray();
	}

	// ------------------------------------------------------- エントロピー符号化

	/// <summary>
	/// Cb, Cr, Y の順にインターリーブした 1 スキャンを書く。MCU は 16x16 で、
	/// 1 MCU につき Cb 1 + Cr 1 + Y 4 ブロック。
	/// DC 予測子は「色差で 1 本 (Cb と Cr で共有) / 輝度で 1 本」の 2 本だけ持つ。
	/// </summary>
	static byte[] EncodeColorScan(byte[] y, byte[] cb, byte[] cr, int width, int height,
		byte[] lumaQuant, byte[] chromaQuant)
	{
		var writer = new BitWriter();
		var mcuX = width / 16;
		var mcuY = height / 16;
		var cw = width / 2;

		var predLuma = 0;
		var predChroma = 0;
		var block = new int[64];

		for (var my = 0; my < mcuY; my++)
		{
			for (var mx = 0; mx < mcuX; mx++)
			{
				Forward(cb, cw, mx * 8, my * 8, chromaQuant, block);
				WriteBlock(writer, block, ref predChroma, DcChroma, AcChroma);

				Forward(cr, cw, mx * 8, my * 8, chromaQuant, block);
				WriteBlock(writer, block, ref predChroma, DcChroma, AcChroma);

				for (var by = 0; by < 2; by++)
				{
					for (var bx = 0; bx < 2; bx++)
					{
						Forward(y, width, (mx * 2 + bx) * 8, (my * 2 + by) * 8, lumaQuant, block);
						WriteBlock(writer, block, ref predLuma, DcLuma, AcLuma);
					}
				}
			}
		}

		return writer.Finish();
	}

	/// <summary>8x8 を切り出して DCT・量子化し、ジグザグ順の係数にする。</summary>
	static void Forward(byte[] plane, int planeWidth, int x0, int y0, byte[] quant, int[] zigzag)
	{
		Span<float> samples = stackalloc float[64];
		for (var y = 0; y < 8; y++)
			for (var x = 0; x < 8; x++)
				samples[y * 8 + x] = plane[(y0 + y) * planeWidth + x0 + x] - 128f;

		Span<float> coef = stackalloc float[64];
		Dct8x8(samples, coef);

		for (var k = 0; k < 64; k++)
		{
			var v = coef[Zigzag[k]] / quant[k];
			zigzag[k] = (int)MathF.Round(v);
		}
	}

	/// <summary>分離型の素朴な 2 次元 DCT-II。JPEG と同じ 1/4·C(u)C(v) の正規化。</summary>
	static void Dct8x8(ReadOnlySpan<float> input, Span<float> output)
	{
		Span<float> tmp = stackalloc float[64];
		// 行方向
		for (var y = 0; y < 8; y++)
			for (var u = 0; u < 8; u++)
			{
				var sum = 0f;
				for (var x = 0; x < 8; x++) sum += input[y * 8 + x] * CosTable[x * 8 + u];
				tmp[y * 8 + u] = sum;
			}
		// 列方向
		for (var u = 0; u < 8; u++)
			for (var v = 0; v < 8; v++)
			{
				var sum = 0f;
				for (var y = 0; y < 8; y++) sum += tmp[y * 8 + u] * CosTable[y * 8 + v];
				output[v * 8 + u] = sum;
			}
	}

	// cos((2x+1)uπ/16) に 1/2·C(u) を掛けたもの。行と列で 2 回掛けると 1/4·C(u)C(v) になる。
	static readonly float[] CosTable = BuildCosTable();

	static float[] BuildCosTable()
	{
		var table = new float[64];
		for (var x = 0; x < 8; x++)
			for (var u = 0; u < 8; u++)
			{
				var cu = u == 0 ? 1.0 / Math.Sqrt(2.0) : 1.0;
				table[x * 8 + u] = (float)(0.5 * cu * Math.Cos((2 * x + 1) * u * Math.PI / 16.0));
			}
		return table;
	}

	/// <summary>1 ブロックぶんの DC 差分と AC のランレングスを書く。</summary>
	static void WriteBlock(BitWriter writer, int[] zigzag, ref int pred, HuffTable dc, HuffTable ac)
	{
		var diff = zigzag[0] - pred;
		pred = zigzag[0];

		var category = Category(diff);
		dc.Write(writer, category);
		if (category > 0) writer.WriteBits(Magnitude(diff, category), category);

		// 末尾の 0 は EOB でまとめて済ませるので、最後に値がある位置を先に探す
		var last = 0;
		for (var k = 1; k < 64; k++) if (zigzag[k] != 0) last = k;

		var run = 0;
		for (var k = 1; k <= last; k++)
		{
			if (zigzag[k] == 0) { run++; continue; }

			// 16 個以上続く 0 は ZRL (15,0) で刻む
			while (run >= 16) { ac.Write(writer, 0xF0); run -= 16; }

			category = Category(zigzag[k]);
			ac.Write(writer, (run << 4) | category);
			writer.WriteBits(Magnitude(zigzag[k], category), category);
			run = 0;
		}

		if (last < 63) ac.Write(writer, 0x00);   // EOB
	}

	/// <summary>値を表すのに要るビット数。</summary>
	static int Category(int value)
	{
		var v = Math.Abs(value);
		var bits = 0;
		while (v > 0) { bits++; v >>= 1; }
		return bits;
	}

	/// <summary>負の値は 1 の補数で書く、という JPEG の決まり。</summary>
	static int Magnitude(int value, int category) =>
		value >= 0 ? value : value + (1 << category) - 1;

	// ------------------------------------------------------------ ビット出力

	/// <summary>
	/// 上位ビットから詰めていく。0xFF を書いたら 0x00 を続ける (JPEG のバイトスタッフ)。
	/// デコーダ側がこれを外すので、入れないとビット位置がずれる。
	/// </summary>
	sealed class BitWriter
	{
		readonly MemoryStream _stream = new();
		int _accumulator;
		int _count;

		public void WriteBits(int value, int length)
		{
			for (var i = length - 1; i >= 0; i--)
			{
				_accumulator = (_accumulator << 1) | ((value >> i) & 1);
				if (++_count != 8) continue;

				var b = (byte)_accumulator;
				_stream.WriteByte(b);
				if (b == 0xFF) _stream.WriteByte(0x00);
				_accumulator = 0;
				_count = 0;
			}
		}

		public byte[] Finish()
		{
			if (_count > 0) WriteBits((1 << (8 - _count)) - 1, 8 - _count);   // 余りは 1 で埋める
			return _stream.ToArray();
		}
	}

	/// <summary>符号 → (ビット列, 長さ) の表。標準テーブルから組み立てる。</summary>
	sealed class HuffTable
	{
		readonly int[] _code = new int[256];
		readonly int[] _length = new int[256];

		public HuffTable(byte[] bits, byte[] values)
		{
			var code = 0;
			var k = 0;
			for (var length = 1; length <= 16; length++)
			{
				for (var i = 0; i < bits[length - 1]; i++)
				{
					_code[values[k]] = code;
					_length[values[k]] = length;
					code++;
					k++;
				}
				code <<= 1;
			}
		}

		public void Write(BitWriter writer, int symbol) => writer.WriteBits(_code[symbol], _length[symbol]);
	}

	// ---------------------------------------------------------------- 標準の表
	// ハフマンテーブルはファイルに入らないので、デコーダと同じ標準表を使う。

	static readonly HuffTable DcLuma = new(
		new byte[] { 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0 },
		new byte[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 });

	static readonly HuffTable DcChroma = new(
		new byte[] { 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0 },
		new byte[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 });

	static readonly HuffTable AcLuma = new(
		new byte[] { 0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d },
		new byte[]
		{
			0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
			0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
			0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
			0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
			0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
			0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
			0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
			0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
			0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
			0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
			0xf9, 0xfa,
		});

	static readonly HuffTable AcChroma = new(
		new byte[] { 0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77 },
		new byte[]
		{
			0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
			0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
			0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
			0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
			0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
			0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
			0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
			0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
			0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
			0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
			0xf9, 0xfa,
		});

	/// <summary>ジグザグ順の k 番目が、自然順のどこにあたるか。</summary>
	static readonly int[] Zigzag =
	{
		 0,  1,  8, 16,  9,  2,  3, 10,
		17, 24, 32, 25, 18, 11,  4,  5,
		12, 19, 26, 33, 40, 48, 41, 34,
		27, 20, 13,  6,  7, 14, 21, 28,
		35, 42, 49, 56, 57, 50, 43, 36,
		29, 22, 15, 23, 30, 37, 44, 51,
		58, 59, 52, 45, 38, 31, 39, 46,
		53, 60, 61, 54, 47, 55, 62, 63,
	};

	// 標準の量子化テーブル (自然順)
	static readonly byte[] BaseLuma =
	{
		16, 11, 10, 16, 24, 40, 51, 61,
		12, 12, 14, 19, 26, 58, 60, 55,
		14, 13, 16, 24, 40, 57, 69, 56,
		14, 17, 22, 29, 51, 87, 80, 62,
		18, 22, 37, 56, 68, 109, 103, 77,
		24, 35, 55, 64, 81, 104, 113, 92,
		49, 64, 78, 87, 103, 121, 120, 101,
		72, 92, 95, 98, 112, 100, 103, 99,
	};

	static readonly byte[] BaseChroma =
	{
		17, 18, 24, 47, 99, 99, 99, 99,
		18, 21, 26, 66, 99, 99, 99, 99,
		24, 26, 56, 99, 99, 99, 99, 99,
		47, 66, 99, 99, 99, 99, 99, 99,
		99, 99, 99, 99, 99, 99, 99, 99,
		99, 99, 99, 99, 99, 99, 99, 99,
		99, 99, 99, 99, 99, 99, 99, 99,
		99, 99, 99, 99, 99, 99, 99, 99,
	};

	/// <summary>品質 (1-100) で標準テーブルを伸縮し、ジグザグ順にして返す。</summary>
	static byte[] ScaleQuantTable(byte[] natural, int quality)
	{
		quality = Math.Clamp(quality, 1, 100);
		var scale = quality < 50 ? 5000 / quality : 200 - quality * 2;

		var table = new byte[64];
		for (var k = 0; k < 64; k++)
		{
			var v = (natural[Zigzag[k]] * scale + 50) / 100;
			table[k] = (byte)Math.Clamp(v, 1, 255);
		}
		return table;
	}

	static byte Clip8(int v) => (byte)(v < 0 ? 0 : v > 255 ? 255 : v);

	static void Put16(byte[] buffer, int offset, ushort value) =>
		BinaryPrimitives.WriteUInt16LittleEndian(buffer.AsSpan(offset), value);

	static void Put32(byte[] buffer, int offset, uint value) =>
		BinaryPrimitives.WriteUInt32LittleEndian(buffer.AsSpan(offset), value);
}
