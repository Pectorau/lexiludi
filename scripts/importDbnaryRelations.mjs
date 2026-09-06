import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { StreamParser } from "n3";

const sourceFile = process.argv[2] || "/home/ubuntu/dbnary/fr_dbnary_ontolex.ttl.bz2";
const databaseUrl = process.env.DATABASE_URL;
const previewOnly = process.argv.includes("--preview");

if (!databaseUrl) throw new Error("DATABASE_URL est requis pour importer les relations DBnary.");

function normalize(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").trim().replace(/\s+/g, " ");
}

function dbnaryTokenToLemma(token) {
  const raw = token
    .replace(/^fra:/, "")
    .replace(/^<https?:\/\/[^/]+\/dbnary\/fra\//, "")
    .replace(/^https?:\/\/[^/]+\/dbnary\/fra\//, "")
    .replace(/>$/, "");
  try {
    return decodeURIComponent(raw).replace(/__[^_]+__\d+$/, "").replaceAll("_", " ");
  } catch {
    return raw.replace(/__[^_]+__\d+$/, "").replaceAll("_", " ");
  }
}

function relationFromPredicate(predicate) {
  if (predicate.endsWith("synonym")) return "synonym";
  if (predicate.endsWith("antonym")) return "antonym";
  return null;
}

const connection = await mysql.createConnection(databaseUrl);
const [entries] = await connection.query("SELECT id, normalized_lemma FROM lexical_entries WHERE cnrtl_url IS NOT NULL AND cnrtl_url <> ''");
const entryByLemma = new Map(entries.map((entry) => [entry.normalized_lemma, entry.id]));
const decompressor = spawn("bzip2", ["-dc", sourceFile]);
const parser = new StreamParser({ baseIRI: "http://kaiko.getalp.org/dbnary/" });
decompressor.stdout.pipe(parser);

let batch = [];
const samples = [];
let scanned = 0;
let imported = 0;
let candidates = 0;

async function flush() {
  if (!batch.length) return;
  const values = batch;
  batch = [];
  const placeholders = values.map(() => "(?, ?, ?)").join(",");
  const params = values.flat();
  if (!previewOnly) {
    const [result] = await connection.query(`INSERT IGNORE INTO lexical_relations (source_entry_id, target_entry_id, relation) VALUES ${placeholders}`, params);
    imported += Number(result.affectedRows ?? 0);
  }
}

for await (const quad of parser) {
  scanned += 1;
  const relation = relationFromPredicate(quad.predicate.value);
  if (!relation || quad.subject.termType !== "NamedNode" || quad.object.termType !== "NamedNode") continue;
  const source = dbnaryTokenToLemma(quad.subject.value);
  const target = dbnaryTokenToLemma(quad.object.value);
  const sourceId = entryByLemma.get(normalize(source));
  const targetId = entryByLemma.get(normalize(target));
  if (!sourceId || !targetId || targetId === sourceId) continue;
  batch.push([sourceId, targetId, relation]);
  candidates += 1;
  if (samples.length < 12) samples.push({ relation, source, target });
  if (batch.length >= 750) await flush();
}

await flush();
await connection.end();
console.log(JSON.stringify({ mode: previewOnly ? "preview" : "import", scanned, candidates, imported, samples }, null, 2));
