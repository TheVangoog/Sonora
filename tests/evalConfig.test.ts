import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appMatchesConfig,
  metrics,
  mostFrequentAnswer,
  NO_CHORD,
  partOf,
  playerOf,
  readConfig,
} from "../scripts/chordEval.ts";

const config = readConfig();

test("the app runs with the values frozen in scripts/chord-eval.config.json", () => {
  assert.deepEqual(appMatchesConfig(config), []);
});

test("GuitarSet is split by player: every player in exactly one part", () => {
  const { dev, test: testPart } = config.split;
  assert.deepEqual([...dev, ...testPart].sort(), ["00", "01", "02", "03", "04", "05"]);
  assert.equal(dev.filter((p) => testPart.includes(p)).length, 0);
});

test("a segment belongs to the part of its player, in both segment sets", () => {
  assert.equal(playerOf("D♯__00_BN1-129-Eb_comp_02.wav"), "00");
  assert.equal(playerOf("05_SS3-98-C_comp"), "05");
  // The same recording gives the same part in guitarset-segments and -ext.
  assert.equal(partOf("Am__04_Jazz2-110-Bb_comp_03.wav", config), "test");
  assert.equal(partOf("Am7__04_Jazz2-110-Bb_comp_03.wav", config), "test");
  assert.equal(partOf("G__01_Rock1-90-C#_comp_00.wav", config), "dev");
  assert.throws(() => playerOf("Am__03.wav"));
});

test("file answer: the most frequent chord among windows with an answer", () => {
  assert.equal(mostFrequentAnswer([NO_CHORD, NO_CHORD, NO_CHORD, "Am", "Am", "C"]), "Am");
  assert.equal(mostFrequentAnswer(["C", "Am", NO_CHORD]), "C", "a tie goes to the chord heard first");
  assert.equal(mostFrequentAnswer([NO_CHORD, NO_CHORD]), NO_CHORD);
});

test("window metrics: correct, answered, wrong chord and false alarm are counted apart", () => {
  const m = metrics([
    { file: "a", expected: "Am", answers: ["Am", NO_CHORD, "C"], fileAnswer: "Am" },
    { file: "b", expected: NO_CHORD, answers: [NO_CHORD, "E"], fileAnswer: "E" },
  ]);
  assert.deepEqual(m, {
    files: 2,
    filesCorrect: 1,
    windows: 5,
    windowsCorrect: 2, // "Am" and the silent window of the none-* take
    windowsAnswered: 3,
    windowsWrongChord: 1,
    windowsFalseAlarm: 1,
    filesFalseAlarm: 1,
  });
});
