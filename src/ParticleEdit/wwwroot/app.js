"use strict";

// ---------------------------------------------------------------- パラメータ定義
// ここに 1 行足せば UI とサーバ送信の両方に反映される。
// key は C# 側 EffectSpec のプロパティ名 (camelCase) と一致させること。

const GROUPS = [
  {
    title: "エミッター",
    params: [
      { key: "emitRate",          label: "1秒あたりの発生数", min: 1,    max: 300,  step: 1,     value: 40 },
      { key: "spawnRangeX",       label: "発生位置のばらつき X", min: 0, max: 600,  step: 1,     value: 0 },
      { key: "spawnRangeY",       label: "発生位置のばらつき Y", min: 0, max: 600,  step: 1,     value: 0 },
      { key: "speed",             label: "初速",             min: 0,    max: 20,   step: 0.05,  value: 3 },
      { key: "speedVariance",     label: "初速のばらつき",     min: 0,    max: 20,   step: 0.05,  value: 1.5 },
      { key: "direction",         label: "方向 (度)",         min: 0,    max: 360,  step: 1,     value: 90 },
      { key: "directionVariance", label: "方向の広がり (度)",  min: 0,    max: 360,  step: 1,     value: 40 },
      { key: "gravity",           label: "重力",             min: 0,    max: 1,    step: 0.005, value: 0.06 },
      { key: "gravityDirection",  label: "重力の向き (度)",    min: 0,    max: 360,  step: 1,     value: 270 },
      { key: "drag",              label: "空気抵抗",          min: 0,    max: 1,    step: 0.005, value: 0 },
    ],
  },
  {
    title: "パーティクル",
    params: [
      { key: "life",              label: "寿命 (フレーム)",    min: 1,   max: 300, step: 1, value: 70 },
      { key: "lifeVariance",      label: "寿命のばらつき",      min: 0,   max: 300, step: 1, value: 30 },
      { key: "startSize",         label: "開始サイズ",         min: 0,   max: 300, step: 1, value: 28 },
      { key: "startSizeVariance", label: "開始サイズのばらつき", min: 0,  max: 300, step: 1, value: 12 },
      { key: "endSize",           label: "終了サイズ",         min: 0,   max: 300, step: 1, value: 0 },
      { key: "endSizeVariance",   label: "終了サイズのばらつき", min: 0,  max: 300, step: 1, value: 0 },
    ],
  },
  {
    title: "カラー",
    params: [
      { key: "hue",                label: "色相",           min: 0, max: 360, step: 1, value: 30 },
      { key: "hueVariance",        label: "色相のばらつき",   min: 0, max: 360, step: 1, value: 40 },
      { key: "saturation",         label: "彩度",           min: 0, max: 100, step: 1, value: 85 },
      { key: "saturationVariance", label: "彩度のばらつき",   min: 0, max: 100, step: 1, value: 15 },
      { key: "brightness",         label: "明度",           min: 0, max: 100, step: 1, value: 100 },
      { key: "brightnessVariance", label: "明度のばらつき",   min: 0, max: 100, step: 1, value: 0 },
      { key: "startAlpha",         label: "開始の透明度",     min: 0, max: 1,   step: 0.01, value: 1 },
      { key: "endAlpha",           label: "終了の透明度",     min: 0, max: 1,   step: 0.01, value: 0 },
    ],
  },
  {
    title: "描画",
    params: [
      { key: "blend", label: "ブレンド", type: "select", value: "add",
        options: [["add", "加算"], ["blend", "通常"]] },
      { key: "shape", label: "形状", type: "select", value: "blur_circle",
        options: [["blur_circle", "ぼかし円"], ["circle", "円"], ["ring", "リング"], ["star", "星"], ["square", "四角"]] },
    ],
  },
];

const spec = {};
for (const g of GROUPS) for (const p of g.params) spec[p.key] = p.value;

// ---------------------------------------------------------------- UI 構築

const statusEl = document.getElementById("status");
const statsEl = document.getElementById("stats");

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", !!isError);
}

function buildPanel() {
  const panel = document.getElementById("params");
  for (const group of GROUPS) {
    const title = document.createElement("div");
    title.className = "group-title";
    title.textContent = group.title;
    panel.appendChild(title);

    for (const p of group.params) {
      const row = document.createElement("div");
      row.className = "row";

      const label = document.createElement("div");
      label.className = "label";
      const name = document.createElement("span");
      name.textContent = p.label;
      const value = document.createElement("span");
      value.className = "value";
      label.append(name, value);
      row.appendChild(label);

      if (p.type === "select") {
        value.textContent = "";
        const sel = document.createElement("select");
        for (const [v, text] of p.options) {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = text;
          sel.appendChild(opt);
        }
        sel.value = p.value;
        sel.addEventListener("change", () => { spec[p.key] = sel.value; requestRebuild(); });
        row.appendChild(sel);
      } else {
        const input = document.createElement("input");
        input.type = "range";
        input.min = p.min; input.max = p.max; input.step = p.step;
        input.value = p.value;
        const show = () => { value.textContent = formatNumber(+input.value, p.step); };
        show();
        input.addEventListener("input", () => {
          spec[p.key] = +input.value;
          show();
          requestRebuild();
        });
        row.appendChild(input);
      }

      panel.appendChild(row);
    }
  }
}

function formatNumber(v, step) {
  const decimals = (String(step).split(".")[1] || "").length;
  return v.toFixed(decimals);
}

// ---------------------------------------------------------------- 書き出し

async function exportAs(format) {
  const res = await fetch("/api/export?format=" + format, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) { setStatus("書き出しに失敗: " + res.status, true); return; }

  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = format === "zip" ? "effect.zip" : "effect." + format;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById("btn-efk").addEventListener("click", () => exportAs("efk"));
document.getElementById("btn-efkefc").addEventListener("click", () => exportAs("efkefc"));
document.getElementById("btn-zip").addEventListener("click", () => exportAs("zip"));

// ---------------------------------------------------------------- プレビュー

const INSTANCE_MAX = 4000;
const SELFTEST = new URLSearchParams(location.search).has("selftest");

const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl", { alpha: false, depth: true, antialias: true });

let context = null;      // EffekseerContext
let effect = null;       // 現在ロードされている EffekseerEffect
let handle = null;       // 再生ハンドル

// 連打対策: 通信中は次の 1 回だけ予約しておく
let rebuildInFlight = false;
let rebuildPending = false;
let generation = 0;      // 追い越された古いビルドを捨てるための世代番号

function requestRebuild() {
  if (rebuildInFlight) { rebuildPending = true; return; }
  rebuild();
}

async function rebuild() {
  rebuildInFlight = true;
  const myGeneration = ++generation;
  try {
    const started = performance.now();
    const res = await fetch("/api/effect.efk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);

    const buffer = await res.arrayBuffer();
    const next = await loadEffect(buffer);

    if (myGeneration !== generation) {
      // 待っている間に新しいビルドが始まっていた。この結果は捨てる。
      context.releaseEffect(next);
      return;
    }

    swapEffect(next);
    setStatus(`${buffer.byteLength} B / ${Math.round(performance.now() - started)} ms`);
  } catch (e) {
    setStatus("ビルドに失敗: " + e.message, true);
  } finally {
    rebuildInFlight = false;
    if (rebuildPending) { rebuildPending = false; rebuild(); }
  }
}

/// エフェクトを「テクスチャまで含めて完全に読み終わった状態」で返す。
///
/// 注意: loadEffect() に ArrayBuffer を渡すと、依存リソースが Effekseer 側の
/// キャッシュに残っている場合は onload が *同期的に* 呼ばれる。つまり
/// loadEffect() の戻り値をコールバックの中から参照することはできない。
/// (ここを踏み外すと「パラメータを変えるとプレビューが消える」不具合になる)
function loadEffect(buffer) {
  return new Promise((resolve, reject) => {
    const created = context.loadEffect(
      buffer,
      1.0,
      undefined,
      (reason, path) => reject(new Error(`${reason}: ${path}`)));

    if (created.isLoaded) {
      resolve(created);        // 同期で読み終わっていた場合
    } else {
      created.onload = () => resolve(created);
    }
  });
}

/// 新しいエフェクトが完全に準備できてから差し替える。
/// 先に古い方を解放しないので、切り替えの瞬間もプレビューが途切れない。
function swapEffect(next) {
  context.stopAll();
  if (effect) context.releaseEffect(effect);
  effect = next;
  handle = context.play(effect, 0, 0, 0);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(canvas.clientWidth, 1);
  const h = Math.max(canvas.clientHeight, 1);
  if (canvas.width !== (w * dpr | 0) || canvas.height !== (h * dpr | 0)) {
    canvas.width = w * dpr | 0;
    canvas.height = h * dpr | 0;
  }
  return { w, h };
}

// ---------------------------------------------------------------- 自己診断
// ?selftest=1 を付けて開くと、パラメータを変えながら数サイクル回し、
// 各サイクルで「実際にピクセルが描かれたか」を測って DOM に書き出す。
// パラメータ変更のたびにプレビューが消える、といった不具合を機械的に検出するため。

/// 指定フレーム数だけ描画を進めて、光っているピクセルを数える。
function renderAndMeasure(frames) {
  const { w, h } = resize();
  gl.viewport(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < frames; i++) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    context.setProjectionOrthographic(w, h, 1, 4000);
    context.setCameraLookAt(0, 0, 1000, 0, 0, 0, 0, 1, 0);
    context.update(1.0);
    context.draw();
  }

  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  let lit = 0, xMin = 1e9, xMax = -1e9, yMin = 1e9, yMax = -1e9;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (pixels[i] > 16 || pixels[i + 1] > 16 || pixels[i + 2] > 16) {
        lit++;
        if (x < xMin) xMin = x; if (x > xMax) xMax = x;
        if (y < yMin) yMin = y; if (y > yMax) yMax = y;
      }
    }
  }

  if (lit === 0) return { litPixels: 0, played: !!handle };

  return {
    litPixels: lit,
    played: !!handle,
    // readPixels は左下原点なので、画面中央からの相対で見る
    x: [Math.round(xMin - canvas.width / 2), Math.round(xMax - canvas.width / 2)],
    y: [Math.round(yMin - canvas.height / 2), Math.round(yMax - canvas.height / 2)],
    instances: INSTANCE_MAX - context.getRestInstancesCount(),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runSelfTest() {
  const cycles = [];
  // 実際の操作と同じように、パラメータを変えては作り直す
  for (let i = 0; i < 5; i++) {
    spec.hue = 20 + i * 60;
    await rebuild();
    await sleep(150);            // テクスチャなど非同期の読み込みが片付くのを待つ
    cycles.push({ cycle: i, hue: spec.hue, ...renderAndMeasure(40) });
  }

  // スライダーをドラッグしたときのように、間を置かず連続で変更した場合
  for (let i = 0; i < 12; i++) {
    spec.hue = 10 * i;
    requestRebuild();
    await sleep(5);
  }
  await sleep(600);
  const burst = { cycle: "burst", hue: spec.hue, ...renderAndMeasure(40) };
  cycles.push(burst);

  const blank = cycles.filter((c) => c.litPixels === 0);
  const el = document.createElement("pre");
  el.id = "selftest";
  el.textContent = JSON.stringify({ ok: blank.length === 0, blankCycles: blank.length, cycles }, null, 1);
  document.body.appendChild(el);
}

function frame() {
  const { w, h } = resize();

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (context) {
    // 1 ワールド単位 = 1 CSS ピクセルになるように正射影を張る
    context.setProjectionOrthographic(w, h, 1, 4000);
    context.setCameraLookAt(0, 0, 1000, 0, 0, 0, 0, 1, 0);
    context.update(1.0);
    context.draw();

    // 空き枠から逆算した、いま生きているインスタンス数
    statsEl.textContent = `particles: ${INSTANCE_MAX - context.getRestInstancesCount()}`;
  }

  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- 起動

buildPanel();

if (!gl) {
  setStatus("WebGL を初期化できません", true);
} else {
  effekseer.initRuntime("vendor/effekseer.wasm", () => {
    context = effekseer.createContext();
    context.init(gl);
    setStatus("準備完了");
    if (SELFTEST) {
      runSelfTest();
    } else {
      rebuild();
      requestAnimationFrame(frame);
    }
  }, () => {
    setStatus("effekseer.wasm の読み込みに失敗しました", true);
  });
}
