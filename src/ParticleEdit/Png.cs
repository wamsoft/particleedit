using System.Buffers.Binary;
using System.IO.Compression;

namespace ParticleEdit;

/// <summary>
/// 依存ライブラリなしで RGBA8 の PNG を書き出す最小実装。
/// 組み込みテクスチャを実行時に生成するためだけに使う。
/// </summary>
public static class Png
{
	public static byte[] Encode(int width, int height, byte[] rgba)
	{
		if (rgba.Length != width * height * 4)
			throw new ArgumentException("rgba length mismatch");

		// 各行の先頭にフィルタタイプ (0 = None) を挟んだ raw データ
		var raw = new byte[height * (width * 4 + 1)];
		for (var y = 0; y < height; y++)
		{
			var src = y * width * 4;
			var dst = y * (width * 4 + 1);
			raw[dst] = 0;
			Array.Copy(rgba, src, raw, dst + 1, width * 4);
		}

		using var compressed = new MemoryStream();
		using (var z = new ZLibStream(compressed, CompressionLevel.Optimal, leaveOpen: true))
		{
			z.Write(raw, 0, raw.Length);
		}

		using var output = new MemoryStream();
		output.Write(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });

		var ihdr = new byte[13];
		BinaryPrimitives.WriteInt32BigEndian(ihdr.AsSpan(0), width);
		BinaryPrimitives.WriteInt32BigEndian(ihdr.AsSpan(4), height);
		ihdr[8] = 8;  // bit depth
		ihdr[9] = 6;  // color type: truecolor + alpha
		ihdr[10] = 0; // compression
		ihdr[11] = 0; // filter
		ihdr[12] = 0; // interlace
		WriteChunk(output, "IHDR", ihdr);
		WriteChunk(output, "IDAT", compressed.ToArray());
		WriteChunk(output, "IEND", Array.Empty<byte>());

		return output.ToArray();
	}

	static void WriteChunk(Stream s, string type, byte[] data)
	{
		Span<byte> len = stackalloc byte[4];
		BinaryPrimitives.WriteInt32BigEndian(len, data.Length);
		s.Write(len);

		var typeBytes = new byte[4];
		for (var i = 0; i < 4; i++) typeBytes[i] = (byte)type[i];
		s.Write(typeBytes);
		s.Write(data);

		var crc = Crc32(typeBytes, data);
		Span<byte> crcBytes = stackalloc byte[4];
		BinaryPrimitives.WriteUInt32BigEndian(crcBytes, crc);
		s.Write(crcBytes);
	}

	static readonly uint[] CrcTable = BuildCrcTable();

	static uint[] BuildCrcTable()
	{
		var table = new uint[256];
		for (uint n = 0; n < 256; n++)
		{
			var c = n;
			for (var k = 0; k < 8; k++)
				c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
			table[n] = c;
		}
		return table;
	}

	static uint Crc32(byte[] a, byte[] b)
	{
		var c = 0xFFFFFFFFu;
		foreach (var x in a) c = CrcTable[(c ^ x) & 0xFF] ^ (c >> 8);
		foreach (var x in b) c = CrcTable[(c ^ x) & 0xFF] ^ (c >> 8);
		return c ^ 0xFFFFFFFFu;
	}
}
