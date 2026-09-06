/**
 * Imports the official Morphalou 3 CSV into LexiLudi's lexical index.
 * Source: ATILF / ORTOLANG — LGPL-LR. The source archive remains outside the project bundle.
 */
import "dotenv/config";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import mysql from "mysql2/promise";

const sourcePath = process.argv[2] || "/home/ubuntu/webdev-static-assets/morphalou/Morphalou3_CSV.csv";
const batchSize = Number.parseInt(process.env.MORPHALOU_BATCH_SIZE || "40", 10);
const sourceUrl = "https://repository.ortolang.fr/api/content/morphalou/2/";
const shouldResume = process.env.MORPHALOU_RESUME === "1";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to import Morphalou.");
}

const clean = (value) => (value && value !== "-" ? value.trim() : null);
const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
const cnrtlUrl = (lemma) => `https://www.cnrtl.fr/definition/${encodeURIComponent(lemma)}`;

function parseSemicolonCsv(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ";" && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [existingEntries] = await connection.query("SELECT COUNT(*) AS count FROM lexical_entries");
const [existingForms] = await connection.query("SELECT COUNT(*) AS count FROM lexical_forms");

if (!shouldResume && (existingEntries[0].count > 0 || existingForms[0].count > 0)) {
  throw new Error("The lexical index is not empty. The importer refuses to merge a second full copy of Morphalou.");
}

let records = [];
let currentRecord = null;
let entriesToSkip = shouldResume ? Number(existingEntries[0].count) : 0;
let lemmaCount = Number(existingEntries[0].count);
let formCount = Number(existingForms[0].count);

async function queueRecord(record) {
  if (entriesToSkip > 0) {
    entriesToSkip -= 1;
    return;
  }
  records.push(record);
  if (records.length >= batchSize) await flush();
}

async function flush() {
  if (!records.length) return;
  const batch = records;
  records = [];
  const entryRows = batch.map((record) => [
    record.lemma, normalize(record.lemma), clean(record.category), clean(record.subcategory),
    clean(record.isLocution), clean(record.gender), clean(record.linkedLemmas), clean(record.pronunciation),
    clean(record.origins), cnrtlUrl(record.lemma),
  ]);

  await connection.beginTransaction();
  try {
    const [entryResult] = await connection.query(
      "INSERT INTO lexical_entries (lemma, normalized_lemma, category, subcategory, is_locution, gender, linked_lemmas, pronunciation, origins, cnrtl_url) VALUES ?",
      [entryRows],
    );
    const firstEntryId = entryResult.insertId;
    const forms = [];
    batch.forEach((record, recordIndex) => {
      record.forms.forEach((form) => {
        forms.push([
          firstEntryId + recordIndex, form.form, normalize(form.form), clean(form.grammaticalNumber), clean(form.mode),
          clean(form.gender), clean(form.tense), clean(form.person), clean(form.pronunciation), clean(form.origins),
        ]);
      });
    });
    if (forms.length) {
      await connection.query(
        "INSERT INTO lexical_forms (entry_id, form, normalized_form, grammatical_number, mode, gender, tense, person, pronunciation, origins) VALUES ?",
        [forms],
      );
    }
    await connection.commit();
    lemmaCount += batch.length;
    formCount += forms.length;
    if (lemmaCount % 10_000 < batch.length) {
      console.log(`Imported ${lemmaCount.toLocaleString("fr-FR")} lemmes and ${formCount.toLocaleString("fr-FR")} forms.`);
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

const reader = createInterface({ input: createReadStream(sourcePath, { encoding: "utf8" }), crlfDelay: Infinity });
for await (const line of reader) {
  const columns = parseSemicolonCsv(line);
  if (columns.length < 18) continue;

  if (columns[0] && /^\d+$/.test(columns[1] || "")) {
    if (currentRecord) await queueRecord(currentRecord);
    currentRecord = {
      lemma: columns[0],
      category: columns[2],
      subcategory: columns[3],
      isLocution: columns[4],
      gender: columns[5],
      linkedLemmas: columns[6],
      pronunciation: columns[7],
      origins: columns[8],
      forms: [],
    };
  }

  if (currentRecord && columns[9] && /^\d+$/.test(columns[10] || "")) {
    currentRecord.forms.push({
      form: columns[9], grammaticalNumber: columns[11], mode: columns[12], gender: columns[13],
      tense: columns[14], person: columns[15], pronunciation: columns[16], origins: columns[17],
    });
  }
}

if (currentRecord) await queueRecord(currentRecord);
await flush();
await connection.end();
console.log(`Morphalou import complete: ${lemmaCount.toLocaleString("fr-FR")} lemmes and ${formCount.toLocaleString("fr-FR")} forms. Source: ${sourceUrl}`);
