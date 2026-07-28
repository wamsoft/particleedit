namespace ParticleEdit;

/// <summary>
/// 使われなくなったサーバを自分で畳むための番人。
///
/// このアプリはブラウザから使う自分専用のローカルサーバなので、
/// 「誰も使っていない」状態でいつまでも走り続けると裏に残ってしまう。
/// そこで、次の合図が途絶えたら自分自身を畳む。
///
///   1. 心拍が途絶えたとき  … ページが生きているあいだ、ブラウザが
///      定期的に /api/heartbeat を叩く。閉じれば途絶える。
///   2. 標準入力が切れたとき … 起動元のコンソールや親プロセスが消えると
///      stdin が EOF になる。それを検知して畳む。
///
/// どちらも「このプロセスが自分を止める」だけで、他のプロセスには一切
/// 触らない。したがって別フォルダで起動した別インスタンスとは無関係に動く。
/// </summary>
public sealed class Watchdog
{
	/// <summary>心拍が最後に来てから、これだけ途絶えたら畳む。</summary>
	static readonly TimeSpan Idle = TimeSpan.FromSeconds(15);

	/// <summary>起動直後はまだブラウザが繋がっていないので、最初の心拍をこれだけ待つ。</summary>
	static readonly TimeSpan Startup = TimeSpan.FromSeconds(60);

	/// <summary>タブを閉じた合図 (/api/bye) が来たら、この短い猶予で畳む。</summary>
	static readonly TimeSpan ByeGrace = TimeSpan.FromSeconds(2);

	/// <summary>
	/// 起動直後に来る stdin の EOF は「そもそも繋がっていない」だけなので無視する。
	/// (NUL からの入力など。ここで畳むと繋がっていない環境で即終了してしまう)
	/// </summary>
	static readonly TimeSpan StdinGuard = TimeSpan.FromSeconds(3);

	readonly IHostApplicationLifetime _life;

	/// <summary>この時刻を過ぎたら畳む。心拍のたびに先へ延ばす。</summary>
	long _deadlineTicks;

	public Watchdog(IHostApplicationLifetime life)
	{
		_life = life;
		_deadlineTicks = (DateTime.UtcNow + Startup).Ticks;
	}

	/// <summary>ブラウザが生きている合図。期限を先へ延ばす。</summary>
	public void Beat() =>
		Volatile.Write(ref _deadlineTicks, (DateTime.UtcNow + Idle).Ticks);

	/// <summary>
	/// タブが閉じられた合図。期限を手前へ引き寄せる。
	/// ただし別タブの心拍が入れた期限より手前へは動かさない
	/// (複数タブを開いていて 1 つだけ閉じた場合に生き残らせるため)。
	/// </summary>
	public void Bye()
	{
		var soon = (DateTime.UtcNow + ByeGrace).Ticks;
		if (soon < Volatile.Read(ref _deadlineTicks))
			Volatile.Write(ref _deadlineTicks, soon);
	}

	/// <summary>見張りを始める。app.Run() の前に呼ぶ。</summary>
	public void Start()
	{
		_ = WatchHeartbeatAsync();
		_ = WatchStdinAsync();
	}

	async Task WatchHeartbeatAsync()
	{
		var token = _life.ApplicationStopping;
		while (!token.IsCancellationRequested)
		{
			try { await Task.Delay(TimeSpan.FromSeconds(2), token); }
			catch (OperationCanceledException) { return; }

			if (DateTime.UtcNow.Ticks > Volatile.Read(ref _deadlineTicks))
			{
				_life.StopApplication();
				return;
			}
		}
	}

	async Task WatchStdinAsync()
	{
		var started = DateTime.UtcNow;
		var buffer = new byte[256];
		try
		{
			using var stdin = Console.OpenStandardInput();
			// EOF (Read が 0) になるまで読み捨てる。このアプリは stdin を
			// 入力には使わないので、来た文字は捨ててよい。
			while (await stdin.ReadAsync(buffer) > 0) { }
		}
		catch
		{
			// パイプが壊れた等。EOF と同じ扱いにする。
		}

		// 起動直後の EOF は stdin が繋がっていないだけなので、番をやめるだけにする。
		if (DateTime.UtcNow - started < StdinGuard) return;

		_life.StopApplication();
	}
}
