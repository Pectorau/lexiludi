/**
 * Imports a compact, attributed French definition index from DBnary.
 * DBnary extracts Wiktionary content under CC BY-SA 3.0; see definition_sources.md.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const endpoint = "https://kaiko.getalp.org/sparql";
const targetCount = Number.parseInt(process.env.DBNARY_TARGET_COUNT || "900", 10);
const queryBatchSize = 45;
const insertBatchSize = 100;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to import DBnary definitions.");

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[’']/g, " ")
    .replace(/[^a-z\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeSparqlLiteral(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function definitionQuery(lemmas) {
  const values = lemmas.map((lemma) => `"${escapeSparqlLiteral(lemma)}"@fr`).join(" ");
  return `PREFIX ontolex: <http://www.w3.org/ns/lemon/ontolex#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT ?word ?definition WHERE {
  VALUES ?word { ${values} }
  ?entry ontolex:canonicalForm/ontolex:writtenRep ?word ; ontolex:sense ?sense .
  ?sense skos:definition ?definitionNode .
  ?definitionNode rdf:value ?definition .
  FILTER(lang(?definition) = "fr")
}`;
}

async function fetchDefinitions(lemmas) {
  const url = new URL(endpoint);
  url.searchParams.set("query", definitionQuery(lemmas));
  const response = await fetch(url, { headers: { Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`DBnary request failed: ${response.status}`);
  const payload = await response.json();
  return payload.results.bindings.map((item) => ({ word: item.word.value, definition: item.definition.value }));
}

const reader = await mysql.createConnection(process.env.DATABASE_URL);
const [sourceEntries] = await reader.query(
  "SELECT id, lemma, normalized_lemma FROM lexical_entries WHERE CHAR_LENGTH(normalized_lemma) BETWEEN 4 AND 18 AND normalized_lemma NOT LIKE '% %' ORDER BY MOD(id, 311), id LIMIT ?",
  [targetCount],
);
await reader.end();

const entryByNormalized = new Map(sourceEntries.map((entry) => [entry.normalized_lemma, entry]));
const candidates = new Map();

for (let offset = 0; offset < sourceEntries.length; offset += queryBatchSize) {
  const batch = sourceEntries.slice(offset, offset + queryBatchSize);
  try {
    const values = await fetchDefinitions(batch.map((entry) => entry.lemma));
    values.forEach(({ word, definition }) => {
      const normalizedLemma = normalize(word);
      const entry = entryByNormalized.get(normalizedLemma);
      const cleanDefinition = definition.replace(/\s+/g, " ").trim();
      if (!entry || candidates.has(normalizedLemma) || cleanDefinition.length < 25 || cleanDefinition.length > 260 || /définition manquante|à compléter|\(ajouter\)|\bfesses\b|\bpénis\b|\bvagin\b|\bporn\w*|\bérot\w*|\bmasturb\w*|\borgasm\w*|\béjacul\w*|\bsodom\w*|\bcoït\b/i.test(cleanDefinition)) return;
      candidates.set(normalizedLemma, { entry, definition: cleanDefinition });
    });
    console.log(`Lot ${Math.floor(offset / queryBatchSize) + 1} : ${values.length} définitions reçues, ${candidates.size} retenues.`);
  } catch (error) {
    console.warn(`Lot ${Math.floor(offset / queryBatchSize) + 1} ignoré :`, error instanceof Error ? error.message : error);
  }
}

if (!candidates.size) throw new Error("Aucune définition DBnary n’a été reçue : l’index existant est conservé.");

const connection = await mysql.createConnection(process.env.DATABASE_URL);
await connection.query("DELETE FROM lexical_definitions");
let imported = 0;
const values = [...candidates.values()];

for (let offset = 0; offset < values.length; offset += insertBatchSize) {
  const batch = values.slice(offset, offset + insertBatchSize);
  const rows = batch.map(({ entry, definition }) => [
    entry.id,
    entry.lemma,
    entry.normalized_lemma,
    definition,
    `https://fr.wiktionary.org/wiki/${encodeURIComponent(entry.lemma)}`,
  ]);
  await connection.query(
    "INSERT INTO lexical_definitions (lexical_entry_id, lemma, normalized_lemma, definition, source_url) VALUES ?",
    [rows],
  );
  imported += rows.length;
}

const [totals] = await connection.query("SELECT COUNT(*) AS count FROM lexical_definitions");
await connection.end();
console.log(`DBnary import complete: ${imported} rows imported, ${totals[0].count} definitions available. Attribution: DBnary / Wiktionnaire, CC BY-SA 3.0.`);
