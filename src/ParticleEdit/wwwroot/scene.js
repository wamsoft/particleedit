"use strict";
// ---------------------------------------------------------------- シーン
//
// 保存済みのプロジェクトをいくつか並べて、1 つの画面での見えかたを確かめる。
// 並べたうちの 1 つが「アクティブ」で、いつものつまみはそれを編集する。
// 残りは同じプレビューの中で背景として流れ続ける。
//
// - アクティブの位置・拡大・回転は「動き」タブの「再生側の操作」と同じ値
//   (playX / playY / playZoom / playRotation) を使う。どちらから動かしてもよい
// - 別のものをアクティブにすると、それまでのものは編集途中の状態のまま背景へ回る。
//   保存はシーンを保存するときにまとめて行う (変更のあるものに ● が付く)
// - 書き出すと吉里吉里プラグインの .efkset (エフェクトの並び) と、並べた efkzip が出る
//
// 座標はゲームの画面と同じ流儀で持つ: 画面中央が原点、Y は下向き、回転は時計回り。
// エディタのワールドは Y が上向きなので、プレビューへ渡すときに符号を直す。
//
// このファイルは app.js より先に読み込む (buildPanel が buildSceneEditor を呼ぶため)。
// app.js の変数 (spec / context / handle など) は、関数の中で実行時に参照する。

const SCENE_STORAGE_KEY = "particleedit.scene";

/// 並べたもの。{ project, x, y, zoom, angle, speed, delay, loop, motion, hidden,
///   spec, savedKey, effect, handle, wait, motionFrame, building }
const sceneEntries = [];
let sceneActive = -1;            // アクティブの添字 (-1 = なし)
let sceneDim = false;            // アクティブ以外を薄く出す
let sceneEls = null;             // パネルの部品
const sceneMarkers = [];         // プレビュー上の目印 (sceneEntries と同じ並び)

const deepCopy = (v) => JSON.parse(JSON.stringify(v));

/// 変更があるかの比較用。見た目だけの設定 (配置・背景など) は数えない。
function specKey(s) {
  const copy = {};
  for (const key of Object.keys(s)) {
    if (!EDITOR_ONLY_KEYS.has(key)) copy[key] = s[key];
  }
  return JSON.stringify(copy);
}

/// プロジェクトとして保存する形。再生側の操作は既定値に戻しておく
/// (シーンの配置がプロジェクト単体を開いたときの確認用の値に残らないように)。
function specForSave(s) {
  const copy = deepCopy(s);
  copy.playX = 0; copy.playY = 0; copy.playZoom = 100; copy.playRotation = 0;
  return copy;
}

function newEntry(project, projectSpec) {
  return {
    project, x: 0, y: 0, zoom: 100, angle: 0, speed: 1, delay: 0, loop: true, motion: "", hidden: false,
    spec: projectSpec ? deepCopy(projectSpec) : null,
    savedKey: projectSpec ? specKey(projectSpec) : "",
    effect: null, handle: null, wait: 0, motionFrame: 0, building: false,
  };
}

/// いまの編集内容を含めた、そのエントリのパラメータ
const entrySpec = (entry, index) => (index === sceneActive ? spec : entry.spec);

const isDirty = (entry, index) => {
  const s = entrySpec(entry, index);
  return !!s && specKey(s) !== entry.savedKey;
};

// --- 配置の変換 ---------------------------------------------------------------

/// アクティブのエントリへ「再生側の操作」の値を写す (毎フレーム)
function sceneSyncActive() {
  if (sceneActive < 0) return;
  const e = sceneEntries[sceneActive];
  e.x = spec.playX ?? 0;
  e.y = -(spec.playY ?? 0);
  e.zoom = spec.playZoom ?? 100;
  e.angle = normalizeAngle(-(spec.playRotation ?? 0));
  if (handle) handle.setSpeed(e.speed);
}

/// エントリの配置を「再生側の操作」へ入れる (アクティブにしたとき・パネルで動かしたとき)
function scenePushActivePlacement() {
  if (sceneActive < 0) return;
  const e = sceneEntries[sceneActive];
  spec.playX = Math.round(e.x);
  spec.playY = Math.round(-e.y);
  spec.playZoom = e.zoom;
  spec.playRotation = normalizeAngle(-e.angle);
  for (const key of ["playX", "playY", "playZoom", "playRotation"]) {
    const set = controls.get(key);
    if (set) set(spec[key]);
  }
}

const normalizeAngle = (a) => ((Math.round(a) % 360) + 360) % 360;

// --- 背景で流すもの -----------------------------------------------------------

/// 背景のエフェクトを (作り直して) 頭から流す
async function buildBackground(entry) {
  if (!context || !entry.spec) return;
  entry.building = true;
  try {
    const next = await loadEffectOn(context, await buildEffect(entry.spec));
    if (!sceneEntries.includes(entry) || sceneEntries.indexOf(entry) === sceneActive) {
      // 待っている間に消された / アクティブになった
      context.releaseEffect(next);
      return;
    }
    stopBackground(entry);
    entry.effect = next;
    restartBackground(entry);
  } catch (e) {
    setStatus(`${entry.project} を組み立てられません: ${e.message}`, true);
  } finally {
    entry.building = false;
  }
}

function stopBackground(entry) {
  if (entry.handle) { entry.handle.stop(); entry.handle = null; }
  if (entry.effect && context) { context.releaseEffect(entry.effect); entry.effect = null; }
}

function restartBackground(entry) {
  if (entry.handle) { entry.handle.stop(); entry.handle = null; }
  entry.wait = Math.round((entry.delay || 0) * 60 / 1000);   // プレビューは 1 フレーム = 1/60 秒
  entry.motionFrame = 0;
  entry.finished = false;
}

/// すべて頭から流し直す (アクティブも)。遅れの確認用
function sceneRestartAll() {
  sceneEntries.forEach((e, i) => { if (i !== sceneActive) restartBackground(e); });
  if (effect && context) {
    if (handle) handle.stop();
    resetMotionClock();
    handle = context.play(effect, 0, 0, 0);
  }
}

/// 毎フレーム、更新の前に呼ぶ (配置と発生位置は更新より前に入れる)
function sceneBeforeUpdate() {
  sceneEntries.forEach((entry, index) => {
    if (index === sceneActive || !entry.effect) return;
    if (entry.hidden) {
      if (entry.handle) { entry.handle.stop(); entry.handle = null; }
      return;
    }
    if (!entry.handle) {
      if (entry.finished) return;
      if (entry.wait > 0) { entry.wait -= 1; return; }
      entry.handle = context.play(entry.effect, 0, 0, 0);
    } else if (!entry.handle.exists) {
      // 終わった。ループなら頭から (遅れは最初の 1 回だけ。ゲーム側と同じ)
      entry.handle = null;
      if (!entry.loop) { entry.finished = true; return; }
      // 軌道は流し直しても続きから (ゲーム側も軌道はエフェクトとは別に回っている)
      entry.handle = context.play(entry.effect, 0, 0, 0);
    }
    const h = entry.handle;
    const scale = Math.max(0.01, entry.zoom / 100);
    h.setLocation(entry.x, -entry.y, 0);
    h.setRotation(0, 0, -entry.angle * Math.PI / 180);
    h.setScale(scale, scale, scale);
    h.setSpeed(entry.speed);
    const a = sceneDim ? 70 : 255;
    h.setAllColor(255, 255, 255, a);
    driveEntryMotion(entry);
  });
  if (handle) handle.setAllColor(255, 255, 255, 255);
}

/// 「組み込み先から動かす」で作ったものに、選んだ軌道を流す (ゲーム側の motion 指定と同じ)
function driveEntryMotion(entry) {
  const s = entry.spec;
  if (!entry.motion || s.emitterMotion !== "dynamic") return;
  const m = (s.motions || []).find((x) => x.name === entry.motion);
  if (!m || !m.points || m.points.length < 2) return;
  const frames = m.frames > 0 ? m.frames : 1;
  entry.motionFrame += entry.speed;
  if (entry.motionFrame > frames) {
    entry.motionFrame = m.loop ? entry.motionFrame % frames : frames;
  }
  const p = motionPositionAt(m, entry.motionFrame);
  if (!p) return;
  entry.handle.setDynamicInput(0, p.x);
  entry.handle.setDynamicInput(1, -p.y);
}

// --- アクティブの切り替え -----------------------------------------------------

/// いまのアクティブを背景へ回す (編集途中の状態ごと)
function stashActive() {
  if (sceneActive < 0) return;
  const e = sceneEntries[sceneActive];
  e.spec = deepCopy(spec);
  sceneActive = -1;
  buildBackground(e);
}

async function activateEntry(index) {
  if (index === sceneActive) return;
  const e = sceneEntries[index];
  if (!e) return;
  if (!e.spec && !(await loadEntrySpec(e))) return;
  stashActive();
  stopBackground(e);
  sceneActive = index;
  const wasClean = specKey(e.spec) === e.savedKey;
  applySpec(deepCopy(e.spec));
  // 古いプロジェクトに無い項目は既定値で埋まるので、そのぶんを変更と数えない
  if (wasClean) e.savedKey = specKey(spec);
  nameInput.value = e.project;
  scenePushActivePlacement();
  renderSceneList();
  await rebuild();
  setStatus(`${e.project} を編集中 (ほかは背景で流れています)`);
}

async function loadEntrySpec(entry) {
  const res = await fetch("/api/projects/" + encodeURIComponent(entry.project));
  if (!res.ok) { setStatus(`プロジェクトが見つかりません: ${entry.project}`, true); return false; }
  const doc = await res.json();
  entry.spec = doc.spec;
  entry.savedKey = specKey(doc.spec);
  return true;
}

/// 見出しの一覧から別のプロジェクトを開くとき。アクティブを背景へ回して外す
/// (開いたものはシーンの外で編集する。並べたいときは「編集中のものを並べる」)
function sceneBeforeLoadProject(name) {
  if (sceneActive < 0) return;
  if (sceneEntries[sceneActive].project === name) return;
  stashActive();
  renderSceneList();
}

/// 見出しの「保存」でアクティブのプロジェクトが保存されたとき
function sceneOnProjectSaved(name) {
  if (sceneActive < 0) return;
  const e = sceneEntries[sceneActive];
  if (e.project !== name) return;
  e.savedKey = specKey(spec);
  renderSceneList();
}

// --- 追加と削除 ---------------------------------------------------------------

async function addEntry(project) {
  const entry = newEntry(project, null);
  if (!(await loadEntrySpec(entry))) return;
  sceneEntries.push(entry);
  if (sceneActive < 0 && sceneEntries.length === 1) {
    await activateEntry(0);
  } else {
    buildBackground(entry);
  }
  renderSceneList();
  setStatus(`${project} を並べました`);
}

/// いま編集しているものを並べる (保存してから)
async function addCurrent() {
  const name = nameInput.value.trim();
  if (!name) { setStatus("先にプロジェクト名を付けてください (保存してから並べます)", true); nameInput.focus(); return; }
  if (sceneActive >= 0 && sceneEntries[sceneActive].project === name) {
    setStatus(`${name} はもう並んでいます (アクティブ)`);
    return;
  }
  await saveProject();
  const entry = newEntry(name, spec);
  entry.x = spec.playX ?? 0; entry.y = -(spec.playY ?? 0);
  entry.zoom = spec.playZoom ?? 100; entry.angle = normalizeAngle(-(spec.playRotation ?? 0));
  if (sceneActive >= 0) {
    // 別名で保存し直した = アクティブだったものを複製して新しく並べた、という扱い。
    // 元のものは編集を始める前の状態で背景へ戻す (いまの内容は新しい名前のほうへ行った)
    const previous = sceneEntries[sceneActive];
    sceneActive = -1;
    buildBackground(previous);
  }
  sceneEntries.push(entry);
  sceneActive = sceneEntries.length - 1;
  renderSceneList();
  setStatus(`${name} を並べました (アクティブ)`);
}

function removeEntry(index) {
  const e = sceneEntries[index];
  if (!e) return;
  if (isDirty(e, index) && !confirm(`${e.project} は保存していない変更があります。並びから外しますか？\n(プロジェクト自体は消えません)`)) return;
  stopBackground(e);
  sceneEntries.splice(index, 1);
  if (index === sceneActive) sceneActive = -1;
  else if (index < sceneActive) sceneActive -= 1;
  renderSceneList();
}

function clearScene() {
  for (const e of sceneEntries) stopBackground(e);
  sceneEntries.length = 0;
  sceneActive = -1;
}

// --- 保存・読み込み・書き出し -------------------------------------------------

function sceneDocument() {
  return {
    formatVersion: 1,
    width: spec.frameWidth, height: spec.frameHeight,
    items: sceneEntries.map((e) => ({
      project: e.project, x: Math.round(e.x), y: Math.round(e.y), zoom: e.zoom, angle: e.angle,
      speed: e.speed, delay: e.delay, loop: e.loop, motion: e.motion || null, hidden: e.hidden,
    })),
  };
}

/// 変更のあるプロジェクトを保存する。やめたら false
async function saveDirtyProjects() {
  const dirty = sceneEntries.map((e, i) => [e, i]).filter(([e, i]) => isDirty(e, i));
  if (!dirty.length) return true;
  const names = [...new Set(dirty.map(([e]) => e.project))];
  if (!confirm(`変更のあるプロジェクトを保存します:\n  ${names.join("\n  ")}`)) return false;
  for (const [e, i] of dirty) {
    const s = entrySpec(e, i);
    const res = await fetch("/api/projects/" + encodeURIComponent(e.project), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(specForSave(s)),
    });
    if (!res.ok) { setStatus(`${e.project} を保存できません: ${await res.text()}`, true); return false; }
    e.savedKey = specKey(s);
  }
  await refreshProjectList(nameInput.value.trim());
  return true;
}

async function saveScene() {
  const name = sceneEls.name.value.trim();
  if (!name) { setStatus("シーン名を入力してください", true); sceneEls.name.focus(); return false; }
  if (!sceneEntries.length) { setStatus("並べたものがありません", true); return false; }
  if (!(await saveDirtyProjects())) return false;
  const res = await fetch("/api/scenes/" + encodeURIComponent(name), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sceneDocument()),
  });
  if (!res.ok) { setStatus("シーンを保存できません: " + (await res.text()), true); return false; }
  try { localStorage.setItem(SCENE_STORAGE_KEY, name); } catch (e) { /* 覚えられなくても困らない */ }
  await refreshSceneList(name);
  renderSceneList();
  setStatus(`シーンを保存しました: ${name}`);
  return true;
}

async function loadScene(name) {
  const res = await fetch("/api/scenes/" + encodeURIComponent(name));
  if (!res.ok) { setStatus("シーンを読み込めません: " + res.status, true); return; }
  const doc = await res.json();
  const dirty = sceneEntries.some((e, i) => isDirty(e, i));
  if (dirty && !confirm("保存していない変更があります。破棄して読み込みますか？")) {
    sceneEls.list.value = "";
    return;
  }
  clearScene();
  for (const item of doc.items || []) {
    const e = newEntry(item.project, null);
    Object.assign(e, {
      x: item.x ?? 0, y: item.y ?? 0, zoom: item.zoom ?? 100, angle: item.angle ?? 0,
      speed: item.speed ?? 1, delay: item.delay ?? 0, loop: item.loop ?? true,
      motion: item.motion || "", hidden: !!item.hidden,
    });
    sceneEntries.push(e);
  }
  sceneEls.name.value = name;
  try { localStorage.setItem(SCENE_STORAGE_KEY, name); } catch (e) { /* 同上 */ }
  for (const e of sceneEntries) await loadEntrySpec(e);
  const first = sceneEntries.findIndex((e) => e.spec);
  for (let i = 0; i < sceneEntries.length; i++) {
    if (i !== first && sceneEntries[i].spec) buildBackground(sceneEntries[i]);
  }
  if (first >= 0) await activateEntry(first);
  renderSceneList();
  setStatus(`シーンを読み込みました: ${name}`);
}

async function exportScene() {
  if (!(await saveScene())) return;
  const name = sceneEls.name.value.trim();
  const res = await fetch(`/api/scenes/${encodeURIComponent(name)}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sceneDocument()),
  });
  await receiveFile(res, `${name}.zip`);
}

async function refreshSceneList(selected) {
  const res = await fetch("/api/scenes");
  const items = res.ok ? await res.json() : [];
  const list = sceneEls.list;
  list.textContent = "";
  const head = document.createElement("option");
  head.value = "";
  head.textContent = items.length ? "シーンを読み込む…" : "(保存したシーンはありません)";
  list.appendChild(head);
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item.name;
    opt.textContent = item.name;
    list.appendChild(opt);
  }
  list.value = "";
  if (selected) sceneEls.name.value = selected;
}

async function refreshAddList() {
  const res = await fetch("/api/projects");
  const items = res.ok ? await res.json() : [];
  const add = sceneEls.add;
  add.textContent = "";
  const head = document.createElement("option");
  head.value = "";
  head.textContent = items.length ? "＋ 保存したものを並べる…" : "(保存したプロジェクトがありません)";
  add.appendChild(head);
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item.name;
    opt.textContent = item.name;
    add.appendChild(opt);
  }
  add.value = "";
}

// --- パネル -------------------------------------------------------------------

/// 選んでいるもの (= アクティブ) の配置と再生の設定
const SCENE_FIELDS = [
  { key: "x", label: "位置 X", min: -960, max: 960, step: 1, help: "画面中央からの位置。右が正" },
  { key: "y", label: "位置 Y", min: -540, max: 540, step: 1, help: "画面中央からの位置。下が正 (ゲームと同じ)" },
  { key: "zoom", label: "拡大 (%)", min: 10, max: 400, step: 1, help: "粒の大きさも一緒に変わる" },
  { key: "angle", label: "回転 (度)", min: 0, max: 359, step: 1, help: "時計回り" },
  { key: "speed", label: "再生速度", min: 0.1, max: 3, step: 0.05, help: "1 で等速" },
  { key: "delay", label: "開始の遅れ (ms)", min: 0, max: 5000, step: 50,
    help: "頭出しから出はじめるまでの時間。背景で流しているものに効く (「頭から流す」で確かめる)" },
];

function buildSceneEditor() {
  const box = document.createElement("div");
  box.className = "scene-editor";

  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "保存したものを並べて、1 つの画面での見えかたを確かめます。"
    + "選んだ 1 つ (アクティブ) をつまみで編集し、ほかは背景で流れ続けます。";
  box.appendChild(note);

  // シーンの名前・保存・読み込み
  const fileRow = document.createElement("div");
  fileRow.className = "row scene-file";
  const name = Object.assign(document.createElement("input"),
    { type: "text", placeholder: "シーン名", spellcheck: false });
  const save = Object.assign(document.createElement("button"), { type: "button", textContent: "保存" });
  save.title = "シーンと、変更のあるプロジェクトを保存する";
  save.addEventListener("click", saveScene);
  const list = document.createElement("select");
  list.addEventListener("change", () => { if (list.value) loadScene(list.value); });
  fileRow.append(name, save, list);
  box.appendChild(fileRow);

  // 並べたものの一覧
  const items = document.createElement("div");
  items.className = "scene-items";
  box.appendChild(items);

  // 追加
  const addRow = document.createElement("div");
  addRow.className = "row scene-add";
  const add = document.createElement("select");
  add.addEventListener("focus", refreshAddList);
  add.addEventListener("change", () => { if (add.value) { addEntry(add.value); add.value = ""; } });
  const addCurrentButton = Object.assign(document.createElement("button"),
    { type: "button", textContent: "編集中のものを並べる" });
  addCurrentButton.title = "いま編集しているものを保存して並べる";
  addCurrentButton.addEventListener("click", addCurrent);
  addRow.append(add, addCurrentButton);
  box.appendChild(addRow);

  // 表示のしかた
  const viewRow = document.createElement("div");
  viewRow.className = "row row-toggle";
  const dimLabel = document.createElement("label");
  const dim = Object.assign(document.createElement("input"), { type: "checkbox" });
  dim.addEventListener("input", () => { sceneDim = dim.checked; });
  dimLabel.append(dim, " アクティブ以外を薄く出す");
  const restart = Object.assign(document.createElement("button"), { type: "button", textContent: "頭から流す" });
  restart.title = "並べたものを全部いっしょに頭から流し直す (開始の遅れを確かめる)";
  restart.addEventListener("click", sceneRestartAll);
  viewRow.append(dimLabel, restart);
  box.appendChild(viewRow);

  // 選んでいるものの設定
  const fieldsTitle = document.createElement("div");
  fieldsTitle.className = "group-title";
  box.appendChild(fieldsTitle);

  const fields = new Map();
  for (const f of SCENE_FIELDS) {
    const row = document.createElement("div");
    row.className = "row";
    row.title = f.help;
    const label = document.createElement("div");
    label.className = "label";
    const text = document.createElement("span");
    text.textContent = f.label;
    const value = document.createElement("span");
    value.className = "value";
    label.append(text, value);
    const input = Object.assign(document.createElement("input"),
      { type: "range", min: f.min, max: f.max, step: f.step });
    input.addEventListener("input", () => {
      const e = sceneEntries[sceneActive];
      if (!e) return;
      e[f.key] = +input.value;
      value.textContent = formatNumber(+input.value, f.step);
      if (["x", "y", "zoom", "angle"].includes(f.key)) scenePushActivePlacement();
    });
    row.append(label, input);
    box.appendChild(row);
    fields.set(f.key, (v) => { input.value = v; value.textContent = formatNumber(+v, f.step); });
  }

  const loopRow = document.createElement("div");
  loopRow.className = "row row-toggle";
  loopRow.title = "終わったら頭から流し直す (ゲーム側の loop)";
  const loopLabel = document.createElement("label");
  const loop = Object.assign(document.createElement("input"), { type: "checkbox" });
  loop.addEventListener("input", () => { const e = sceneEntries[sceneActive]; if (e) e.loop = loop.checked; });
  loopLabel.append(loop, " 終わったら頭から流す");
  loopRow.appendChild(loopLabel);
  box.appendChild(loopRow);

  const motionRow = document.createElement("div");
  motionRow.className = "row";
  motionRow.title = "ゲーム側で流す軌道 (「組み込み先から動かす」で作ったものだけ)";
  const motionLabel = document.createElement("div");
  motionLabel.className = "label";
  motionLabel.textContent = "ゲームで流す軌道";
  const motion = document.createElement("select");
  motion.addEventListener("input", () => { const e = sceneEntries[sceneActive]; if (e) e.motion = motion.value; });
  motionRow.append(motionLabel, motion);
  box.appendChild(motionRow);

  // 書き出し
  const exportRow = document.createElement("div");
  exportRow.className = "row";
  const exportButton = Object.assign(document.createElement("button"),
    { type: "button", textContent: "シーンを書き出す (.efkset)", className: "wide primary" });
  exportButton.title = "保存してから、.efkset と並べたものの efkzip を書き出す";
  exportButton.addEventListener("click", exportScene);
  exportRow.appendChild(exportButton);
  box.appendChild(exportRow);

  sceneEls = { name, list, items, add, fieldsTitle, fields, loop, motion, dim };
  refreshSceneList();
  refreshAddList();
  renderSceneList();
  return box;
}

function renderSceneList() {
  if (!sceneEls) return;
  const box = sceneEls.items;
  box.textContent = "";
  if (!sceneEntries.length) {
    const empty = document.createElement("p");
    empty.className = "note";
    empty.textContent = "まだ何も並べていません。下の「＋」から追加します。";
    box.appendChild(empty);
  }
  sceneEntries.forEach((e, i) => {
    const row = document.createElement("div");
    row.className = "scene-item" + (i === sceneActive ? " active" : "");

    const pick = Object.assign(document.createElement("input"), { type: "radio", name: "scene-active" });
    pick.checked = i === sceneActive;
    pick.title = "アクティブにして編集する";
    pick.addEventListener("change", () => activateEntry(i));

    const shown = Object.assign(document.createElement("input"), { type: "checkbox" });
    shown.checked = !e.hidden;
    shown.title = "表示する (隠したものは書き出さない)";
    shown.addEventListener("input", () => { e.hidden = !shown.checked; renderSceneList(); });

    const label = document.createElement("span");
    label.className = "scene-name";
    label.textContent = e.project + (isDirty(e, i) ? " ●" : "");
    label.title = isDirty(e, i) ? "保存していない変更があります" : "";
    label.addEventListener("click", () => activateEntry(i));

    const remove = Object.assign(document.createElement("button"),
      { type: "button", textContent: "×", title: "並びから外す (プロジェクトは消えない)" });
    remove.addEventListener("click", () => removeEntry(i));

    row.append(pick, shown, label, remove);
    box.appendChild(row);
  });
  syncSceneFields();
}

function syncSceneFields() {
  if (!sceneEls) return;
  const e = sceneEntries[sceneActive];
  sceneEls.fieldsTitle.textContent = e ? `「${e.project}」の配置と再生` : "配置と再生 (アクティブを選ぶと出ます)";
  for (const [key, set] of sceneEls.fields) set(e ? e[key] : 0);
  sceneEls.loop.checked = e ? e.loop : true;
  const motion = sceneEls.motion;
  motion.textContent = "";
  motion.appendChild(Object.assign(document.createElement("option"), { value: "", textContent: "(流さない)" }));
  if (e) {
    const s = entrySpec(e, sceneActive) || {};
    for (const m of s.motions || []) {
      motion.appendChild(Object.assign(document.createElement("option"), { value: m.name, textContent: m.name }));
    }
    motion.value = e.motion || "";
  }
  const usable = !!e;
  for (const el of sceneEls.items.parentElement.querySelectorAll(".row input[type=range], .row select"))
    if (el !== sceneEls.list && el !== sceneEls.add) el.disabled = !usable;
  sceneEls.loop.disabled = !usable;
}

// ● の付け外し (つまみを動かしたあとに追従させる。重くないので間引いて回すだけ)
let lastDirtyMarks = "";
setInterval(() => {
  if (!sceneEls || !sceneEntries.length) return;
  const marks = sceneEntries.map((e, i) => (isDirty(e, i) ? "1" : "0")).join("");
  if (marks !== lastDirtyMarks) { lastDirtyMarks = marks; renderSceneList(); }
}, 500);

// --- プレビュー上の目印 -------------------------------------------------------
// 並べたものの位置に名前つきの目印を出す。つかんで動かせる。
// 動かさずに離したら、それをアクティブにする。

function updateSceneMarkers(zoom) {
  const preview = document.getElementById("preview");
  while (sceneMarkers.length > sceneEntries.length) sceneMarkers.pop().remove();
  while (sceneMarkers.length < sceneEntries.length) {
    const marker = document.createElement("div");
    marker.className = "scene-marker";
    const index = sceneMarkers.length;
    marker.addEventListener("pointerdown", (event) => startMarkerDrag(event, index));
    preview.appendChild(marker);
    sceneMarkers.push(marker);
  }
  sceneEntries.forEach((e, i) => {
    const marker = sceneMarkers[i];
    marker.textContent = e.project;
    marker.classList.toggle("active", i === sceneActive);
    marker.classList.toggle("hidden", e.hidden);
    marker.style.transform = `translate(${e.x * zoom}px, ${e.y * zoom}px)`;
  });
}

function startMarkerDrag(event, index) {
  const e = sceneEntries[index];
  const marker = sceneMarkers[index];
  if (!e) return;
  const zoom = previewZoom(canvas.clientWidth, canvas.clientHeight);
  const startX = event.clientX, startY = event.clientY;
  const baseX = e.x, baseY = e.y;
  let moved = false;
  try { marker.setPointerCapture(event.pointerId); } catch (err) { /* 続行 */ }
  marker.classList.add("dragging");
  event.preventDefault();

  const onMove = (move) => {
    const dx = (move.clientX - startX) / zoom, dy = (move.clientY - startY) / zoom;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    e.x = Math.round(baseX + dx);
    e.y = Math.round(baseY + dy);
    if (index === sceneActive) scenePushActivePlacement();
    if (index === sceneActive) syncSceneFields();
  };
  const onUp = () => {
    marker.classList.remove("dragging");
    marker.removeEventListener("pointermove", onMove);
    marker.removeEventListener("pointerup", onUp);
    marker.removeEventListener("pointercancel", onUp);
    if (!moved) activateEntry(index);
  };
  marker.addEventListener("pointermove", onMove);
  marker.addEventListener("pointerup", onUp);
  marker.addEventListener("pointercancel", onUp);
}

/// 起動時に前回のシーンを開き直す
async function restoreScene() {
  let name = null;
  try { name = localStorage.getItem(SCENE_STORAGE_KEY); } catch (e) { /* 覚えていなければ何もしない */ }
  if (!name) return;
  const res = await fetch("/api/scenes/" + encodeURIComponent(name));
  if (res.ok) await loadScene(name);
}
