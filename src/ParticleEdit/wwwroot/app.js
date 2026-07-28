"use strict";

// ---------------------------------------------------------------- パラメータ定義
// ここに 1 行足せば UI とサーバ送信の両方に反映される。
// key は C# 側 EffectSpec のプロパティ名 (camelCase) と一致させること。

const GROUPS = [
  {
    tab: "発生", title: "エミッター",
    params: [
      { key: "emitRate", label: "1秒あたりの発生数", min: 1, max: 400, step: 1, value: 80,
        help: "多いほど密になる。重さもここで効く" },
      { key: "emitterX", label: "発生位置 X", min: -960, max: 960, step: 1, value: 0,
        help: "画面中央からの横位置。プレビューの十字をドラッグしても同じ" },
      { key: "emitterY", label: "発生位置 Y", min: -540, max: 540, step: 1, value: 0,
        help: "画面中央からの縦位置。正の値が画面の上方向" },
      { type: "emitter-reset" },
      { key: "spawnRangeX", label: "発生位置のばらつき X", min: 0, max: 600, step: 1, value: 0,
        help: "発生位置を横にばらけさせる幅。0 で 1 点から" },
      { key: "spawnRangeY", label: "発生位置のばらつき Y", min: 0, max: 600, step: 1, value: 0,
        help: "発生位置を縦にばらけさせる幅。0 で 1 点から" },
      { key: "speed", label: "初速", min: 0, max: 30, step: 0.05, value: 5,
        help: "1 フレームあたりに進むピクセル数" },
      { key: "speedVariance", label: "初速のばらつき", min: 0, max: 30, step: 0.05, value: 3,
        help: "速さのばらつきの幅。粒ごとにこの範囲で散る" },
      { key: "direction", label: "方向 (度)", min: 0, max: 360, step: 1, value: 90,
        help: "出ていく向き。0 が右、90 が上 (反時計回り)" },
      { key: "directionVariance", label: "方向の広がり (度)", min: 0, max: 360, step: 1, value: 40,
        help: "出ていく向きの広がり。360 で全方向へ放射する" },
      { key: "gravity", label: "重力", min: 0, max: 1, step: 0.005, value: 0.06,
        help: "1 フレームあたりに速度へ加わる量。0 で無効" },
      { key: "gravityDirection", label: "重力の向き (度)", min: 0, max: 360, step: 1, value: 270,
        help: "引かれる向き。270 が下、90 が上" },
      { key: "drag", label: "空気抵抗", min: 0, max: 1, step: 0.005, value: 0,
        help: "速度を減らしていく強さ。上げるとすぐ止まる" },
      { key: "locationBind", label: "発生位置を動かしたとき", type: "select", value: "spawn",
        options: [["spawn", "その場に置き去り (軌跡になる)"], ["always", "まるごと追従"]],
        help: "再生中に発生位置を動かしたとき、すでに出ている粒がどうなるか" },
    ],
  },
  {
    tab: "発生", title: "ループ",
    params: [
      { key: "loop", label: "同じパターンを繰りかえす", type: "toggle", value: false,
        help: "周期ごとに発生をやり直す。アニメパターンの書き出しはこの周期を使う" },
      { key: "loopFrames", label: "周期 (フレーム)", min: 2, max: 300, step: 1, value: 60,
        help: "何フレームで一巡するか (60 でおよそ 1 秒)" },
      { key: "loopEmitFrames", label: "発生する長さ (フレーム)", min: 1, max: 300, step: 1, value: 60,
        help: "周期のうち粒を出している長さ。周期より短くすると休みができる" },
      { type: "loop-note" },
    ],
  },
  {
    tab: "粒", title: "パーティクル",
    params: [
      { key: "life", label: "寿命 (フレーム)", min: 1, max: 300, step: 1, value: 70,
        help: "粒が消えるまでのフレーム数 (60 でおよそ 1 秒)" },
      { key: "lifeVariance", label: "寿命のばらつき", min: 0, max: 300, step: 1, value: 30,
        help: "寿命のばらつきの幅" },
      { key: "startSize", label: "開始サイズ", min: 0, max: 600, step: 1, value: 64,
        help: "発生した瞬間の大きさ (ピクセル)" },
      { key: "startSizeVariance", label: "開始サイズのばらつき", min: 0, max: 600, step: 1, value: 26,
        help: "開始サイズのばらつきの幅" },
      { key: "endSize", label: "終了サイズ", min: 0, max: 600, step: 1, value: 0,
        help: "消える直前の大きさ。0 にすると縮みながら消える" },
      { key: "endSizeVariance", label: "終了サイズのばらつき", min: 0, max: 600, step: 1, value: 0,
        help: "終了サイズのばらつきの幅" },
      { key: "rotation", label: "発生時の角度 (度)", min: 0, max: 360, step: 1, value: 0,
        help: "発生したときの角度。基準は進行方向" },
      { key: "rotationVariance", label: "角度のばらつき (度)", min: 0, max: 360, step: 1, value: 0,
        help: "角度のばらつきの幅。360 でばらばらの向きになる" },
      { key: "rotationSpeed", label: "回転速度 (度/フレーム)", min: -20, max: 20, step: 0.1, value: 0,
        help: "1 フレームあたりに回る角度。正で反時計回り" },
      { key: "rotationSpeedVariance", label: "回転速度のばらつき", min: 0, max: 40, step: 0.1, value: 0,
        help: "回る速さのばらつきの幅" },
    ],
  },
  {
    tab: "色", title: "カラー",
    params: [
      { key: "hue", label: "色相", min: 0, max: 360, step: 1, value: 30,
        help: "色あい。0 が赤、120 が緑、240 が青" },
      { key: "hueVariance", label: "色相のばらつき", min: 0, max: 360, step: 1, value: 40,
        help: "色あいのばらつきの幅。広げると色とりどりになる" },
      { key: "saturation", label: "彩度", min: 0, max: 100, step: 1, value: 85,
        help: "0 で白黒、100 で鮮やか" },
      { key: "saturationVariance", label: "彩度のばらつき", min: 0, max: 100, step: 1, value: 15 },
      { key: "brightness", label: "明度", min: 0, max: 100, step: 1, value: 100,
        help: "明るさ。加算合成では強さになる" },
      { key: "brightnessVariance", label: "明度のばらつき", min: 0, max: 100, step: 1, value: 0 },
      { key: "startAlpha", label: "開始の透明度", min: 0, max: 1, step: 0.01, value: 1,
        help: "発生した瞬間の濃さ" },
      { key: "endAlpha", label: "終了の透明度", min: 0, max: 1, step: 0.01, value: 0,
        help: "消える直前の濃さ。0 にすると薄れながら消える" },
    ],
  },
  {
    tab: "形", title: "描画",
    params: [
      { key: "blend", label: "ブレンド", type: "select", value: "add",
        options: [["add", "加算"], ["blend", "通常"]],
        help: "加算は光もの向き。通常は紙吹雪など下の絵を隠すもの向き" },
    ],
  },
  {
    tab: "形", title: "形状",
    params: [
      { type: "shape-editor" },
      { key: "shape.sides", label: "辺の数 (0 = 円)", min: 0, max: 16, step: 1, value: 0,
        help: "0 で円、3 以上でその辺数の多角形" },
      { key: "shape.starRatio", label: "星形", min: 0.05, max: 1, step: 0.01, value: 1,
        help: "1 で正多角形。下げるほど鋭い星になる" },
      { key: "shape.hole", label: "中抜き", min: 0, max: 0.9, step: 0.01, value: 0,
        help: "中心をくり抜く割合。上げるとリングになる" },
      { key: "shape.blur", label: "ぼかし", min: 0, max: 1, step: 0.01, value: 1,
        help: "縁のぼかし幅。0 でくっきり、1 で中心から滑らかに減衰" },
      { key: "shape.falloff", label: "ぼかしの曲がり", min: 0.2, max: 4, step: 0.05, value: 2,
        help: "減衰のカーブ。大きいほど中心に濃さが集まる" },
      { key: "shape.rotation", label: "回転 (度)", min: 0, max: 360, step: 1, value: 0,
        help: "形そのものの向き。90 度で上 (反時計回り)" },
      { key: "shape.scale", label: "大きさ", min: 0.2, max: 1, step: 0.01, value: 1,
        help: "テクスチャいっぱいに対する比率。余白の調整" },
    ],
  },
  {
    tab: "表示", title: "プレビュー (エフェクトには含まれない)",
    params: [
      { key: "backgroundColor", label: "背景色", type: "color", value: "#101014",
        help: "見やすさのためのもの。エフェクトには入らない" },
      { type: "background-image" },
      { key: "backgroundBrightness", label: "背景画像の明るさ", min: 0, max: 100, step: 1, value: 100,
        help: "背景を暗くすると粒が見やすくなる" },
      { key: "showFrame", label: "画面サイズの枠を表示", type: "toggle", value: true,
        help: "組み込み先の画面サイズを枠として重ねる" },
      { type: "frame-presets" },
      { key: "frameWidth", label: "画面の幅", min: 320, max: 2560, step: 16, value: 1280,
        help: "組み込み先の画面の幅" },
      { key: "frameHeight", label: "画面の高さ", min: 240, max: 1600, step: 16, value: 720,
        help: "組み込み先の画面の高さ" },
    ],
  },
  {
    tab: "動き", title: "エミッタの動き",
    params: [
      { key: "emitterMotion", label: "動かしかた", type: "select", value: "none",
        options: [
          ["none", "動かさない"],
          ["baked", "軌道を焼き込む"],
          ["dynamic", "組み込み先から動かす"],
        ],
        help: "発生位置そのものを動かすかどうか。詳しくはヘルプへ" },
      { type: "motion-editor" },
    ],
  },
  {
    tab: "動き", title: "再生側の操作 (確認用)",
    params: [
      { key: "playX", label: "位置 X", min: -960, max: 960, step: 1, value: 0,
        help: "組み込み先がエフェクト全体を置く位置。エフェクトには入らない" },
      { key: "playY", label: "位置 Y", min: -540, max: 540, step: 1, value: 0,
        help: "同上。正の値が画面の上方向" },
      { key: "playZoom", label: "ズーム (%)", min: 10, max: 400, step: 1, value: 100,
        help: "組み込み先が掛ける拡大率。粒の大きさも一緒に変わる" },
      { key: "playRotation", label: "回転 (度)", min: 0, max: 360, step: 1, value: 0,
        help: "組み込み先が掛ける回転。反時計回り" },
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

// つまみを持たないもの (形・軌道・アニメパターンの焼きかた) はここで初期値を与える
const spec = {
  shape: { type: "procedural", curve: "polygon", imageId: null }, motions: [], motionName: "",
  patternFormat: "sheet", patternWidth: 256, patternHeight: 256,
  patternColumns: 8, patternStep: 1, patternQuality: 92,
};
for (const g of GROUPS) for (const p of g.params) if (p.key) setPath(spec, p.key, p.value);

/// キー -> UI へ値を書き戻す関数。プロジェクトやテンプレートの読み込み時に使う。
const controls = new Map();

/// エフェクトデータに影響しない (= 作り直しが要らない) パラメータ
const EDITOR_ONLY_KEYS = new Set([
  "backgroundColor", "backgroundBrightness", "showFrame", "frameWidth", "frameHeight",
  "playX", "playY", "playZoom", "playRotation",
  "patternFormat", "patternWidth", "patternHeight", "patternColumns", "patternStep", "patternQuality",
]);

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

// パラメータは数が多いので、グループをタブへ振り分けて出す。
// 1 タブに複数グループが入るときだけグループ名の見出しを出す。

const TAB_STORAGE_KEY = "particleedit.tab";

const tabOf = (group) => group.tab || group.title;

function buildPanel() {
  const panel = document.getElementById("params");

  const tabBar = document.createElement("div");
  tabBar.className = "tabs";
  panel.appendChild(tabBar);

  // タブごとの入れ物を、GROUPS に出てくる順で作る
  const pages = new Map();
  const groupsPerTab = new Map();
  for (const group of GROUPS) {
    const tab = tabOf(group);
    groupsPerTab.set(tab, (groupsPerTab.get(tab) || 0) + 1);
    if (pages.has(tab)) continue;
    const page = document.createElement("div");
    page.className = "page hidden";
    panel.appendChild(page);
    pages.set(tab, page);
  }

  for (const group of GROUPS) {
    const page = pages.get(tabOf(group));

    if (groupsPerTab.get(tabOf(group)) > 1) {
      const title = document.createElement("div");
      title.className = "group-title";
      title.textContent = group.title;
      page.appendChild(title);
    }

    for (const p of group.params) {
      if (p.type === "shape-editor") {
        page.appendChild(buildShapeEditor());
        continue;
      }
      if (p.type === "frame-presets") {
        page.appendChild(buildFramePresets());
        continue;
      }
      if (p.type === "motion-editor") {
        page.appendChild(buildMotionEditor());
        continue;
      }
      if (p.type === "background-image") {
        page.appendChild(buildBackgroundEditor());
        continue;
      }
      if (p.type === "emitter-reset") {
        page.appendChild(buildEmitterReset());
        continue;
      }
      if (p.type === "loop-note") {
        loopNoteEl = document.createElement("p");
        loopNoteEl.className = "note";
        page.appendChild(loopNoteEl);
        continue;
      }

      const row = document.createElement("div");
      row.className = "row";
      if (p.key.startsWith("shape.")) row.dataset.procedural = "1";
      row.dataset.key = p.key;
      if (p.help) row.title = p.help;

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
          // 枠の表示のような見た目だけのものは作り直さない
          if (!EDITOR_ONLY_KEYS.has(p.key)) requestRebuild();
          if (p.key === "loop") updateLoopRows();
        });
        controls.set(p.key, (v) => { input.checked = !!v; });
        label.appendChild(input);
        row.classList.add("row-toggle");
        page.appendChild(row);
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

      page.appendChild(row);
    }
  }

  // タブのボタン。選んだタブは次に開いたときも残す。
  const buttons = new Map();
  const select = (tab) => {
    if (!pages.has(tab)) tab = pages.keys().next().value;
    for (const [name, page] of pages) page.classList.toggle("hidden", name !== tab);
    for (const [name, button] of buttons) button.classList.toggle("active", name === tab);
    try { localStorage.setItem(TAB_STORAGE_KEY, tab); } catch (e) { /* 保存できなくても困らない */ }
  };

  for (const tab of pages.keys()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tab;
    button.addEventListener("click", () => select(tab));
    buttons.set(tab, button);
    tabBar.appendChild(button);
  }

  // ?tab=形 のように指定して開くこともできる (説明や不具合報告で場所を示すとき用)
  let saved = new URLSearchParams(location.search).get("tab");
  if (!saved) {
    try { saved = localStorage.getItem(TAB_STORAGE_KEY); } catch (e) { /* 同上 */ }
  }
  select(saved || pages.keys().next().value);
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
  updateLoopRows();
  syncPatternControls();
  syncMotionEditor();
}

// ---------------------------------------------------------------- ループ
// 周期ごとに発生をやり直す。エフェクト側の作りは EffectBuilder の
// 「ループノード」を参照。ここは案内を出すのと、行の有効・無効だけ。

let loopNoteEl = null;

const maxParticleLife = () => Math.round(spec.life + Math.abs(spec.lifeVariance) / 2);

/// 焼いたら何コマになるか。
const patternFrameCount = () =>
  Math.ceil(Math.max(2, Math.round(spec.loopFrames)) / Math.max(1, Math.round(spec.patternStep)));

function updateLoopRows() {
  for (const key of ["loopFrames", "loopEmitFrames"]) {
    const row = document.querySelector(`#params .row[data-key="${key}"]`);
    if (!row) continue;
    row.classList.toggle("disabled", !spec.loop);
    const input = row.querySelector("input");
    if (input) input.disabled = !spec.loop;
  }

  if (!loopNoteEl) return;
  if (!spec.loop) {
    loopNoteEl.textContent =
      "切っている間は出しっぱなしです。アニメパターンを焼くには周期が要るので、ここを入れてください。";
    return;
  }

  const period = Math.max(2, Math.round(spec.loopFrames));
  const emit = Math.min(Math.round(spec.loopEmitFrames), period);
  const notes = [`1 周 ${(period / 60).toFixed(2)} 秒 / 焼くと ${patternFrameCount()} コマ。`];

  const tail = emit + maxParticleLife();
  if (tail > period) {
    notes.push(`粒は周期を ${tail - period} フレームはみ出すので、前の周の残りと重なります (それでも繰りかえしはつながります)。`);
  }

  const motion = currentMotion();
  if (spec.emitterMotion === "baked" && motion && motion.frames !== period) {
    notes.push(`焼き込む軌道は ${motion.frames} フレームです。周期と揃えないと 1 周ごとに位置がずれます。`);
  }

  loopNoteEl.textContent = notes.join(" ");
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
  // 再生側の配置を掛けた後の位置に置く (そうしないと粒の出どころとずれる)。
  const marker = placedPoint(spec.emitterX || 0, spec.emitterY || 0);
  emitterMarker.style.transform =
    `translate(${marker.x * zoom}px, ${-marker.y * zoom}px)`;

  updateMotionPath(zoom);
}

/// エフェクト内の座標を、再生側の配置 (位置・ズーム・回転) を掛けた後の座標へ直す。
/// 目印と軌道の道すじを粒の出どころに合わせるために使う。
function placedPoint(x, y) {
  const scale = (spec.playZoom ?? 100) / 100;
  const angle = (spec.playRotation ?? 0) * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const sx = x * scale, sy = y * scale;
  return {
    x: sx * cos - sy * sin + (spec.playX ?? 0),
    y: sx * sin + sy * cos + (spec.playY ?? 0),
  };
}

/// 画面上の移動量を、エフェクト内の移動量へ戻す (placedPoint の逆)。
function unplacedDelta(dx, dy) {
  const scale = Math.max(0.01, (spec.playZoom ?? 100) / 100);
  const angle = -(spec.playRotation ?? 0) * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: (dx * cos - dy * sin) / scale, y: (dx * sin + dy * cos) / scale };
}

/// ドラッグで動かした発生位置を中央へ戻すボタン。
function buildEmitterReset() {
  const row = document.createElement("div");
  row.className = "row";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "発生位置を中央へ戻す";
  button.className = "wide";
  button.addEventListener("click", () => {
    spec.emitterX = 0;
    spec.emitterY = 0;
    syncControls();
    requestRebuild();
    setStatus("発生位置を中央へ戻しました");
  });

  row.appendChild(button);
  return row;
}

// --- 発生位置のドラッグ -----------------------------------------------------
// 目印をつかんで動かす。スライダーと同じ値をいじるだけなので、
// 離した時点ではなく動かしている間ずっとプレビューへ反映される。

const emitterMarker = document.getElementById("emitter-marker");

emitterMarker.addEventListener("pointerdown", (event) => {
  const zoom = previewZoom(canvas.clientWidth, canvas.clientHeight);
  const startX = event.clientX, startY = event.clientY;
  const baseX = spec.emitterX || 0, baseY = spec.emitterY || 0;

  // 取れなくても動かせるようにしておく (合成したイベントでは失敗する)
  try { emitterMarker.setPointerCapture(event.pointerId); } catch (e) { /* 続行 */ }
  emitterMarker.classList.add("dragging");
  event.preventDefault();

  const onMove = (move) => {
    // 画面での動きぶんを、再生側の配置を外した座標へ戻してから足す
    const delta = unplacedDelta((move.clientX - startX) / zoom, -(move.clientY - startY) / zoom);
    spec.emitterX = Math.round(baseX + delta.x);
    spec.emitterY = Math.round(baseY + delta.y);
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

/// 軌道の指定フレームでの位置 (点と点の間は直線で埋める)。
function motionPositionAt(motion, frame) {
  const points = motion.points;
  if (!points || !points.length) return null;
  if (frame <= points[0].frame) return { x: points[0].x, y: points[0].y };

  const last = points[points.length - 1];
  if (frame >= last.frame) return { x: last.x, y: last.y };

  for (let i = 1; i < points.length; i++) {
    const b = points[i];
    if (frame > b.frame) continue;
    const a = points[i - 1];
    const span = b.frame - a.frame;
    const t = span > 0 ? (frame - a.frame) / span : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return null;
}

// --- 軌道の再生 (プレビュー用) --------------------------------------------
// 焼き込みは Effekseer が自分で動かすが、いま何フレーム目でどこに居るのかは
// 外からは分からない。「組み込み先から動かす」ほうは誰も動かさないので、
// そのままだと止まって見える。どちらもこちらで時計を回して面倒を見る。

let motionFrame = 0;

function resetMotionClock() { motionFrame = 0; }

/// 1 フレーム進めて、いまの発生位置を返す。軌道が無ければ null。
function advanceMotion() {
  if (spec.emitterMotion === "none") return null;
  const active = currentMotion();
  if (!active || !active.points || active.points.length < 2) return null;

  const frames = active.frames > 0 ? active.frames : 1;
  motionFrame += 1;
  if (motionFrame > frames) {
    if (active.loop) motionFrame -= Math.floor(motionFrame / frames) * frames;
    else motionFrame = frames;
  }

  const point = motionPositionAt(active, motionFrame);
  if (!point) return null;

  // 「組み込み先から動かす」は誰も値を入れないので、ここで入れて動かして見せる。
  // 組み込み先へ渡すのと同じ流儀 (画面中央が原点・Y は下向き) にする。
  if (spec.emitterMotion === "dynamic" && handle) {
    handle.setDynamicInput(0, point.x);
    handle.setDynamicInput(1, -point.y);
  }

  return { x: spec.emitterX + point.x, y: spec.emitterY + point.y };
}

/// 選んでいる軌道をプレビューへ重ねる。
function updateMotionPath(zoom) {
  const motion = spec.emitterMotion === "none" ? null : currentMotion();
  motionPath.classList.toggle("hidden", !motion || motion.points.length < 2);
  if (!motion || motion.points.length < 2) return;

  const cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2;
  motionPolyline.setAttribute("points", motion.points
    .map((p) => placedPoint(spec.emitterX + p.x, spec.emitterY + p.y))
    .map((p) => `${cx + p.x * zoom},${cy - p.y * zoom}`)
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

// ------------------------------------------------------------------ 背景画像
// 組み込み先の絵に重ねたときの見えかたを確かめるためのもの。
// 中央に原寸で敷くだけ (1 ワールド単位 = 1 ピクセルなので、枠と同じ寸法の絵なら
// ちょうど枠を埋める)。エフェクトのデータには一切入らない。
//
// プロジェクトには保存しない。背景はエフェクトの一部ではないし、入れると
// ファイルが重くなるため。代わりにブラウザ側へ覚えさせて、開き直しても残るようにする。

const BACKGROUND_STORAGE_KEY = "particleedit.background";
const BACKGROUND_MAX = 1920;   // 覚えさせる前に縮める上限

let backgroundNoteEl = null;
let backgroundImage = null;    // HTMLImageElement

function buildBackgroundEditor() {
  const box = document.createElement("div");
  box.className = "row";

  const buttons = document.createElement("div");
  buttons.className = "motion-row";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";
  input.addEventListener("change", () => {
    if (input.files && input.files[0]) loadBackground(input.files[0]);
    input.value = "";
  });

  const pick = document.createElement("button");
  pick.type = "button";
  pick.textContent = "背景画像…";
  pick.addEventListener("click", () => input.click());

  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "外す";
  clear.addEventListener("click", () => setBackground(null));

  buttons.append(pick, clear, input);
  box.appendChild(buttons);

  backgroundNoteEl = document.createElement("div");
  backgroundNoteEl.className = "motion-note";
  box.appendChild(backgroundNoteEl);

  return box;
}

function updateBackgroundNote() {
  if (!backgroundNoteEl) return;
  backgroundNoteEl.textContent = backgroundImage
    ? `${backgroundImage.naturalWidth} × ${backgroundImage.naturalHeight} を中央に原寸で表示中`
    : "組み込み先の絵を敷いて見えかたを確かめられます (保存はされません)";
}

/// 画像を読み込んで、大きすぎれば縮めてから覚えさせる。
async function loadBackground(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, BACKGROUND_MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas2d = document.createElement("canvas");
    canvas2d.width = w;
    canvas2d.height = h;
    canvas2d.getContext("2d").drawImage(bitmap, 0, 0, w, h);

    // 覚えさせる先の容量が小さいので JPEG に落とす (背景の確認用なので十分)
    setBackground(canvas2d.toDataURL("image/jpeg", 0.85));
    setStatus(`背景画像を読み込みました (${w}×${h})`);
  } catch (e) {
    setStatus("背景画像の読み込みに失敗: " + e.message, true);
  }
}

/// データ URL を背景にする。null で外す。
function setBackground(dataUrl) {
  if (!dataUrl) {
    backgroundImage = null;
    releaseBackgroundTexture();
    try { localStorage.removeItem(BACKGROUND_STORAGE_KEY); } catch (e) { /* 覚えられなくても困らない */ }
    updateBackgroundNote();
    return;
  }

  const image = new Image();
  image.addEventListener("load", () => {
    backgroundImage = image;
    releaseBackgroundTexture();     // 次の描画で作り直す
    updateBackgroundNote();
  });
  image.addEventListener("error", () => setStatus("背景画像を表示できません", true));
  image.src = dataUrl;

  try {
    localStorage.setItem(BACKGROUND_STORAGE_KEY, dataUrl);
  } catch (e) {
    setStatus("背景画像を覚えられませんでした (表示はされます)", true);
  }
}

function restoreBackground() {
  let saved = null;
  try { saved = localStorage.getItem(BACKGROUND_STORAGE_KEY); } catch (e) { /* 同上 */ }
  if (saved) setBackground(saved);
  else updateBackgroundNote();
}

// --- 描画 -----------------------------------------------------------------
// エフェクトと同じキャンバスへ、Effekseer が描く前に敷く。
// キャンバスの外で CSS として重ねる手もあるが、加算合成の粒を透明なキャンバス越しに
// 合成すると色が変わってしまうので、中で描いてしまうほうが素直。

let bgProgram = null;
let bgBuffer = null;
let bgTexture = null;
let bgUniform = null;

function releaseBackgroundTexture() {
  if (bgTexture && gl) gl.deleteTexture(bgTexture);
  bgTexture = null;
}

function initBackgroundProgram() {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, `
    attribute vec2 corner;
    uniform vec2 half_size;
    varying vec2 uv;
    void main() {
      // 画像の上下は逆なので v を反転する
      uv = vec2(corner.x * 0.5 + 0.5, 0.5 - corner.y * 0.5);
      gl_Position = vec4(corner * half_size, 0.0, 1.0);
    }`);
  const fs = compile(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D image;
    uniform float brightness;
    varying vec2 uv;
    void main() {
      gl_FragColor = vec4(texture2D(image, uv).rgb * brightness, 1.0);
    }`);

  bgProgram = gl.createProgram();
  gl.attachShader(bgProgram, vs);
  gl.attachShader(bgProgram, fs);
  gl.bindAttribLocation(bgProgram, 0, "corner");
  gl.linkProgram(bgProgram);

  bgUniform = {
    halfSize: gl.getUniformLocation(bgProgram, "half_size"),
    image: gl.getUniformLocation(bgProgram, "image"),
    brightness: gl.getUniformLocation(bgProgram, "brightness"),
  };

  bgBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function drawBackground(w, h, zoom) {
  if (!backgroundImage || !gl) return;
  if (!bgProgram) initBackgroundProgram();

  if (!bgTexture) {
    bgTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backgroundImage);
    // 2 の冪とは限らないのでミップマップも繰り返しも使えない
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // 中央に原寸で置く。プレビューの縮小率だけ掛ける。
  const halfX = backgroundImage.naturalWidth * zoom / w;
  const halfY = backgroundImage.naturalHeight * zoom / h;

  gl.useProgram(bgProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, bgTexture);
  gl.uniform1i(bgUniform.image, 0);
  gl.uniform2f(bgUniform.halfSize, halfX, halfY);
  gl.uniform1f(bgUniform.brightness, Math.max(0, (spec.backgroundBrightness ?? 100) / 100));

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.depthMask(false);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.depthMask(true);

  gl.disableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.useProgram(null);
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
// 決め打ちの曲線 (ハートなど) では、多角形のためのつまみは効かない
const POLYGON_ONLY_KEYS = new Set(["shape.sides", "shape.starRatio"]);

function updateShapeRowsEnabled() {
  const isImage = spec.shape.type === "image";
  const isCurve = !isImage && spec.shape.curve && spec.shape.curve !== "polygon";

  for (const row of document.querySelectorAll('#params .row[data-procedural="1"]')) {
    const off = isImage || (isCurve && POLYGON_ONLY_KEYS.has(row.dataset.key));
    row.classList.toggle("disabled", off);
    const input = row.querySelector("input");
    if (input) input.disabled = off;
  }

  if (shapeNoteEl) {
    shapeNoteEl.textContent =
      isImage ? "取り込んだ画像を使用中。プリセットを押すと手続き的な形に戻ります。"
      : isCurve ? "決まった形なので、辺の数と星形は効きません。ほかのつまみは使えます。"
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
  await receiveFile(res, "effect.zip");
}

/// 書き出しの返事を受け取る。ファイルとして降ってきたらダウンロードさせる。
async function receiveFile(res, fallbackName) {
  if (!res.ok) { setStatus("書き出しに失敗: " + (await res.text() || res.status), true); return; }

  // particleedit.json で書き出し先が決まっているときは、サーバがそこへ置いて
  // 置いた場所を返してくる (ブラウザからは保存先を選べないため)
  if ((res.headers.get("Content-Type") || "").startsWith("application/json")) {
    const done = await res.json();
    setStatus(`書き出しました: ${done.path}${done.note ? "  (" + done.note + ")" : ""}`);
    return;
  }

  // サーバが Content-Disposition で付けたファイル名をそのまま使う
  const disposition = res.headers.get("Content-Disposition") || "";
  const matched = /filename="?([^";]+)"?/.exec(disposition);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = matched ? decodeURIComponent(matched[1]) : fallbackName;
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
  updateLoopRows();
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
/// cycle に "one" を渡すと、ループの 1 周期ぶんだけ発生するものになる (アニメパターン用)。
async function buildEffect(forSpec, cycle) {
  const res = await fetch("/api/effect.efk" + (cycle ? "?cycle=" + cycle : ""), {
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
  resetMotionClock();
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
/// 組み込み先がエフェクト全体に掛ける配置を真似る。
/// 平行移動が既に出ている粒に効かないのに拡縮と回転は効く、といった差もここで見える。
function applyPlacement() {
  if (!handle) return;
  const scale = Math.max(0.01, (spec.playZoom ?? 100) / 100);
  handle.setLocation(spec.playX ?? 0, spec.playY ?? 0, 0);
  handle.setRotation(0, 0, (spec.playRotation ?? 0) * Math.PI / 180);
  handle.setScale(scale, scale, scale);
}

function step(w, h) {
  clearToBackground();
  drawBackground(w, h, previewZoom(w, h));
  // 等倍なら 1 ワールド単位 = 1 CSS ピクセル。
  // 枠を出しているときは、枠が収まるぶんだけ視野を広げる (= 縮小表示)。
  const zoom = previewZoom(w, h);
  context.setProjectionOrthographic(w / zoom, h / zoom, 1, 4000);
  context.setCameraLookAt(0, 0, 1000, 0, 0, 0, 0, 1, 0);
  // 配置と発生位置は更新より前に入れる (更新時の値で 1 フレームぶんが決まるため)
  applyPlacement();
  const position = advanceMotion();
  context.update(1.0);
  context.draw();
  return { zoom, position };
}

function frame() {
  const { w, h } = resize();
  gl.viewport(0, 0, canvas.width, canvas.height);

  if (context) {
    const { zoom, position } = step(w, h);
    updateFrameGuide(zoom);
    // 空き枠から逆算したインスタンス数を、粒の数に直して見せる
    const instances = INSTANCE_MAX - context.getRestInstancesCount();
    const particles = `particles: ${Math.round(instances / INSTANCES_PER_PARTICLE)}`;
    statsEl.textContent = position
      ? `${particles}    発生位置: ${Math.round(position.x)}, ${Math.round(position.y)}`
      : particles;
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

// ---------------------------------------------------------------- ヘルプ
// 中身は index.html に直書き。ここは開け閉てだけ。

const helpOverlay = document.getElementById("help-overlay");
const showHelp = (on) => helpOverlay.classList.toggle("hidden", !on);

document.getElementById("btn-help").addEventListener("click", () => showHelp(true));
document.getElementById("btn-close-help").addEventListener("click", () => showHelp(false));
helpOverlay.addEventListener("click", (ev) => { if (ev.target === helpOverlay) showHelp(false); });

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    overlay.classList.add("hidden");
    showHelp(false);
    showPattern(false);
  }
  // F1 でヘルプ。ブラウザ既定のヘルプは邪魔なので止める
  if (ev.key === "F1") {
    ev.preventDefault();
    showHelp(helpOverlay.classList.contains("hidden"));
  }
});

// ---------------------------------------------------------------- アニメパターン
// ループの周期を使って、エフェクトを絵の連なりに焼く。
//
// 継ぎ目のない繰りかえしにするための仕掛け:
//
//   1. 「1 周期ぶんだけ発生する」エフェクトを作る (/api/effect.efk?cycle=one)
//   2. 粒が全部消えるまで回して、1 フレームずつ絵を取る
//   3. 周期ごとに折り返して重ねる。i コマ目 = 0 周目の i + 1 周目の i + ...
//
// 3 がすべてで、これは「ずっと繰りかえしている状態」と数式のうえで同じものになる。
// 1 周期ぶんの粒を N フレームおきに何度も重ねたものが、まさに繰りかえしの絵だから。
// 周期をまたいで生き残る粒があっても、その粒は次の周の頭に重なって出てくる。
//
// 重ねかたは合成方法に合わせる。加算はそのまま足す。通常は「後の周ほど古い粒」なので
// 下へ潜らせる。どちらもアルファ乗算のまま計算して、最後に割り戻す。

const PATTERN_UNIT = 16;   // .amv が幅・高さに要求する倍数

const patternOverlay = document.getElementById("pattern-overlay");
const patternNoteEl = document.getElementById("pattern-note");
const patternCanvas = document.getElementById("pattern-canvas");

let bakeCanvas = null, bakeGl = null, bakeContext = null;
let baking = false;

const roundUnit = (v) =>
  Math.max(PATTERN_UNIT, Math.round(v / PATTERN_UNIT) * PATTERN_UNIT);

/// 焼く先の WebGL。プレビューとは別にしておかないと、
/// 焼いている間に表示中の絵を壊してしまう。
function initBakeContext(width, height) {
  if (!bakeContext) {
    bakeCanvas = document.createElement("canvas");
    // 背景を透明にして、粒だけをアルファ付きで取り出す
    bakeGl = bakeCanvas.getContext("webgl", { alpha: true, depth: true, antialias: true });
    bakeContext = effekseer.createContext();
    bakeContext.init(bakeGl, { instanceMaxCount: INSTANCE_MAX, squareMaxCount: 20000 });
  }
  bakeCanvas.width = width;
  bakeCanvas.height = height;
  return bakeContext;
}

/// プレビューの時計とは別に、t フレーム目の発生位置を差し込む。
/// 「組み込み先から動かす」で書き出すエフェクトも、焼くときは動いていてほしいため。
function driveMotionAt(target, frame) {
  if (spec.emitterMotion !== "dynamic") return;
  const active = currentMotion();
  if (!active || !active.points || active.points.length < 2) return;

  const frames = active.frames > 0 ? active.frames : 1;
  const at = active.loop ? ((frame - 1) % frames) + 1 : Math.min(frame, frames);
  const point = motionPositionAt(active, at);
  if (!point) return;

  target.setDynamicInput(0, point.x);
  target.setDynamicInput(1, -point.y);
}

async function bakePattern() {
  const period = Math.max(2, Math.round(spec.loopFrames));
  const step = patternStep();
  const width = roundUnit(spec.patternWidth);
  const height = roundUnit(spec.patternHeight);
  const emit = Math.min(Math.round(spec.loopEmitFrames), period);
  const count = patternFrameCount();

  if (patternMemory() > PATTERN_MEMORY_LIMIT) {
    throw new Error(`この大きさと枚数だと ${Math.round(patternMemory() / 1024 / 1024)}MB 要ります`);
  }

  // 最後に出た粒が消えるまで回す。周期の切りのいいところまで回さないと折り返せない。
  const cycles = Math.max(1, Math.ceil((emit + maxParticleLife() + 2) / period));
  const total = cycles * period;

  const ctx = initBakeContext(width, height);
  const created = await loadEffectOn(ctx, await buildEffect(spec, "one"));
  ctx.stopAll();
  const bakeHandle = ctx.play(created, 0, 0, 0);

  const plane = width * height * 4;
  const accumulator = new Float32Array(count * plane);   // アルファ乗算済みのまま貯める
  const pixels = new Uint8Array(plane);
  const additive = spec.blend !== "blend";

  for (let t = 0; t < total; t++) {
    // 間引いたぶんは絵が要らない。更新だけは毎フレーム回す (飛ばすと動きが変わる)
    const phase = t % period;
    const keep = phase % step === 0;

    driveMotionAt(bakeHandle, t + 1);
    ctx.update(1.0);

    if (keep) {
      bakeGl.viewport(0, 0, width, height);
      bakeGl.clearColor(0, 0, 0, 0);
      bakeGl.clear(bakeGl.COLOR_BUFFER_BIT | bakeGl.DEPTH_BUFFER_BIT);
      ctx.setProjectionOrthographic(width, height, 1, 4000);
      ctx.setCameraLookAt(0, 0, 1000, 0, 0, 0, 0, 1, 0);
      ctx.draw();
      // draw の直後に読む。間に何か挟むと描画結果が消えていることがある
      bakeGl.readPixels(0, 0, width, height, bakeGl.RGBA, bakeGl.UNSIGNED_BYTE, pixels);
      foldFrame(accumulator, phase / step * plane, pixels, additive);
    }

    if (phase === period - 1) {
      setStatus(`焼いています… ${Math.round((t + 1) / total * 100)}%`);
      await new Promise(requestAnimationFrame);   // 画面が固まらないよう息継ぎ
    }
  }

  ctx.stopAll();
  ctx.releaseEffect(created);

  const frames = [];
  for (let i = 0; i < count; i++) frames.push(resolveFrame(accumulator, i * plane, width, height));
  return { frames, width, height, period, step };
}

/// 1 フレームぶんを、その周期位置へ重ねる。
function foldFrame(accumulator, base, pixels, additive) {
  for (let i = 0; i < pixels.length; i += 4) {
    if (additive) {
      accumulator[base + i] += pixels[i];
      accumulator[base + i + 1] += pixels[i + 1];
      accumulator[base + i + 2] += pixels[i + 2];
      accumulator[base + i + 3] += pixels[i + 3];
      continue;
    }

    // 後から重ねるものほど古い周の粒なので、既にあるものの下へ潜らせる
    const under = 1 - accumulator[base + i + 3] / 255;
    if (under <= 0) continue;
    accumulator[base + i] += pixels[i] * under;
    accumulator[base + i + 1] += pixels[i + 1] * under;
    accumulator[base + i + 2] += pixels[i + 2] * under;
    accumulator[base + i + 3] += pixels[i + 3] * under;
  }
}

/// 貯めたものを 1 コマの RGBA にする。上下を戻し、アルファ乗算を解く。
function resolveFrame(accumulator, base, width, height) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    // readPixels は左下が原点なので、ここで裏返す
    const src = base + (height - 1 - y) * width * 4;
    const dst = y * width * 4;
    for (let x = 0; x < width * 4; x += 4) {
      const alpha = Math.min(255, accumulator[src + x + 3]);
      out[dst + x + 3] = alpha;
      if (alpha <= 0) continue;

      const scale = 255 / alpha;
      out[dst + x] = accumulator[src + x] * scale;
      out[dst + x + 1] = accumulator[src + x + 1] * scale;
      out[dst + x + 2] = accumulator[src + x + 2] * scale;
    }
  }
  return out;
}

// --------------------------------------------------- 焼いたものを見せる / 送る

let previewTimer = 0;

/// 焼いたコマを繰りかえし再生して見せる。継ぎ目が出ていないかはこれで分かる。
function playPatternPreview(frames, width, height, step) {
  clearInterval(previewTimer);
  patternCanvas.width = width;
  patternCanvas.height = height;
  const ctx2d = patternCanvas.getContext("2d");

  const images = frames.map((f) => new ImageData(f, width, height));
  let at = 0;
  previewTimer = setInterval(() => {
    ctx2d.clearRect(0, 0, width, height);
    ctx2d.putImageData(images[at], 0, 0);
    at = (at + 1) % images.length;
  }, 1000 / 60 * step);
}

async function runBake(send) {
  if (baking) return;
  if (!spec.loop) {
    setStatus("「発生」タブのループを入れてから焼いてください", true);
    return;
  }

  baking = true;
  try {
    const { frames, width, height, period, step } = await bakePattern();
    playPatternPreview(frames, width, height, step);
    setStatus(`焼きました: ${frames.length} コマ / ${width}×${height} px`);
    if (send) await sendPattern(frames, width, height, period, step);
  } catch (e) {
    setStatus("焼けませんでした: " + e.message, true);
    console.error(e);
  } finally {
    baking = false;
  }
}

/// 注文の JSON と生のコマを 1 本の body にして送る。
/// 中身は [JSON の長さ (4 バイト)] [JSON] [コマ...]。
async function sendPattern(frames, width, height, period, step) {
  const res = await postPattern(frames, width, height, period, step);
  await receiveFile(res, "pattern.zip");
}

async function postPattern(frames, width, height, period, step) {
  const order = {
    format: spec.patternFormat,
    name: nameInput.value.trim() || "effect",
    width, height,
    columns: Math.max(1, Math.round(spec.patternColumns)),
    // 間引いたぶんだけゆっくり流さないと、もとの速さにならない
    fps: Math.max(1, Math.round(60 / step)),
    quality: Math.round(spec.patternQuality),
    periodFrames: period,
    step,
    centerX: 0, centerY: 0,
    blend: spec.blend,
  };

  const json = new TextEncoder().encode(JSON.stringify(order));
  const plane = width * height * 4;
  const body = new Uint8Array(4 + json.length + frames.length * plane);
  new DataView(body.buffer).setInt32(0, json.length, true);
  body.set(json, 4);
  frames.forEach((frame, i) => body.set(new Uint8Array(frame.buffer), 4 + json.length + i * plane));

  return fetch("/api/pattern", { method: "POST", body });
}

// ------------------------------------------------------------ 設定まわりの UI

// なめらかさは fps で選ばせる。エディタは 60fps 基準なので、
// 実際には「何フレームおきに 1 コマ焼くか」に読み替えている (60 を割り切れる値だけ)。
const PATTERN_FPS = [
  [1, "60 fps (毎フレーム)"],
  [2, "30 fps (2 フレームおき)"],
  [3, "20 fps (3 フレームおき)"],
  [4, "15 fps (4 フレームおき)"],
  [5, "12 fps (5 フレームおき)"],
  [6, "10 fps (6 フレームおき)"],
  [10, "6 fps (10 フレームおき)"],
];

const patternStep = () => Math.max(1, Math.round(spec.patternStep));
const patternFps = () => Math.max(1, Math.round(60 / patternStep()));

const PATTERN_INPUTS = [
  ["pattern-format", "patternFormat", (v) => v],
  ["pattern-fps", "patternStep", (v) => Math.max(1, Math.round(+v))],
  ["pattern-width", "patternWidth", (v) => roundUnit(+v)],
  ["pattern-height", "patternHeight", (v) => roundUnit(+v)],
  ["pattern-columns", "patternColumns", (v) => Math.max(1, Math.round(+v))],
  ["pattern-quality", "patternQuality", (v) => Math.min(100, Math.max(50, Math.round(+v)))],
];

for (const [step, text] of PATTERN_FPS) {
  const option = document.createElement("option");
  option.value = step;
  option.textContent = text;
  document.getElementById("pattern-fps").appendChild(option);
}

for (const [id, key, clean] of PATTERN_INPUTS) {
  const input = document.getElementById(id);
  input.addEventListener("change", () => {
    spec[key] = clean(input.value);
    syncPatternControls();   // 形式を変えると出す項目も変わる
  });
  controls.set(key, (v) => { input.value = v; });
}

/// コマの大きさを、組み込み先の画面サイズ (「表示」タブ) に合わせる。
document.getElementById("btn-pattern-screen").addEventListener("click", () => {
  spec.patternWidth = roundUnit(spec.frameWidth);
  spec.patternHeight = roundUnit(spec.frameHeight);
  syncPatternControls();
});

function syncPatternControls() {
  // なめらかさは選べる値が飛び飛びなので、外から来た値はいちばん近いものへ寄せる
  if (!PATTERN_FPS.some(([step]) => step === patternStep())) {
    spec.patternStep = PATTERN_FPS.reduce((best, [step]) =>
      Math.abs(step - patternStep()) < Math.abs(best - patternStep()) ? step : best, 1);
  }

  for (const [id, key] of PATTERN_INPUTS) document.getElementById(id).value = spec[key];

  // 形式に関わる項目だけ出す
  for (const label of document.querySelectorAll("#pattern-body [data-format]")) {
    label.classList.toggle("hidden", label.dataset.format !== spec.patternFormat);
  }

  document.getElementById("btn-pattern-screen").textContent =
    `画面サイズ (${roundUnit(spec.frameWidth)}×${roundUnit(spec.frameHeight)}) にする`;

  // 焼く前でもコマの大きさが分かるように、確認用の枠を指定の大きさにしておく。
  // (大きさを変えたら焼いたものは合わなくなるので、そのときは消す)
  const width = roundUnit(spec.patternWidth);
  const height = roundUnit(spec.patternHeight);
  if (patternCanvas.width !== width || patternCanvas.height !== height) {
    clearInterval(previewTimer);
    patternCanvas.width = width;
    patternCanvas.height = height;
  }

  updatePatternNote();
}

/// 焼くのに要るメモリ (バイト)。コマを Float32 で貯めるので、大きさ × 枚数で効いてくる。
const patternMemory = () =>
  patternFrameCount() * roundUnit(spec.patternWidth) * roundUnit(spec.patternHeight) * 4 * 4;

const PATTERN_MEMORY_LIMIT = 400 * 1024 * 1024;

function updatePatternNote() {
  if (!patternNoteEl) return;
  const width = roundUnit(spec.patternWidth);
  const height = roundUnit(spec.patternHeight);
  const count = patternFrameCount();
  const notes = [];

  if (!spec.loop) {
    notes.push("ループが切れています。「発生」タブでループを入れると、その周期で焼けます。");
  } else {
    notes.push(`${patternFps()} fps で ${count} コマ / 1 コマ ${width}×${height} px。`);
    if (spec.patternFormat === "sheet") {
      const columns = Math.min(Math.max(1, Math.round(spec.patternColumns)), count);
      const rows = Math.ceil(count / columns);
      notes.push(`シートは ${columns}×${rows} 並びで ${columns * width}×${rows * height} px になります。`);
    }
    if (spec.patternFormat === "amv") {
      notes.push("色は JPEG、アルファは可逆です。");
    }
    if (patternMemory() > PATTERN_MEMORY_LIMIT) {
      notes.push(`※ この大きさと枚数だと ${Math.round(patternMemory() / 1024 / 1024)}MB 必要で焼けません。なめらかさを落とすか、コマを小さくしてください。`);
    }
  }
  notes.push("写すのはプレビューの中央です (再生側の操作やズームは掛かりません)。");
  patternNoteEl.textContent = notes.join(" ");
}

const showPattern = (on) => {
  patternOverlay.classList.toggle("hidden", !on);
  if (on) { syncPatternControls(); } else { clearInterval(previewTimer); }
};

document.getElementById("btn-pattern").addEventListener("click", () => showPattern(true));
document.getElementById("btn-close-pattern").addEventListener("click", () => showPattern(false));
document.getElementById("btn-bake").addEventListener("click", () => runBake(false));
document.getElementById("btn-export-pattern").addEventListener("click", () => runBake(true));
patternOverlay.addEventListener("click", (ev) => { if (ev.target === patternOverlay) showPattern(false); });

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

  // 再生側の操作: ズームと位置がプレビューに効くか。
  // 直前の検査がテンプレートを適用しているので、測るのに要る値は全部置き直す。
  spec.emitterMotion = "none"; spec.motionName = ""; spec.motions = [];
  spec.showFrame = false;
  spec.emitRate = 400; spec.speed = 0; spec.speedVariance = 0;
  spec.gravity = 0; spec.drag = 0; spec.life = 30; spec.lifeVariance = 0;
  spec.emitterX = 0; spec.emitterY = 0;
  spec.spawnRangeX = 0; spec.spawnRangeY = 0;
  spec.startSize = 40; spec.startSizeVariance = 0;
  spec.endSize = 40; spec.endSizeVariance = 0;
  spec.rotation = 0; spec.rotationVariance = 0;
  spec.rotationSpeed = 0; spec.rotationSpeedVariance = 0;
  spec.shape = { type: "procedural", curve: "polygon", sides: 0, starRatio: 1, hole: 0,
                 blur: 0.1, falloff: 1, rotation: 0, scale: 1, imageId: null };
  spec.playX = 0; spec.playY = 0; spec.playZoom = 100; spec.playRotation = 0;
  await rebuild();
  await sleep(150);
  const plain = renderAndMeasure(20);
  spec.playZoom = 200;
  const zoomed = renderAndMeasure(20);
  spec.playZoom = 100; spec.playX = 150; spec.playY = -80;
  // 「その場に置き去り」なので、平行移動には既に出ている粒が付いてこない。
  // 前の位置の粒が寿命で消えるまで進めてから測る。
  const moved = renderAndMeasure(45);
  spec.playX = 0; spec.playY = 0;

  const spanOf = (r) => (r.x ? r.x[1] - r.x[0] : 0);
  const midOf = (r) => (r.x ? [(r.x[0] + r.x[1]) / 2, (r.y[0] + r.y[1]) / 2] : null);
  const before = midOf(plain), after = midOf(moved);
  const placement = {
    span: [spanOf(plain), spanOf(zoomed)],
    moved: before && after
      ? [Math.round((after[0] - before[0]) / dpr), Math.round((after[1] - before[1]) / dpr)]
      : null,
    // ズーム 200% で見た目がおよそ 2 倍、位置指定ぶんだけ動く
    ok: spanOf(zoomed) > spanOf(plain) * 1.7 && spanOf(zoomed) < spanOf(plain) * 2.3
      && !!before && !!after
      && Math.abs((after[0] - before[0]) / dpr - 150) < 12
      && Math.abs((after[1] - before[1]) / dpr + 80) < 12,
  };

  // 軌道の現在位置: 時計が進んで座標が返るか
  spec.motions = [{
    name: "__selftest__", frames: 60, loop: true,
    points: [{ frame: 0, x: -100, y: 0 }, { frame: 60, x: 100, y: 0 }],
  }];
  spec.motionName = "__selftest__";
  spec.emitterMotion = "dynamic";
  await rebuild();
  await sleep(150);
  resetMotionClock();
  const first = advanceMotion();
  for (let i = 0; i < 29; i++) advanceMotion();
  const halfway = advanceMotion();
  spec.emitterMotion = "none";
  spec.showFrame = savedShowFrame;

  const readout = {
    first: first ? [Math.round(first.x), Math.round(first.y)] : null,
    halfway: halfway ? [Math.round(halfway.x), Math.round(halfway.y)] : null,
    // 60 フレームで -100 から +100 なので、30 フレーム目はほぼ 0
    ok: !!first && !!halfway
      && Math.abs(first.x + 100) < 8 && Math.abs(halfway.x) < 8,
  };

  // 発生位置のドラッグ: 目印をつかんで動かすと値が変わるか。
  // 再生側のズームを掛けているときは、その逆をたどってエフェクト内の量に戻る。
  spec.emitterX = 0; spec.emitterY = 0;
  spec.playX = 0; spec.playY = 0; spec.playZoom = 200; spec.playRotation = 0;
  syncControls();
  const marker = document.getElementById("emitter-marker");
  const dragZoom = previewZoom(canvas.clientWidth, canvas.clientHeight);
  const pointer = (type, x, y) => marker.dispatchEvent(
    new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
  pointer("pointerdown", 400, 400);
  pointer("pointermove", 460, 430);
  pointer("pointerup", 460, 430);

  // ズーム 200% なので、画面で 60px 動かすとエフェクト内では 30px ぶん
  // 戻すボタンで中央へ帰るか
  const dragged = [spec.emitterX, spec.emitterY];
  [...document.querySelectorAll("#params button")]
    .find((b) => b.textContent === "発生位置を中央へ戻す")?.click();

  const drag = {
    moved: dragged,
    reset: [spec.emitterX, spec.emitterY],
    expected: [Math.round(60 / dragZoom / 2), Math.round(-30 / dragZoom / 2)],
    ok: Math.abs(dragged[0] - 60 / dragZoom / 2) < 2
      && Math.abs(dragged[1] + 30 / dragZoom / 2) < 2
      && spec.emitterX === 0 && spec.emitterY === 0,
  };
  spec.emitterX = 0; spec.emitterY = 0;
  spec.playZoom = 100;
  syncControls();

  // 背景画像: 敷いた絵が中央に原寸で出るか
  spec.showFrame = false;
  spec.emitRate = 1; spec.startSize = 1; spec.endSize = 1;
  await rebuild();
  await sleep(120);
  const withoutBackground = renderAndMeasure(2);

  const swatch = document.createElement("canvas");
  swatch.width = 200; swatch.height = 100;
  const swatchCtx = swatch.getContext("2d");
  swatchCtx.fillStyle = "#c040a0";
  swatchCtx.fillRect(0, 0, swatch.width, swatch.height);
  setBackground(swatch.toDataURL("image/png"));
  for (let i = 0; i < 40 && !backgroundImage; i++) await sleep(25);

  const withBackground = renderAndMeasure(2);
  setBackground(null);
  await sleep(50);
  const afterRemoval = renderAndMeasure(2);
  spec.showFrame = savedShowFrame;

  const background = {
    expected: [swatch.width, swatch.height],
    lit: [withoutBackground.litPixels, withBackground.litPixels, afterRemoval.litPixels],
    bounds: withBackground.x ? [withBackground.x, withBackground.y] : null,
    // 敷いたときだけ大きく増え、外すと戻る。範囲は画像の半分ぶん (dpr 込み)
    ok: withBackground.litPixels > withoutBackground.litPixels + 10000
      && afterRemoval.litPixels < withBackground.litPixels / 4
      && !!withBackground.x
      && Math.abs(Math.abs(withBackground.x[0]) - swatch.width / 2 * dpr) < 3 * dpr
      && Math.abs(Math.abs(withBackground.y[0]) - swatch.height / 2 * dpr) < 3 * dpr,
  };

  // タブとヘルプ: どのタブを選んでも表示されるページはひとつだけか、
  // どのパラメータもどこかのタブに出ているか
  const tabButtons = [...document.querySelectorAll("#params .tabs button")];
  const pages = [...document.querySelectorAll("#params .page")];
  let tabsOk = tabButtons.length >= 5 && pages.length === tabButtons.length;
  for (const button of tabButtons) {
    button.click();
    if (pages.filter((page) => !page.classList.contains("hidden")).length !== 1) tabsOk = false;
  }
  const keys = GROUPS.flatMap((g) => g.params).filter((p) => p.key).map((p) => p.key);
  const missing = keys.filter((key) => !controls.has(key));

  const help = document.getElementById("help-overlay");
  document.getElementById("btn-help").click();
  const helpOpened = !help.classList.contains("hidden");
  document.getElementById("btn-close-help").click();
  const helpClosed = help.classList.contains("hidden");

  const ui = {
    tabs: tabButtons.map((b) => b.textContent),
    missingControls: missing,
    help: helpOpened && helpClosed,
    ok: tabsOk && missing.length === 0 && helpOpened && helpClosed,
  };

  // アニメパターン: 折り返し合成が「ずっと繰りかえしている状態」になっているか。
  //
  // 粒の寿命 (60) を周期 (30) より長くしておくのが要点。折り返しが効いていなければ
  // 頭のコマは出はじめで空っぽ、終わりのコマは満杯になるので、
  //   ・コマごとの濃さがばらつく
  //   ・最後のコマ → 最初のコマ の変化だけが飛び抜けて大きくなる
  // という形で必ず現れる。
  spec.loop = true;
  spec.loopFrames = 30;
  spec.loopEmitFrames = 30;
  spec.life = 60; spec.lifeVariance = 0;
  spec.emitRate = 120;
  spec.speed = 1.5; spec.speedVariance = 0;
  spec.gravity = 0;
  spec.emitterMotion = "none";
  spec.patternWidth = 64; spec.patternHeight = 64; spec.patternStep = 3;

  const baked = await bakePattern();
  const totalAlpha = (frame) => {
    let sum = 0;
    for (let i = 3; i < frame.length; i += 4) sum += frame[i];
    return sum;
  };
  const meanDiff = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum / a.length;
  };

  const steps = [];
  for (let i = 0; i < baked.frames.length - 1; i++) steps.push(meanDiff(baked.frames[i], baked.frames[i + 1]));
  const seam = meanDiff(baked.frames[baked.frames.length - 1], baked.frames[0]);
  const typical = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)];
  const fills = baked.frames.map(totalAlpha);

  // 3 形式とも書き出せるか (中身までは見ない。サーバ側の往復テストは別にある)
  const formats = {};
  for (const format of ["sheet", "frames", "amv"]) {
    spec.patternFormat = format;
    const res = await postPattern(baked.frames, baked.width, baked.height, baked.period, baked.step);
    formats[format] = res.ok ? (await res.blob()).size : "HTTP " + res.status;
  }

  const pattern = {
    frames: baked.frames.length,
    size: [baked.width, baked.height],
    // 継ぎ目の変化が、ふつうのコマ送りと同じくらいなら輪になっている
    seam: +seam.toFixed(2), typical: +typical.toFixed(2),
    fill: [Math.round(Math.min(...fills)), Math.round(Math.max(...fills))],
    formats,
    ok: baked.frames.length === 10
      && Math.min(...fills) > 0
      && Math.min(...fills) > Math.max(...fills) * 0.6
      && seam < typical * 2.5
      && Object.values(formats).every((v) => typeof v === "number" && v > 0),
  };

  const blank = cycles.filter((c) => c.litPixels === 0);
  const el = document.createElement("pre");
  el.id = "selftest";
  el.textContent = JSON.stringify(
    {
      ok: blank.length === 0 && emitter.ok && drag.ok && motion.ok && placement.ok
        && readout.ok && background.ok && roundTrip.ok && templates.ok && shapes.ok && ui.ok
        && pattern.ok,
      blankCycles: blank.length, ui, emitter, drag, motion, placement, readout, background,
      roundTrip, templates, shapes, pattern, cycles,
    }, null, 1);
  document.body.appendChild(el);
}

// ---------------------------------------------------------------- サーバの後始末
// このページが生きているあいだだけサーバへ心拍を送る。ページを閉じれば心拍が
// 途絶え、サーバは一定時間で自分を畳む (裏に残り続けないように)。
// selftest でも送る。ヘッドレスのブラウザが終われば心拍も止まり、やはり畳まれる。

function pingServer(path) {
  // 失敗は無視でよい (サーバが先に落ちていることもある)
  try { fetch(path, { method: "POST", keepalive: true }).catch(() => {}); } catch (_) {}
}

pingServer("/api/heartbeat");
setInterval(() => pingServer("/api/heartbeat"), 5000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") pingServer("/api/heartbeat");
});
// タブを閉じる/離れるとき、畳むのを待たせないよう合図を送る。
// sendBeacon はページが消える瞬間でも届く。
window.addEventListener("pagehide", () => {
  if (navigator.sendBeacon) navigator.sendBeacon("/api/bye");
  else pingServer("/api/bye");
});

// ---------------------------------------------------------------- 起動

buildPanel();
initMotionRecording();
restoreBackground();
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
      if (location.hash === "#help") showHelp(true);
      if (location.hash === "#pattern") showPattern(true);
    }
  }, () => {
    setStatus("effekseer.wasm の読み込みに失敗しました", true);
  });
}
