const STORAGE_KEY = "jlpt-review-trainer-progress-v1";
const APP_VERSION = "3.2.12";
let transientNoticeTimer = null;

function createDefaultCustomConfig() {
  return {
    batchSize: 20,
    selectedStageKeys: [],
  };
}

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
  customConfig: createDefaultCustomConfig(),
  customSession: null,
  reveal: {},
  stagePrompt: null,
  stagePreview: null,
  stageStats: null,
  transientNotice: null,
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

function restoreAppStateFromProgress() {
  const persisted = state.progress?.__appState ?? {};
  state.customConfig = persisted.customConfig ?? createDefaultCustomConfig();
  state.customSession = persisted.customSession ?? null;
}

function syncAppStateToProgress() {
  state.progress.__appState = {
    customConfig: state.customConfig,
    customSession: state.customSession,
  };
}

restoreAppStateFromProgress();

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveProgress() {
  syncAppStateToProgress();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function getSavedItemIds() {
  return Array.isArray(state.progress.__savedItemIds) ? state.progress.__savedItemIds : [];
}

function setSavedItemIds(ids) {
  state.progress.__savedItemIds = [...new Set(ids)].sort();
}

function makeSavedItemKey(trackId, itemId) {
  return `${trackId}:${itemId}`;
}

function isItemSaved(trackId, itemId) {
  return getSavedItemIds().includes(makeSavedItemKey(trackId, itemId));
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
      restoreAppStateFromProgress();
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
  let start = 0;

  while (start < total) {
    const end = Math.min(start + stageSize, total);
    stages.push({
      id: `block-${start + 1}-${end}`,
      label: `${stages.length + 1}회독`,
      range: `${start + 1}~${end}`,
      start,
      end,
    });
    start = end;
  }

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
      stageRecords: {},
      recentPairIds: [],
      sessions: {},
    };
  }

  state.progress[trackId].itemStates ??= {};
  state.progress[trackId].completedStages ??= {};
  state.progress[trackId].stageRecords ??= {};
  state.progress[trackId].sessions ??= {};
  syncTrackTotals(state.progress[trackId]);
  normalizeTrackProgress(trackId);
  return state.progress[trackId];
}

function syncTrackTotals(progress) {
  const values = Object.values(progress.itemStates ?? {});
  progress.known = values.filter((value) => value === "known").length;
  progress.again = values.filter((value) => value === "again").length;
}

function getProgressSchemaVersion(track) {
  return Array.isArray(track?.stages) && track.stages.length ? "native-v1" : "block-v1";
}

function getStageSessionPresence(progress, track, stage) {
  const daySession = progress.sessions?.[getSessionKey(track, stage, "day")];
  const reviewSession = progress.sessions?.[getSessionKey(track, stage, "review")];
  return Boolean(daySession || reviewSession);
}

function normalizeTrackProgress(trackId) {
  const progress = state.progress[trackId];
  const track = getTrack(trackId);
  if (!progress || !track) {
    return;
  }

  const schemaVersion = getProgressSchemaVersion(track);
  if (progress.stageSchemaVersion !== schemaVersion) {
    progress.sessions = {};
    progress.stageSchemaVersion = schemaVersion;
  }

  const nextCompletedStages = {};
  for (const stage of getStages(track)) {
    const items = getItemsForStage(track, stage);
    if (items.length && items.every((item) => progress.itemStates?.[item.id] === "known")) {
      nextCompletedStages[getStageKeyByEnd(track, stage)] = true;
    }
  }

  progress.completedStages = nextCompletedStages;
  progress.stageIndex = Math.min(progress.stageIndex ?? 0, Math.max(0, getStages(track).length - 1));
}

function getStageCellState(track, stage) {
  const progress = getTrackProgress(track.id);
  const stageKey = getStageKeyByEnd(track, stage);

  if (progress.completedStages?.[stageKey]) {
    return "complete";
  }

  if (getStageSessionPresence(progress, track, stage)) {
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
    return stageKey !== skipStageKey && !progress.completedStages[stageKey] && getStageSessionPresence(progress, track, stage);
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
    customConfig: state.customConfig,
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
  state.customConfig = routeState.customConfig ?? createDefaultCustomConfig();
  state.reveal = {};
  state.stagePrompt = null;
  state.stagePreview = null;
  state.stageStats = null;
  state.transientNotice = null;
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
  state.stageStats = null;
  state.transientNotice = null;
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

function enterGroup(groupId) {
  state.continuousProgress = false;

  if (state.languageId === "ja" && (groupId === "?낇빐" || groupId === "泥?빐")) {
    const track = getTracksByGroup(groupId, state.languageId)[0];
    if (!track) {
      return;
    }

    setRoute("stage", {
      languageId: state.languageId,
      groupId,
      subgroupId: null,
      trackId: track.id,
    });
    return;
  }

  if (state.languageId === "en" && groupId === "?⑥뼱") {
    setRoute("subgroups", {
      languageId: state.languageId,
      groupId,
      subgroupId: null,
      trackId: null,
    });
    return;
  }

  const firstTrack = getTracksByGroup(groupId, state.languageId)[0];
  if (!firstTrack) {
    return;
  }

  setRoute("types", {
    languageId: state.languageId,
    groupId,
    subgroupId: null,
    trackId: firstTrack.id,
  });
}

function enterSubgroup(subgroupId) {
  state.continuousProgress = false;
  const firstTrack = getTracksBySubgroup(subgroupId)[0];
  if (!firstTrack) {
    return;
  }

  setRoute("types", {
    languageId: state.languageId,
    groupId: state.groupId,
    subgroupId,
    trackId: firstTrack.id,
  });
}

function enterTrack(trackId) {
  state.continuousProgress = false;
  state.sessionMode = "day";
  setRoute("stage", {
    languageId: state.languageId,
    groupId: state.groupId,
    subgroupId: state.subgroupId,
    trackId,
  });
}

function enterGroupSafe(groupId) {
  state.continuousProgress = false;

  if (state.languageId === "ja" && (groupId === "\uB3C5\uD574" || groupId === "\uCCAD\uD574")) {
    const track = getTracksByGroup(groupId, state.languageId)[0];
    if (!track) {
      return;
    }

    setRoute("stage", {
      languageId: state.languageId,
      groupId,
      subgroupId: null,
      trackId: track.id,
    });
    return;
  }

  if (state.languageId === "en" && groupId === "\uB2E8\uC5B4") {
    setRoute("subgroups", {
      languageId: state.languageId,
      groupId,
      subgroupId: null,
      trackId: null,
    });
    return;
  }

  const firstTrack = getTracksByGroup(groupId, state.languageId)[0];
  if (!firstTrack) {
    return;
  }

  setRoute("types", {
    languageId: state.languageId,
    groupId,
    subgroupId: null,
    trackId: firstTrack.id,
  });
}

function enterSubgroupSafe(subgroupId) {
  state.continuousProgress = false;
  const firstTrack = getTracksBySubgroup(subgroupId)[0];
  if (!firstTrack) {
    return;
  }

  setRoute("types", {
    languageId: state.languageId,
    groupId: state.groupId,
    subgroupId,
    trackId: firstTrack.id,
  });
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
  const learnedItems = getItemsForStage(track, stage);
  const reviewedItems = learnedItems.filter((item) => {
    const itemState = progress.itemStates?.[item.id];
    return itemState === "known" || itemState === "again";
  });

  if (reviewedItems.length) {
    const againItems = reviewedItems.filter((item) => progress.itemStates?.[item.id] === "again");
    return againItems.length ? againItems : reviewedItems;
  }

  return learnedItems;
}

function getVisibleItems(track, mode = state.sessionMode ?? "day") {
  if (mode === "review") {
    return getReviewItems(track);
  }

  const progress = getTrackProgress(track.id);
  const stages = getStages(track);
  const stage = stages[Math.min(progress.stageIndex, stages.length - 1)];
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

function getStageRecord(track, stage) {
  const progress = getTrackProgress(track.id);
  return progress.stageRecords?.[getStageKeyByEnd(track, stage)] ?? null;
}

function recordStageCompletion(track, stage, session) {
  const progress = getTrackProgress(track.id);
  progress.stageRecords ??= {};
  const stageKey = getStageKeyByEnd(track, stage);
  const current = progress.stageRecords[stageKey] ?? { history: [] };
  const stageItems = getItemsForStage(track, stage);
  const againCountMap = session?.againCountMap ?? {};
  const cardAgainCounts = stageItems.map((item) => ({
    itemId: item.id,
    count: Math.max(0, Number(againCountMap[item.id]) || 0),
  }));
  const entry = {
    rounds: session?.round ?? 1,
    cardAgainCounts,
    completedAt: new Date().toISOString(),
  };
  const history = [...(current.history ?? []), entry].slice(-10);
  progress.stageRecords[stageKey] = {
    lastRounds: entry.rounds,
    lastCardAgainCounts: cardAgainCounts,
    completedAt: entry.completedAt,
    history,
  };
}

function normalizeCardAgainCounts(list) {
  return (Array.isArray(list) ? list : [])
    .map((entry) => Math.max(0, Number(entry?.count) || 0))
    .filter((value) => Number.isFinite(value));
}

function buildHistogramBins(counts) {
  const maxAgain = counts.length ? Math.max(...counts) : 0;
  return Array.from({ length: maxAgain + 1 }, (_, againCount) => ({
    againCount,
    cardCount: counts.filter((value) => value === againCount).length,
  }));
}

function buildStageStats(record, options = {}) {
  const history = record?.history ?? [];
  const mode = options.mode === "average" ? "average" : "recent";
  const historyIndex = Math.max(0, Number(options.historyIndex) || 0);
  const averageWindow = Math.max(1, Number(options.averageWindow) || 3);
  const fallbackCounts = normalizeCardAgainCounts(record?.lastCardAgainCounts);

  let counts = [];
  let sourceLabel = "";
  let selectedHistoryIndex = historyIndex;

  if (mode === "recent") {
    const safeIndex = history.length ? Math.min(historyIndex, history.length - 1) : 0;
    const selectedEntry = history.length ? history[history.length - 1 - safeIndex] : null;
    counts = normalizeCardAgainCounts(selectedEntry?.cardAgainCounts);
    if (!counts.length) {
      counts = fallbackCounts;
    }
    sourceLabel = history.length
      ? `최근 ${safeIndex + 1}회차`
      : "최신 스냅샷";
    selectedHistoryIndex = safeIndex;
  } else {
    const recentEntries = history.slice(-averageWindow);
    const snapshots = recentEntries
      .map((entry) => normalizeCardAgainCounts(entry?.cardAgainCounts))
      .filter((snapshot) => snapshot.length);

    if (snapshots.length) {
      const cardCount = Math.max(...snapshots.map((snapshot) => snapshot.length));
      counts = Array.from({ length: cardCount }, (_, index) => {
        const values = snapshots.map((snapshot) => snapshot[index] ?? 0);
        return values.reduce((sum, value) => sum + value, 0) / values.length;
      });
    } else {
      counts = fallbackCounts;
    }

    sourceLabel = history.length
      ? `최근 ${Math.min(averageWindow, history.length)}회 평균`
      : "평균 스냅샷";
  }

  if (!history.length && !counts.length) {
    return {
      mode,
      sourceLabel,
      completionCount: 0,
      cardCount: 0,
      averageAgain: 0,
      maxAgain: 0,
      directKnownCount: 0,
      bins: [],
      historyLength: 0,
      historyIndex: 0,
    };
  }

  const totalAgain = counts.reduce((sum, value) => sum + value, 0);
  const bins = buildHistogramBins(counts);

  return {
    mode,
    sourceLabel,
    completionCount: history.length,
    cardCount: counts.length,
    averageAgain: counts.length ? totalAgain / counts.length : 0,
    maxAgain: counts.length ? Math.max(...counts) : 0,
    directKnownCount: counts.filter((value) => value === 0).length,
    bins,
    historyLength: history.length,
    historyIndex: selectedHistoryIndex,
  };
}

function getStageByKey(track, stageKey) {
  return getStages(track).find((stage) => getStageKeyByEnd(track, stage) === stageKey) ?? null;
}

function tryRecordCustomStageCompletion(session, entry) {
  if (!session || !entry?.stageKey) {
    return;
  }

  const completedStageMap = session.completedStageMap ?? {};
  const completionKey = `${entry.trackId}:${entry.stageKey}`;
  if (completedStageMap[completionKey]) {
    return;
  }

  const allEntries = session.allEntries ?? [];
  const stageEntries = allEntries.filter(
    (candidate) => candidate.trackId === entry.trackId && candidate.stageKey === entry.stageKey,
  );
  if (!stageEntries.length) {
    return;
  }

  const finalResultMap = session.finalResultMap ?? {};
  if (!stageEntries.every((candidate) => finalResultMap[candidate.id] === "known")) {
    return;
  }

  const attemptMap = session.attemptMap ?? {};
  const rounds = Math.max(1, ...stageEntries.map((candidate) => attemptMap[candidate.id] ?? 1));
  const track = getTrack(entry.trackId);
  const stage = track ? getStageByKey(track, entry.stageKey) : null;
  if (!track || !stage) {
    return;
  }

  recordStageCompletion(track, stage, { round: rounds });
  completedStageMap[completionKey] = true;
  session.completedStageMap = completedStageMap;
}

function showTransientNotice(text, duration = 1100) {
  if (transientNoticeTimer) {
    window.clearTimeout(transientNoticeTimer);
    transientNoticeTimer = null;
  }

  state.transientNotice = { text };
  render();

  transientNoticeTimer = window.setTimeout(() => {
    state.transientNotice = null;
    transientNoticeTimer = null;
    render();
  }, duration);
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
    againCountMap: {},
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

function isCustomStudyRoute() {
  return state.route === "custom-study";
}

function getActiveStudyTrack() {
  if (isCustomStudyRoute()) {
    const entry = getCurrentCustomEntry();
    return entry ? getTrack(entry.trackId) : null;
  }

  return getTrack(state.trackId);
}

function advanceCard(result) {
  if (isCustomStudyRoute()) {
    advanceCustomCard(result);
    return;
  }

  const track = getTrack(state.trackId);
  const progress = getTrackProgress(state.trackId);
  const session = getStageSession(track);

  if (session.prompt) {
    return;
  }

  const currentItemId = session.queueIds[session.pointer];
  const currentItem = getItemById(track, currentItemId);

  session.statusMap[currentItemId] = result;
  session.againCountMap ??= {};
  if (result === "again") {
    session.againCountMap[currentItemId] = (session.againCountMap[currentItemId] ?? 0) + 1;
    session.lastAgainEntryId = currentItemId;
  }
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
  const track = getActiveStudyTrack();
  if (!track || (state.route !== "study" && state.route !== "custom-study")) {
    return;
  }

  const session = isCustomStudyRoute() ? state.customSession : getStageSession(track);
  if (session.prompt?.type === "retry") {
    if (action === "known") {
      handleRetryPrompt(true);
    } else if (action === "again") {
      handleRetryPrompt(false);
    }
    return;
  }

  if (session.prompt?.type === "next") {
    if (action === "known") {
      handleNextProgressPrompt(true);
    } else if (action === "again") {
      handleNextProgressPrompt(false);
    }
    return;
  }

  if (session.prompt?.type === "refresh") {
    if (action === "known") {
      handleCustomRefreshPrompt();
    }
    return;
  }

  if (session.prompt?.type === "complete") {
    if (action === "known") {
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

  if (pad && (state.route === "study" || state.route === "custom-study")) {
    const mapping = [
      [0, "known"],
      [1, "meaning"],
      [2, "again"],
      [3, "reading"],
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
  const track = getActiveStudyTrack();
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
  if (isCustomStudyRoute()) {
    return getCurrentCustomItem();
  }

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

function getStageForItem(track, itemId) {
  const itemIndex = track.items.findIndex((item) => item.id === itemId);
  if (itemIndex < 0) {
    return null;
  }

  return getStages(track).find((stage) => itemIndex >= (stage.start ?? 0) && itemIndex < stage.end) ?? null;
}

function getFilteredStagePreviewItems(track, items) {
  if (!state.stagePreview || state.stagePreview.filter !== "pending") {
    return items;
  }

  const progress = getTrackProgress(track.id);
  return items.filter((item) => progress.itemStates[item.id] !== "known");
}

function getSelectableStageOptions(languageId = state.languageId) {
  return getTracksByLanguage(languageId).flatMap((track) =>
    getStages(track).map((stage, index) => ({
      id: `${track.id}::${getStageKeyByEnd(track, stage)}`,
      trackId: track.id,
      groupId: track.group,
      trackTitle: getTrackLabel(track),
      stageIndex: index,
      stageKey: getStageKeyByEnd(track, stage),
      stageLabel: formatStageDisplayLabel(stage),
      stageRange: stage.range,
      itemCount: getItemsForStage(track, stage).length,
    })),
  );
}

function getCustomStageGroups(languageId = state.languageId) {
  return getLanguageGroups(languageId)
    .map((group) => {
      const tracks = getTracksByGroup(group.id, languageId)
        .map((track) => ({
          groupId: group.id,
          trackId: track.id,
          trackTitle: getTrackLabel(track),
          options: getStages(track).map((stage, index) => ({
            id: `${track.id}::${getStageKeyByEnd(track, stage)}`,
            trackId: track.id,
            stageIndex: index,
            stageLabel: formatStageDisplayLabel(stage),
            stageRange: stage.range,
            itemCount: getItemsForStage(track, stage).length,
            isCompleted: isStageCompleted(track, stage),
          })),
        }))
        .filter((track) => track.options.length);

      return {
        groupId: group.id,
        groupTitle: group.title,
        tracks,
      };
    })
    .filter((group) => group.tracks.length);
}

function getSelectedCustomStageOptions() {
  const selected = new Set(state.customConfig.selectedStageKeys ?? []);
  return getSelectableStageOptions().filter((option) => selected.has(option.id));
}

function buildCustomSelectionSignature(config = state.customConfig) {
  return JSON.stringify({
    batchSize: config?.batchSize ?? 20,
    selectedStageKeys: [...(config?.selectedStageKeys ?? [])].sort(),
  });
}

function abortCustomSession() {
  state.customSession = null;
  state.reveal = {};
  saveProgress();
  setRoute("custom-select");
}

function clearSavedItemsForLanguage(languageId = state.languageId) {
  const filtered = getSavedItemIds().filter((key) => {
    const [trackId] = key.split(":");
    const track = getTrack(trackId);
    return track && (track.language ?? "ja") !== languageId;
  });
  setSavedItemIds(filtered);

  if ((state.customSession?.kind ?? "selected") === "saved" && (state.customSession.languageId ?? state.languageId) === languageId) {
    state.customSession = null;
    state.reveal = {};
  }

  saveProgress();
  render();
}

function toggleCustomStageSelection(optionId) {
  const selected = new Set(state.customConfig.selectedStageKeys ?? []);
  if (selected.has(optionId)) {
    selected.delete(optionId);
  } else {
    selected.add(optionId);
  }

  state.customConfig = {
    ...state.customConfig,
    selectedStageKeys: [...selected],
  };
  saveProgress();
  render();
}

function clearCustomStageSelection() {
  state.customConfig = {
    ...state.customConfig,
    selectedStageKeys: [],
  };
  saveProgress();
  render();
}

function rebalanceSavedSession(session) {
  if (!session || (session.kind ?? "selected") !== "saved") {
    return;
  }

  const savedSet = new Set(getSavedItemIds());
  const currentEntry = session.activeEntries?.[session.pointer] ?? null;
  const shouldKeep = (entry) => savedSet.has(entry.id) || entry.id === currentEntry?.id;

  session.allEntries = (session.allEntries ?? []).filter((entry) => savedSet.has(entry.id));
  session.remainingEntries = (session.remainingEntries ?? []).filter((entry) => savedSet.has(entry.id));
  session.activeEntries = (session.activeEntries ?? []).filter(shouldKeep);
  session.totalEntries = session.allEntries.length;

  if (!session.activeEntries.length && !session.remainingEntries.length) {
    session.prompt = { type: "complete" };
  }

  if (session.pointer >= session.activeEntries.length) {
    session.pointer = Math.max(0, session.activeEntries.length - 1);
  }
}

function toggleSavedItem(trackId, itemId) {
  const key = makeSavedItemKey(trackId, itemId);
  const saved = new Set(getSavedItemIds());
  if (saved.has(key)) {
    saved.delete(key);
  } else {
    saved.add(key);
  }

  setSavedItemIds([...saved]);
  rebalanceSavedSession(state.customSession);
  saveProgress();
  render();
}

function setCustomBatchSize(batchSize) {
  state.customConfig = {
    ...state.customConfig,
    batchSize,
  };
  saveProgress();
  render();
}

function shuffleEntries(entries) {
  return shuffleArray(entries);
}

function avoidLeadingLastAgain(entries, lastAgainEntryId) {
  if (!lastAgainEntryId || entries.length <= 1 || entries[0]?.id !== lastAgainEntryId) {
    return entries;
  }

  return [...entries.slice(1), entries[0]];
}

function getCustomSessionStats(session) {
  if (!session) {
    return { known: 0, again: 0, overallDone: 0, overallTotal: 0 };
  }

  let known = 0;
  let again = 0;

  for (const entry of session.activeEntries) {
    const value = session.statusMap[entry.id];
    if (value === "known") {
      known += 1;
    } else if (value === "again") {
      again += 1;
    }
  }

  return {
    known,
    again,
    overallDone: Object.keys(session.completedEntryMap ?? {}).length,
    overallTotal: session.totalEntries ?? 0,
  };
}

function buildCustomSessionEntries() {
  const selectedOptions = getSelectedCustomStageOptions();
  const seen = new Set();
  const entries = [];

  for (const option of selectedOptions) {
    const track = getTrack(option.trackId);
    const stage = getStages(track)[option.stageIndex];
    for (const item of getItemsForStage(track, stage)) {
      const entryId = `${track.id}:${item.id}`;
      if (seen.has(entryId)) {
        continue;
      }

      seen.add(entryId);
      entries.push({
        id: entryId,
        trackId: track.id,
        itemId: item.id,
        stageKey: option.stageKey,
        groupId: option.groupId,
        trackTitle: option.trackTitle,
        stageLabel: option.stageLabel,
        stageRange: option.stageRange,
      });
    }
  }

  return shuffleEntries(entries);
}

function buildSavedSessionEntries(languageId = state.languageId) {
  const savedSet = new Set(getSavedItemIds());
  const entries = [];

  for (const track of getTracksByLanguage(languageId)) {
    for (const item of track.items) {
      const entryId = makeSavedItemKey(track.id, item.id);
      if (!savedSet.has(entryId)) {
        continue;
      }

      const stage = getStageForItem(track, item.id);
      entries.push({
        id: entryId,
        trackId: track.id,
        itemId: item.id,
        stageKey: stage ? getStageKeyByEnd(track, stage) : "",
        groupId: track.group,
        trackTitle: getTrackLabel(track),
        stageLabel: stage ? formatStageDisplayLabel(stage) : "",
        stageRange: stage?.range ?? "",
      });
    }
  }

  return shuffleEntries(entries);
}

function refillCustomSession(session) {
  const sessionKind = session.kind ?? "selected";
  const savedSet = sessionKind === "saved" ? new Set(getSavedItemIds()) : null;
  const retryEntries = session.activeEntries.filter(
    (entry) => session.statusMap[entry.id] === "again" && (!savedSet || savedSet.has(entry.id)),
  );
  const nextEntries = [...retryEntries];

  while (nextEntries.length < session.batchSize && session.remainingEntries.length) {
    const candidate = session.remainingEntries.shift();
    if (!candidate) {
      continue;
    }
    if (savedSet && !savedSet.has(candidate.id)) {
      continue;
    }
    nextEntries.push(candidate);
  }

  session.activeEntries = avoidLeadingLastAgain(shuffleEntries(nextEntries), session.lastAgainEntryId);
  session.pointer = 0;
  session.round += 1;
  session.statusMap = {};
  session.prompt = null;
}

function startCustomStudy(kind = "selected") {
  const selectionSignature = kind === "saved"
    ? JSON.stringify({
        kind,
        batchSize: state.customConfig.batchSize ?? 20,
        languageId: state.languageId,
        savedItemIds: getSavedItemIds().filter((key) => {
          const [trackId] = key.split(":");
          const track = getTrack(trackId);
          return track && (track.language ?? "ja") === state.languageId;
        }),
      })
    : buildCustomSelectionSignature();
  if (state.customSession?.selectionSignature === selectionSignature && state.customSession.activeEntries?.length) {
    state.reveal = {};
    setRoute("custom-study");
    return;
  }

  const entries = kind === "saved" ? buildSavedSessionEntries() : buildCustomSessionEntries();
  if (!entries.length) {
    return;
  }

  const batchSize = state.customConfig.batchSize ?? 20;
  const totalEntries = entries.length;
  const allEntries = [...entries];
  const activeEntries = entries.splice(0, batchSize);
  state.customSession = {
    kind,
    languageId: state.languageId,
    batchSize,
    round: 1,
    pointer: 0,
    totalEntries,
    selectionSignature,
    allEntries,
    activeEntries: shuffleEntries(activeEntries),
    remainingEntries: entries,
    statusMap: {},
    completedEntryMap: {},
    finalResultMap: {},
    attemptMap: {},
    againCountMap: {},
    completedStageMap: {},
    lastAgainEntryId: "",
    prompt: null,
  };
  state.reveal = {};
  saveProgress();
  setRoute("custom-study");
}

function getCurrentCustomEntry() {
  const session = state.customSession;
  if (!session?.activeEntries?.length) {
    return null;
  }

  return session.activeEntries[session.pointer] ?? null;
}

function getCurrentCustomItem() {
  const entry = getCurrentCustomEntry();
  const track = entry ? getTrack(entry.trackId) : null;
  return entry && track ? getItemById(track, entry.itemId) : null;
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

const JAPANESE_TERM_ALIASES = {
  "アイデア": ["アイディア"],
  "交代": ["交替"],
  "怖い": ["恐い", "恐かった", "恐く", "恐くない"],
  "片付ける": ["片づける", "片づけ", "片づけて", "片づけた"],
  "眼鏡": ["メガネ"],
  "ぎりぎり": ["ギリギリ"],
  "ぴかぴか": ["ピカピカ"],
  "ぶらぶら": ["ブラブラ"],
  "早い": ["速い", "速かった", "速く", "速くない"],
  "止まる": ["留まる"],
  "頭がいい": ["頭がよい", "頭がよく", "頭がよかった", "頭がよくない"],
  "夜が明ける": ["夜があける"],
};

function toKatakana(text) {
  return String(text || "").replace(/[\u3041-\u3096]/gu, (char) =>
    String.fromCodePoint(char.codePointAt(0) + 0x60),
  );
}

function toHiragana(text) {
  return String(text || "").replace(/[\u30A1-\u30F6]/gu, (char) =>
    String.fromCodePoint(char.codePointAt(0) - 0x60),
  );
}

function buildJapaneseVerbForms(term) {
  const forms = new Set();
  const value = String(term || "").trim();
  if (!value) {
    return [];
  }

  const addForms = (...items) => items.forEach((item) => addTerm(forms, item));
  addForms(value);

  if (value.endsWith("する")) {
    const root = value.slice(0, -2);
    addForms(
      `${root}し`,
      `${root}します`,
      `${root}しました`,
      `${root}しません`,
      `${root}しましょう`,
      `${root}したい`,
      `${root}して`,
      `${root}した`,
      `${root}しない`,
      `${root}しなかった`,
      `${root}しなければ`,
      `${root}しよう`,
      `${root}できる`,
      `${root}できない`,
      `${root}される`,
      `${root}された`,
      `${root}されて`,
      `${root}させる`,
      `${root}させた`,
      `${root}させて`,
    );
    return [...forms];
  }

  if (value.endsWith("くる")) {
    const root = value.slice(0, -2);
    addForms(
      `${root}き`,
      `${root}きます`,
      `${root}きました`,
      `${root}きません`,
      `${root}きましょう`,
      `${root}きたい`,
      `${root}きて`,
      `${root}きた`,
      `${root}こない`,
      `${root}こなかった`,
      `${root}こよう`,
      `${root}こられる`,
      `${root}こられない`,
      `${root}こさせる`,
    );
    return [...forms];
  }

  if (value.endsWith("る")) {
    const ichidanLike = /[\u3048\u3051\u3052\u305b\u305c\u3066\u3067\u306d\u3078\u3079\u307a\u3081\u308c\u3044\u304d\u304e\u3057\u3058\u3061\u3062\u306b\u3072\u3073\u3074\u307f\u308a]\u308b$/u.test(value);
    if (ichidanLike) {
      const root = value.slice(0, -1);
      addForms(
        root,
        `${root}ます`,
        `${root}ました`,
        `${root}ません`,
        `${root}ましょう`,
        `${root}たい`,
        `${root}て`,
        `${root}た`,
        `${root}ない`,
        `${root}なかった`,
        `${root}なければ`,
        `${root}よう`,
        `${root}られる`,
        `${root}られない`,
        `${root}られた`,
        `${root}られて`,
        `${root}させる`,
        `${root}させた`,
        `${root}させて`,
      );
      return [...forms];
    }
  }

  const ending = value.slice(-1);
  const root = value.slice(0, -1);
  const godanMap = {
    う: { i: "い", a: "わ", e: "え", o: "お", te: "って", ta: "った" },
    く: { i: "き", a: "か", e: "け", o: "こ", te: "いて", ta: "いた" },
    ぐ: { i: "ぎ", a: "が", e: "げ", o: "ご", te: "いで", ta: "いだ" },
    す: { i: "し", a: "さ", e: "せ", o: "そ", te: "して", ta: "した" },
    つ: { i: "ち", a: "た", e: "て", o: "と", te: "って", ta: "った" },
    ぬ: { i: "に", a: "な", e: "ね", o: "の", te: "んで", ta: "んだ" },
    ぶ: { i: "び", a: "ば", e: "べ", o: "ぼ", te: "んで", ta: "んだ" },
    む: { i: "み", a: "ま", e: "め", o: "も", te: "んで", ta: "んだ" },
    る: { i: "り", a: "ら", e: "れ", o: "ろ", te: "って", ta: "った" },
  };
  const info = godanMap[ending];
  if (!info) {
    return [...forms];
  }

  const stem = `${root}${info.i}`;
  const negativeRoot = `${root}${info.a}`;
  const potentialRoot = `${root}${info.e}`;
  const volitional = `${root}${info.o}う`;
  const teForm = value === "行く" ? `${root}って` : `${root}${info.te}`;
  const taForm = value === "行く" ? `${root}った` : `${root}${info.ta}`;

  addForms(
    stem,
    `${stem}ます`,
    `${stem}ました`,
    `${stem}ません`,
    `${stem}ましょう`,
    `${stem}たい`,
    teForm,
    taForm,
    `${negativeRoot}ない`,
    `${negativeRoot}なかった`,
    `${negativeRoot}なければ`,
    `${negativeRoot}ねば`,
    volitional,
    `${potentialRoot}る`,
    `${potentialRoot}ない`,
    `${potentialRoot}ます`,
    `${potentialRoot}ません`,
    `${negativeRoot}れる`,
    `${negativeRoot}れた`,
    `${negativeRoot}れて`,
    `${negativeRoot}せる`,
    `${negativeRoot}せた`,
    `${negativeRoot}せて`,
  );

  return [...forms];
}

function getRubyBaseText(parts) {
  return Array.isArray(parts) ? parts.map((part) => part.base || "").join("") : "";
}

function getRubyReadingText(parts) {
  return Array.isArray(parts) ? parts.map((part) => part.ruby || "").join("") : "";
}

function expandJapaneseExampleTerms(seed) {
  const terms = new Set();
  const baseSeed = String(seed || "").trim();
  if (!baseSeed) {
    return [];
  }

  addTerm(terms, baseSeed);
  addTerm(terms, baseSeed.replace(/\s+/gu, ""));
  addTerm(terms, toKatakana(baseSeed));
  addTerm(terms, toHiragana(baseSeed));

  const aliases = JAPANESE_TERM_ALIASES[baseSeed] || [];
  for (const alias of aliases) {
    addTerm(terms, alias);
    addTerm(terms, toKatakana(alias));
    addTerm(terms, toHiragana(alias));
  }

  for (const base of [...terms]) {
    const normalized = String(base || "").trim();
    if (!normalized) {
      continue;
    }

    for (const form of buildJapaneseVerbForms(normalized)) {
      addTerm(terms, form);
    }

    if (normalized.endsWith("い") && normalized.length >= 2) {
      const root = normalized.slice(0, -1);
      [
        root,
        `${root}い`,
        `${root}く`,
        `${root}くて`,
        `${root}かった`,
        `${root}くない`,
        `${root}くなかった`,
        `${root}すぎる`,
        `${root}すぎた`,
        `${root}さ`,
        `${root}そう`,
      ].forEach((term) => addTerm(terms, term));
    }

    if (normalized.endsWith("いい")) {
      const root = normalized.slice(0, -2);
      [
        `${root}よい`,
        `${root}よく`,
        `${root}よかった`,
        `${root}よくない`,
        `${root}よくて`,
      ].forEach((term) => addTerm(terms, term));
    }

    if (normalized.endsWith("て")) {
      addTerm(terms, `${normalized.slice(0, -1)}た`);
    }

    if (normalized.endsWith("で")) {
      addTerm(terms, `${normalized.slice(0, -1)}だ`);
    }

    if (normalized.endsWith("ない")) {
      const root = normalized.slice(0, -2);
      [
        `${root}なかった`,
        `${root}なくて`,
        `${root}ていない`,
        `${root}ていなかった`,
      ].forEach((term) => addTerm(terms, term));
    }
  }

  return [...terms].filter(Boolean).sort((left, right) => right.length - left.length);
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
  const seeds = [
    item.primary,
    item.answer,
    item.reading,
    item.pairText,
    item.pairReading,
    getRubyBaseText(item.rubyParts),
    getRubyReadingText(item.rubyParts),
    getRubyBaseText(item.pairRubyParts),
    getRubyReadingText(item.pairRubyParts),
  ];

  for (const seed of seeds) {
    for (const term of expandJapaneseExampleTerms(seed)) {
      addTerm(terms, term);
    }
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

function advanceCustomCard(result) {
  const session = state.customSession;
  const entry = getCurrentCustomEntry();
  if (!session || !entry) {
    return;
  }

  const track = getTrack(entry.trackId);
  const progress = getTrackProgress(entry.trackId);
  session.statusMap[entry.id] = result;
  session.completedEntryMap[entry.id] = true;
  session.finalResultMap ??= {};
  session.finalResultMap[entry.id] = result;
  session.attemptMap ??= {};
  session.attemptMap[entry.id] = (session.attemptMap[entry.id] ?? 0) + 1;
  session.againCountMap ??= {};
  if (result === "again") {
    session.againCountMap[entry.itemId] = (session.againCountMap[entry.itemId] ?? 0) + 1;
    session.lastAgainEntryId = entry.id;
  }
  progress.itemStates[entry.itemId] = result;
  syncTrackTotals(progress);
  normalizeTrackProgress(entry.trackId);
  if ((session.kind ?? "selected") === "selected") {
    tryRecordCustomStageCompletion(session, entry);
  }
  if ((session.kind ?? "selected") === "saved") {
    rebalanceSavedSession(session);
  }

  if (session.pointer < session.activeEntries.length - 1) {
    session.pointer += 1;
  } else {
    const retryEntries = session.activeEntries.filter((activeEntry) => session.statusMap[activeEntry.id] === "again");
    if (retryEntries.length || session.remainingEntries.length) {
      refillCustomSession(session);
      saveProgress();
      state.reveal = {};
      showTransientNotice("새로 채웁니다");
      return;
    } else {
      session.prompt = { type: "complete" };
    }
  }

  saveProgress();
  state.reveal = {};
  render();
}

function handleCustomRefreshPrompt() {
  if (!state.customSession) {
    return;
  }

  refillCustomSession(state.customSession);
  state.reveal = {};
  saveProgress();
  render();
}

function handleRetryPrompt(shouldRetry) {
  if (isCustomStudyRoute()) {
    return;
  }

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
  if (isCustomStudyRoute()) {
    state.customSession = null;
    saveProgress();
    setRoute("custom-select");
    return;
  }

  const track = getTrack(state.trackId);
  const progress = getTrackProgress(track.id);
  const stage = getStageByIndex(track, progress.stageIndex);
  const session = getStageSession(track);
  recordStageCompletion(track, stage, session);
  progress.completedStages[getStageKey(track)] = true;
  progress.sessions[getSessionKey(track, stage, state.sessionMode ?? "day")] = null;
  state.continuousProgress = false;
  saveProgress();
  setRoute("stage");
}

function handleNextProgressPrompt(shouldMove) {
  if (isCustomStudyRoute()) {
    return;
  }

  const track = getTrack(state.trackId);
  const progress = getTrackProgress(track.id);
  const stageKey = getStageKey(track);
  const session = getStageSession(track);
  const target = session.prompt?.target ?? null;
  const stage = getStageByIndex(track, progress.stageIndex);

  recordStageCompletion(track, stage, session);
  progress.completedStages[stageKey] = true;
  progress.sessions[getSessionKey(track, stage, state.sessionMode ?? "day")] = null;

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
      kind: "custom",
      id: "custom",
      title: "맞춤",
    },
  ]
    .map((button) => {
      if (button.kind === "custom") {
        return `
        <button class="big-button big-button--accent" data-custom-menu>
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

function renderCustomMenu() {
  const isCustomStudy = isCustomStudyRoute();
  return appShell(`
    <div class="topbar">
      <button class="back-button" data-route="${isCustomStudy ? "custom-select" : "groups"}">홈</button>
    </div>
    <div class="section-card">
      <h1 class="page-title">맞춤</h1>
      <p class="page-subtitle">진행 추천 또는 여러 뭉치를 직접 골라 학습합니다.</p>
    </div>
    <div class="section-card">
      <div class="type-list">
        <button class="type-button" data-continue>
          <div class="type-button__title">진행</div>
          <div class="type-button__meta">가장 덜 진행된 뭉치부터 차례대로 학습합니다.</div>
        </button>
        <button class="type-button" data-custom-select-open>
          <div class="type-button__title">선택</div>
          <div class="type-button__meta">여러 뭉치를 골라 섞어서 학습</div>
        </button>
      </div>
    </div>
  `);
}

function renderCustomMenuResume() {
  const isCustomStudy = isCustomStudyRoute();
  const currentCustomKind = state.customSession?.kind ?? "selected";
  const hasActiveSelectedSession = Boolean(currentCustomKind === "selected" && state.customSession?.activeEntries?.length);
  const hasActiveSavedSession = Boolean(currentCustomKind === "saved" && state.customSession?.activeEntries?.length);
  const savedCount = getSavedItemIds().filter((key) => {
    const [trackId] = key.split(":");
    const track = getTrack(trackId);
    return track && (track.language ?? "ja") === state.languageId;
  }).length;

  return appShell(`
    <div class="topbar">
      <button class="back-button" data-route="${isCustomStudy ? "custom-select" : "groups"}">\uD648</button>
    </div>
    <div class="section-card">
      <h1 class="page-title">\uB9DE\uCDA4</h1>
      <p class="page-subtitle">\uC9C4\uD589 \uCD94\uCC9C \uB610\uB294 \uC120\uD0DD \uD559\uC2B5\uC744 \uC9C4\uD589\uD569\uB2C8\uB2E4.</p>
    </div>
    <div class="section-card">
      <div class="type-list">
        <button class="type-button" data-continue>
          <div class="type-button__title">\uC9C4\uD589</div>
          <div class="type-button__meta">\uAC00\uC7A5 \uB35C \uC9C4\uD589\uB41C \uBB49\uCE58\uBD80\uD130 \uCC28\uB840\uB300\uB85C \uD559\uC2B5\uD569\uB2C8\uB2E4.</div>
        </button>
        <div class="custom-menu-select-row">
          <button class="type-button custom-menu-select-button" data-custom-select-open>
            <div class="type-button__title">${hasActiveSelectedSession ? "\uC120\uD0DD [\uD559\uC2B5\uC911]" : "\uC120\uD0DD"}</div>
            <div class="type-button__meta">${hasActiveSelectedSession ? "\uD559\uC2B5 \uC911\uC774\uB358 \uC120\uD0DD \uC138\uC158\uC73C\uB85C \uBC14\uB85C \uB4E4\uC5B4\uAC11\uB2C8\uB2E4." : "\uC5EC\uB7EC \uBB49\uCE58\uB97C \uACE0\uB974\uACE0 \uBB36\uC5B4\uC11C \uD559\uC2B5"}</div>
          </button>
          ${hasActiveSelectedSession ? `<button class="custom-abort-button" type="button" data-custom-abort>[\uC870\uAE30\uC885\uB8CC]</button>` : ""}
        </div>
        <div class="custom-menu-select-row">
          <button class="type-button custom-menu-select-button" data-saved-open${savedCount ? "" : " disabled"}>
            <div class="type-button__title">${hasActiveSavedSession ? "\uC800\uC7A5 [\uD559\uC2B5\uC911]" : "\uC800\uC7A5"}</div>
            <div class="type-button__meta">${savedCount ? `\uC800\uC7A5\uB41C \uB2E8\uC5B4 ${savedCount}\uAC1C\uB97C \uD559\uC2B5\uD569\uB2C8\uB2E4.` : "\uC800\uC7A5\uB41C \uB2E8\uC5B4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</div>
          </button>
          <button class="custom-abort-button" type="button" data-saved-clear${savedCount ? "" : " disabled"}>[\uBAA8\uB450\uD574\uC81C]</button>
        </div>
      </div>
    </div>
  `);
}

function renderCustomSelect() {
  const options = getSelectableStageOptions();
  const selected = new Set(state.customConfig.selectedStageKeys ?? []);
  const batchSize = state.customConfig.batchSize ?? 20;

  return appShell(`
    <div class="topbar">
      <button class="back-button" data-route="custom">홈</button>
    </div>
    <div class="section-card">
      <h1 class="page-title">선택</h1>
      <p class="page-subtitle">뭉치를 여러 개 고르고, 한 번에 볼 개수를 정한 뒤 시작합니다.</p>
    </div>
    <div class="section-card">
      <div class="custom-batch-picker">
        <button class="stage-preview-filter${batchSize === 7 ? " is-active" : ""}" type="button" data-custom-batch="7">7개</button>
        <button class="stage-preview-filter${batchSize === 20 ? " is-active" : ""}" type="button" data-custom-batch="20">20개</button>
      </div>
      <div class="page-subtitle">선택된 뭉치 ${selected.size}개</div>
    </div>
    <div class="section-card">
      <div class="type-list">
        ${options
          .map(
            (option) => `
              <button class="type-button${selected.has(option.id) ? " is-active" : ""}" data-custom-stage="${option.id}">
                <div class="type-button__title">${escapeHtml(option.trackTitle)} · ${escapeHtml(option.stageLabel)}</div>
                <div class="type-button__meta">${escapeHtml(option.groupId)} · ${escapeHtml(option.stageRange)} · ${option.itemCount}개</div>
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
    <div class="section-card">
      <button class="big-button big-button--accent big-button--single" data-custom-start${selected.size ? "" : " disabled"}>
        <div class="big-button__title">시작</div>
      </button>
    </div>
  `);
}

function renderCustomSelectCompact() {
  const selected = new Set(state.customConfig.selectedStageKeys ?? []);
  const batchSize = state.customConfig.batchSize ?? 20;
  const groups = getCustomStageGroups();
  const selectedCardCount = groups.reduce(
    (sum, group) =>
      sum +
      group.tracks.reduce(
        (trackSum, track) =>
          trackSum +
          track.options.reduce(
            (optionSum, option) => optionSum + (selected.has(option.id) ? option.itemCount : 0),
            0,
          ),
        0,
      ),
    0,
  );

  return appShell(`
    <div class="topbar">
      <button class="back-button" data-route="custom">\uD648</button>
    </div>
    <div class="section-card section-card--compact">
      <h1 class="page-title">\uC120\uD0DD</h1>
      <p class="page-subtitle">\uB2E8\uC6D0\uC744 \uACE0\uB974\uACE0 \uD55C \uBC88\uC5D0 \uD559\uC2B5\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.</p>
    </div>
    <div class="section-card section-card--compact custom-select-board">
      ${groups
        .map(
          (group) => `
            <section class="custom-select-group">
              <h2 class="custom-select-group__title">${escapeHtml(group.groupTitle)}</h2>
              ${group.tracks
                .map((track) => {
                  const selectedCount = track.options.filter((option) => selected.has(option.id)).length;
                  return `
                    <div class="custom-select-track">
                      <div class="custom-select-track__head">
                        <h3 class="custom-select-track__title">${escapeHtml(track.trackTitle)}</h3>
                        <div class="custom-select-track__meta">${selectedCount}/${track.options.length}</div>
                      </div>
                      <div class="custom-stage-chip-grid">
                        ${track.options
                          .map(
                            (option, index) => `
                              <button
                                class="custom-stage-chip${selected.has(option.id) ? " is-active" : ""}${option.isCompleted ? " is-complete" : ""}"
                                type="button"
                                data-custom-stage="${option.id}"
                                title="${escapeHtml(`${track.trackTitle} ${option.stageLabel} · ${option.stageRange}`)}"
                                aria-label="${escapeHtml(`${track.trackTitle} ${option.stageLabel} ${option.stageRange}`)}"
                              >${String(index + 1).padStart(2, "0")}</button>
                            `,
                          )
                          .join("")}
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </section>
          `,
        )
        .join("")}
    </div>
    <div class="section-card section-card--compact custom-select-footer">
      <div class="custom-select-footer__summary-wrap">
        <div class="custom-select-footer__summary">\uC120\uD0DD\uD55C \uBB49\uCE58 ${selected.size}\uAC1C</div>
        <div class="custom-select-footer__summary">\uC120\uD0DD\uD55C \uCE74\uB4DC ${selectedCardCount}\uAC1C</div>
        <button class="stage-preview-filter custom-select-clear" type="button" data-custom-clear${selected.size ? "" : " disabled"}>\uC804\uCCB4\uD574\uC81C</button>
      </div>
      <div class="custom-batch-picker custom-batch-picker--footer">
        <button class="stage-preview-filter${batchSize === 7 ? " is-active" : ""}" type="button" data-custom-batch="7">7\uAC1C</button>
        <button class="stage-preview-filter${batchSize === 20 ? " is-active" : ""}" type="button" data-custom-batch="20">20\uAC1C</button>
      </div>
      <button class="big-button big-button--accent big-button--single custom-select-start" data-custom-start${selected.size ? "" : " disabled"}>
        <div class="big-button__title">\uC2DC\uC791</div>
      </button>
    </div>
  `);
}

function renderSubgroups() {
  const isCustomStudy = isCustomStudyRoute();
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
      <button class="back-button" data-route="${isCustomStudy ? "custom-select" : "groups"}">홈</button>
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
  const isCustomStudy = isCustomStudyRoute();
  const track = getTrack(state.trackId);
  if (!track) {
    return appShell(`
      <div class="topbar">
        <button class="back-button" data-route="${isCustomStudy ? "custom-select" : "groups"}">홈</button>
      </div>
      <div class="section-card">
        <div class="muted-box">학습 트랙을 찾지 못했습니다.</div>
      </div>
    `);
  }
  const progress = getTrackProgress(track.id);
  const stages = getStages(track);
  const buttons = stages
    .map((stage, index) => {
      const completed = isStageCompleted(track, stage);
      const record = getStageRecord(track, stage);
      const reviewCount = getItemsForStage(track, stage).filter((item) => {
        const itemState = progress.itemStates?.[item.id];
        return itemState === "known" || itemState === "again";
      }).length;
      const submetaText = `복습 후보 ${reviewCount}개${record ? ` · 최근 ${record.lastRounds}R` : ""}`;

      return `
        <div class="stage-row stage-row--day">
          <div class="stage-button stage-button--day${index === progress.stageIndex ? " is-active" : ""}${completed ? " is-complete" : ""}" data-stage-row-index="${index}">
            <div class="stage-button__main">
              <div class="stage-button__head">
                <div class="stage-button__title">${escapeHtml(formatStageDisplayLabel(stage))}</div>
                <button class="stage-preview-button stage-preview-button--compact" type="button" data-stage-preview="${index}" aria-label="Day 목록 보기">&#9776;</button>
              </div>
              <div class="stage-button__meta">
                <span>학습 범위 ${escapeHtml(stage.range)}</span>
                ${completed ? '<span class="stage-badge">완료</span>' : ""}
              </div>
              <div class="stage-button__submeta">복습 후보 ${reviewCount}개</div>
            </div>
            <div class="stage-button__sidebar">
              <div class="stage-button__sidebar-actions">
                <button class="stage-action-button stage-action-button--compact" type="button" data-stage-day="${index}">단일</button>
                <button class="stage-action-button stage-action-button--compact stage-action-button--ghost" type="button" data-stage-review="${index}">복습</button>
              </div>
            </div>
          </div>
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
        <button class="back-button" data-route="${isCustomStudy ? "custom-select" : "groups"}">홈</button>
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
  const isCustomStudy = isCustomStudyRoute();
  const customEntry = isCustomStudy ? getCurrentCustomEntry() : null;
  const track = isCustomStudy ? getTrack(customEntry?.trackId) : getTrack(state.trackId);
  const progress = track ? getTrackProgress(track.id) : null;
  const stages = track ? getStages(track) : [];
  const stage = isCustomStudy
    ? { range: customEntry?.stageRange ?? "", label: customEntry?.stageLabel ?? "" }
    : stages[Math.min(progress.stageIndex, stages.length - 1)];
  const session = isCustomStudy ? state.customSession : getStageSession(track);
  const item = track ? getCurrentItem(track) : null;
  const stats = isCustomStudy ? getCustomSessionStats(session) : getSessionStats(session);
  const unitProgressText = `${Math.min(session.pointer + 1, isCustomStudy ? session.activeEntries.length : session.queueIds.length)}/${isCustomStudy ? session.activeEntries.length : session.queueIds.length}`;
  const totalProgressText = isCustomStudy ? `${stats.overallDone}/${stats.overallTotal}` : "";
  const studyProgressText = isCustomStudy ? `단위 : ${unitProgressText}   총 : ${totalProgressText}` : unitProgressText;
  const modeDescription = isCustomStudy
    ? `${customEntry?.groupId ?? ""} · ${customEntry?.stageLabel ?? ""} · ${customEntry?.stageRange ?? ""} · ${session?.round ?? 1}라운드`
    : `${stage.range} · ${session.round}라운드`;

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
  const isEnglish = (track.language ?? "ja") === "en";
  const isSaved = isItemSaved(track.id, item.id);

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
    !isCustomStudy && session.prompt?.type === "retry"
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
  const refreshPromptModal =
    isCustomStudy && session.prompt?.type === "refresh"
      ? `<div class="modal-backdrop">
        <div class="modal-panel session-prompt session-prompt--modal">
          <div class="session-prompt__text">뭉치를 갱신합니다.</div>
          <div class="stage-prompt__meta">공부하겠음 항목은 유지하고 새 항목을 보충합니다.</div>
          <div class="session-prompt__actions">
            <button class="prompt-button" data-session-action="custom-refresh">확인</button>
          </div>
        </div>
      </div>`
      : "";
  const completePromptModal =
    session.prompt?.type === "complete"
      ? `<div class="modal-backdrop">
        <div class="modal-panel session-prompt session-prompt--modal">
          <div class="session-prompt__text">${isCustomStudy ? ((state.customSession?.kind ?? "selected") === "saved" ? "저장한 단어 학습을 완료했습니다!" : "선택한 뭉치 학습을 완료했습니다!") : "완료했습니다!"}</div>
          <div class="session-prompt__actions">
            <button class="prompt-button" data-session-action="complete-ok">확인</button>
          </div>
        </div>
      </div>`
      : "";
  const transientNotice = state.transientNotice
    ? `<div class="transient-notice" aria-live="polite">${escapeHtml(state.transientNotice.text)}</div>`
    : "";
  const nextPromptModal =
    !isCustomStudy && session.prompt?.type === "next"
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
      ${isCustomStudy ? "" : `<div class="study-mode-row">
        <button class="study-mode-badge${state.continuousProgress ? " is-active" : ""}" type="button" data-continuous-toggle>
          ${state.continuousProgress ? "[진행중]" : "[진행]"}
        </button>
      </div>`}
      <div class="study-head">
        <div>
          <h1 class="page-title page-title--study">${escapeHtml(isCustomStudy ? `${getTrackLabel(track)} · ${customEntry?.stageLabel ?? ""}` : getTrackLabel(track))}</h1>
          <div class="study-inline-meta">
            <span class="page-subtitle">${escapeHtml(modeText)}</span>
          </div>
        </div>
        <div class="study-progress">${studyProgressText}</div>
      </div>
      <div class="study-summary-row">
        <div class="study-summary-left">
          <span class="page-subtitle">${escapeHtml(modeDescription)}</span>
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
        <button class="card-bookmark-button${isSaved ? " is-active" : ""}" data-bookmark-toggle aria-label="${isSaved ? "저장 해제" : "저장"}">&#128278;</button>
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
    ${refreshPromptModal}
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
  } else if (state.route === "custom") {
    app.innerHTML = renderCustomMenuResume();
  } else if (state.route === "custom-select") {
    app.innerHTML = renderCustomSelectCompact();
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
  normalizeStageRecordMeta();
  normalizeTransientNotice();
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

function normalizeStageRecordMeta() {
  if (state.route !== "stage" || !state.trackId) {
    return;
  }

  const track = getTrack(state.trackId);
  if (!track) {
    return;
  }

  const progress = getTrackProgress(track.id);
  const stages = getStages(track);
  document.querySelectorAll("[data-stage-row-index]").forEach((row) => {
    const index = Number(row.getAttribute("data-stage-row-index"));
    const stage = stages[index];
    const submeta = row.querySelector(".stage-button__submeta");
    const head = row.querySelector(".stage-button__head");
    if (!stage || !submeta) {
      return;
    }

    const reviewCount = getItemsForStage(track, stage).filter((item) => {
      const itemState = progress.itemStates?.[item.id];
      return itemState === "known" || itemState === "again";
    }).length;
    const record = getStageRecord(track, stage);
    submeta.textContent = `복습 후보 ${reviewCount}개${record ? ` · 최근 ${record.lastRounds}R` : ""}`;

    if (head && !head.querySelector("[data-stage-stats]")) {
      const previewButton = head.querySelector("[data-stage-preview]");
      const actionWrap = document.createElement("div");
      actionWrap.className = "stage-head-actions";

      const statsButton = document.createElement("button");
      statsButton.className = "stage-preview-button stage-preview-button--compact";
      statsButton.type = "button";
      statsButton.setAttribute("data-stage-stats", String(index));
      statsButton.setAttribute("aria-label", "회독 통계 보기");
      statsButton.innerHTML = "&#128202;";

      if (previewButton) {
        previewButton.remove();
        actionWrap.append(statsButton, previewButton);
      } else {
        actionWrap.append(statsButton);
      }

      head.append(actionWrap);
    }
  });

  renderStageStatsModal(track, stages);
}

function normalizeTransientNotice() {
  document.querySelector(".transient-notice")?.remove();

  if (!state.transientNotice || state.route !== "study" && state.route !== "custom-study") {
    return;
  }

  const cardPanel = document.querySelector(".card-panel");
  if (!cardPanel) {
    return;
  }

  const notice = document.createElement("div");
  notice.className = "transient-notice";
  notice.setAttribute("aria-live", "polite");
  notice.textContent = state.transientNotice.text;
  cardPanel.prepend(notice);
}

function renderStageStatsModal(track, stages) {
  const existing = document.querySelector(".stage-stats-modal-backdrop");
  existing?.remove();

  if (!state.stageStats) {
    return;
  }

  const stage = stages[state.stageStats.index];
  if (!stage) {
    return;
  }

  const record = getStageRecord(track, stage);
  const statsMode = state.stageStats.mode === "average" ? "average" : "recent";
  const historyIndex = Math.max(0, Number(state.stageStats.historyIndex) || 0);
  const averageWindow = Math.max(1, Number(state.stageStats.averageWindow) || 3);
  const stats = buildStageStats(record, {
    mode: statsMode,
    historyIndex,
    averageWindow,
  });
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop stage-stats-modal-backdrop";

  const maxBinCardCount = Math.max(1, ...stats.bins.map((entry) => entry.cardCount));
  const bars = stats.bins.length
    ? stats.bins
        .map((entry) => {
          const height = entry.cardCount
            ? Math.max(18, (entry.cardCount / maxBinCardCount) * 88)
            : 10;
          return `
            <div class="stage-stats-bar-item">
              <div class="stage-stats-bar" style="height:${height}px"><span>${entry.cardCount}</span></div>
              <div class="stage-stats-bar-label">${entry.againCount}회</div>
            </div>
          `;
        })
        .join("")
    : `<div class="stage-preview-empty">아직 완료 기록이 없습니다.</div>`;

  const recentModeClass = statsMode === "recent" ? " is-active" : "";
  const averageModeClass = statsMode === "average" ? " is-active" : "";
  const navControls = statsMode === "recent" && stats.historyLength > 1
    ? `
      <div class="stage-stats-nav">
        <button class="stage-preview-filter" type="button" data-stage-stats-nav="prev"${stats.historyIndex >= stats.historyLength - 1 ? " disabled" : ""}>이전</button>
        <div class="stage-stats-nav__label">${stats.sourceLabel}</div>
        <button class="stage-preview-filter" type="button" data-stage-stats-nav="next"${stats.historyIndex <= 0 ? " disabled" : ""}>다음</button>
      </div>
    `
    : `<div class="stage-stats-nav stage-stats-nav--single"><div class="stage-stats-nav__label">${stats.sourceLabel}</div></div>`;
  const averageControls = statsMode === "average"
    ? `
      <div class="stage-stats-window">
        <button class="stage-preview-filter${averageWindow === 3 ? " is-active" : ""}" type="button" data-stage-stats-window="3">3회</button>
        <button class="stage-preview-filter${averageWindow === 5 ? " is-active" : ""}" type="button" data-stage-stats-window="5">5회</button>
        <button class="stage-preview-filter${averageWindow >= Math.max(stats.historyLength, 1) ? " is-active" : ""}" type="button" data-stage-stats-window="all">전체</button>
      </div>
    `
    : "";

  backdrop.innerHTML = `
    <div class="modal-panel section-card stage-preview-modal stage-stats-modal">
      <div class="stage-preview-head">
        <div>
          <div class="stage-preview-title">${escapeHtml(getTrackLabel(track))} · ${escapeHtml(formatStageDisplayLabel(stage))} ${escapeHtml(stage.range)}</div>
          <div class="stage-preview-subtitle">카드별 공부하겠음 횟수 분포</div>
        </div>
        <button class="stage-preview-close" type="button" data-stage-stats-close aria-label="통계 닫기">\u2715</button>
      </div>
      <div class="stage-stats-mode">
        <button class="stage-preview-filter${recentModeClass}" type="button" data-stage-stats-mode="recent">회차별</button>
        <button class="stage-preview-filter${averageModeClass}" type="button" data-stage-stats-mode="average">평균</button>
      </div>
      ${navControls}
      ${averageControls}
      <div class="stage-stats-summary">
        <span class="study-stat-chip">카드 <strong>${stats.cardCount}개</strong></span>
        <span class="study-stat-chip">직행 <strong>${stats.directKnownCount}개</strong></span>
        <span class="study-stat-chip">평균 <strong>${stats.averageAgain.toFixed(1)}회</strong></span>
        <span class="study-stat-chip">최대 <strong>${stats.maxAgain}회</strong></span>
      </div>
      <div class="stage-stats-bars">${bars}</div>
      <div class="stage-preview-subtitle">완료 기록 ${stats.completionCount}회 기준</div>
    </div>
  `;

  document.querySelector(".screen")?.append(backdrop);
}

function bindEvents() {
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => onSelectLanguage(button.dataset.language));
  });

  document.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => enterGroupSafe(button.dataset.group));
  });

  document.querySelectorAll("[data-subgroup]").forEach((button) => {
    button.addEventListener("click", () => enterSubgroupSafe(button.dataset.subgroup));
  });

  document.querySelectorAll("[data-track]").forEach((button) => {
    button.addEventListener("click", () => enterTrack(button.dataset.track));
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

  document.querySelectorAll("[data-stage-stats]").forEach((button) => {
    button.addEventListener("click", () => {
      state.stageStats = {
        index: Number(button.dataset.stageStats),
        mode: "recent",
        historyIndex: 0,
        averageWindow: 3,
      };
      render();
    });
  });

  document.querySelectorAll("[data-stage-stats-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.stageStats) {
        return;
      }

      state.stageStats = {
        ...state.stageStats,
        mode: button.dataset.stageStatsMode === "average" ? "average" : "recent",
      };
      render();
    });
  });

  document.querySelectorAll("[data-stage-stats-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.stageStats) {
        return;
      }

      const currentIndex = Math.max(0, Number(state.stageStats.historyIndex) || 0);
      state.stageStats = {
        ...state.stageStats,
        historyIndex: button.dataset.stageStatsNav === "prev" ? currentIndex + 1 : Math.max(0, currentIndex - 1),
      };
      render();
    });
  });

  document.querySelectorAll("[data-stage-stats-window]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.stageStats) {
        return;
      }

      state.stageStats = {
        ...state.stageStats,
        averageWindow: button.dataset.stageStatsWindow === "all" ? 999 : Number(button.dataset.stageStatsWindow) || 3,
      };
      render();
    });
  });

  document.querySelectorAll("[data-stage-stats-close]").forEach((button) => {
    button.addEventListener("click", () => {
      state.stageStats = null;
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

  document.querySelectorAll("[data-custom-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      state.customConfig = {
        ...state.customConfig,
        selectedStageKeys: [],
      };
      saveProgress();
      setRoute("custom");
    });
  });

  document.querySelectorAll("[data-custom-select-open]").forEach((button) => {
    button.addEventListener("click", () => {
      if ((state.customSession?.kind ?? "selected") === "selected" && state.customSession?.activeEntries?.length) {
        state.reveal = {};
        setRoute("custom-study");
        return;
      }

      state.customConfig = {
        ...state.customConfig,
        selectedStageKeys: [],
      };
      saveProgress();
      setRoute("custom-select");
    });
  });

  document.querySelectorAll("[data-saved-open]").forEach((button) => {
    button.addEventListener("click", () => {
      if ((state.customSession?.kind ?? "selected") === "saved" && state.customSession?.activeEntries?.length) {
        state.reveal = {};
        setRoute("custom-study");
        return;
      }

      startCustomStudy("saved");
    });
  });

  document.querySelectorAll("[data-saved-clear]").forEach((button) => {
    button.addEventListener("click", () => clearSavedItemsForLanguage());
  });

  document.querySelectorAll("[data-custom-abort]").forEach((button) => {
    button.addEventListener("click", abortCustomSession);
  });

  document.querySelectorAll("[data-custom-stage]").forEach((button) => {
    button.addEventListener("click", () => toggleCustomStageSelection(button.dataset.customStage));
  });

  document.querySelectorAll("[data-custom-batch]").forEach((button) => {
    button.addEventListener("click", () => setCustomBatchSize(Number(button.dataset.customBatch)));
  });

  document.querySelectorAll("[data-custom-clear]").forEach((button) => {
    button.addEventListener("click", clearCustomStageSelection);
  });

  document.querySelectorAll("[data-custom-start]").forEach((button) => {
    button.addEventListener("click", () => startCustomStudy("selected"));
  });

  document.querySelectorAll("[data-continue]").forEach((button) => {
    button.addEventListener("click", continueLeastProgress);
  });

  document.querySelectorAll("[data-export-progress]").forEach((button) => {
    button.addEventListener("click", exportProgress);
  });

  document.querySelectorAll("[data-bookmark-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const activeTrack = getActiveStudyTrack();
      const currentItem = activeTrack ? getCurrentItem(activeTrack) : null;
      if (!activeTrack || !currentItem) {
        return;
      }
      toggleSavedItem(activeTrack.id, currentItem.id);
    });
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
      } else if (button.dataset.route === "custom") {
        setRoute("custom");
      } else if (button.dataset.route === "custom-select") {
        setRoute("custom-select");
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
      } else if (button.dataset.sessionAction === "custom-refresh") {
        handleCustomRefreshPrompt();
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
    for (const track of state.dataset.tracks ?? []) {
      getTrackProgress(track.id);
    }
    saveProgress();
    primeSpeechVoices();
    render();
  } catch (error) {
    state.error = `데이터 로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
    render();
  }
}

init();
