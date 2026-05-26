import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, "_N3", "1 일본어___해커스 N3.txt");
const outputDir = path.join(rootDir, "data");
const outputPath = path.join(outputDir, "n3.json");
const overridePath = path.join(rootDir, "data", "furigana-overrides.json");
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
      c14: cols[13] ?? "",
    });
  }

  return rows;
}

function loadOverrides() {
  if (!fs.existsSync(overridePath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(overridePath, "utf8"));
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

function segmentReadingByKanji(primary, reading, candidateMap) {
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
    const segmented = segmentKanjiRun(run.text, readingSlice, originalSlice, candidateMap);
    parts.push(...segmented);
    cursor = limit === -1 ? readingNorm.length : limit;
  }

  return parts.filter((part) => part.base);
}

function segmentKanjiRun(baseText, readingNorm, originalReading, candidateMap) {
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

  const supportedCount = parts.filter((part) => {
    const readings = candidateMap.get(part.base);
    return readings?.has(part.ruby);
  }).length;

  if (supportedCount < Math.ceil(chars.length / 2)) {
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

function buildItem(track, row, index, candidateMap, overrides) {
  const effectiveReading = row.c3 || READING_OVERRIDES[row.c2] || "";
  const override = overrides[row.c2];
  const item = {
    id: `${track.id}-${index + 1}`,
    primary: row.c2,
    reading: effectiveReading,
    meaning: row.c5,
    exampleJa: row.c6,
    exampleEn: row.c7,
    exampleKo: row.c8,
    note: row.c11,
    hint: row.c12,
    sourceTag: row.c14,
    rubyParts: override || segmentReadingByKanji(row.c2, effectiveReading, candidateMap),
  };

  if (track.mode === "kana_to_kanji") {
    item.answer = row.c2;
    item.primary = effectiveReading || row.c2;
  }

  if (track.mode === "synonym_pair") {
    const pair = parseSynonymPair(row.c12);
    item.pairText = pair?.text || "";
    item.pairReading = pair?.reading || "";
    item.pairRubyParts = item.pairText
      ? (overrides[item.pairText] || segmentReadingByKanji(item.pairText, item.pairReading, candidateMap))
      : [];
  }

  return item;
}

function main() {
  const text = fs.readFileSync(sourcePath, "utf8");
  const rows = parseTsv(text);
  const tracks = [];
  const candidateMap = new Map();
  const overrides = loadOverrides();

  for (const row of rows) {
    collectSingleKanjiReadings(row.c2, row.c3 || READING_OVERRIDES[row.c2] || "", candidateMap);
  }

  for (const [deck, def] of Object.entries(TRACK_DEFS)) {
    const trackRows = rows.filter((row) => row.deck === deck);
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
