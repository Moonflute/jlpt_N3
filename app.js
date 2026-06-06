const STORAGE_KEY = "jlpt-review-trainer-progress-v1";
const APP_VERSION = "2.0.12";

const LANGUAGES = [
  { id: "ja", title: "일본어", flag: "🇯🇵" },
  { id: "en", title: "영어", flag: "🇺🇸" },
];

const GROUPS_BY_LANGUAGE = {
  ja: [
    { id: "언지", title: "언지" },
    { id: "문법", title: "문법" },
    { id: "독해", title: "독해" },
    { id: "청해", title: "청해" },
    { id: "단어", title: "단어" },
  ],
  en: [{ id: "단어", title: "단어" }],
};

const state = {
  route: "home",
  languageId: null,
  groupId: null,
  subgroupId: null,
  trackId: null,
  sessionMode: "day",
  reveal: {},
  stagePrompt: null,
  stagePreview: null,
  progressOverview: false,
  continuousProgress: false,
  voicesLoaded: false,
  backupNotice: "",
  gamepadButtons: {},
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

function buildProgressBackup() {
  return {
    app: "review-note",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    progress: state.progress,
  };
}

function exportProgress() {
  try {
    const backup = buildProgressBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const date = backup.exportedAt.slice(0, 10);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `review-note-progress-${date}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    state.backupNotice = "진행기록을 백업했습니다.";
    render();
  } catch {
    state.backupNotice = "백업 파일 생성에 실패했습니다.";
    render();
  }
}

function importProgress() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !parsed.progress || typeof parsed.progress !== "object") {
        throw new Error("invalid");
      }

      const shouldReplace = window.confirm("현재 진행기록을 가져온 파일로 덮어쓸까요?");
      if (!shouldReplace) {
        return;
      }

      state.progress = parsed.progress;
      saveProgress();
      state.backupNotice = "진행기록을 불러왔습니다.";
      render();
    } catch {
      state.backupNotice = "진행기록 불러오기에 실패했습니다.";
      render();
    }
  });

  input.click();
}

function getTracks() {
  return state.dataset?.tracks ?? [];
}

function getTrack(trackId) {
  return getTracks().find((track) => track.id === trackId) ?? null;
}

function getTrackDisplayTitleLegacy(track) {
  if (!track) {
    return "";
  }

  const englishWordTitles = {
    "eng-word-green-main": "메인",
    "eng-word-green-sub": "유의어",
    "eng-word-yellow-core": "빈출",
    "eng-word-yellow-basic": "기초",
    "eng-word-yellow-800": "800",
    "eng-word-yellow-900": "900",
  };

  return englishWordTitles[track.id] || track.title;
}

function getEnglishWordSubgroupsLegacy() {
  return [
    { id: "green", title: "초록이" },
    { id: "yellow", title: "노랭이" },
  ];
}

function getTrackSubgroup(track) {
  if (!track || (track.language ?? "ja") !== "en" || track.group !== "단어") {
    return "";
  }

  if (track.id.startsWith("eng-word-green-")) {
    return "green";
  }

  if (track.id.startsWith("eng-word-yellow-")) {
    return "yellow";
  }

  return "";
}

function getTrackDisplayTitle(track) {
  if (!track) {
    return "";
  }

  const englishWordTitles = {
    "eng-word-green-main": "메인",
    "eng-word-green-sub": "유의어",
    "eng-word-yellow-core": "빈출단어",
    "eng-word-yellow-basic": "기초단어",
    "eng-word-yellow-800": "800점단어",
    "eng-word-yellow-900": "900점단어",
  };

  return englishWordTitles[track.id] || track.title;
}

function getEnglishWordSubgroups() {
  return [
    { id: "yellow", title: "노랭이" },
    { id: "green", title: "초록이" },
  ];
}

function getLanguageGroups(languageId = state.languageId) {
  return GROUPS_BY_LANGUAGE[languageId] ?? [];
}

function getTracksByLanguage(languageId = state.languageId) {
  return getTracks().filter((track) => (track.language ?? "ja") === languageId);
}

function getTracksByGroup(groupId, languageId = state.languageId) {
  return getTracksByLanguage(languageId).filter((track) => track.group === groupId);
}

function getTracksBySubgroup(subgroupId, groupId = state.groupId, languageId = state.languageId) {
  return getTracksByGroup(groupId, languageId).filter((track) => getTrackSubgroup(track) === subgroupId);
}

function getTrackLabel(track) {
  if (!track) {
    return "";
  }

  const englishWordTitles = {
    "eng-word-green-main": "\uBA54\uC778",
    "eng-word-green-sub": "\uC720\uC758\uC5B4",
    "eng-word-yellow-core": "\uBE48\uCD9C\uB2E8\uC5B4",
    "eng-word-yellow-basic": "\uAE30\uCD08\uB2E8\uC5B4",
    "eng-word-yellow-800": "800\uC810\uB2E8\uC5B4",
    "eng-word-yellow-900": "900\uC810\uB2E8\uC5B4",
  };

  return englishWordTitles[track.id] || track.title;
}

function getEnglishWordSubgroupOptions() {
  return [
    { id: "yellow", title: "\uB178\uB791\uC774" },
    { id: "green", title: "\uCD08\uB85D\uC774" },
  ];
}

function getStages(track) {
  if (Array.isArray(track.stages) && track.stages.length) {
    return track.stages;
  }

  const total = track.total;
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

function formatStageDisplayLabel(stage) {
  const raw = String(stage?.label || stage?.id || "");
  const splitMatch = raw.match(/^Day\s?(\d+)\s?\((1\/2|2\/2)\)$/i) || raw.match(/^Day(\d+)-([AB])$/i);
  if (splitMatch) {
    const dayNumber = String(splitMatch[1]).padStart(2, "0");
    const part = splitMatch[2] === "A" ? "1/2" : splitMatch[2] === "B" ? "2/2" : splitMatch[2];
    return `Day ${dayNumber} (${part})`;
  }

  const dayMatch = raw.match(/^Day\s?(\d+)$/i) || raw.match(/^Day(\d+)$/i);
  if (dayMatch) {
    return `Day ${String(dayMatch[1]).padStart(2, "0")}`;
  }

  return raw;
}

function getTrackProgress(trackId) {
  if (!state.progress[trackId]) {
    state.progress[trackId] = {
      stageIndex: 0,
      known: 0,
      again: 0,
      cursor: 0,
      itemStates: {},
      completedStages: {},
      recentPairIds: [],
      sessions: {},
    };
  }

  state.progress[trackId].itemStates ??= {};
  state.progress[trackId].completedStages ??= {};
  state.progress[trackId].sessions ??= {};
  syncTrackTotals(state.progress[trackId]);
  return state.progress[trackId];
}

function syncTrackTotals(progress) {
  const values = Object.values(progress.itemStates ?? {});
  progress.known = values.filter((value) => value === "known").length;
  progress.again = values.filter((value) => value === "again").length;
}

function getStageCellState(track, stage) {
  const progress = getTrackProgress(track.id);
  const stageKey = getStageKeyByEnd(track, stage);

  if (progress.completedStages?.[stageKey]) {
    return "complete";
  }

  if (progress.sessions?.[stageKey]) {
    return "active";
  }

  const stageItems = getItemsForStage(track, stage);
  const hasTouchedItem = stageItems.some((item) => {
    const value = progress.itemStates?.[item.id];
    return value === "known" || value === "again";
  });

  return hasTouchedItem ? "active" : "idle";
}

function getProgressOverviewGroups(languageId = state.languageId) {
  return getLanguageGroups(languageId).map((group) => {
    const tracks = getTracksByGroup(group.id).map((track) => {
      const progress = getTrackProgress(track.id);
      const known = progress.known ?? 0;
      const total = track.total ?? 0;
      const percent = total ? Math.round((known / total) * 100) : 0;
      const stageCells = getStages(track).map((stage, index) => ({
        id: `${track.id}:${stage.id ?? stage.end ?? index}`,
        label: formatStageDisplayLabel(stage),
        state: getStageCellState(track, stage),
      }));
      const completedCount = stageCells.filter((cell) => cell.state === "complete").length;

      return {
        id: track.id,
        title: getTrackLabel(track),
        known,
        total,
        percent,
        completedCount,
        stageCount: stageCells.length,
        stageCells,
      };
    });

    return {
      id: group.id,
      title: group.title,
      tracks,
    };
  }).filter((group) => group.tracks.length);
}

function getTrackProgressScore(track) {
  const progress = getTrackProgress(track.id);
  const known = progress.known ?? 0;
  const total = track.total ?? 0;
  return total ? known / total : 0;
}

function getPreferredStageIndex(track, options = {}) {
  const progress = getTrackProgress(track.id);
  const stages = getStages(track);
  const skipStageKey = options.skipStageKey || "";

  const activeIndex = stages.findIndex((stage) => {
    const stageKey = getStageKeyByEnd(track, stage);
    return stageKey !== skipStageKey && !progress.completedStages[stageKey] && progress.sessions?.[stageKey];
  });

  if (activeIndex >= 0) {
    return activeIndex;
  }

  const incompleteIndex = stages.findIndex((stage) => {
    const stageKey = getStageKeyByEnd(track, stage);
    return stageKey !== skipStageKey && !isStageCompleted(track, stage);
  });
  if (incompleteIndex >= 0) {
    return incompleteIndex;
  }

  return 0;
}

function getLeastProgressTarget(options = {}, languageId = state.languageId) {
  const skipTrackId = options.skipTrackId || "";
  const skipStageKey = options.skipStageKey || "";
  const rankedGroups = getLanguageGroups(languageId).map((group, index) => {
    const tracks = getTracksByGroup(group.id, languageId);
    const totals = tracks.reduce(
      (accumulator, track) => {
        const progress = getTrackProgress(track.id);
        accumulator.known += progress.known ?? 0;
        accumulator.total += track.total ?? 0;
        return accumulator;
      },
      { known: 0, total: 0 },
    );

    return {
      id: group.id,
      order: index,
      tracks,
      score: totals.total ? totals.known / totals.total : 0,
    };
  }).filter((group) => group.tracks.length);

  rankedGroups.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    return left.order - right.order;
  });

  const targetGroup = rankedGroups.find((group) => group.score < 1) || rankedGroups[0];
  if (!targetGroup) {
    return null;
  }

  const hasRemainingStage = (track) =>
    getStages(track).some((stage) => {
      const stageKey = getStageKeyByEnd(track, stage);
      if (track.id === skipTrackId && stageKey === skipStageKey) {
        return false;
      }

      return !isStageCompleted(track, stage);
    });

  const sortedTracks = [...targetGroup.tracks].sort((left, right) => {
    const leftScore = getTrackProgressScore(left);
    const rightScore = getTrackProgressScore(right);

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return left.title.localeCompare(right.title, "ko");
  });

  const targetTrack =
    sortedTracks.find((track) => hasRemainingStage(track) && getTrackProgressScore(track) < 1) ||
    sortedTracks.find((track) => hasRemainingStage(track));
  if (!targetTrack) {
    return null;
  }

  const stageIndex = getPreferredStageIndex(targetTrack, {
    skipStageKey: targetTrack.id === skipTrackId ? skipStageKey : "",
  });
  const stage = getStages(targetTrack)[stageIndex];

  return {
    groupId: targetGroup.id,
    trackId: targetTrack.id,
    stageIndex,
    trackTitle: getTrackLabel(targetTrack),
    stageLabel: formatStageDisplayLabel(stage),
    stageRange: stage.range,
  };
}

function continueLeastProgress() {
  const target = getLeastProgressTarget();
  if (!target) {
    return;
  }

  state.continuousProgress = true;
  state.groupId = target.groupId;
  state.trackId = target.trackId;
  onSelectStage(target.stageIndex);
}

function currentRouteState() {
  return {
    route: state.route,
    sessionMode: state.sessionMode,
    languageId: state.languageId,
    groupId: state.groupId,
    subgroupId: state.subgroupId,
    trackId: state.trackId,
    continuousProgress: state.continuousProgress,
  };
}

function applyRouteState(routeState) {
  state.route = routeState.route ?? "home";
  state.sessionMode = routeState.sessionMode ?? "day";
  state.languageId = routeState.languageId ?? null;
  state.groupId = routeState.groupId ?? null;
  state.subgroupId = routeState.subgroupId ?? null;
  state.trackId = routeState.trackId ?? null;
  state.continuousProgress = Boolean(routeState.continuousProgress);
  state.reveal = {};
  state.stagePrompt = null;
  state.stagePreview = null;
  state.progressOverview = false;
  state.backupNotice = "";
}

function setRoute(route, payload = {}, options = {}) {
  state.route = route;
  state.languageId = payload.languageId ?? state.languageId;
  state.groupId = payload.groupId ?? state.groupId;
  state.subgroupId = payload.subgroupId ?? state.subgroupId;
  state.trackId = payload.trackId ?? state.trackId;
  state.reveal = {};
  state.stagePrompt = null;
  state.stagePreview = null;
  state.progressOverview = false;
  state.backupNotice = "";

  if (!options.skipHistory && !state.isPoppingState) {
    window.history.pushState(currentRouteState(), "");
  }

  render();
}

function onSelectLanguage(languageId) {
  state.continuousProgress = false;
  state.languageId = languageId;
  state.groupId = null;
  state.subgroupId = null;
  state.trackId = null;
  setRoute("groups");
}

function onSelectGroup(groupId) {
  state.continuousProgress = false;
  state.subgroupId = null;

  if (state.languageId === "ja" && (groupId === "독해" || groupId === "청해")) {
    const track = getTracksByGroup(groupId, state.languageId)[0];
    state.groupId = groupId;
    state.trackId = track?.id ?? null;
    setRoute("stage");
    return;
  }

  if (state.languageId === "en" && groupId === "단어") {
    state.groupId = groupId;
    state.trackId = null;
    setRoute("subgroups");
    return;
  }

  state.groupId = groupId;
  state.trackId = getTracksByGroup(groupId, state.languageId)[0]?.id ?? null;
  setRoute("types");
}

function onSelectSubgroup(subgroupId) {
  state.continuousProgress = false;
  state.subgroupId = subgroupId;
  state.trackId = getTracksBySubgroup(subgroupId)[0]?.id ?? null;
  setRoute("types");
}

function onSelectTrack(trackId) {
  state.continuousProgress = false;
  state.sessionMode = "day";
  state.trackId = trackId;
  setRoute("stage");
}

function isDayBasedTrack(track) {
  const stages = getStages(track);
  return stages.length > 0 && stages.every((stage) => /^Day\b/i.test(String(stage.label || "")));
}

function getStageByIndex(track, index) {
  const stages = getStages(track);
  return stages[Math.min(index, stages.length - 1)];
}

function getStageKeyByEnd(track, stageOrEnd) {
  if (typeof stageOrEnd === "object" && stageOrEnd) {
    return `${track.id}:${stageOrEnd.id ?? stageOrEnd.end}`;
  }

  return `${track.id}:${stageOrEnd}`;
}

function isStageCompleted(track, stage) {
  const progress = getTrackProgress(track.id);
  return Boolean(progress.completedStages[getStageKeyByEnd(track, stage)]);
}

function onSelectStage(index, options = {}) {
  const track = getTrack(state.trackId);
  const progress = getTrackProgress(state.trackId);
  const mode = options.mode ?? "day";
  state.sessionMode = mode;
  progress.stageIndex = index;
  const stage = getStageByIndex(track, index);
  const stageKey = getStageKeyByEnd(track, stage);

  if (mode === "day" && isStageCompleted(track, stage) && !options.forceReset) {
    state.stagePrompt = { index, stageKey, label: stage.label, range: stage.range };
    saveProgress();
    render();
    return;
  }

  if (options.forceReset && mode === "day") {
    delete progress.completedStages[stageKey];
    progress.sessions[getSessionKey(track, stage, mode)] = null;
  }

  initializeStageSession(track, Boolean(options.forceReset), mode);
  saveProgress();
  setRoute("study");
}

function getReviewItems(track) {
  const progress = getTrackProgress(track.id);
  const stages = getStages(track);
  const stage = stages[Math.min(progress.stageIndex, stages.length - 1)];
  const learnedItems = track.items.slice(0, stage.end);
  const reviewedItems = learnedItems.filter((item) => {
    const itemState = progress.itemStates?.[item.id];
    return itemState === "known" || itemState === "again";
  });

  if (reviewedItems.length) {
    const againItems = reviewedItems.filter((item) => progress.itemStates?.[item.id] === "again");
    return againItems.length ? againItems : reviewedItems;
  }

  return learnedItems.slice(0, stage.start ?? 0);
}

function getVisibleItems(track, mode = state.sessionMode ?? "day") {
  const progress = getTrackProgress(track.id);
  const stages = getStages(track);
  const stage = stages[Math.min(progress.stageIndex, stages.length - 1)];

  if (mode === "review" && isDayBasedTrack(track)) {
    return getReviewItems(track);
  }

  return track.items.slice(stage.start ?? 0, stage.end);
}

function getItemsForStage(track, stageEnd) {
  if (typeof stageEnd === "object" && stageEnd) {
    return track.items.slice(stageEnd.start ?? 0, stageEnd.end);
  }

  return track.items.slice(0, stageEnd);
}

function getStageKey(track) {
  const progress = getTrackProgress(track.id);
  const stage = getStageByIndex(track, progress.stageIndex);
  return getStageKeyByEnd(track, stage);
}

function getSessionKey(track, stage, mode = state.sessionMode ?? "day") {
  return `${getStageKeyByEnd(track, stage)}:${mode}`;
}

function shuffleArray(items) {
  const copied = [...items];
  for (let index = copied.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copied[index], copied[swapIndex]] = [copied[swapIndex], copied[index]];
  }
  return copied;
}

function initializeStageSession(track, reset = false, mode = state.sessionMode ?? "day") {
  const progress = getTrackProgress(track.id);
  const stage = getStageByIndex(track, progress.stageIndex);
  const sessionKey = getSessionKey(track, stage, mode);
  progress.sessions ??= {};

  if (!reset && progress.sessions[sessionKey]) {
    return progress.sessions[sessionKey];
  }

  const items = getVisibleItems(track, mode);
  const sourceIds = items.map((item) => item.id);
  progress.sessions[sessionKey] = {
    mode,
    sourceIds,
    queueIds: shuffleArray(sourceIds),
    pointer: 0,
    round: 1,
    statusMap: {},
    prompt: null,
    recentPairIds: [],
  };
  return progress.sessions[sessionKey];
}

function getStageSession(track) {
  return initializeStageSession(track, false, state.sessionMode ?? "day");
}

function getItemById(track, itemId) {
  return track.items.find((item) => item.id === itemId) ?? null;
}

function getSessionStats(session) {
  let known = 0;
  let again = 0;

  for (const itemId of session.sourceIds) {
    const value = session.statusMap[itemId];
    if (value === "known") {
      known += 1;
    } else if (value === "again") {
      again += 1;
    }
  }

  return { known, again };
}

function getNextQueueIndex(track, session, currentIndex) {
  if (track.mode !== "synonym_pair") {
    return currentIndex + 1;
  }

  const recent = new Set(session.recentPairIds ?? []);
  for (let offset = 1; offset < session.queueIds.length - currentIndex; offset += 1) {
    const nextIndex = currentIndex + offset;
    const candidate = getItemById(track, session.queueIds[nextIndex]);
    if (!candidate?.pairId || !recent.has(candidate.pairId)) {
      return nextIndex;
    }
  }

  return currentIndex + 1;
}

function advanceCard(result) {
  const track = getTrack(state.trackId);
  const progress = getTrackProgress(state.trackId);
  const session = getStageSession(track);

  if (session.prompt) {
    return;
  }

  const currentItemId = session.queueIds[session.pointer];
  const currentItem = getItemById(track, currentItemId);

  session.statusMap[currentItemId] = result;
  progress.itemStates[currentItemId] = result;
  syncTrackTotals(progress);

  if (track.mode === "synonym_pair" && currentItem?.pairId) {
    session.recentPairIds = [...(session.recentPairIds ?? []), currentItem.pairId].slice(-4);
  }

  if (session.pointer < session.queueIds.length - 1) {
    session.pointer = getNextQueueIndex(track, session, session.pointer);
  } else {
    const retryIds = session.queueIds.filter((itemId) => session.statusMap[itemId] === "again");
    if (retryIds.length) {
      session.prompt = { type: "retry", itemIds: retryIds };
    } else if (state.continuousProgress) {
      const stageKey = getStageKey(track);
      const nextTarget = getLeastProgressTarget({
        skipTrackId: track.id,
        skipStageKey: stageKey,
      });
      session.prompt = nextTarget
        ? { type: "next", target: nextTarget }
        : { type: "complete" };
    } else {
      session.prompt = { type: "complete" };
    }
  }

  saveProgress();
  state.reveal = {};
  render();
}

function reveal(key) {
  if (key === "exampleKo" && !state.reveal.exampleKo && !state.reveal.example) {
    state.reveal.example = true;
    state.reveal.exampleKo = true;
    render();
    return;
  }

  state.reveal[key] = !state.reveal[key];
  render();
}

function getPrimaryGamepad() {
  if (!("getGamepads" in navigator)) {
    return null;
  }

  return [...(navigator.getGamepads?.() ?? [])].find(Boolean) ?? null;
}

function isGamepadButtonPressed(button) {
  if (!button) {
    return false;
  }

  if (typeof button === "number") {
    return button > 0.5;
  }

  return Boolean(button.pressed) || button.value > 0.5;
}

function handleGamepadStudyAction(action) {
  const track = getTrack(state.trackId);
  if (!track || state.route !== "study") {
    return;
  }

  const session = getStageSession(track);
  if (session.prompt?.type === "retry") {
    if (action === "again") {
      handleRetryPrompt(true);
    } else if (action === "known") {
      handleRetryPrompt(false);
    }
    return;
  }

  if (session.prompt?.type === "next") {
    if (action === "again") {
      handleNextProgressPrompt(true);
    } else if (action === "known") {
      handleNextProgressPrompt(false);
    }
    return;
  }

  if (session.prompt?.type === "complete") {
    if (action === "again") {
      handleCompletePrompt();
    }
    return;
  }

  if (action === "known" || action === "again") {
    advanceCard(action);
    return;
  }

  if (action === "reading" && (track.language ?? "ja") === "ja") {
    reveal("reading");
    return;
  }

  if (action === "meaning") {
    reveal("meaning");
    return;
  }

  if (action === "example") {
    reveal("example");
    return;
  }

  if (action === "exampleKo") {
    reveal("exampleKo");
  }
}

function pollGamepad() {
  const pad = getPrimaryGamepad();
  const nextStates = {};

  if (pad && state.route === "study") {
    const mapping = [
      [0, "again"],
      [1, "known"],
      [2, "reading"],
      [3, "meaning"],
      [4, "example"],
      [5, "exampleKo"],
    ];

    for (const [index, action] of mapping) {
      const pressed = isGamepadButtonPressed(pad.buttons?.[index]);
      nextStates[index] = pressed;
      if (pressed && !state.gamepadButtons[index]) {
        handleGamepadStudyAction(action);
      }
    }
  }

  state.gamepadButtons = nextStates;
  window.requestAnimationFrame(pollGamepad);
}

function getSpeechText(item, track) {
  if (track.mode === "kana_to_kanji") {
    return item.reading || item.primary || item.answer || "";
  }

  return item.reading || item.primary || "";
}

function getSpeechSynth() {
  if (!("speechSynthesis" in window)) {
    return null;
  }

  return window.speechSynthesis;
}

function scoreJapaneseVoice(voice) {
  const lang = voice.lang?.toLowerCase() ?? "";
  const name = voice.name?.toLowerCase() ?? "";
  let score = 0;

  if (lang === "ja-jp") {
    score += 60;
  } else if (lang.startsWith("ja")) {
    score += 40;
  }

  if (voice.localService) {
    score += 12;
  }

  if (/google|microsoft|kyoko|otoya|sayaka|nanami|keita|haruka|ayumi|japanese/.test(name)) {
    score += 24;
  }

  if (/eloquence|english|korean|corean/.test(name)) {
    score -= 80;
  }

  return score;
}

function scoreEnglishVoice(voice) {
  const lang = voice.lang?.toLowerCase() ?? "";
  const name = voice.name?.toLowerCase() ?? "";
  let score = 0;

  if (lang === "en-us") {
    score += 60;
  } else if (lang.startsWith("en")) {
    score += 40;
  }

  if (voice.localService) {
    score += 12;
  }

  if (/google|microsoft|samantha|zira|aria|jenny|davis|english/.test(name)) {
    score += 24;
  }

  if (/japanese|korean|corean/.test(name)) {
    score -= 80;
  }

  return score;
}

function pickJapaneseVoice(voices = null) {
  const synth = getSpeechSynth();
  if (!synth) {
    return null;
  }

  const pool = voices ?? synth.getVoices();
  const japaneseVoices = pool.filter((voice) => voice.lang?.toLowerCase().startsWith("ja"));
  if (!japaneseVoices.length) {
    return null;
  }

  return [...japaneseVoices].sort((left, right) => scoreJapaneseVoice(right) - scoreJapaneseVoice(left))[0] ?? null;
}

function pickEnglishVoice(voices = null) {
  const synth = getSpeechSynth();
  if (!synth) {
    return null;
  }

  const pool = voices ?? synth.getVoices();
  const englishVoices = pool.filter((voice) => voice.lang?.toLowerCase().startsWith("en"));
  if (!englishVoices.length) {
    return null;
  }

  return [...englishVoices].sort((left, right) => scoreEnglishVoice(right) - scoreEnglishVoice(left))[0] ?? null;
}

function primeSpeechVoices() {
  const synth = getSpeechSynth();
  if (!synth || state.voicesLoaded) {
    return;
  }

  const refresh = () => {
    const voices = synth.getVoices();
    if (voices.length) {
      state.voicesLoaded = true;
    }
  };

  refresh();
  synth.addEventListener?.("voiceschanged", refresh);
}

function waitForSpeechVoices(timeout = 800) {
  const synth = getSpeechSynth();
  if (!synth) {
    return Promise.resolve([]);
  }

  const existing = synth.getVoices();
  if (existing.length) {
    state.voicesLoaded = true;
    return Promise.resolve(existing);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      synth.removeEventListener?.("voiceschanged", finish);
      const voices = synth.getVoices();
      if (voices.length) {
        state.voicesLoaded = true;
      }
      resolve(voices);
    };

    const timer = window.setTimeout(finish, timeout);
    synth.addEventListener?.("voiceschanged", finish);
    synth.getVoices();
  });
}

async function speakCurrentItem() {
  const track = getTrack(state.trackId);
  const synth = getSpeechSynth();
  if (!track || !synth) {
    return;
  }

  const item = getCurrentItem(track);
  const text = item ? getSpeechText(item, track) : "";
  if (!text) {
    return;
  }

  const voices = await waitForSpeechVoices();
  const isEnglish = (track.language ?? "ja") === "en";
  const voice = isEnglish ? pickEnglishVoice(voices) : pickJapaneseVoice(voices);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = isEnglish ? "en-US" : "ja-JP";
  utterance.rate = isEnglish ? 0.98 : 0.92;
  utterance.pitch = 1;
  if (voice) {
    utterance.voice = voice;
  }

  synth.cancel();
  synth.speak(utterance);
}

function getCurrentItem(track) {
  const session = getStageSession(track);
  if (!session.queueIds.length) {
    return null;
  }

  return getItemById(track, session.queueIds[session.pointer]);
}

function renderStagePreviewWord(track, item) {
  if ((track.language ?? "ja") === "en") {
    return escapeHtml(item.primary || "");
  }

  if (track.mode === "kana_to_kanji") {
    return escapeHtml(item.primary || "");
  }

  if (track.mode === "synonym_pair") {
    return renderRubyParts(item.rubyParts, true, { padBlankRuby: true });
  }

  return renderRubyParts(item.rubyParts, true, { padBlankRuby: true });
}

function renderStagePreviewTarget(track, item) {
  if ((track.language ?? "ja") === "en") {
    return escapeHtml(item.note || item.hint || "");
  }

  if (track.mode === "kana_to_kanji") {
    return renderRubyParts(item.rubyParts, true, { padBlankRuby: true });
  }

  if (track.mode === "synonym_pair") {
    return renderRubyParts(
      item.pairRubyParts || [{ base: item.pairText || "", ruby: item.pairReading || "" }],
      true,
      { padBlankRuby: true },
    );
  }

  return escapeHtml(item.note || item.hint || item.reading || "");
}

function renderStagePreviewRows(track, items) {
  return items
    .map((item) => {
      return `
        <tr>
          <td class="stage-preview-table__word">${renderStagePreviewWord(track, item)}</td>
          <td>${escapeHtml(item.meaning || "")}</td>
          <td>${renderStagePreviewTarget(track, item)}</td>
        </tr>
      `;
    })
    .join("");
}

function getFilteredStagePreviewItems(track, items) {
  if (!state.stagePreview || state.stagePreview.filter !== "pending") {
    return items;
  }

  const progress = getTrackProgress(track.id);
  return items.filter((item) => progress.itemStates[item.id] !== "known");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderRubyParts(parts, revealRuby, options = {}) {
  if (!parts?.length) {
    return "";
  }

  const padBlankRuby = Boolean(options.padBlankRuby);
  return parts
    .map((part) => {
      const base = escapeHtml(part.base);
      if (!revealRuby) {
        return base;
      }

      if (!part.ruby && !padBlankRuby) {
        return base;
      }

      return `<ruby>${base}<rt>${part.ruby ? escapeHtml(part.ruby) : "&nbsp;"}</rt></ruby>`;
    })
    .join("");
}

function addTerm(target, value) {
  const term = String(value || "").trim();
  if (!term) {
    return;
  }

  target.add(term);
}

function stripGrammarLabel(text) {
  return String(text || "")
    .replace(/\s*\(\d+\)\s*$/u, "")
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .replace(/^[~\uFF5E\u301C]+\s*/u, "")
    .trim();
}

function buildJapaneseVerbStem(term) {
  const irregular = {
    "\u3044\u3089\u3063\u3057\u3083\u308b": "\u3044\u3089\u3063\u3057\u3083\u3044",
    "\u304f\u3060\u3055\u308b": "\u304f\u3060\u3055\u3044",
    "\u306a\u3055\u308b": "\u306a\u3055\u3044",
    "\u304a\u3063\u3057\u3083\u308b": "\u304a\u3063\u3057\u3083\u3044",
    "\u3054\u3056\u308b": "\u3054\u3056\u3044",
  };

  if (irregular[term]) {
    return irregular[term];
  }

  if (term.endsWith("\u3059\u308b")) {
    return `${term.slice(0, -2)}\u3057`;
  }

  if (term.endsWith("\u304f\u308b")) {
    return `${term.slice(0, -2)}\u304d`;
  }

  if (term.endsWith("\u308b")) {
    const ichidanLike = /[\u3048\u3051\u3052\u305b\u305c\u3066\u3067\u306d\u3078\u3079\u307a\u3081\u308c\u3044\u304d\u304e\u3057\u3058\u3061\u3062\u306b\u3072\u3073\u3074\u307f\u308a]\u308b$/u.test(term);
    if (ichidanLike) {
      return term.slice(0, -1);
    }
  }

  const godanMap = {
    "\u3046": "\u3044",
    "\u304f": "\u304d",
    "\u3050": "\u304e",
    "\u3059": "\u3057",
    "\u3064": "\u3061",
    "\u306c": "\u306b",
    "\u3076": "\u3073",
    "\u3080": "\u307f",
    "\u308b": "\u308a",
  };

  const last = term.slice(-1);
  if (godanMap[last]) {
    return `${term.slice(0, -1)}${godanMap[last]}`;
  }

  return "";
}

function buildGrammarHighlightTerms(item) {
  const terms = new Set();
  const raw = String(item.primary || "").trim();
  if (!raw) {
    return [];
  }

  addTerm(terms, stripGrammarLabel(raw));

  const plusMatch = raw.match(/\+\s*(.+)$/u);
  if (plusMatch) {
    addTerm(terms, stripGrammarLabel(plusMatch[1]));
  }

  const noLeadWave = stripGrammarLabel(raw).replace(/^[~\uFF5E\u301C]+\s*/u, "");
  addTerm(terms, noLeadWave);
  addTerm(terms, stripGrammarLabel(item.reading || ""));

  for (const base of [...terms]) {
    addTerm(terms, base.replace(/\s+/gu, ""));

    if (base.endsWith("\u3060")) {
      addTerm(terms, `${base.slice(0, -1)}\u3067\u3059`);
      addTerm(terms, `${base.slice(0, -1)}\u3067\u3057\u305f`);
    }

    if (base.includes("\u3066\u3044\u308b")) {
      addTerm(terms, base.replace("\u3066\u3044\u308b", "\u3066\u304a\u308a"));
      addTerm(terms, base.replace("\u3066\u3044\u308b", "\u3066\u304a\u308a\u307e\u3059"));
      addTerm(terms, base.replace("\u3066\u3044\u308b", "\u3066\u3044\u307e\u3059"));
    }

    const stem = buildJapaneseVerbStem(base);
    if (stem) {
      addTerm(terms, stem);
      addTerm(terms, `${stem}\u307e\u3059`);
      addTerm(terms, `${stem}\u307e\u3057\u305f`);
      addTerm(terms, `${stem}\u307e\u3057\u3087\u3046`);
      addTerm(terms, `${stem}\u305f\u3044`);
      addTerm(terms, `${stem}\u305f`);
      addTerm(terms, `${stem}\u3066`);
    }

    for (let cut = 1; cut <= 3; cut += 1) {
      const shortened = base.slice(0, Math.max(0, base.length - cut));
      if (shortened.length >= 2 || /[\u3400-\u4dbf\u4e00-\u9fff]/u.test(shortened)) {
        addTerm(terms, shortened);
      }
    }
  }

  return [...terms].filter(Boolean).sort((left, right) => right.length - left.length);
}

function getExampleTerms(track, item) {
  const terms = new Set();

  if (item.primary) {
    terms.add(item.primary);
  }

  if (track.mode === "kana_to_kanji" && item.answer) {
    terms.add(item.answer);
  }

  if (track.mode === "synonym_pair" && item.pairText) {
    terms.add(item.pairText);
  }

  if (track.id?.startsWith("grammar-")) {
    for (const term of buildGrammarHighlightTerms(item)) {
      addTerm(terms, term);
    }
  }

  return [...terms].filter(Boolean).sort((left, right) => right.length - left.length);
}

function highlightExampleText(example, item, track) {
  const terms = getExampleTerms(track, item);
  if (!example || !terms.length) {
    return escapeHtml(example || "");
  }

  let cursor = 0;
  let output = "";

  while (cursor < example.length) {
    let matchedTerm = "";
    for (const term of terms) {
      if (example.startsWith(term, cursor)) {
        matchedTerm = term;
        break;
      }
    }

    if (matchedTerm) {
      output += `<span class="example-highlight">${escapeHtml(matchedTerm)}</span>`;
      cursor += matchedTerm.length;
      continue;
    }

    output += escapeHtml(example[cursor]);
    cursor += 1;
  }

  return output;
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

function handleRetryPrompt(shouldRetry) {
  const track = getTrack(state.trackId);
  const session = getStageSession(track);
  const retryIds = session.prompt?.itemIds ?? [];

  if (!shouldRetry) {
    session.queueIds = shuffleArray(retryIds);
    session.pointer = 0;
    session.round += 1;
    session.prompt = null;
    session.recentPairIds = [];
    saveProgress();
    setRoute("stage");
    return;
  }

  session.queueIds = shuffleArray(retryIds);
  session.pointer = 0;
  session.round += 1;
  session.prompt = null;
  session.recentPairIds = [];
  saveProgress();
  state.reveal = {};
  render();
}

function handleCompletePrompt() {
  const track = getTrack(state.trackId);
  const progress = getTrackProgress(track.id);
  progress.completedStages[getStageKey(track)] = true;
  progress.sessions[getStageKey(track)] = null;
  state.continuousProgress = false;
  saveProgress();
  setRoute("stage");
}

function handleNextProgressPrompt(shouldMove) {
  const track = getTrack(state.trackId);
  const progress = getTrackProgress(track.id);
  const stageKey = getStageKey(track);
  const session = getStageSession(track);
  const target = session.prompt?.target ?? null;

  progress.completedStages[stageKey] = true;
  progress.sessions[stageKey] = null;

  if (!shouldMove || !target) {
    state.continuousProgress = false;
    saveProgress();
    setRoute("stage");
    return;
  }

  saveProgress();
  state.groupId = target.groupId;
  state.trackId = target.trackId;
  onSelectStage(target.stageIndex);
}

function appShell(inner) {
  return `<div class="screen">${inner}</div>`;
}

function renderHome() {
  const languageButtons = LANGUAGES.map((language) => {
    return `
      <button class="big-button big-button--language" data-language="${language.id}">
        <div class="big-button__title">${language.title}</div>
        <div class="big-button__flag" aria-hidden="true">${language.flag}</div>
      </button>
    `;
  }).join("");

  const backupNotice = state.backupNotice
    ? `
      <div class="modal-backdrop">
        <div class="modal-panel session-prompt session-prompt--modal">
          <div class="session-prompt__text">${escapeHtml(state.backupNotice)}</div>
          <div class="session-prompt__actions">
            <button class="prompt-button" type="button" data-backup-notice-close>확인</button>
          </div>
        </div>
      </div>
    `
    : "";

  return appShell(`
    <div class="topbar topbar--home topbar--home-root">
      <div class="topbar__spacer"></div>
      <div class="home-utility-actions">
        <button class="home-utility-button" type="button" data-export-progress>백업</button>
        <button class="home-utility-button" type="button" data-import-progress>복원</button>
      </div>
    </div>
    <div class="title-block title-block--home title-block--home-root">
      <h1>회독노트</h1>
    </div>
    <div class="home-actions home-actions--root">
      <div class="home-actions-stack">
        <div class="grid-2 grid-2--languages grid-2--languages-stack">${languageButtons}</div>
      </div>
    </div>
    <div class="home-version">ver ${APP_VERSION}</div>
    ${backupNotice}
  `);
}

function renderGroups() {
  const groups = getLanguageGroups();
  const homeButtons = [
    ...groups.map((group) => ({
      kind: "group",
      id: group.id,
      title: group.title,
    })),
    {
      kind: "continue",
      id: "continue",
      title: "진행",
    },
  ]
    .map((button) => {
      if (button.kind === "continue") {
        return `
        <button class="big-button big-button--accent" data-continue>
          <div class="big-button__title">${button.title}</div>
        </button>
      `;
      }

      return `
      <button class="big-button" data-group="${button.id}">
        <div class="big-button__title">${button.title}</div>
      </button>
    `;
    })
    .join("");
  const overviewGroups = getProgressOverviewGroups();
  const overviewModal = state.progressOverview
    ? `
      <div class="modal-backdrop">
        <div class="modal-panel section-card progress-modal">
          <div class="progress-modal__head">
            <div>
              <div class="stage-preview-title">진행률</div>
              <div class="stage-preview-subtitle">각 파트별 알고있음 기준 진행률</div>
            </div>
            <button class="stage-preview-close" type="button" data-progress-close aria-label="진행률 닫기">\u2715</button>
          </div>
          <div class="progress-groups">
            ${overviewGroups.map((group) => `
              <section class="progress-group">
                <div class="progress-group__title">${escapeHtml(group.title)}</div>
                <div class="progress-track-list">
                  ${group.tracks.map((track) => `
                    <div class="progress-track">
                      <div class="progress-track__head">
                        <div class="progress-track__title">${escapeHtml(getTrackLabel(track))}</div>
                        <div class="progress-track__meta">${track.completedCount}/${track.stageCount} 뭉치 완료 · ${track.known}/${track.total}</div>
                      </div>
                      <div class="progress-cells" aria-label="${escapeHtml(track.title)} 진행 셀">
                        ${track.stageCells
                          .map(
                            (cell) =>
                              `<span class="progress-cell progress-cell--${cell.state}" title="${escapeHtml(cell.label)}"></span>`,
                          )
                          .join("")}
                      </div>
                    </div>
                  `).join("")}
                </div>
              </section>
            `).join("")}
          </div>
        </div>
      </div>
    `
    : "";

  return appShell(`
    <div class="topbar topbar--home">
      <button class="back-button back-button--ghost" data-route="home">홈</button>
      <button class="home-icon-button" type="button" data-progress-open aria-label="진행률 보기">&#128202;</button>
    </div>
    <div class="title-block title-block--home">
      <h1>${escapeHtml(state.languageId === "en" ? "영어" : "일본어")}</h1>
    </div>
    <div class="home-actions">
      <div class="home-actions-stack">
        <div class="grid-2">${homeButtons}</div>
      </div>
    </div>
    <div class="home-version">ver ${APP_VERSION}</div>
    ${overviewModal}
  `);
}

function renderSubgroups() {
  const buttons = getEnglishWordSubgroupOptions()
    .map((subgroup) => {
      const tracks = getTracksBySubgroup(subgroup.id);
      const total = tracks.reduce((sum, track) => sum + (track.total || 0), 0);
      const known = tracks.reduce((sum, track) => sum + (getTrackProgress(track.id).known ?? 0), 0);

      return `
        <button class="type-button${subgroup.id === state.subgroupId ? " is-active" : ""}" data-subgroup="${subgroup.id}">
          <div class="type-button__title">${escapeHtml(subgroup.title)}</div>
          <div class="type-button__meta">${total}개 · 알고있음 ${known}</div>
        </button>
      `;
    })
    .join("");

  return appShell(`
    <div class="topbar">
      <button class="back-button" data-route="groups">홈</button>
    </div>
    <div class="section-card">
      <h1 class="page-title">단어</h1>
      <p class="page-subtitle">교재를 먼저 고른 뒤 하위 분류로 들어갑니다.</p>
    </div>
    <div class="section-card">
      <div class="type-list">${buttons}</div>
    </div>
  `);
}

function renderTypes() {
  const tracks = state.subgroupId ? getTracksBySubgroup(state.subgroupId) : getTracksByGroup(state.groupId);
  const buttons = tracks
    .map((track) => {
      const progress = getTrackProgress(track.id);
      return `
        <button class="type-button${track.id === state.trackId ? " is-active" : ""}" data-track="${track.id}">
          <div class="type-button__title">${escapeHtml(getTrackLabel(track))}</div>
          <div class="type-button__meta">${track.total}개 · 알고있음 ${progress.known} · 공부하겠음 ${progress.again}</div>
        </button>
      `;
    })
    .join("");

  return appShell(`
    <div class="topbar">
      <button class="back-button" data-route="${state.subgroupId ? "subgroups" : "groups"}">홈</button>
    </div>
    <div class="section-card">
      <h1 class="page-title">${escapeHtml(state.subgroupId ? getEnglishWordSubgroupOptions().find((subgroup) => subgroup.id === state.subgroupId)?.title || state.groupId : state.groupId)}</h1>
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
  const stages = getStages(track);
  const isDayTrack = isDayBasedTrack(track);
  const buttons = stages
    .map((stage, index) => {
      const completed = isStageCompleted(track, stage);
      if (isDayTrack) {
        const reviewCount = track.items
          .slice(0, stage.end)
          .filter((item) => {
            const itemState = progress.itemStates?.[item.id];
            return itemState === "known" || itemState === "again";
          }).length;

        return `
          <div class="stage-row stage-row--day">
            <div class="stage-button${index === progress.stageIndex ? " is-active" : ""}${completed ? " is-complete" : ""}">
              <div class="stage-button__title">${escapeHtml(formatStageDisplayLabel(stage))}</div>
              <div class="stage-button__meta">
                <span>학습 범위 ${escapeHtml(stage.range)}</span>
                ${completed ? '<span class="stage-badge">완료</span>' : ""}
              </div>
              <div class="stage-button__submeta">복습 후보 ${reviewCount}개</div>
            </div>
            <div class="stage-row__actions">
              <button class="stage-action-button" type="button" data-stage-day="${index}">단일 학습</button>
              <button class="stage-action-button stage-action-button--ghost" type="button" data-stage-review="${index}">누적 복습</button>
              <button class="stage-preview-button" type="button" data-stage-preview="${index}" aria-label="Day 목록 보기">&#9776;</button>
            </div>
          </div>
        `;
      }

      return `
        <div class="stage-row">
          <button class="stage-button${index === progress.stageIndex ? " is-active" : ""}${completed ? " is-complete" : ""}" data-stage="${index}">
            <div class="stage-button__title">${escapeHtml(formatStageDisplayLabel(stage))}</div>
            <div class="stage-button__meta">
              <span>학습 범위 ${escapeHtml(stage.range)}</span>
              ${completed ? '<span class="stage-badge">완료</span>' : ""}
            </div>
          </button>
          <button class="stage-preview-button" type="button" data-stage-preview="${index}" aria-label="회독 목록 보기">&#9776;</button>
        </div>
      `;
    })
    .join("");

  const previewStage = state.stagePreview ? stages[state.stagePreview.index] : null;
  const previewItems = previewStage ? getItemsForStage(track, previewStage) : [];
  const filteredPreviewItems = getFilteredStagePreviewItems(track, previewItems);
  const previewTitle = track.mode === "kana_to_kanji"
    ? "히라가나 / 정답 표기"
    : track.mode === "synonym_pair"
      ? "단어 / 유의 표현"
      : "단어 / 읽기";

  return appShell(`
      <div class="topbar">
        <button class="back-button" data-route="groups">홈</button>
      </div>
    <div class="section-card">
      <h1 class="page-title">${escapeHtml(getTrackLabel(track))}</h1>
      <p class="page-subtitle">${escapeHtml(track.description)}</p>
    </div>
    <div class="section-card">
      <div class="stage-list">${buttons}</div>
    </div>

      ${
        state.stagePrompt
          ? `<div class="modal-backdrop">
        <div class="modal-panel session-prompt stage-prompt">
          <div class="session-prompt__text">\uD559\uC2B5\uD55C \uD68C\uCC28\uC785\uB2C8\uB2E4. \uCD08\uAE30\uD654\uD558\uACE0 \uB2E4\uC2DC \uD559\uC2B5\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?</div>
          <div class="stage-prompt__meta">${escapeHtml(formatStageDisplayLabel(state.stagePrompt))} ${escapeHtml(state.stagePrompt.range)}</div>
          <div class="session-prompt__actions">
            <button class="prompt-button" data-stage-reset="yes">\uC608</button>
            <button class="prompt-button prompt-button--ghost" data-stage-reset="no">\uC544\uB2C8\uC624</button>
          </div>
        </div>
      </div>`
          : ""
      }

      ${
        state.stagePreview && previewStage
          ? `<div class="modal-backdrop">
        <div class="modal-panel section-card stage-preview-modal">
          <div class="stage-preview-head">
            <div>
              <div class="stage-preview-title">${escapeHtml(getTrackLabel(track))} · ${escapeHtml(formatStageDisplayLabel(previewStage))} ${escapeHtml(previewStage.range)}</div>
              <div class="stage-preview-subtitle">이 회독 범위에서 확인할 항목 목록 · ${filteredPreviewItems.length}개</div>
            </div>
            <button class="stage-preview-close" type="button" data-stage-preview-close aria-label="목록 닫기">\u2715</button>
          </div>
          <div class="stage-preview-filters">
            <button
              class="stage-preview-filter${state.stagePreview.filter !== "pending" ? " is-active" : ""}"
              type="button"
              data-stage-preview-filter="all"
            >
              전체 목록
            </button>
            <button
              class="stage-preview-filter${state.stagePreview.filter === "pending" ? " is-active" : ""}"
              type="button"
              data-stage-preview-filter="pending"
            >
              미완료만
            </button>
          </div>
          <div class="stage-preview-table-wrap">
            ${
              filteredPreviewItems.length
                ? `<table class="stage-preview-table">
              <thead>
                <tr>
                  <th>${escapeHtml(previewTitle)}</th>
                  <th>뜻</th>
                  <th>메모 / 대상</th>
                </tr>
              </thead>
              <tbody>${renderStagePreviewRows(track, filteredPreviewItems)}</tbody>
            </table>`
                : `<div class="stage-preview-empty">이 회독 범위에서 아직 미완료 항목이 없습니다.</div>`
            }
          </div>
        </div>
      </div>`
          : ""
      }
    `);
}

function renderStudy() {
  const track = getTrack(state.trackId);
  const progress = getTrackProgress(track.id);
  const stages = getStages(track);
  const stage = stages[Math.min(progress.stageIndex, stages.length - 1)];
  const session = getStageSession(track);
  const item = getCurrentItem(track);
  const stats = getSessionStats(session);
  const isReviewMode = session.mode === "review";
  const modeLabel = isReviewMode ? "누적 복습" : "단일 학습";
  const modeDescription = isReviewMode
    ? `${formatStageDisplayLabel(stage)}까지의 누적 복습`
    : `${formatStageDisplayLabel(stage)} 단일 학습`;

  if (!item) {
    return appShell(`
      <div class="topbar">
        <button class="back-button" data-route="groups">홈</button>
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
  const isEnglish = (track.language ?? "ja") === "en";

  let primary = "";
  let secondary = "";
  let tertiary = "";
  let choices = "";
  let modeText = "";
  let actions = [];
  let secondaryClass = "card-reading";
  let tertiaryClass = "card-meaning";
  let choiceClass = "card-choice";

  if (isEnglish) {
    modeText = "단어를 보고 뜻을 떠올린 뒤 확인";
    primary = escapeHtml(item.primary);
    secondary = state.reveal.meaning ? escapeHtml(item.meaning) : "";
    actions = [
      { key: "meaning", label: "뜻 보기" },
      { key: "example", label: "예문 보기", enabled: Boolean(exampleJa) },
      { key: "exampleKo", label: "예문 해석 보기", enabled: Boolean(exampleKo) },
    ];
  } else if (track.mode === "kanji_to_kana") {
    modeText = "한자를 보고 읽기를 떠올린 뒤 확인";
    primary = renderRubyParts(item.rubyParts, state.reveal.reading, { padBlankRuby: true });
    secondary = state.reveal.meaning ? escapeHtml(item.meaning) : "";
    actions = [
      { key: "reading", label: "히라가나 보기" },
      { key: "meaning", label: "의미 보기" },
      { key: "example", label: "예문 보기", enabled: Boolean(exampleJa) },
      { key: "exampleKo", label: "예문 해석 보기", enabled: Boolean(exampleKo) },
    ];
  } else if (track.mode === "kana_to_kanji") {
    modeText = "히라가나를 보고 맞는 한자 표기를 떠올린 뒤 확인";
    primary = escapeHtml(item.primary);
    secondary = state.reveal.answer ? renderRubyParts(item.rubyParts, true, { padBlankRuby: true }) : "";
    tertiary = state.reveal.answer ? escapeHtml(item.meaning) : "";
    secondaryClass = "card-reading card-reading--answer";
    tertiaryClass = "card-meaning card-meaning--answer";
    choices = state.reveal.choices ? escapeHtml(buildChoiceList(item).join(" · ")) : "";
    actions = [
      { key: "choices", label: "보기 열기" },
      { key: "answer", label: "정답 보기" },
      { key: "example", label: "예문 보기", enabled: Boolean(exampleJa) },
      { key: "exampleKo", label: "예문 해석 보기", enabled: Boolean(exampleKo) },
    ];
  } else if (track.mode === "synonym_pair") {
    modeText = "한쪽 표현을 보고 대응되는 유의 표현을 떠올리는 연습";
    primary = renderRubyParts(item.rubyParts, state.reveal.reading, { padBlankRuby: true });
    secondary = state.reveal.pair
      ? renderRubyParts(
          item.pairRubyParts || [{ base: item.pairText, ruby: item.pairReading || "" }],
          true,
          { padBlankRuby: true },
        )
      : "";
    choices = state.reveal.meaning ? escapeHtml(item.meaning) : "";
    actions = [
      { key: "reading", label: "히라가나 보기" },
      { key: "pair", label: "유의 표현 보기" },
      { key: "meaning", label: "의미 보기" },
      { key: "example", label: "예문 보기", enabled: Boolean(exampleJa) },
      { key: "exampleKo", label: "예문 해석 보기", enabled: Boolean(exampleKo) },
    ];
  } else {
    modeText = "의미를 떠올린 뒤 예문으로 확인";
    primary = renderRubyParts(item.rubyParts, state.reveal.reading, { padBlankRuby: true });
    secondary = state.reveal.meaning ? escapeHtml(item.meaning) : "";
    actions = [
      { key: "reading", label: "히라가나 보기" },
      { key: "meaning", label: "의미 보기" },
      { key: "example", label: "예문 보기", enabled: Boolean(exampleJa) },
      { key: "exampleKo", label: "예문 해석 보기", enabled: Boolean(exampleKo) },
    ];
  }

  const visibleActions = actions.filter((action) => action.enabled !== false);
  const primaryActions = visibleActions.filter(
    (action) => action.key !== "example" && action.key !== "exampleKo",
  );
  const exampleActions = visibleActions.filter(
    (action) => action.key === "example" || action.key === "exampleKo",
  );
  const isPromptOpen = Boolean(session.prompt);
  const retryPromptModal =
    session.prompt?.type === "retry"
      ? `<div class="modal-backdrop">
        <div class="modal-panel session-prompt session-prompt--modal">
          <div class="session-prompt__text">공부하겠음을 누른 단어들만 다시 띄울까요?</div>
          <div class="session-prompt__actions">
            <button class="prompt-button" data-session-action="retry-yes">예</button>
            <button class="prompt-button prompt-button--ghost" data-session-action="retry-no">아니오</button>
          </div>
        </div>
      </div>`
      : "";
  const completePromptModal =
    session.prompt?.type === "complete"
      ? `<div class="modal-backdrop">
        <div class="modal-panel session-prompt session-prompt--modal">
          <div class="session-prompt__text">완료했습니다!</div>
          <div class="session-prompt__actions">
            <button class="prompt-button" data-session-action="complete-ok">확인</button>
          </div>
        </div>
      </div>`
      : "";
  const nextPromptModal =
    session.prompt?.type === "next"
      ? `<div class="modal-backdrop">
        <div class="modal-panel session-prompt session-prompt--modal">
          <div class="session-prompt__text">다음 진행 뭉치: ${escapeHtml(session.prompt.target.trackTitle)} · ${escapeHtml(session.prompt.target.stageLabel)}</div>
          <div class="stage-prompt__meta">${escapeHtml(session.prompt.target.stageRange)} 이동하시겠습니까?</div>
          <div class="session-prompt__actions">
            <button class="prompt-button" data-session-action="next-yes">예</button>
            <button class="prompt-button prompt-button--ghost" data-session-action="next-no">아니오</button>
          </div>
        </div>
      </div>`
      : "";

  return appShell(`
    <div class="topbar">
      <button class="back-button" data-route="groups">홈</button>
    </div>
    <div class="section-card">
      <div class="study-mode-row">
        <button class="study-mode-badge${state.continuousProgress ? " is-active" : ""}" type="button" data-continuous-toggle>
          ${state.continuousProgress ? "[진행중]" : "[진행]"}
        </button>
      </div>
      <div class="study-head">
        <div>
          <h1 class="page-title page-title--study">${escapeHtml(getTrackLabel(track))}</h1>
          <div class="study-inline-meta">
            <span class="page-subtitle">${escapeHtml(modeText)}</span>
          </div>
        </div>
        <div class="study-progress">${Math.min(session.pointer + 1, session.queueIds.length)} / ${session.queueIds.length}</div>
      </div>
      <div class="study-mode-row">
        <div class="study-mode-badge is-active">${escapeHtml(modeLabel)}</div>
      </div>
      <div class="study-summary-row">
        <div class="study-summary-left">
          <span class="page-subtitle">${escapeHtml(modeDescription)} · ${escapeHtml(stage.range)} · ${session.round}라운드</span>
        </div>
        <div class="study-summary-stats">
          <span class="study-stat-chip">알고있음 <strong>${stats.known}</strong></span>
          <span class="study-stat-chip">공부하겠음 <strong>${stats.again}</strong></span>
        </div>
      </div>
    </div>
    <div class="section-card card-frame">
      <div class="card-panel">
        <button class="card-speak-button" data-speak aria-label="단어 발음 듣기">&#128266;</button>
        ${metaButtonVisible ? `<button class="card-meta-button" data-reveal="meta" aria-label="메모 열기">✏️</button>` : ""}
        ${metaVisible ? `<div class="card-meta-popover">${metaText}</div>` : ""}
        <div class="card-primary">${primary}</div>
        <div class="card-slot ${secondaryClass}${secondary ? "" : " is-empty"}">${secondary || "&nbsp;"}</div>
        <div class="card-slot ${tertiaryClass}${tertiary ? "" : " is-empty"}">${tertiary || "&nbsp;"}</div>
        <div class="card-slot ${choiceClass}${choices ? "" : " is-empty"}">${choices || "&nbsp;"}</div>
        <div class="card-example-shell">
          <div class="card-example${state.reveal.example && exampleJa ? "" : " is-empty"}">${state.reveal.example && exampleJa ? highlightExampleText(item.exampleJa, item, track) : "&nbsp;"}</div>
          <div class="card-example card-example--ko${state.reveal.exampleKo && exampleKo ? "" : " is-empty"}">${state.reveal.exampleKo && exampleKo ? exampleKo : "&nbsp;"}</div>
        </div>
      </div>
      <div class="action-stack">
        <div class="action-row action-row--primary">
          ${primaryActions
            .map(
              (action) =>
                `<button class="action-button" data-reveal="${action.key}">${escapeHtml(action.label)}</button>`,
            )
            .join("")}
        </div>
        ${
          exampleActions.length
            ? `<div class="action-row action-row--examples">
          ${exampleActions
            .map(
              (action) =>
                `<button class="action-button action-button--secondary" data-reveal="${action.key}">${escapeHtml(action.label)}</button>`,
            )
            .join("")}
        </div>`
            : ""
        }
        <div class="decision-row">
          <button class="decision-button decision-button--again" data-decision="again"${isPromptOpen ? " disabled" : ""}>공부하겠음</button>
          <button class="decision-button decision-button--known" data-decision="known"${isPromptOpen ? " disabled" : ""}>알고있음</button>
        </div>
      </div>
    </div>
    ${retryPromptModal}
    ${completePromptModal}
    ${nextPromptModal}
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
      <h1>회독노트</h1>
    </div>
    <div class="section-card">
      <div class="muted-box">데이터를 불러오는 중입니다...</div>
    </div>
  `);
}

function renderError() {
  return appShell(`
    <div class="title-block">
      <h1>회독노트</h1>
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
  } else if (state.route === "groups") {
    app.innerHTML = renderGroups();
  } else if (state.route === "subgroups") {
    app.innerHTML = renderSubgroups();
  } else if (state.route === "types") {
    app.innerHTML = renderTypes();
  } else if (state.route === "stage") {
    app.innerHTML = renderStage();
  } else {
    app.innerHTML = renderStudy();
  }

  normalizeStudyHeaderLayout();
  bindEvents();
}

function normalizeStudyHeaderLayout() {
  const studyHead = document.querySelector(".study-head");
  const progress = document.querySelector(".study-progress");
  const summaryRow = document.querySelector(".study-summary-row");
  const stats = document.querySelector(".study-summary-stats");

  if (!studyHead || !progress || !summaryRow || !stats) {
    return;
  }

  if (summaryRow.nextElementSibling?.classList.contains("study-summary-row--stats")) {
    return;
  }

  progress.remove();
  stats.remove();

  const statsRow = document.createElement("div");
  statsRow.className = "study-summary-row study-summary-row--stats";
  statsRow.append(progress, stats);
  summaryRow.insertAdjacentElement("afterend", statsRow);
}

function bindEvents() {
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => onSelectLanguage(button.dataset.language));
  });

  document.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => onSelectGroup(button.dataset.group));
  });

  document.querySelectorAll("[data-subgroup]").forEach((button) => {
    button.addEventListener("click", () => onSelectSubgroup(button.dataset.subgroup));
  });

  document.querySelectorAll("[data-track]").forEach((button) => {
    button.addEventListener("click", () => onSelectTrack(button.dataset.track));
  });

  document.querySelectorAll("[data-stage]").forEach((button) => {
    button.addEventListener("click", () => onSelectStage(Number(button.dataset.stage)));
  });

  document.querySelectorAll("[data-stage-day]").forEach((button) => {
    button.addEventListener("click", () => onSelectStage(Number(button.dataset.stageDay), { mode: "day" }));
  });

  document.querySelectorAll("[data-stage-review]").forEach((button) => {
    button.addEventListener("click", () => onSelectStage(Number(button.dataset.stageReview), { mode: "review" }));
  });

  document.querySelectorAll("[data-stage-preview]").forEach((button) => {
    button.addEventListener("click", () => {
      state.stagePreview = { index: Number(button.dataset.stagePreview), filter: "all" };
      render();
    });
  });

  document.querySelectorAll("[data-stage-preview-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.stagePreview) {
        return;
      }

      state.stagePreview = {
        ...state.stagePreview,
        filter: button.dataset.stagePreviewFilter === "pending" ? "pending" : "all",
      };
      render();
    });
  });

  document.querySelectorAll("[data-stage-preview-close]").forEach((button) => {
    button.addEventListener("click", () => {
      state.stagePreview = null;
      render();
    });
  });

  document.querySelectorAll("[data-progress-open]").forEach((button) => {
    button.addEventListener("click", () => {
      state.progressOverview = true;
      render();
    });
  });

  document.querySelectorAll("[data-progress-close]").forEach((button) => {
    button.addEventListener("click", () => {
      state.progressOverview = false;
      render();
    });
  });

  document.querySelectorAll("[data-continue]").forEach((button) => {
    button.addEventListener("click", continueLeastProgress);
  });

  document.querySelectorAll("[data-export-progress]").forEach((button) => {
    button.addEventListener("click", exportProgress);
  });

  document.querySelectorAll("[data-import-progress]").forEach((button) => {
    button.addEventListener("click", importProgress);
  });

  document.querySelectorAll("[data-backup-notice-close]").forEach((button) => {
    button.addEventListener("click", () => {
      state.backupNotice = "";
      render();
    });
  });

  document.querySelectorAll("[data-continuous-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      state.continuousProgress = !state.continuousProgress;
      render();
    });
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.route === "home") {
        setRoute("home", { languageId: null, groupId: null, subgroupId: null, trackId: null });
      } else if (button.dataset.route === "groups") {
        setRoute("groups", { languageId: state.languageId, groupId: null, subgroupId: null, trackId: null });
      } else if (button.dataset.route === "subgroups") {
        setRoute("subgroups", { languageId: state.languageId, groupId: state.groupId, subgroupId: null, trackId: null });
      } else {
        setRoute("types");
      }
    });
  });

  document.querySelectorAll("[data-reveal]").forEach((button) => {
    button.addEventListener("click", () => reveal(button.dataset.reveal));
  });

  document.querySelectorAll("[data-speak]").forEach((button) => {
    button.addEventListener("click", speakCurrentItem);
  });

  document.querySelectorAll("[data-decision]").forEach((button) => {
    button.addEventListener("click", () => advanceCard(button.dataset.decision));
  });

  document.querySelectorAll("[data-session-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.sessionAction === "retry-yes") {
        handleRetryPrompt(true);
      } else if (button.dataset.sessionAction === "retry-no") {
        handleRetryPrompt(false);
      } else if (button.dataset.sessionAction === "next-yes") {
        handleNextProgressPrompt(true);
      } else if (button.dataset.sessionAction === "next-no") {
        handleNextProgressPrompt(false);
      } else if (button.dataset.sessionAction === "complete-ok") {
        handleCompletePrompt();
      }
    });
  });

  document.querySelectorAll("[data-stage-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.stageReset === "yes" && state.stagePrompt) {
        onSelectStage(state.stagePrompt.index, { forceReset: true });
        return;
      }

      state.stagePrompt = null;
      render();
    });
  });
}

async function init() {
  window.history.replaceState(currentRouteState(), "");
  primeSpeechVoices();
  window.requestAnimationFrame(pollGamepad);

  window.addEventListener("popstate", (event) => {
    const routeState = event.state;
    state.isPoppingState = true;
    applyRouteState(routeState ?? { route: "home", languageId: null, groupId: null, subgroupId: null, trackId: null });
    render();
    state.isPoppingState = false;
  });

  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      primeSpeechVoices();
      navigator.serviceWorker.register("./sw.js").then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      }).catch(() => {});
    });
  }

  try {
    const response = await fetch("./data/n3.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.dataset = await response.json();
    primeSpeechVoices();
    render();
  } catch (error) {
    state.error = `데이터 로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
    render();
  }
}

init();
