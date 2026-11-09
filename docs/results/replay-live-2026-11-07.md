# Live replay: does the chord stay on screen? (2026-11-07)

Algorithm mode, one reading every 100 ms, exactly the page logic (`LiveChordTracker`). **visible** = share of playing time with a chord on screen; **dropouts** = times per minute the chord vanishes while one is played; **correct** = share of playing time with the right chord.

## GuitarSet, every 3rd full accompaniment track, major/minor only

| variant | visible | dropouts / min | correct |
|---|---|---|---|
| before (gate +12 dB only, no hold) | 94.6 % | 3.7 | 58.9 % |
| gate +12 / +6 dB | 97.4 % | 1.8 | 60.1 % |
| gate +12 / +3 dB | 98.3 % | 1.1 | 60.5 % |
| gate +12 / +6 dB + hold 4 s | 99.7 % | 0.0 | 60.6 % |

## your takes (from the strum to the end), major/minor only

| variant | visible | dropouts / min | correct |
|---|---|---|---|
| before (gate +12 dB only, no hold) | 56.1 % | 19.8 | 52.5 % |
| gate +12 / +6 dB | 73.6 % | 14.5 | 70.0 % |
| gate +12 / +3 dB | 83.4 % | 12.3 | 79.7 % |
| gate +12 / +6 dB + hold 4 s | 98.1 % | 0.0 | 94.5 % |

## GuitarSet, every 3rd full accompaniment track, all chords

| variant | visible | dropouts / min | correct |
|---|---|---|---|
| before (gate +12 dB only, no hold) | 94.3 % | 3.1 | 40.7 % |
| gate +12 / +6 dB | 97.7 % | 1.5 | 41.9 % |
| gate +12 / +3 dB | 98.5 % | 0.8 | 42.2 % |
| gate +12 / +6 dB + hold 4 s | 99.6 % | 0.0 | 42.4 % |

## your takes (from the strum to the end), all chords

| variant | visible | dropouts / min | correct |
|---|---|---|---|
| before (gate +12 dB only, no hold) | 55.4 % | 19.8 | 49.3 % |
| gate +12 / +6 dB | 72.9 % | 14.5 | 66.8 % |
| gate +12 / +3 dB | 82.7 % | 12.3 | 75.2 % |
| gate +12 / +6 dB + hold 4 s | 97.4 % | 0.0 | 89.0 % |
