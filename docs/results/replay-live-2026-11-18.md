# Live replay: does the chord stay on screen? (2026-11-18)

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
| before (gate +12 dB only, no hold) | 95.0 % | 2.6 | 40.8 % |
| gate +12 / +6 dB | 97.9 % | 1.4 | 41.9 % |
| gate +12 / +3 dB | 98.6 % | 0.8 | 42.1 % |
| gate +12 / +6 dB + hold 4 s | 99.6 % | 0.0 | 42.3 % |

## your takes (from the strum to the end), all chords

| variant | visible | dropouts / min | correct |
|---|---|---|---|
| before (gate +12 dB only, no hold) | 57.4 % | 19.8 | 51.7 % |
| gate +12 / +6 dB | 73.4 % | 14.5 | 67.6 % |
| gate +12 / +3 dB | 82.8 % | 12.3 | 75.3 % |
| gate +12 / +6 dB + hold 4 s | 97.4 % | 0.0 | 90.7 % |
