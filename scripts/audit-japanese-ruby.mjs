import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const dataPath = path.join(rootDir, "data", "n3.json");
const sourceDir = path.join(rootDir, "_N3");

const hanRegex = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々ヶ]/u;
const kanaReadingRegex = /^[ぁ-ゖゝゞァ-ヶー・･ 　0-9０-９()（）\-－]*$/u;
const kanaBaseRegex = /^[ぁ-ゖァ-ヶー]+$/u;

function scanBuiltData() {
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const problems = [];

  for (const language of data.languages || []) {
    if (language.id !== "ja") {
      continue;
    }

    for (const group of language.groups || []) {
      for (const track of group.tracks || []) {
        for (const item of track.items || []) {
          inspectReading(problems, track.id, item.id, item.term, item.reading, "reading");
          inspectRubyParts(problems, track.id, item.id, item.term, item.reading, item.furigana, "furigana");
          inspectRubyParts(problems, track.id, item.id, item.term, item.reading, item.meaningFurigana, "meaningFurigana");
          inspectRubyParts(problems, track.id, item.id, item.term, item.reading, item.exampleJaFurigana, "exampleJaFurigana");

          for (const [index, synonym] of (item.synonyms || []).entries()) {
            inspectReading(problems, track.id, `${item.id}#syn${index + 1}`, synonym.term, synonym.reading, "synonym.reading");
            inspectRubyParts(
              problems,
              track.id,
              `${item.id}#syn${index + 1}`,
              synonym.term,
              synonym.reading,
              synonym.rubyParts,
              "synonym.rubyParts",
            );
          }
        }
      }
    }
  }

  return problems;
}

function inspectReading(problems, trackId, itemId, term, reading, field) {
  if (typeof reading !== "string") {
    return;
  }

  if (hanRegex.test(reading)) {
    problems.push({ source: "built", trackId, itemId, term, field, value: reading, reason: "reading_has_kanji" });
    return;
  }

  if (reading && !kanaReadingRegex.test(reading)) {
    problems.push({ source: "built", trackId, itemId, term, field, value: reading, reason: "reading_has_non_kana_chars" });
  }
}

function inspectRubyParts(problems, trackId, itemId, term, reading, parts, field) {
  if (!Array.isArray(parts)) {
    return;
  }

  for (const part of parts) {
    if (typeof part?.ruby === "string" && hanRegex.test(part.ruby)) {
      problems.push({
        source: "built",
        trackId,
        itemId,
        term,
        field,
        value: part.ruby,
        base: part.base || "",
        reason: "ruby_has_kanji",
      });
    }
  }

  if (field !== "furigana" || typeof reading !== "string" || !reading) {
    return;
  }

  const joinedReading = parts
    .map((part) => {
      if (part.ruby) {
        return part.ruby;
      }

      return kanaBaseRegex.test(part.base || "") ? part.base : "";
    })
    .join("");

  if (joinedReading && joinedReading !== reading) {
    problems.push({
      source: "built",
      trackId,
      itemId,
      term,
      field,
      value: joinedReading,
      expected: reading,
      reason: "ruby_join_mismatch",
    });
  }
}

function scanSourceFiles() {
  const problems = [];
  const sourceFiles = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".txt"));

  for (const fileName of sourceFiles) {
    const filePath = path.join(sourceDir, fileName);
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      if (!line || line.startsWith("#")) {
        continue;
      }

      const cols = line.split("\t");
      const term = cols[1] || "";
      const reading = cols[2] || "";

      if (hanRegex.test(reading)) {
        problems.push({
          source: "source",
          fileName,
          line: index + 1,
          term,
          field: "c3",
          value: reading,
          reason: "reading_column_has_kanji",
        });
      }

      for (const colIndex of [3, 11]) {
        const raw = cols[colIndex] || "";
        for (const match of raw.matchAll(/\[([^\]]+)\]/gu)) {
          const bracketValue = match[1] || "";
          if (hanRegex.test(bracketValue)) {
            problems.push({
              source: "source",
              fileName,
              line: index + 1,
              term,
              field: `c${colIndex + 1}`,
              value: bracketValue,
              reason: "bracket_reading_has_kanji",
            });
          }
        }
      }
    }
  }

  return problems;
}

const builtProblems = scanBuiltData();
const sourceProblems = scanSourceFiles();
const allProblems = [...builtProblems, ...sourceProblems];

console.log(JSON.stringify({
  builtProblems: builtProblems.length,
  sourceProblems: sourceProblems.length,
  totalProblems: allProblems.length,
  sample: allProblems.slice(0, 200),
}, null, 2));

if (allProblems.length) {
  process.exitCode = 1;
}
