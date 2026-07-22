"use strict";

// ---------------------------------------------------------------- パラメータ定義
// ここに 1 行足せば UI とサーバ送信の両方に反映される。
// key は C# 側 EffectSpec のプロパティ名 (camelCase) と一致させること。

const GROUPS = [
  {
    title: "エミッター",
    params: [
      { key: "emitRate",          label: "1秒あたりの発生数", min: 1,    max: 400,  step: 1,     value: 80 },
      { key: "emitterX",          label: "発生位置 X",        min: -960, max: 960,  step: 1,     value: 0 },
      { key: "emitterY",          label: "発生位置 Y",        min: -540, max: 540,  step: 1,     value: 0 },
      { key: "spawnRangeX",       label: "発生位置のばらつき X", min: 0, max: 600,  step: 1,     value: 0 },
      { key: "spawnRangeY",       label: "発生位置のばらつき Y", min: 0, max: 600,  step: 1,     value: 0 },
      { key: "speed",             label: "初速",             min: 0,    max: 30,   step: 0.05,  value: 5 },
      { key: "speedVariance",     label: "初速のばらつき",     min: 0,    max: 30,   step: 0.05,  value: 3 },
      { key: "direction",         label: "方向 (度)",         min: 0,    max: 360,  step: 1,     value: 90 },
      { key: "directionVariance", label: "方向の広がり (度)",  min: 0,    max: 360,  step: 1,     value: 40 },
      { key: "gravity",           label: "重力",             min: 0,    max: 1,    step: 0.005, value: 0.06 },
      { key: "gravityDirection",  label: "重力の向き (度)",    min: 0,    max: 360,  step: 1,     value: 270 },
      { key: "drag",              label: "空気抵抗",          min: 0,    max: 1,    step: 0.005, value: 0 },
      { key: "locationBind", label: "発生位置を動かしたとき", type: "select", value: "spawn",
        options: [["spawn", "その場に置き去り (軌跡になる)"], ["always", "まるごと追従"]] },
    ],
  },
  {
    title: "エミッタの動き",
    params: [
      { key: "emitterMotion", label: "動かしかた", type: "select", value: "none",
        options: [
          ["none", "動かさない"],
          ["baked", "軌道を焼き込む"],
          ["dynamic", "組み込み先から動かす"],
        ] },
      { type: "motion-editor" },
    ],
  },
  {
    title: "パーティクル",
    params: [
      { key: "life",              label: "寿命 (フレーム)",    min: 1,   max: 300, step: 1, value: 70 },
      { key: "lifeVariance",      label: "寿命のばらつき",      min: 0,   max: 300, step: 1, value: 30 },
      { key: "startSize",         label: "開始サイズ",         min: 0,   max: 600, step: 1, value: 64 },
      { key: "startSizeVariance", label: "開始サイズのばらつき", min: 0,  max: 600, step: 1, value: 26 },
      { key: "endSize",           label: "終了サイズ",         min: 0,   max: 600, step: 1, value: 0 },
      { key: "endSizeVariance",   label: "終了サイズのばらつき", min: 0,  max: 600, step: 1, value: 0 },
      { key: "rotation",              label: "発生時の角度 (度)",   min: 0,    max: 360, step: 1,   value: 0 },
      { key: "rotationVariance",      label: "角度のばらつき (度)", min: 0,    max: 360, step: 1,   value: 0 },
      { key: "rotationSpeed",         label: "回転速度 (度/フレーム)", min: -20, max: 20, step: 0.1, value: 0 },
      { key: "rotationSpeedVariance", label: "回転速度のばらつき",  min: 0,    max: 40,  step: 0.1, value: 0 },
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
    ],
  },
  {
    title: "形状",
    params: [
      { type: "shape-editor" },
      { key: "shape.sides",     label: "辺の数 (0 = 円)", min: 0,   max: 16, step: 1,    value: 0 },
      { key: "shape.starRatio", label: "星形",           min: 0.05, max: 1,  step: 0.01, value: 1 },
      { key: "shape.hole",      label: "中抜き",          min: 0,   max: 0.9, step: 0.01, value: 0 },
      { key: "shape.blur",      label: "ぼかし",          min: 0,   max: 1,  step: 0.01, value: 1 },
      { key: "shape.falloff",   label: "ぼかしの曲がり",   min: 0.2, max: 4,  step: 0.05, value: 2 },
      { key: "shape.rotation",  label: "回転 (度)",       min: 0,   max: 360, step: 1,   value: 0 },
      { key: "shape.scale",     label: "大きさ",          min: 0.2, max: 1,  step: 0.01, value: 1 },
    ],
  },
  {
    title: "プレビュー (エフェクトには含まれない)",
    params: [
      { key: "backgroundColor", label: "背景色", type: "color", value: "#101014" },
      { key: "showFrame", label: "画面サイズの枠を表示", type: "toggle", value: true },
      { type: "frame-presets" },
      { key: "frameWidth",  label: "画面の幅",   min: 320, max: 2560, step: 16, value: 1280 },
      { key: "frameHeight", label: "画面の高さ", min: 240, max: 1600, step: 16, value: 720 },
    ],
  },
];

// パラメータは "shape.blur" のような入れ子のキーも取れるようにしておく
const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

const spec = { shape: { type: "procedural", imageId: null }, motions: [], motionName: "" };
for (const g of GROUPS) for (const p of g.params) if (p.key) setPath(spec, p.key, p.value);

/// キー -> UI へ値を書き戻す関数。プロジェクトやテンプレートの読み込み時に使う。
const controls = new Map();

/// エフェクトデータに影響しない (= 作り直しが要らない) パラメータ
const EDITOR_ONLY_KEYS = new Set(["backgroundColor", "showFrame", "frameWidth", "frameHeight"]);

// ---------------------------------------------------------------- UI 構築

const statusEl = document.getElementById("status");
const statsEl = document.getElementById("stats");

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", !!isError);
}

function formatNumber(v, step) {
  const decimals = (String(step).split(".")[1] || "").length;
  return v.toFixed(decimals);
}

function buildPanel() {
  const panel = document.getElementById("params");
  for (const group of GROUPS) {
    const title = document.createElement("div");
    title.className = "group-title";
    title.textContent = group.title;
    panel.appendChild(title);

    for (const p of group.params) {
      if (p.type === "shape-editor") {
        panel.appendChild(buildShapeEditor());
        continue;
      }
      if (p.type === "frame-presets") {
        panel.appendChild(buildFramePresets());
        continue;
      }
      if (p.type === "motion-editor") {
        panel.appendChild(buildMotionEditor());
        continue;
      }

      const row = document.createElement("div");
      row.className = "row";
      if (p.key.startsWith("shape.")) row.dataset.procedural = "1";

      const label = document.createElement("div");
      label.className = "label";
      const name = document.createElement("span");
      name.textContent = p.label;
      const value = document.createElement("span");
      value.className = "value";
      label.append(name, value);
      row.appendChild(label);

      if (p.type === "toggle") {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = !!p.value;
        input.addEventListener("input", () => {
          setPath(spec, p.key, input.checked);
          // 枠の表示切り替えはエフェクトの作り直しを伴わない
        });
        controls.set(p.key, (v) => { input.checked = !!v; });
        label.appendChild(input);
        row.classList.add("row-toggle");
        panel.appendChild(row);
        continue;
      }

      if (p.type === "select" || p.type === "color") {
        const input = p.type === "color"
          ? Object.assign(document.createElement("input"), { type: "color" })
          : document.createElement("select");

        if (p.type === "select") {
          for (const [v, text] of p.options) {
            const opt = document.createElement("option");
            opt.value = v;
            opt.textContent = text;
            input.appendChild(opt);
          }
        }
        input.value = p.value;
        input.addEventListener("input", () => {
          setPath(spec, p.key, input.value);
          if (p.key === "backgroundColor") return;   // 背景色は作り直し不要
          requestRebuild();
        });
        controls.set(p.key, (v) => { input.value = v; });
        row.appendChild(input);
      } else {
        const input = document.createElement("input");
        input.type = "range";
        input.min = p.min; input.max = p.max; input.step = p.step;
        input.value = p.value;
        const show = () => { value.textContent = formatNumber(+input.value, p.step); };
        show();
        input.addEventListener("input", () => {
          setPath(spec, p.key, +input.value);
          show();
          if (p.key.startsWith("shape.")) onShapeEdited();
          if (!EDITOR_ONLY_KEYS.has(p.key)) requestRebuild();
        });
        controls.set(p.key, (v) => { input.value = v; show(); });
        row.appendChild(input);
      }

      panel.appendChild(row);
    }
  }
}

/// 読み込んだパラメータを spec へ取り込み、UI 全体を追従させる。
function applySpec(loaded) {
  for (const key of Object.keys(spec)) {
    if (loaded[key] === undefined) continue;
    spec[key] = loaded[key];
  }
  syncControls();
}

/// spec の現在値をすべての UI コントロールへ書き戻す。
function syncControls() {
  for (const [key, set] of controls) {
    const value = getPath(spec, key);
    if (value !== undefined && value !== null) set(value);
  }
  updateShapePreview();
  updateShapeRowsEnabled();
  syncMotionEditor();
}

// ---------------------------------------------------------------- 画面サイズの枠
// 吉里吉里などに組み込んだときの大きさ・位置の当たりを付けるための目安。
// 枠が収まるようにプレビュー全体を縮小して表示する。

const FRAME_PRESETS = [
  ["1280 × 720", 1280, 720],
  ["1920 × 1080", 1920, 1080],
  ["1024 × 768", 1024, 768],
  ["800 × 600", 800, 600],
  ["640 × 480", 640, 480],
];

function buildFramePresets() {
  const row = document.createElement("div");
  row.className = "row";

  const buttons = document.createElement("div");
  buttons.className = "frame-presets";
  for (const [label, width, height] of FRAME_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      spec.frameWidth = width;
      spec.frameHeight = height;
      spec.showFrame = true;
      syncControls();
    });
    buttons.appendChild(button);
  }

  row.appendChild(buttons);
  return row;
}

const frameGuide = document.getElementById("frame-guide");
const frameLabel = frameGuide.querySelector(".frame-label");

/// 枠がプレビュー領域に収まる倍率。枠を出していないときは等倍。
function previewZoom(w, h) {
  if (!spec.showFrame) return 1;
  return Math.min(1, Math.min(w / spec.frameWidth, h / spec.frameHeight) * 0.92);
}

function updateFrameGuide(zoom) {
  frameGuide.classList.toggle("hidden", !spec.showFrame);
  if (spec.showFrame) {
    frameGuide.style.width = `${spec.frameWidth * zoom}px`;
    frameGuide.style.height = `${spec.frameHeight * zoom}px`;
    frameLabel.textContent = `${spec.frameWidth} × ${spec.frameHeight}  (${Math.round(zoom * 100)}%)`;
  }

  // 発生位置の目印。ワールドは +Y が上、画面は +Y が下なので符号を反転する。
  emitterMarker.style.transform =
    `translate(${(spec.emitterX || 0) * zoom}px, ${-(spec.emitterY || 0) * zoom}px)`;

  updateMotionPath(zoom);
}

// --- 発生位置のドラッグ -----------------------------------------------------
// 目印をつかんで動かす。スライダーと同じ値をいじるだけなので、
// 離した時点ではなく動かしている間ずっとプレビューへ反映される。

const emitterMarker = document.getElementById("emitter-marker");

emitterMarker.addEventListener("pointerdown", (event) => {
  const zoom = previewZoom(canvas.clientWidth, canvas.clientHeight);
  const startX = event.clientX, startY = event.clientY;
  const baseX = spec.emitterX || 0, baseY = spec.emitterY || 0;

  emitterMarker.setPointerCapture(event.pointerId);
  emitterMarker.classList.add("dragging");
  event.preventDefault();

  const onMove = (move) => {
    spec.emitterX = Math.round(baseX + (move.clientX - startX) / zoom);
    spec.emitterY = Math.round(baseY - (move.clientY - startY) / zoom);
    // 動かしている間は該当のスライダーだけ追従させる
    // (syncControls は形状プレビューの取得まで走るので毎フレームは重い)
    controls.get("emitterX")(spec.emitterX);
    controls.get("emitterY")(spec.emitterY);
    requestRebuild();
  };
  const onUp = () => {
    emitterMarker.classList.remove("dragging");
    emitterMarker.removeEventListener("pointermove", onMove);
    emitterMarker.removeEventListener("pointerup", onUp);
    emitterMarker.removeEventListener("pointercancel", onUp);
  };

  emitterMarker.addEventListener("pointermove", onMove);
  emitterMarker.addEventListener("pointerup", onUp);
  emitterMarker.addEventListener("pointercancel", onUp);
});

// ------------------------------------------------------------ エミッタの動き
// プレビューの上をなぞって軌道を作る。作った軌道は名前を付けて何本でも持てる。
//
// 「軌道を焼き込む」… 選んだ 1 本をエフェクトに埋める。再生すればそう動く
// 「組み込み先から動かす」… 発生位置を動的パラメータに繋いだ形で書き出し、
//                          軌道は全部 JSON として同梱する。どれを流すかは向こうで決める

const motionPath = document.getElementById("motion-path");
const motionPolyline = motionPath.querySelector("polyline");
const recordHint = document.getElementById("record-hint");

let motionSelect = null;
let motionNote = null;
let motionLoop = null;

function buildMotionEditor() {
  const box = document.createElement("div");
  box.className = "row";

  const row = document.createElement("div");
  row.className = "motion-row";

  motionSelect = document.createElement("select");
  motionSelect.addEventListener("input", () => {
    spec.motionName = motionSelect.value;
    syncMotionEditor();
    requestRebuild();
  });

  const record = document.createElement("button");
  record.type = "button";
  record.textContent = "記録…";
  record.addEventListener("click", startRecording);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "削除";
  remove.addEventListener("click", () => {
    const index = spec.motions.findIndex((m) => m.name === spec.motionName);
    if (index < 0) return;
    spec.motions.splice(index, 1);
    spec.motionName = spec.motions.length ? spec.motions[0].name : "";
    syncMotionEditor();
    requestRebuild();
  });

  row.append(motionSelect, record, remove);
  box.appendChild(row);

  const loopRow = document.createElement("label");
  loopRow.className = "motion-row";
  motionLoop = document.createElement("input");
  motionLoop.type = "checkbox";
  motionLoop.addEventListener("input", () => {
    const motion = currentMotion();
    if (!motion) return;
    motion.loop = motionLoop.checked;
    requestRebuild();
  });
  const loopText = document.createElement("span");
  loopText.textContent = "終わったら頭へ戻す";
  loopRow.append(motionLoop, loopText);
  box.appendChild(loopRow);

  motionNote = document.createElement("div");
  motionNote.className = "motion-note";
  box.appendChild(motionNote);

  return box;
}

const currentMotion = () => spec.motions.find((m) => m.name === spec.motionName) || null;

function syncMotionEditor() {
  if (!motionSelect) return;

  motionSelect.textContent = "";
  if (!spec.motions.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "(軌道がありません)";
    motionSelect.appendChild(option);
  }
  for (const motion of spec.motions) {
    const option = document.createElement("option");
    option.value = motion.name;
    option.textContent = motion.name;
    motionSelect.appendChild(option);
  }
  if (!currentMotion() && spec.motions.length) spec.motionName = spec.motions[0].name;
  motionSelect.value = spec.motionName || "";

  const motion = currentMotion();
  motionLoop.checked = motion ? !!motion.loop : true;
  motionLoop.disabled = !motion;
  motionNote.textContent = motion
    ? `${motion.points.length} 点 / ${motion.frames} フレーム (${(motion.frames / 60).toFixed(1)} 秒)`
    : "「記録…」を押してプレビューの上をなぞる";
}

/// 選んでいる軌道をプレビューへ重ねる。
function updateMotionPath(zoom) {
  const motion = spec.emitterMotion === "none" ? null : currentMotion();
  motionPath.classList.toggle("hidden", !motion || motion.points.length < 2);
  if (!motion || motion.points.length < 2) return;

  const cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2;
  motionPolyline.setAttribute("points", motion.points
    .map((p) => `${cx + (spec.emitterX + p.x) * zoom},${cy - (spec.emitterY + p.y) * zoom}`)
    .join(" "));
}

// --- 記録 ---------------------------------------------------------------
// 押している間の指の位置を毎フレーム拾う。フレーム番号は経過時間から出すので、
// ゆっくりなぞればゆっくりな動きになる。

let recording = null;

function startRecording() {
  if (recording) return;
  recording = { points: [], startedAt: 0 };
  recordHint.classList.remove("hidden");
  canvas.style.cursor = "crosshair";
}

function stopRecording(save) {
  if (!recording) return;
  const points = recording.points;
  recording = null;
  recordHint.classList.add("hidden");
  canvas.style.cursor = "";

  if (!save || points.length < 2) return;

  const name = (prompt("軌道の名前", suggestMotionName()) || "").trim();
  if (!name) return;
  if (!/^[^\\/:*?"<>|]+$/.test(name)) {
    setStatus("軌道の名前に使えない文字があります", true);
    return;
  }

  const motion = { name, frames: points[points.length - 1].frame, loop: true, points };
  const existing = spec.motions.findIndex((m) => m.name === name);
  if (existing >= 0) spec.motions[existing] = motion;
  else spec.motions.push(motion);

  spec.motionName = name;
  if (spec.emitterMotion === "none") {
    spec.emitterMotion = "baked";
    controls.get("emitterMotion")("baked");
  }
  syncMotionEditor();
  requestRebuild();
  setStatus(`軌道「${name}」を記録しました`);
}

function suggestMotionName() {
  for (let i = 1; ; i++) {
    const name = `軌道${i}`;
    if (!spec.motions.some((m) => m.name === name)) return name;
  }
}

/// 画面の座標をワールド (発生位置からの相対) へ直す。
function toMotionPoint(event, zoom) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.round((event.clientX - rect.left - rect.width / 2) / zoom - spec.emitterX),
    y: Math.round(-((event.clientY - rect.top - rect.height / 2) / zoom) - spec.emitterY),
  };
}

/// キャンバスは下で宣言しているので、起動時に呼んでもらう。
function initMotionRecording() {
  canvas.addEventListener("pointerdown", (event) => {
    if (!recording) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const zoom = previewZoom(canvas.clientWidth, canvas.clientHeight);
    recording.startedAt = event.timeStamp;
    recording.points = [{ frame: 0, ...toMotionPoint(event, zoom) }];
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!recording || !recording.points.length) return;
    const zoom = previewZoom(canvas.clientWidth, canvas.clientHeight);
    const frame = Math.round((event.timeStamp - recording.startedAt) / (1000 / 60));
    const last = recording.points[recording.points.length - 1];
    if (frame <= last.frame) return;           // 同じフレームに 2 点は要らない
    recording.points.push({ frame, ...toMotionPoint(event, zoom) });
  });

  canvas.addEventListener("pointerup", () => stopRecording(true));
  canvas.addEventListener("pointercancel", () => stopRecording(false));

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") stopRecording(false);
  });
}

// ---------------------------------------------------------------- 形状エディタ
// 形は「手続き的に生成する」か「取り込んだ画像を使う」かの 2 通り。
// 手続き的なほうは下のスライダー群で、プリセットはその出発点。

let shapePreviewEl = null;
let shapeNoteEl = null;

function buildShapeEditor() {
  const box = document.createElement("div");
  box.className = "row shape-editor";

  const top = document.createElement("div");
  top.className = "shape-top";

  shapePreviewEl = document.createElement("div");
  shapePreviewEl.className = "shape-preview";
  shapePreviewEl.title = "いまの形";

  const buttons = document.createElement("div");
  buttons.className = "shape-presets";

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.textContent = "画像を取り込む…";
  importButton.addEventListener("click", () => fileInput.click());

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.hidden = true;
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) importImage(fileInput.files[0]);
    fileInput.value = "";
  });

  top.append(shapePreviewEl, buttons);
  box.append(top, importButton, fileInput);

  shapeNoteEl = document.createElement("div");
  shapeNoteEl.className = "shape-note";
  box.appendChild(shapeNoteEl);

  // プリセットはサーバから取る (組み込みテンプレートと同じ定義を共有するため)
  fetch("/api/shapes").then((r) => r.json()).then((presets) => {
    for (const preset of presets) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = preset.name;
      button.addEventListener("click", () => {
        spec.shape = { ...preset.shape, type: "procedural", imageId: null };
        syncControls();
        requestRebuild();
      });
      buttons.appendChild(button);
    }
  });

  return box;
}

/// 手続き的なスライダーは画像を使っているときは効かないので、見た目でも分かるようにする。
function updateShapeRowsEnabled() {
  const isImage = spec.shape.type === "image";
  for (const row of document.querySelectorAll('#params .row[data-procedural="1"]')) {
    row.classList.toggle("disabled", isImage);
    const input = row.querySelector("input");
    if (input) input.disabled = isImage;
  }
  if (shapeNoteEl) {
    shapeNoteEl.textContent = isImage
      ? "取り込んだ画像を使用中。プリセットを押すと手続き的な形に戻ります。"
      : "";
  }
}

let shapePreviewUrl = null;

async function updateShapePreview() {
  if (!shapePreviewEl) return;
  const res = await fetch("/api/shape.png", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec.shape),
  });
  if (!res.ok) return;

  if (shapePreviewUrl) URL.revokeObjectURL(shapePreviewUrl);
  shapePreviewUrl = URL.createObjectURL(await res.blob());
  shapePreviewEl.style.backgroundImage = `url(${shapePreviewUrl})`;
}

/// スライダーを動かしたら手続き的な形に戻す (画像から抜ける)
function onShapeEdited() {
  if (spec.shape.type === "image") {
    spec.shape.type = "procedural";
    spec.shape.imageId = null;
    updateShapeRowsEnabled();
  }
  updateShapePreview();
}

/// 取り込んだ画像は 2 の冪サイズへ整えてから送る。
/// Effekseer の WebGL ランタイムは非 2 冪テクスチャを勝手に縮めるので、
/// ここで揃えておかないとプレビューと書き出しで見た目がずれる。
async function importImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = Math.min(512, Math.max(32, nextPowerOfTwo(Math.max(bitmap.width, bitmap.height))));

    const canvas2d = document.createElement("canvas");
    canvas2d.width = size;
    canvas2d.height = size;
    const ctx2d = canvas2d.getContext("2d");
    ctx2d.drawImage(bitmap, 0, 0, size, size);

    const blob = await new Promise((r) => canvas2d.toBlob(r, "image/png"));
    const res = await fetch("/api/images", { method: "POST", body: blob });
    if (!res.ok) throw new Error(await res.text());

    const { id } = await res.json();
    spec.shape = { ...spec.shape, type: "image", imageId: id };
    updateShapeRowsEnabled();
    await updateShapePreview();
    await rebuild();
    setStatus(`画像を取り込みました (${size}x${size})`);
  } catch (e) {
    setStatus("画像の取り込みに失敗: " + e.message, true);
  }
}

function nextPowerOfTwo(n) {
  let v = 1;
  while (v < n) v *= 2;
  return v;
}

// ---------------------------------------------------------------- プロジェクト

const nameInput = document.getElementById("project-name");
const projectList = document.getElementById("project-list");

async function refreshProjectList(selected) {
  const res = await fetch("/api/projects");
  const items = await res.json();

  projectList.textContent = "";
  const head = document.createElement("option");
  head.value = "";
  head.textContent = items.length ? "読み込み…" : "(保存されたものはありません)";
  projectList.appendChild(head);

  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item.name;
    opt.textContent = `${item.name}  —  ${new Date(item.modified).toLocaleString()}`;
    projectList.appendChild(opt);
  }
  projectList.value = selected || "";
}

async function saveProject() {
  const name = nameInput.value.trim();
  if (!name) { setStatus("プロジェクト名を入力してください", true); nameInput.focus(); return; }

  const res = await fetch("/api/projects/" + encodeURIComponent(name), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) { setStatus("保存に失敗: " + (await res.text()), true); return; }

  await refreshProjectList(name);
  setStatus(`保存しました: ${name}`);
}

async function loadProject(name) {
  const res = await fetch("/api/projects/" + encodeURIComponent(name));
  if (!res.ok) { setStatus("読み込みに失敗: " + res.status, true); return; }

  const document_ = await res.json();
  applySpec(document_.spec);
  nameInput.value = name;
  await rebuild();
  setStatus(`読み込みました: ${name}`);
}

document.getElementById("btn-save").addEventListener("click", saveProject);
projectList.addEventListener("change", () => {
  if (projectList.value) loadProject(projectList.value);
});

// ---------------------------------------------------------------- エクスポート

async function exportEffect() {
  const format = document.getElementById("export-format").value;
  const name = nameInput.value.trim();
  const query = new URLSearchParams({ format });
  if (name) query.set("name", name);

  const res = await fetch("/api/export?" + query, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) { setStatus("書き出しに失敗: " + res.status, true); return; }

  // サーバが Content-Disposition で付けたファイル名をそのまま使う
  const disposition = res.headers.get("Content-Disposition") || "";
  const matched = /filename="?([^";]+)"?/.exec(disposition);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = matched ? decodeURIComponent(matched[1]) : "effect.zip";
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus(`書き出しました: ${a.download}`);
}

document.getElementById("btn-export").addEventListener("click", exportEffect);

// ---------------------------------------------------------------- プレビュー

// エフェクトは「発生ノード + 粒ノード」の 2 段構成なので、粒 1 つにつき
// インスタンスが 2 つ要る。effekseer.js の既定 (4000) では足りなくなるので広げる。
const INSTANCE_MAX = 12000;
const INSTANCES_PER_PARTICLE = 2;
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
    const next = await loadEffectOn(context, buffer);

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

/// パラメータからエフェクトのバイナリを作る。
async function buildEffect(forSpec) {
  const res = await fetch("/api/effect.efk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(forSpec),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.arrayBuffer();
}

/// エフェクトを「テクスチャまで含めて完全に読み終わった状態」で返す。
///
/// 注意: loadEffect() に ArrayBuffer を渡すと、依存リソースが Effekseer 側の
/// キャッシュに残っている場合は onload が *同期的に* 呼ばれる。つまり
/// loadEffect() の戻り値をコールバックの中から参照することはできない。
/// (ここを踏み外すと「パラメータを変えるとプレビューが消える」不具合になる)
function loadEffectOn(ctx, buffer) {
  return new Promise((resolve, reject) => {
    const created = ctx.loadEffect(
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

function clearToBackground() {
  const c = spec.backgroundColor || "#000000";
  const r = parseInt(c.slice(1, 3), 16) / 255;
  const g = parseInt(c.slice(3, 5), 16) / 255;
  const b = parseInt(c.slice(5, 7), 16) / 255;
  gl.clearColor(r, g, b, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

/// 1 フレーム分の更新と描画。
function step(w, h) {
  clearToBackground();
  // 等倍なら 1 ワールド単位 = 1 CSS ピクセル。
  // 枠を出しているときは、枠が収まるぶんだけ視野を広げる (= 縮小表示)。
  const zoom = previewZoom(w, h);
  context.setProjectionOrthographic(w / zoom, h / zoom, 1, 4000);
  context.setCameraLookAt(0, 0, 1000, 0, 0, 0, 0, 1, 0);
  context.update(1.0);
  context.draw();
  return zoom;
}

function frame() {
  const { w, h } = resize();
  gl.viewport(0, 0, canvas.width, canvas.height);

  if (context) {
    const zoom = step(w, h);
    updateFrameGuide(zoom);
    // 空き枠から逆算したインスタンス数を、粒の数に直して見せる
    const instances = INSTANCE_MAX - context.getRestInstancesCount();
    statsEl.textContent = `particles: ${Math.round(instances / INSTANCES_PER_PARTICLE)}`;
  }

  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- テンプレート
// 組み込み (サーバのコード定義) とユーザー追加を 1 つのグリッドで見せる。
// サムネイルはプレビューとは別の WebGL コンテキストで焼くので、
// 一覧を開いても編集中のプレビューには影響しない。

const overlay = document.getElementById("template-overlay");
const grid = document.getElementById("template-grid");
const templateNameInput = document.getElementById("template-name");
const thumbnailCache = new Map();

let thumbCanvas = null, thumbGl = null, thumbContext = null;

function initThumbnailContext() {
  if (thumbContext) return thumbContext;
  thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = 240;
  thumbCanvas.height = 180;
  // toDataURL でフレームバッファを読むので保持を頼んでおく
  thumbGl = thumbCanvas.getContext("webgl", { alpha: false, depth: true, antialias: true, preserveDrawingBuffer: true });
  thumbContext = effekseer.createContext();
  thumbContext.init(thumbGl, { instanceMaxCount: INSTANCE_MAX, squareMaxCount: 20000 });
  return thumbContext;
}

/// テンプレートを一定フレーム進めた絵を PNG の data URL にして返す。
async function renderThumbnail(templateSpec) {
  const ctx = initThumbnailContext();
  const created = await loadEffectOn(ctx, await buildEffect(templateSpec));

  ctx.stopAll();
  ctx.play(created, 0, 0, 0);

  const bg = templateSpec.backgroundColor || "#101014";
  const r = parseInt(bg.slice(1, 3), 16) / 255;
  const g = parseInt(bg.slice(3, 5), 16) / 255;
  const b = parseInt(bg.slice(5, 7), 16) / 255;

  thumbGl.viewport(0, 0, thumbCanvas.width, thumbCanvas.height);
  // 実プレビューより広い範囲を映して全体像が入るようにする
  for (let i = 0; i < 90; i++) {
    thumbGl.clearColor(r, g, b, 1);
    thumbGl.clear(thumbGl.COLOR_BUFFER_BIT | thumbGl.DEPTH_BUFFER_BIT);
    ctx.setProjectionOrthographic(1000, 750, 1, 4000);
    ctx.setCameraLookAt(0, 0, 1000, 0, 0, 0, 0, 1, 0);
    ctx.update(1.0);
    ctx.draw();
  }

  const url = thumbCanvas.toDataURL("image/png");
  ctx.stopAll();
  ctx.releaseEffect(created);
  return url;
}

async function openTemplates() {
  overlay.classList.remove("hidden");
  const res = await fetch("/api/templates");
  const items = await res.json();

  grid.textContent = "";
  for (const item of items) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";

    const thumb = document.createElement("span");
    thumb.className = "thumb";
    if (thumbnailCache.has(item.name)) {
      thumb.style.backgroundImage = `url(${thumbnailCache.get(item.name)})`;
    }

    const caption = document.createElement("span");
    caption.className = "caption";
    const label = document.createElement("span");
    label.textContent = item.name;
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = item.builtin ? "組み込み" : "自分の";
    caption.append(label, tag);

    card.append(thumb, caption);
    card.addEventListener("click", () => applyTemplate(item.name));

    if (!item.builtin) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.textContent = "×";
      remove.title = "削除";
      remove.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        await fetch("/api/templates/" + encodeURIComponent(item.name), { method: "DELETE" });
        thumbnailCache.delete(item.name);
        openTemplates();
      });
      card.appendChild(remove);
    }

    grid.appendChild(card);
  }

  // サムネイルは順に焼いて、できたものから差し込む
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (thumbnailCache.has(item.name)) continue;
    try {
      const templateSpec = await (await fetch("/api/templates/" + encodeURIComponent(item.name))).json();
      const url = await renderThumbnail(templateSpec);
      thumbnailCache.set(item.name, url);
      const thumb = grid.children[i]?.querySelector(".thumb");
      if (thumb) thumb.style.backgroundImage = `url(${url})`;
    } catch (e) {
      console.warn("thumbnail failed:", item.name, e);
    }
  }
}

async function applyTemplate(name) {
  const res = await fetch("/api/templates/" + encodeURIComponent(name));
  if (!res.ok) { setStatus("テンプレートの読み込みに失敗: " + res.status, true); return; }

  applySpec(await res.json());
  overlay.classList.add("hidden");
  await rebuild();
  setStatus(`テンプレートを適用: ${name}`);
}

async function addTemplate() {
  const name = templateNameInput.value.trim();
  if (!name) { setStatus("テンプレート名を入力してください", true); templateNameInput.focus(); return; }

  const res = await fetch("/api/templates/" + encodeURIComponent(name), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) { setStatus("追加に失敗: " + (await res.text()), true); return; }

  thumbnailCache.delete(name);       // 上書きされたので焼き直す
  templateNameInput.value = "";
  await openTemplates();
  setStatus(`テンプレートに追加: ${name}`);
}

document.getElementById("btn-templates").addEventListener("click", openTemplates);
document.getElementById("btn-add-template").addEventListener("click", addTemplate);
document.getElementById("btn-close-templates").addEventListener("click", () => overlay.classList.add("hidden"));
overlay.addEventListener("click", (ev) => { if (ev.target === overlay) overlay.classList.add("hidden"); });
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") overlay.classList.add("hidden");
});

// ---------------------------------------------------------------- 自己診断
// ?selftest=1 を付けて開くと、パラメータを変えながら数サイクル回し、
// 各サイクルで「実際にピクセルが描かれたか」を測って DOM に書き出す。
// パラメータ変更のたびにプレビューが消える、といった不具合を機械的に検出するため。

/// 指定フレーム数だけ描画を進めて、光っているピクセルを数える。
function renderAndMeasure(frames) {
  const { w, h } = resize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < frames; i++) step(w, h);
  updateFrameGuide(previewZoom(w, h));

  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // 背景色そのものは「描かれていない」とみなす
  const bg = spec.backgroundColor || "#000000";
  const bgR = parseInt(bg.slice(1, 3), 16);
  const bgG = parseInt(bg.slice(3, 5), 16);
  const bgB = parseInt(bg.slice(5, 7), 16);

  let lit = 0, xMin = 1e9, xMax = -1e9, yMin = 1e9, yMax = -1e9;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (Math.abs(pixels[i] - bgR) > 16 || Math.abs(pixels[i + 1] - bgG) > 16 || Math.abs(pixels[i + 2] - bgB) > 16) {
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
  cycles.push({ cycle: "burst", hue: spec.hue, ...renderAndMeasure(40) });

  // 発生位置: ずらした量がそのまま描画位置の移動になるか。
  // 枠を消して等倍にしてから測る (枠があると縮小表示になって倍率が絡む)
  const savedShowFrame = spec.showFrame;
  spec.showFrame = false;
  spec.emitRate = 400; spec.speed = 0; spec.speedVariance = 0;
  spec.gravity = 0; spec.drag = 0; spec.life = 30; spec.lifeVariance = 0;
  spec.emitterX = 0; spec.emitterY = 0;
  await rebuild();
  await sleep(150);
  const atOrigin = renderAndMeasure(30);
  // ずらす量はプレビュー領域からはみ出さない範囲にする (はみ出すと測れない)
  const shiftX = 120, shiftY = -60;
  spec.emitterX = shiftX; spec.emitterY = shiftY;
  await rebuild();
  await sleep(150);
  const atOffset = renderAndMeasure(30);
  spec.showFrame = savedShowFrame;

  const dpr = canvas.width / Math.max(canvas.clientWidth, 1);
  const mid = (r) => (r.x ? [(r.x[0] + r.x[1]) / 2, (r.y[0] + r.y[1]) / 2] : null);
  const from = mid(atOrigin), to = mid(atOffset);
  // readPixels は左下原点なので、y はワールドと同じ向き
  const emitter = from && to
    ? {
        dpr,
        moved: [Math.round((to[0] - from[0]) / dpr), Math.round((to[1] - from[1]) / dpr)],
        expected: [shiftX, shiftY],
        ok: Math.abs((to[0] - from[0]) / dpr - shiftX) < 12
          && Math.abs((to[1] - from[1]) / dpr - shiftY) < 12,
      }
    : { ok: false, reason: "描画されなかった", atOrigin, atOffset };

  // エミッタの動き: 軌道を焼き込むと、粒がその道すじに沿って残るか
  spec.showFrame = false;
  spec.speed = 0; spec.speedVariance = 0; spec.life = 200; spec.lifeVariance = 0;
  spec.emitterX = 0; spec.emitterY = 0; spec.startSize = 12; spec.endSize = 12;
  spec.motions = [{
    name: "__selftest__", frames: 60, loop: false,
    points: [{ frame: 0, x: -150, y: 0 }, { frame: 30, x: 0, y: 90 }, { frame: 60, x: 150, y: 0 }],
  }];
  spec.motionName = "__selftest__";
  spec.emitterMotion = "none";
  await rebuild();
  await sleep(150);
  const still = renderAndMeasure(60);
  spec.emitterMotion = "baked";
  await rebuild();
  await sleep(150);
  const along = renderAndMeasure(60);
  spec.showFrame = savedShowFrame;

  const width = (r) => (r.x ? r.x[1] - r.x[0] : 0);
  const motion = {
    stillWidth: width(still),
    bakedWidth: width(along),
    // 軌道の幅 300px ぶん広がっていれば、道すじに沿って出ている
    ok: width(along) - width(still) > 250 * dpr,
  };

  // 保存 → 読み込みでパラメータが往復するか
  const saveName = "__selftest__";
  spec.hue = 222; spec.life = 123; spec.emitterX = 250;
  await fetch("/api/projects/" + saveName, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(spec),
  });
  spec.hue = 0; spec.life = 1; spec.emitterX = 0;
  const loaded = await (await fetch("/api/projects/" + saveName)).json();
  applySpec(loaded.spec);
  const roundTrip = { hue: spec.hue, life: spec.life, emitterX: spec.emitterX,
    motions: spec.motions.length, motionPoints: spec.motions[0] ? spec.motions[0].points.length : 0,
    ok: spec.hue === 222 && spec.life === 123 && spec.emitterX === 250
      && spec.motions.length === 1 && spec.motions[0].points.length === 3 };
  await fetch("/api/projects/" + saveName, { method: "DELETE" });

  // テンプレート: 一覧が取れて、適用すると描画され、サムネイルも焼けるか
  const list = await (await fetch("/api/templates")).json();
  const templates = { count: list.length, rendered: [] };
  for (const name of ["炎", "爆発", "雪"]) {
    const templateSpec = await (await fetch("/api/templates/" + encodeURIComponent(name))).json();
    applySpec(templateSpec);
    await rebuild();
    await sleep(150);
    const measured = renderAndMeasure(40);
    const thumb = await renderThumbnail(templateSpec);
    templates.rendered.push({
      name,
      litPixels: measured.litPixels,
      thumbnailBytes: thumb.length,
      ok: measured.litPixels > 0 && thumb.length > 1000,
    });
  }
  templates.ok = templates.count >= 12 && templates.rendered.every((t) => t.ok);

  // 形状: プリセットを切り替えても描画され、形ごとに別のテクスチャになるか
  const presets = await (await fetch("/api/shapes")).json();
  const shapes = { count: presets.length, checked: [] };
  for (const preset of presets) {
    spec.shape = { ...preset.shape, type: "procedural", imageId: null };
    await rebuild();
    await sleep(120);
    const measured = renderAndMeasure(30);
    const png = await (await fetch("/api/shape.png", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(spec.shape),
    })).blob();
    shapes.checked.push({ name: preset.name, litPixels: measured.litPixels, pngBytes: png.size,
      ok: measured.litPixels > 0 && png.size > 200 });
  }
  shapes.ok = shapes.checked.every((s) => s.ok);

  const blank = cycles.filter((c) => c.litPixels === 0);
  const el = document.createElement("pre");
  el.id = "selftest";
  el.textContent = JSON.stringify(
    {
      ok: blank.length === 0 && emitter.ok && motion.ok && roundTrip.ok && templates.ok && shapes.ok,
      blankCycles: blank.length, emitter, motion, roundTrip, templates, shapes, cycles,
    }, null, 1);
  document.body.appendChild(el);
}

// ---------------------------------------------------------------- 起動

buildPanel();
initMotionRecording();
syncControls();
refreshProjectList();

if (!gl) {
  setStatus("WebGL を初期化できません", true);
} else {
  effekseer.initRuntime("vendor/effekseer.wasm", () => {
    context = effekseer.createContext();
    context.init(gl, { instanceMaxCount: INSTANCE_MAX, squareMaxCount: 20000 });
    setStatus("準備完了");
    if (SELFTEST) {
      runSelfTest();
    } else {
      rebuild();
      requestAnimationFrame(frame);
      if (location.hash === "#templates") openTemplates();
    }
  }, () => {
    setStatus("effekseer.wasm の読み込みに失敗しました", true);
  });
}
