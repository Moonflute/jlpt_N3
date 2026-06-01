import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "_N3");
const outputDir = path.join(rootDir, "data");
const outputPath = path.join(outputDir, "n3.json");
const overridePath = path.join(rootDir, "data", "furigana-overrides.json");
const extraOverridePath = path.join(rootDir, "data", "furigana-overrides-extra.json");

function findSourceFile(matcher) {
  const entries = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".txt"));
  return entries.find(matcher) || "";
}

const sourceFileName = findSourceFile((name) => name.includes("해커스"));
const vocabSourceFileName =
  findSourceFile((name) => name !== sourceFileName && name.includes("JLPT")) ||
  findSourceFile((name) => name !== sourceFileName);
const sourcePath = path.join(sourceDir, sourceFileName);
const vocabSourcePath = path.join(sourceDir, vocabSourceFileName);
const READING_OVERRIDES = {
  "～に比べて": "～にくらべて",
  "～に加えて": "～にくわえて",
  "～に対して": "～にたいして",
  "～に反して": "～にはんして",
  "～を中心に": "～をちゅうしんに",
  "～を通じて": "～をつうじて",
  "～を抜きにして": "～をぬきにして",
  "～降りそうにない": "～ふりそうにない",
  "～終わる": "～おわる",
  "～直す": "～なおす",
  "～始める": "～はじめる",
  "～て以来": "～ていらい",
  "～ている間に": "～ているあいだに",
  "～一方だ": "～いっぽうだ",
  "～一方で": "～いっぽうで",
  "～ようと思う": "～ようとおもう",
  "～ても不思議ではない": "～てもふしぎではない",
  "～とは限らない": "～とはかぎらない",
  "～最中に": "～さいちゅうに",
  "～場合": "～ばあい",
  "～前に": "～まえに",
  "～に決まっている": "～にきまっている",
  "～に違いない": "～にちがいない",
  "～に行く": "～にいく",
};

const TRACK_DEFS = {
  "1 일본어::_해커스 N3::1 언지::문제 1 (한자읽기)": {
    id: "gengo-q1",
    group: "언지",
    title: "문제 1 한자읽기",
    description: "한자를 보고 정확한 읽기를 떠올리는 연습",
    mode: "kanji_to_kana",
  },
  "1 일본어::_해커스 N3::1 언지::문제 2 (한자표기)": {
    id: "gengo-q2",
    group: "언지",
    title: "문제 2 한자표기",
    description: "히라가나를 보고 알맞은 한자 표기를 구분하는 연습",
    mode: "kana_to_kanji",
  },
  "1 일본어::_해커스 N3::1 언지::문제 3 (문맥 규정)": {
    id: "gengo-q3",
    group: "언지",
    title: "문제 3 문맥 규정",
    description: "문맥 속 의미를 빠르게 판별하는 연습",
    mode: "meaning_check",
  },
  "1 일본어::_해커스 N3::1 언지::문제 4 (유의 표현)": {
    id: "gengo-q4",
    group: "언지",
    title: "문제 4 유의 표현",
    description: "유의어 쌍을 양방향으로 익히는 연습",
    mode: "synonym_pair",
  },
  "1 일본어::_해커스 N3::1 언지::문제 5 (용법)": {
    id: "gengo-q5",
    group: "언지",
    title: "문제 5 용법",
    description: "의미와 쓰임을 함께 확인하는 연습",
    mode: "meaning_check",
  },
  "1 일본어::_해커스 N3::2 문법 ⭐::1 품사": {
    id: "grammar-pos",
    group: "문법",
    title: "품사",
    description: "품사와 의미를 같이 익히는 연습",
    mode: "grammar_meaning",
  },
  "1 일본어::_해커스 N3::2 문법 ⭐::2 표현": {
    id: "grammar-expression",
    group: "문법",
    title: "표현",
    description: "비슷한 표현의 차이를 구분하는 연습",
    mode: "grammar_meaning",
  },
  "1 일본어::_해커스 N3::2 문법 ⭐::2 표현::특수경어": {
    id: "grammar-sonkeigo",
    group: "문법",
    title: "특수경어",
    description: "존경어와 겸양어를 표현 단위로 익히는 연습",
    mode: "grammar_meaning",
  },
  "1 일본어::_해커스 N3::2 문법 ⭐::3 문형": {
    id: "grammar-pattern",
    group: "문법",
    title: "문형",
    description: "문형의 의미와 접속을 묶어서 외우는 연습",
    mode: "grammar_meaning",
  },
  "1 일본어::_해커스 N3::3 독해": {
    id: "reading",
    group: "독해",
    title: "독해 회독",
    description: "지문 기반 어휘를 누적 회독하는 트랙",
    mode: "meaning_check",
  },
  "1 일본어::_해커스 N3::4 청해 단어 ⭐": {
    id: "listening",
    group: "청해",
    title: "청해 회독",
    description: "청해 단어를 누적 회독하는 트랙",
    mode: "meaning_check",
  },
};

const WORD_TRACK_DEFS = {
  N45: {
    id: "word-n45",
    group: "단어",
    title: "N45",
    description: "기초 단어를 Day 반 단위로 회독하는 트랙",
    mode: "meaning_check",
  },
  N3: {
    id: "word-n3",
    group: "단어",
    title: "N3",
    description: "N3 단어를 Day 단위로 회독하는 트랙",
    mode: "meaning_check",
  },
  katakana: {
    id: "word-katakana",
    group: "단어",
    title: "가타가나",
    description: "가타가나 어휘를 Day 단위로 회독하는 트랙",
    mode: "meaning_check",
  },
};

const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;

function parseTsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.startsWith("#")) {
      continue;
    }

    const cols = line.split("\t");
    rows.push({
      deck: cols[0] ?? "",
      c2: cols[1] ?? "",
      c3: cols[2] ?? "",
      c4: cols[3] ?? "",
      c5: cols[4] ?? "",
      c6: cols[5] ?? "",
      c7: cols[6] ?? "",
      c8: cols[7] ?? "",
      c11: cols[10] ?? "",
      c12: cols[11] ?? "",
      c13: cols[12] ?? "",
      c14: cols[13] ?? "",
    });
  }

  return rows;
}

function parseTags(raw) {
  return String(raw || "")
    .replace(/^"|"$/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function extractDayTag(tags) {
  return tags.find((tag) => /Day\d+/i.test(tag)) || "";
}

function getDayNumber(dayTag) {
  const match = String(dayTag || "").match(/Day(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function extractWordLevel(tags) {
  if (tags.some((tag) => tag.includes("#N45"))) {
    return "N45";
  }

  if (tags.some((tag) => tag.includes("#N3"))) {
    return "N3";
  }

  const dayNumber = getDayNumber(extractDayTag(tags));
  if (dayNumber >= 46) {
    return "katakana";
  }

  return "";
}

function isPlaceholderValue(text) {
  return /[?？]{2,}/.test(String(text || "").trim());
}

function loadOverrides() {
  const base = fs.existsSync(overridePath)
    ? JSON.parse(fs.readFileSync(overridePath, "utf8"))
    : {};
  const extra = fs.existsSync(extraOverridePath)
    ? JSON.parse(fs.readFileSync(extraOverridePath, "utf8"))
    : {};

  return { ...base, ...extra };
}

function toHiragana(text) {
  return Array.from(text || "")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= KATAKANA_START && code <= KATAKANA_END) {
        return String.fromCharCode(code - 0x60);
      }
      return char;
    })
    .join("");
}

function isKanjiOnly(text) {
  return /^[\u3400-\u4dbf\u4e00-\u9fff々ヶ]+$/.test(text);
}

function isKanji(char) {
  return /[\u3400-\u4dbf\u4e00-\u9fff々ヶ]/.test(char);
}

function isKana(char) {
  return /[ぁ-ゖァ-ヶー]/.test(char);
}

function splitIntoRuns(text) {
  const chars = Array.from(text || "");
  const runs = [];

  for (const char of chars) {
    const type = isKanji(char) ? "kanji" : isKana(char) ? "kana" : "other";
    const last = runs[runs.length - 1];
    if (last && last.type === type) {
      last.text += char;
    } else {
      runs.push({ type, text: char });
    }
  }

  return runs;
}

function partsToReading(parts) {
  return (parts || [])
    .map((part) => {
      if (part.ruby) {
        return part.ruby;
      }

      return isKana(part.base) ? part.base : "";
    })
    .join("");
}

function parseAnnotatedRuby(raw) {
  if (!raw || !raw.includes("[") || !raw.includes("]")) {
    return null;
  }

  const bracketCount = [...raw.matchAll(/\[([^\]]+)\]/g)].length;
  if (bracketCount <= 1) {
    return null;
  }

  const parts = [];
  let buffer = "";
  let index = 0;

  function flushPlain(text) {
    if (!text || !text.trim()) {
      return;
    }

    for (const run of splitIntoRuns(text)) {
      parts.push({ base: run.text, ruby: "" });
    }
  }

  while (index < raw.length) {
    const char = raw[index];

    if (char === "[") {
      const closeIndex = raw.indexOf("]", index + 1);
      if (closeIndex === -1) {
        buffer += raw.slice(index);
        break;
      }

      const ruby = raw.slice(index + 1, closeIndex);
      const runs = splitIntoRuns(buffer);
      let targetIndex = -1;

      for (let runIndex = runs.length - 1; runIndex >= 0; runIndex -= 1) {
        if (runs[runIndex].type === "kanji") {
          targetIndex = runIndex;
          break;
        }
      }

      if (targetIndex === -1) {
        flushPlain(buffer);
      } else {
        flushPlain(runs.slice(0, targetIndex).map((run) => run.text).join(""));
        parts.push({ base: runs[targetIndex].text, ruby });
        flushPlain(runs.slice(targetIndex + 1).map((run) => run.text).join(""));
      }

      buffer = "";
      index = closeIndex + 1;
      continue;
    }

    buffer += char;
    index += 1;
  }

  flushPlain(buffer);

  return parts.length ? parts : null;
}

function collectSingleKanjiReadings(primary, reading, candidateMap) {
  const runs = splitIntoRuns(primary);
  const readingNorm = toHiragana(reading);
  let cursor = 0;

  for (let i = 0; i < runs.length; i += 1) {
    const run = runs[i];

    if (run.type === "kana") {
      const kanaNorm = toHiragana(run.text);
      if (readingNorm.startsWith(kanaNorm, cursor)) {
        cursor += kanaNorm.length;
      }
      continue;
    }

    if (run.type !== "kanji") {
      continue;
    }

    const nextKana = runs.slice(i + 1).find((value) => value.type === "kana");
    if (!nextKana) {
      continue;
    }

    const nextKanaNorm = toHiragana(nextKana.text);
    const nextIndex = readingNorm.indexOf(nextKanaNorm, cursor);
    if (nextIndex === -1) {
      continue;
    }

    const ruby = reading.slice(cursor, cursor + (nextIndex - cursor));
    if (run.text.length === 1 && ruby) {
      const char = run.text;
      if (!candidateMap.has(char)) {
        candidateMap.set(char, new Map());
      }
      const readings = candidateMap.get(char);
      readings.set(ruby, (readings.get(ruby) ?? 0) + 1);
    }

    cursor = nextIndex;
  }

  if (runs.length === 1 && runs[0].type === "kanji" && runs[0].text.length === 1 && reading) {
    const char = runs[0].text;
    if (!candidateMap.has(char)) {
      candidateMap.set(char, new Map());
    }
    const readings = candidateMap.get(char);
    readings.set(reading, (readings.get(reading) ?? 0) + 1);
  }
}

function addCandidateReading(candidateMap, char, ruby, weight = 1) {
  if (!char || !ruby) {
    return;
  }

  if (!candidateMap.has(char)) {
    candidateMap.set(char, new Map());
  }

  const readings = candidateMap.get(char);
  readings.set(ruby, (readings.get(ruby) ?? 0) + weight);
}

function collectOverrideReadings(overrides, candidateMap) {
  for (const parts of Object.values(overrides || {})) {
    for (const part of parts || []) {
      if (Array.from(part.base || "").length === 1 && isKanji(part.base) && part.ruby) {
        addCandidateReading(candidateMap, part.base, part.ruby, 4);
      }
    }
  }
}

function countSupportedParts(parts, candidateMap) {
  return parts.filter((part) => {
    if (Array.from(part.base || "").length !== 1 || !isKanji(part.base) || !part.ruby) {
      return false;
    }

    const readings = candidateMap.get(part.base);
    return readings?.has(part.ruby);
  }).length;
}

function isReliableTrainingSegmentation(parts, candidateMap) {
  const kanjiParts = parts.filter((part) => Array.from(part.base || "").length === 1 && isKanji(part.base));
  if (!kanjiParts.length) {
    return false;
  }

  if (kanjiParts.some((part) => {
    const len = Array.from(part.ruby || "").length;
    return len < 1 || len > 4;
  })) {
    return false;
  }

  const supported = countSupportedParts(parts, candidateMap);
  if (kanjiParts.length === 1) {
    return supported === 1;
  }

  return supported >= Math.max(1, Math.floor(kanjiParts.length / 2));
}

function collectSegmentedReadings(parts, candidateMap, weight = 1) {
  for (const part of parts) {
    if (Array.from(part.base || "").length === 1 && isKanji(part.base) && part.ruby) {
      addCandidateReading(candidateMap, part.base, part.ruby, weight);
    }
  }
}

function buildExpandedCandidateMap(rows, overrides) {
  const candidateMap = new Map();

  for (const row of rows) {
    collectSingleKanjiReadings(row.c2, resolveReading(row), candidateMap);
  }

  collectOverrideReadings(overrides, candidateMap);

  for (let iteration = 0; iteration < 5; iteration += 1) {
    let learned = 0;

    for (const row of rows) {
      const reading = resolveReading(row);
      if (row.c2 && reading) {
        const parts = segmentReadingByKanji(row.c2, reading, candidateMap, {
          minSupportRatio: 0,
          fallbackWhole: false,
        });

        if (isReliableTrainingSegmentation(parts, candidateMap)) {
          collectSegmentedReadings(parts, candidateMap, 1);
          learned += 1;
        }
      }

      const pair = parseSynonymPair(row.c12);
      if (pair?.text && pair.reading) {
        const parts = segmentReadingByKanji(pair.text, pair.reading, candidateMap, {
          minSupportRatio: 0,
          fallbackWhole: false,
        });

        if (isReliableTrainingSegmentation(parts, candidateMap)) {
          collectSegmentedReadings(parts, candidateMap, 1);
          learned += 1;
        }
      }
    }

    if (!learned) {
      break;
    }
  }

  return candidateMap;
}

function segmentReadingByKanji(primary, reading, candidateMap, options = {}) {
  if (!primary) {
    return [];
  }

  const runs = splitIntoRuns(primary);
  const readingNorm = toHiragana(reading);
  const originalChars = Array.from(reading || "");
  const parts = [];
  let cursor = 0;

  for (let i = 0; i < runs.length; i += 1) {
    const run = runs[i];

    if (run.type === "kana" || run.type === "other") {
      parts.push({ base: run.text, ruby: "" });
      const norm = toHiragana(run.text);
      if (readingNorm.startsWith(norm, cursor)) {
        cursor += norm.length;
      }
      continue;
    }

    const nextKana = runs.slice(i + 1).find((value) => value.type === "kana");
    const limit = nextKana
      ? readingNorm.indexOf(toHiragana(nextKana.text), cursor)
      : readingNorm.length;
    const readingSlice = readingNorm.slice(cursor, limit === -1 ? readingNorm.length : limit);
    const originalSlice = originalChars
      .slice(cursor, limit === -1 ? originalChars.length : limit)
      .join("");
    const segmented = segmentKanjiRun(run.text, readingSlice, originalSlice, candidateMap, options);
    parts.push(...segmented);
    cursor = limit === -1 ? readingNorm.length : limit;
  }

  return parts.filter((part) => part.base);
}

function segmentKanjiRun(baseText, readingNorm, originalReading, candidateMap, options = {}) {
  if (!baseText) {
    return [];
  }

  const chars = Array.from(baseText);
  if (!readingNorm) {
    return chars.map((char) => ({ base: char, ruby: "" }));
  }

  if (chars.length === 1) {
    return [{ base: chars[0], ruby: originalReading }];
  }

  const memo = new Map();

  function scoreCandidate(char, segment) {
    const readings = candidateMap.get(char);
    if (readings?.has(segment)) {
      return 100 + readings.get(segment) * 10;
    }

    const len = Array.from(segment).length;
    if (len < 1 || len > 4) {
      return -50;
    }

    return 10 - Math.abs(2 - len) * 3;
  }

  function solve(charIndex, readIndex) {
    const key = `${charIndex}:${readIndex}`;
    if (memo.has(key)) {
      return memo.get(key);
    }

    if (charIndex === chars.length) {
      return readIndex === readingNorm.length ? { score: 0, cuts: [] } : null;
    }

    const charsLeft = chars.length - charIndex;
    let best = null;
    const minEnd = readIndex + 1;
    const maxEnd = readingNorm.length - (charsLeft - 1);

    for (let end = minEnd; end <= maxEnd; end += 1) {
      const segment = readingNorm.slice(readIndex, end);
      const tail = solve(charIndex + 1, end);
      if (!tail) {
        continue;
      }

      const score = scoreCandidate(chars[charIndex], segment) + tail.score;
      if (!best || score > best.score) {
        best = {
          score,
          cuts: [{ end }, ...tail.cuts],
        };
      }
    }

    memo.set(key, best);
    return best;
  }

  const solved = solve(0, 0);
  if (!solved) {
    return [{ base: baseText, ruby: originalReading }];
  }

  const originalChars = Array.from(originalReading);
  let start = 0;
  const parts = chars.map((char, index) => {
    const end = solved.cuts[index].end;
    const ruby = originalChars.slice(start, end).join("");
    start = end;
    return { base: char, ruby };
  });

  const supportedCount = countSupportedParts(parts, candidateMap);
  const minSupportRatio = options.minSupportRatio ?? 0.5;
  const supportedRatio = chars.length ? supportedCount / chars.length : 0;
  const fallbackWhole = options.fallbackWhole ?? true;

  if (fallbackWhole && supportedRatio < minSupportRatio) {
    return [{ base: baseText, ruby: originalReading }];
  }

  return parts;
}

function parseSynonymPair(raw) {
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(.*?)(?:\[(.*)\])?$/);
  if (!match) {
    return { text: raw, reading: "" };
  }

  return {
    text: match[1] || raw,
    reading: match[2] || "",
  };
}

function extractBracketReading(raw) {
  if (!raw) {
    return "";
  }

  const matches = [...raw.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]).filter(Boolean);
  return matches.join("");
}

function resolveReading(row) {
  const bracketReading = extractBracketReading(row.c4);
  if (bracketReading) {
    return bracketReading;
  }

  if (row.c3 && !/[一-龯々ヶ]/.test(row.c3)) {
    return row.c3;
  }

  return READING_OVERRIDES[row.c2] || row.c3 || "";
}

function buildItem(track, row, index, candidateMap, overrides) {
  const effectiveReading = resolveReading(row);
  const override = overrides[row.c2];
  const annotatedRubyParts = parseAnnotatedRuby(row.c4);
  const rubyParts = override || annotatedRubyParts || segmentReadingByKanji(row.c2, effectiveReading, candidateMap);
  const normalizedReading = effectiveReading && !/[一-龯々ヶ]/.test(effectiveReading)
    ? effectiveReading
    : partsToReading(rubyParts);
  const item = {
    id: `${track.id}-${index + 1}`,
    primary: row.c2,
    reading: normalizedReading,
    meaning: row.c5,
    exampleJa: row.c6,
    exampleEn: row.c7,
    exampleKo: row.c8,
    note: row.c11,
    hint: row.c12,
    sourceTag: row.c14 || row.c13,
    rubyParts,
  };

  if (track.mode === "kana_to_kanji") {
    item.answer = row.c2;
    item.primary = effectiveReading || row.c2;
  }

  if (track.mode === "synonym_pair") {
    const pair = parseSynonymPair(row.c12);
    item.pairText = pair?.text || "";
    item.pairReading = pair?.reading || "";
    const annotatedPairRubyParts = parseAnnotatedRuby(row.c12);
    item.pairRubyParts = item.pairText
      ? (overrides[item.pairText] || annotatedPairRubyParts || segmentReadingByKanji(item.pairText, item.pairReading, candidateMap))
      : [];
  }

  return item;
}

function buildWordItem(track, row, index, candidateMap, overrides) {
  const item = buildItem(track, row, index, candidateMap, overrides);
  item.note = row.c12 || "";
  item.hint = row.c11 || "";
  item.tags = parseTags(row.c13 || row.c14);
  item.dayTag = extractDayTag(item.tags);
  return item;
}

function sortDayTags(tags) {
  return [...tags].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function shortDayLabel(dayTag) {
  return dayTag.split("::").pop() || dayTag;
}

function formatWordStageLabel(dayTag, part = "") {
  const dayNumber = getDayNumber(dayTag);
  const dayText = dayNumber ? `Day ${String(dayNumber).padStart(2, "0")}` : shortDayLabel(dayTag);

  if (part === "A") {
    return `${dayText} (1/2)`;
  }

  if (part === "B") {
    return `${dayText} (2/2)`;
  }

  return dayText;
}

function buildWordStages(level, items) {
  const byDay = new Map();

  for (const item of items) {
    const dayTag = item.dayTag || "NO_DAY";
    if (!byDay.has(dayTag)) {
      byDay.set(dayTag, []);
    }
    byDay.get(dayTag).push(item);
  }

  const stages = [];
  let offset = 0;

  for (const dayTag of sortDayTags(byDay.keys())) {
    const dayItems = byDay.get(dayTag);
    const dayLabel = shortDayLabel(dayTag);

    if (level === "N45") {
      const splitIndex = Math.ceil(dayItems.length / 2);
      const firstCount = splitIndex;
      const secondCount = dayItems.length - splitIndex;

      stages.push({
        id: `${dayLabel}-A`,
        label: formatWordStageLabel(dayTag, "A"),
        range: `${firstCount}개`,
        start: offset,
        end: offset + firstCount,
      });
      offset += firstCount;

      if (secondCount > 0) {
        stages.push({
          id: `${dayLabel}-B`,
          label: formatWordStageLabel(dayTag, "B"),
          range: `${secondCount}개`,
          start: offset,
          end: offset + secondCount,
        });
        offset += secondCount;
      }

      continue;
    }

    stages.push({
      id: dayLabel,
      label: formatWordStageLabel(dayTag),
      range: `${dayItems.length}개`,
      start: offset,
      end: offset + dayItems.length,
    });
    offset += dayItems.length;
  }

  return stages;
}

function buildWordTracks(rows, candidateMap, overrides) {
  const bucketRows = {
    N45: [],
    N3: [],
    katakana: [],
  };

  for (const row of rows) {
    if (isPlaceholderValue(row.c2)) {
      continue;
    }

    const tags = parseTags(row.c13 || row.c14);
    const level = extractWordLevel(tags);
    if (!level) {
      continue;
    }

    bucketRows[level].push(row);
  }

  return Object.entries(WORD_TRACK_DEFS).map(([level, def]) => {
    const items = bucketRows[level].map((row, index) => buildWordItem(def, row, index, candidateMap, overrides));
    const stages = buildWordStages(level, items);
    return {
      ...def,
      total: items.length,
      items,
      stages,
    };
  });
}

function main() {
  const text = fs.readFileSync(sourcePath, "utf8");
  const vocabText = fs.readFileSync(vocabSourcePath, "utf8");
  const rows = parseTsv(text);
  const vocabRows = parseTsv(vocabText);
  const tracks = [];
  const overrides = loadOverrides();
  const candidateMap = buildExpandedCandidateMap([...rows, ...vocabRows], overrides);

  for (const [deck, def] of Object.entries(TRACK_DEFS)) {
    const trackRows = rows.filter((row) => row.deck === deck && !isPlaceholderValue(row.c2));
    const items = trackRows.map((row, index) => buildItem(def, row, index, candidateMap, overrides));

    if (def.mode === "kana_to_kanji") {
      const byHint = new Map();

      for (const item of items) {
        const key = item.hint || item.primary;
        if (!byHint.has(key)) {
          byHint.set(key, []);
        }
        byHint.get(key).push(item);
      }

      for (const item of items) {
        const siblings = byHint.get(item.hint || item.primary) || [];
        item.distractors = siblings
          .filter((candidate) => candidate.id !== item.id)
          .map((candidate) => candidate.answer)
          .slice(0, 3);
      }
    }

    if (def.mode === "synonym_pair") {
      const byPair = new Map();

      for (const item of items) {
        const normalized = [item.primary, item.pairText]
          .filter(Boolean)
          .sort()
          .join("::");
        if (!normalized) {
          continue;
        }

        if (!byPair.has(normalized)) {
          byPair.set(normalized, `pair-${byPair.size + 1}`);
        }

        item.pairId = byPair.get(normalized);
      }
    }

    tracks.push({
      ...def,
      total: items.length,
      items,
    });
  }

  tracks.push(...buildWordTracks(vocabRows, candidateMap, overrides));

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        level: "N3",
        generatedAt: new Date().toISOString(),
        stageSize: 25,
        tracks,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Generated ${outputPath}`);
  for (const track of tracks) {
    console.log(`${track.group} / ${track.title}: ${track.total}`);
  }
}

main();
