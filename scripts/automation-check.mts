// Stichwort-Regeln: wann ein Wort im Transkript eine Aktion ausloest.
//
// WARUM ES DAS GIBT (2026-09-27): Der Smoke-Test prueft den Sendeweg ueber
// den Test-Knopf, aber nicht das Erkennen -- dafuer braeuchte er Vosk. Genau
// dort sitzen die teuren Fehler: „go" in „going" oder „cargo" loest mitten in
// der Show einen Cue aus, und ein doppelt erkanntes „go" loest ihn zweimal aus.
//
// Lauf: `npm run automation:check`
import assert from "node:assert/strict";
import { dueRules, encodeOscMessage, keywordMatches, matchingRules, ruleError } from "../apps/server/src/automation.ts";

assert.ok(keywordMatches("go", "Go!"));
assert.ok(keywordMatches("go", "standby, go"));
assert.ok(!keywordMatches("go", "going on"));
assert.ok(!keywordMatches("go", "cargo"));
assert.ok(keywordMatches("stand by", "Lights, stand   by please"), "Leerraum in der Wendung ist beliebig");
assert.ok(keywordMatches("Achtung", "achtung Bühne"), "Umlaute und Grossschreibung");
assert.ok(!keywordMatches("über", "darüber"), "Wortgrenze auch bei Umlauten");
assert.ok(keywordMatches("cue 3.5", "go cue 3.5 now"), "Sonderzeichen im Stichwort sind wortwoertlich");
assert.ok(!keywordMatches("  ", "anything"));
console.log("✓ ganze Woerter und Wendungen, ohne Gross/Klein, Unicode");

const osc = { kind: "osc" as const, host: "127.0.0.1", port: 8000, address: "/a" };
const rules = [
  { id: "a", keyword: "go", enabled: true, action: osc },
  { id: "b", keyword: "go", channelId: "ch2", enabled: true, action: osc },
  { id: "c", keyword: "go", enabled: false, action: osc },
];
assert.deepEqual(matchingRules(rules, { channelId: "ch1", text: "go" }).map((r) => r.id), ["a"]);
assert.deepEqual(matchingRules(rules, { channelId: "ch2", text: "go" }).map((r) => r.id), ["a", "b"]);
console.log("✓ Kanalfilter und abgeschaltete Regeln");

const hit = { channelId: "ch1", channelName: "SM", sender: "Caller", text: "go", ts: 10_000 };
assert.equal(dueRules([rules[0]], hit).length, 1);
assert.equal(dueRules([rules[0]], { ...hit, ts: 10_500 }).length, 0, "zweites go innerhalb einer Sekunde");
assert.equal(dueRules([rules[0]], { ...hit, ts: 11_100 }).length, 1);
console.log("✓ hoechstens einmal pro Sekunde");

assert.equal(ruleError({ keyword: "go", action: { kind: "webhook", url: "ftp://x" } }), "webhook URL must be http or https");
assert.equal(ruleError({ keyword: "go", action: { kind: "osc", host: "h", port: 70000, address: "/a" } }), "OSC port must be 1–65535");
assert.equal(ruleError({ keyword: "go", action: { kind: "osc", host: "h", port: 1, address: "a" } }), "OSC address must start with /");
assert.equal(ruleError({ keyword: "go", action: osc }), null);
console.log("✓ Eingaben werden geprueft");

const m = encodeOscMessage("/ab", ["xyz"]);
assert.equal(m.length % 4, 0);
assert.deepEqual([...m], [...Buffer.from("/ab\0,s\0\0xyz\0")]);
console.log("✓ OSC-Kodierung: NUL-terminiert, auf 4 Byte aufgefuellt");
