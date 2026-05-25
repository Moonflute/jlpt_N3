const STORAGE_KEY = "jlpt-review-trainer-progress-v1";

const GROUPS = [
  { id: "언지", title: "언지" },
  { id: "문법", title: "문법" },
  { id: "독해", title: "독해" },
  { id: "청해", title: "청해" },
];

const state = {
  route: "home",
  groupId: null,
  trackId: null,
  reveal: {},
  progress: loadProgress(),
  dataset: null,
  error: "",
  isPoppingState: false,
};

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function getTracks() {
  return state.dataset?.tracks ?? [];
}

function getTrack(trackId) {
  return getTracks().find((track) => track.id === trackId) ?? null;
}

function getTracksByGroup(groupId) {
  return getTracks().filter((track) => track.group === groupId);
}

function getStages(total) {
  const stageSize = state.dataset?.stageSize ?? 25;
  const stages = [];
  let end = stageSize;

  while (end < total) {
    stages.push({
      label: `${stages.length + 1}회독`,
      range: `1~${end}`,
      end,
    });
    end += stageSize;
  }

  stages.push({
    label: `${stages.length + 1}회독`,
    range: `1~${total}`,
    end: total,
  });

  return stages;
}

function getTrackProgress(trackId) {
  if (!state.progress[trackId]) {
    state.progress[trackId] = {
      stageIndex: 0,
      known: 0,
      again: 0,
      cursor: 0,
      recentPairIds: [],
    };
  }

  return state.progress[trackId];
}

function currentRouteState() {
  return {
    route: state.route,
    groupId: state.groupId,
    trackId: state.trackId,
  };
}

function applyRouteState(routeState) {
  state.route = routeState.route ?? "home";
  state.groupId = routeState.groupId ?? null;
  state.trackId = routeState.trackId ?? null;
  state.reveal = {};
}

function setRoute(route, payload = {}, options = {}) {
  state.route = route;
  state.groupId = payload.groupId ?? state.groupId;
  state.trackId = payload.trackId ?? state.trackId;
  state.reveal = {};

  if (!options.skipHistory && !state.isPoppingState) {
    window.history.pushState(currentRouteState(), "");
  }

  render();
}

function onSelectGroup(groupId) {
  if (groupId === "독해" || groupId === "청해") {
    const track = getTracksByGroup(groupId)[0];
    state.groupId = groupId;
    state.trackId = track?.id ?? null;
    setRoute("stage");
    return;
  }

  state.groupId = groupId;
  state.trackId = getTracksByGroup(groupId)[0]?.id ?? null;
  setRoute("types");
}

function onSelectTrack(trackId) {
  state.trackId = trackId;
  setRoute("stage");
}

function onSelectStage(index) {
  const progress = getTrackProgress(state.trackId);
  progress.stageIndex = index;
  saveProgress();
  setRoute("study");
}

function getVisibleItems(track) {
  const progress = getTrackProgress(track.id);
  const stages = getStages(track.total);
  const stage = stages[Math.min(progress.stageIndex, stages.length - 1)];
  return track.items.slice(0, stage.end);
}

function advanceCard(result) {
  const track = getTrack(state.trackId);
  const progress = getTrackProgress(state.trackId);
  const visibleItems = getVisibleItems(track);
  const currentItem = visibleItems[progress.cursor % Math.max(visibleItems.length, 1)];

  progress[result] += 1;

  if (track.mode === "synonym_pair" && visibleItems.length) {
    if (currentItem?.pairId) {
      progress.recentPairIds = [...(progress.recentPairIds ?? []), currentItem.pairId].slice(-4);
    }
    progress.cursor = findNextSynonymCursor(visibleItems, progress.cursor, progress.recentPairIds);
  } else {
    progress.cursor = visibleItems.length
      ? (progress.cursor + 1) % visibleItems.length
      : 0;
  }

  saveProgress();
  state.reveal = {};
  render();
}

function reveal(key) {
  state.reveal[key] = !state.reveal[key];
  render();
}

function getCurrentItem(track) {
  const progress = getTrackProgress(track.id);
  const visibleItems = getVisibleItems(track);

  if (!visibleItems.length) {
    return null;
  }

  return visibleItems[progress.cursor % visibleItems.length];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderRubyParts(parts, revealRuby) {
  if (!parts?.length) {
    return "";
  }

  return parts
    .map((part) => {
      const base = escapeHtml(part.base);
      if (!revealRuby || !part.ruby) {
        return base;
      }

      return `<ruby>${base}<rt>${escapeHtml(part.ruby)}</rt></ruby>`;
    })
    .join("");
}

function findNextSynonymCursor(items, currentCursor, recentPairIds) {
  if (!items.length) {
    return 0;
  }

  const recent = new Set(recentPairIds ?? []);
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (currentCursor + offset) % items.length;
    const candidate = items[index];
    if (!candidate?.pairId || !recent.has(candidate.pairId)) {
      return index;
    }
  }

  return (currentCursor + 1) % items.length;
}

function appShell(inner) {
  return `<div class="screen">${inner}</div>`;
}

function renderHome() {
  const buttons = GROUPS.map(
    (group) => `
      <button class="big-button" data-group="${group.id}">
        <div class="big-button__title">${group.title}</div>
      </button>
    `,
  ).join("");

  return appShell(`
    <div class="title-block">
      <h1>JLPT N3 회독</h1>
    </div>
    <div class="home-actions">
      <div class="grid-2">${buttons}</div>
    </div>
  `);
}

function renderTypes() {
  const tracks = getTracksByGroup(state.groupId);
  const buttons = tracks
    .map((track) => {
      const progress = getTrackProgress(track.id);
      return `
        <button class="type-button${track.id === state.trackId ? " is-active" : ""}" data-track="${track.id}">
          <div class="type-button__title">${escapeHtml(track.title)}</div>
          <div class="type-button__meta">${track.total}개 · 알고있음 ${progress.known} · 공부하겠음 ${progress.again}</div>
        </button>
      `;
    })
    .join("");

  return appShell(`
    <div class="topbar">
      <button class="back-button" data-route="home">홈</button>
    </div>
    <div class="section-card">
      <h1 class="page-title">${escapeHtml(state.groupId)}</h1>
      <p class="page-subtitle">유형 버튼을 눌러 회독 화면으로 이동합니다.</p>
    </div>
    <div class="section-card">
      <div class="type-list">${buttons}</div>
    </div>
  `);
}

function renderStage() {
  const track = getTrack(state.trackId);
  const progress = getTrackProgress(track.id);
  const stages = getStages(track.total);
  const buttons = stages
    .map(
      (stage, index) => `
        <button class="stage-button${index === progress.stageIndex ? " is-active" : ""}" data-stage="${index}">
          <div class="stage-button__title">${escapeHtml(stage.label)} ${escapeHtml(stage.range)}</div>
          <div class="stage-button__meta">누적 범위 ${escapeHtml(stage.range)}</div>
        </button>
      `,
    )
    .join("");

  return appShell(`
    <div class="topbar">
      <button class="back-button" data-route="home">홈</button>
    </div>
    <div class="section-card">
      <h1 class="page-title">${escapeHtml(track.title)}</h1>
      <p class="page-subtitle">${escapeHtml(track.description)}</p>
    </div>
    <div class="section-card">
      <div class="stage-list">${buttons}</div>
    </div>
  `);
}

function renderStudy() {
  const track = getTrack(state.trackId);
  const progress = getTrackProgress(track.id);
  const stages = getStages(track.total);
  const stage = stages[Math.min(progress.stageIndex, stages.length - 1)];
  const visibleItems = getVisibleItems(track);
  const item = getCurrentItem(track);

  if (!item) {
    return appShell(`
      <div class="topbar">
        <button class="back-button" data-route="home">홈</button>
      </div>
      <div class="section-card">
        <div class="muted-box">현재 표시할 카드가 없습니다.</div>
      </div>
    `);
  }

  const exampleJa = escapeHtml(item.exampleJa);
  const exampleKo = escapeHtml(item.exampleKo);
  const metaText = escapeHtml(item.note || item.hint || "");
  const metaVisible = Boolean(state.reveal.meta && metaText);
  const metaButtonVisible = Boolean(metaText);

  let primary = "";
  let secondary = "";
  let tertiary = "";
  let choices = "";
  let modeText = "";
  let actions = [];

  if (track.mode === "kanji_to_kana") {
    modeText = "한자를 보고 읽기를 떠올린 뒤 확인";
    primary = renderRubyParts(item.rubyParts, state.reveal.reading);
    secondary = state.reveal.meaning ? escapeHtml(item.meaning) : "";
    actions = [
      { key: "reading", label: "히라가나 보기" },
      { key: "meaning", label: "의미 보기" },
      { key: "example", label: "예문 보기", enabled: Boolean(exampleJa) },
      { key: "exampleKo", label: "예문 해설 보기", enabled: Boolean(exampleKo) },
    ];
  } else if (track.mode === "kana_to_kanji") {
    modeText = "히라가나를 보고 맞는 한자 표기를 떠올린 뒤 확인";
    primary = escapeHtml(item.primary);
    secondary = state.reveal.answer ? renderRubyParts(item.rubyParts, true) : "";
    choices = state.reveal.choices ? escapeHtml(buildChoiceList(item).join(" · ")) : "";
    actions = [
      { key: "choices", label: "보기 열기" },
      { key: "answer", label: "정답 보기" },
      { key: "example", label: "예문 보기", enabled: Boolean(exampleJa) },
      { key: "exampleKo", label: "예문 해설 보기", enabled: Boolean(exampleKo) },
    ];
  } else if (track.mode === "synonym_pair") {
    modeText = "한쪽 표현을 보고 대응되는 유의 표현을 떠올리는 연습";
    primary = renderRubyParts(item.rubyParts, state.reveal.reading);
    secondary = state.reveal.pair ? escapeHtml(item.pairText) : "";
    tertiary = state.reveal.pair && item.pairReading ? escapeHtml(item.pairReading) : "";
    choices = state.reveal.meaning ? escapeHtml(item.meaning) : "";
    actions = [
      { key: "reading", label: "히라가나 보기" },
      { key: "pair", label: "유의 표현 보기" },
      { key: "meaning", label: "의미 보기" },
      { key: "example", label: "예문 보기", enabled: Boolean(exampleJa) },
      { key: "exampleKo", label: "예문 해설 보기", enabled: Boolean(exampleKo) },
    ];
  } else {
    modeText = "의미를 떠올린 뒤 예문으로 확인";
    primary = renderRubyParts(item.rubyParts, state.reveal.reading);
    secondary = state.reveal.meaning ? escapeHtml(item.meaning) : "";
    actions = [
      { key: "reading", label: "히라가나 보기" },
      { key: "meaning", label: "의미 보기" },
      { key: "example", label: "예문 보기", enabled: Boolean(exampleJa) },
      { key: "exampleKo", label: "예문 해설 보기", enabled: Boolean(exampleKo) },
    ];
  }

  const visibleActions = actions.filter((action) => action.enabled !== false);

  return appShell(`
    <div class="topbar">
      <button class="back-button" data-route="home">홈</button>
    </div>
    <div class="section-card">
      <div class="study-head">
        <div>
          <h1 class="page-title page-title--study">${escapeHtml(track.title)}</h1>
          <p class="page-subtitle">${escapeHtml(stage.label)} ${escapeHtml(stage.range)}</p>
          <p class="page-subtitle page-subtitle--mode">${escapeHtml(modeText)}</p>
        </div>
        <div class="study-progress">${(progress.cursor % visibleItems.length) + 1} / ${visibleItems.length}</div>
      </div>
      <div class="summary-list">
        <div class="summary-pill">
          <div class="summary-pill__label">알고있음</div>
          <div class="summary-pill__value">${progress.known}</div>
        </div>
        <div class="summary-pill">
          <div class="summary-pill__label">공부하겠음</div>
          <div class="summary-pill__value">${progress.again}</div>
        </div>
      </div>
    </div>
    <div class="section-card card-frame">
      <div class="card-panel">
        ${metaButtonVisible ? `<button class="card-meta-button" data-reveal="meta" aria-label="메모 열기">✏️</button>` : ""}
        ${metaVisible ? `<div class="card-meta-popover">${metaText}</div>` : ""}
        <div class="card-primary">${primary}</div>
        <div class="card-slot card-reading${secondary ? "" : " is-empty"}">${secondary || "&nbsp;"}</div>
        <div class="card-slot card-meaning${tertiary ? "" : " is-empty"}">${tertiary || "&nbsp;"}</div>
        <div class="card-slot card-choice${choices ? "" : " is-empty"}">${choices || "&nbsp;"}</div>
        <div class="card-example-shell">
          <div class="card-example${state.reveal.example && exampleJa ? "" : " is-empty"}">${state.reveal.example && exampleJa ? exampleJa : "&nbsp;"}</div>
          <div class="card-example card-example--ko${state.reveal.exampleKo && exampleKo ? "" : " is-empty"}">${state.reveal.exampleKo && exampleKo ? exampleKo : "&nbsp;"}</div>
        </div>
      </div>
      <div class="action-row">
        ${visibleActions
          .map(
            (action) =>
              `<button class="action-button" data-reveal="${action.key}">${escapeHtml(action.label)}</button>`,
          )
          .join("")}
      </div>
      <div class="decision-row">
        <button class="decision-button decision-button--again" data-decision="again">공부하겠음</button>
        <button class="decision-button decision-button--known" data-decision="known">알고있음</button>
      </div>
    </div>
  `);
}

function buildChoiceList(item) {
  const choices = [item.answer, ...(item.distractors ?? [])].filter(Boolean);
  const pivot = item.id
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rotated = [];

  for (let index = 0; index < choices.length; index += 1) {
    rotated.push(choices[(index + (pivot % choices.length)) % choices.length]);
  }

  return [...new Set(rotated)];
}

function renderLoading() {
  return appShell(`
    <div class="title-block">
      <h1>JLPT N3 회독</h1>
    </div>
    <div class="section-card">
      <div class="muted-box">데이터를 불러오는 중입니다...</div>
    </div>
  `);
}

function renderError() {
  return appShell(`
    <div class="title-block">
      <h1>JLPT N3 회독</h1>
    </div>
    <div class="section-card">
      <div class="muted-box">${escapeHtml(state.error || "데이터를 불러오지 못했습니다.")}</div>
    </div>
  `);
}

function render() {
  const app = document.getElementById("app");

  if (state.error) {
    app.innerHTML = renderError();
    return;
  }

  if (!state.dataset) {
    app.innerHTML = renderLoading();
    return;
  }

  if (state.route === "home") {
    app.innerHTML = renderHome();
  } else if (state.route === "types") {
    app.innerHTML = renderTypes();
  } else if (state.route === "stage") {
    app.innerHTML = renderStage();
  } else {
    app.innerHTML = renderStudy();
  }

  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => onSelectGroup(button.dataset.group));
  });

  document.querySelectorAll("[data-track]").forEach((button) => {
    button.addEventListener("click", () => onSelectTrack(button.dataset.track));
  });

  document.querySelectorAll("[data-stage]").forEach((button) => {
    button.addEventListener("click", () => onSelectStage(Number(button.dataset.stage)));
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.route === "home") {
        setRoute("home", { groupId: null, trackId: null });
      } else {
        setRoute("types");
      }
    });
  });

  document.querySelectorAll("[data-reveal]").forEach((button) => {
    button.addEventListener("click", () => reveal(button.dataset.reveal));
  });

  document.querySelectorAll("[data-decision]").forEach((button) => {
    button.addEventListener("click", () => advanceCard(button.dataset.decision));
  });
}

async function init() {
  window.history.replaceState(currentRouteState(), "");

  window.addEventListener("popstate", (event) => {
    const routeState = event.state;
    state.isPoppingState = true;
    applyRouteState(routeState ?? { route: "home", groupId: null, trackId: null });
    render();
    state.isPoppingState = false;
  });

  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  try {
    const response = await fetch("./data/n3.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.dataset = await response.json();
    render();
  } catch (error) {
    state.error = `데이터 로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
    render();
  }
}

init();
