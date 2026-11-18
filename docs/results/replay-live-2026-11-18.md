# Live replay: does the chord stay on screen? (2026-11-18)

> Rerun with the thresholds frozen on the dev part (scripts/chord-eval.config.json; DSP extendedMargin 1). The same run with the earlier thresholds: replay-live-2026-11-18-old-thresholds.md. Page settings (gate +12 / +6 dB + hold 4 s), all chords: GuitarSet 42.3 → 39.7 % correct, own takes 90.7 → 94.5 %; major/minor only: unchanged (60.5 %, 94.5 %). The GuitarSet tracks here are every 3rd track of all players (dev and test), so this shows how the page behaves, not an independent accuracy; that is docs/results/eval-test-2026-11-18.md.

Algorithm mode, one reading every 100 ms, exactly the page logic (`LiveChordTracker`). **visible** = share of playing time with a chord on screen; **dropouts** = times per minute the chord vanishes while one is played; **correct** = share of playing time with the right chord.

## GuitarSet, every 3rd full accompaniment track, major/minor only

| variant | visible | dropouts / min | correct |
|---|---|---|---|
| before (gate +12 dB only, no hold) | 95.2 % | 3.1 | 59.0 % |
| gate +12 / +6 dB | 97.7 % | 1.7 | 60.2 % |
| gate +12 / +3 dB | 98.5 % | 1.0 | 60.4 % |
| gate +12 / +6 dB + hold 4 s | 99.7 % | 0.0 | 60.5 % |

## your takes (from the strum to the end), major/minor only

| variant | visible | dropouts / min | correct |
|---|---|---|---|
| before (gate +12 dB only, no hold) | 58.1 % | 19.8 | 54.4 % |
| gate +12 / +6 dB | 74.1 % | 14.5 | 70.4 % |
| gate +12 / +3 dB | 83.5 % | 12.3 | 79.8 % |
| gate +12 / +6 dB + hold 4 s | 98.1 % | 0.0 | 94.5 % |

## GuitarSet, every 3rd full accompaniment track, all chords

| variant | visible | dropouts / min | correct |
|---|---|---|---|
| before (gate +12 dB only, no hold) | 95.6 % | 2.6 | 38.9 % |
| gate +12 / +6 dB | 98.1 % | 1.4 | 39.5 % |
| gate +12 / +3 dB | 98.8 % | 0.8 | 39.7 % |
| gate +12 / +6 dB + hold 4 s | 99.7 % | 0.0 | 39.7 % |

## your takes (from the strum to the end), all chords

| variant | visible | dropouts / min | correct |
|---|---|---|---|
| before (gate +12 dB only, no hold) | 58.1 % | 19.8 | 54.4 % |
| gate +12 / +6 dB | 74.1 % | 14.5 | 70.4 % |
| gate +12 / +3 dB | 83.5 % | 12.3 | 79.8 % |
| gate +12 / +6 dB + hold 4 s | 98.1 % | 0.0 | 94.5 % |
