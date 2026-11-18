# Tuning on the dev part only (2026-11-18)

> Rejected run, kept for the record. Criterion here: most windows correct. For DSP it chose rules that name a wrong chord in 28.8 % of the windows (previous values: 11.7 %), so the criterion was changed to (windows correct − windows with a wrong chord) before anything was run on the test part. The config values from this run were not used.

Split by player: dev = 00, 01, 02, 03, test = 04, 05 (never read by this script).
Chosen on: dev part of guitarset-segments-ext, extended vocabulary (108 chords): most windows correct, ties → fewer windows with a wrong chord.
Input: `tests/recordings/guitarset-segments-ext`: 517 files from 92 recordings (file list sha256 `c39b86795303`).

| | |
|---|---|
| Commit | `95425d9` (with uncommitted changes in src/ or scripts/) |
| Configuration | `scripts/chord-eval.config.json` (sha256 `95ec3b9330de`) |
| AI model | Basic Pitch, @spotify/basic-pitch 1.0.1, model.json sha256 `1ed1aaee3409`; TensorFlow.js 3.21.0 (CPU) |
| Hardware | 11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz, 8 threads, 16 GB RAM; Windows NT 10.0.26200; Node v24.16.0 |

## Algorithm (DSP): margins and fallback

200 combinations, top 10:

| rules | files | file correct ¹ | windows | window correct | windows with an answer | correct of answered | wrong chord (windows) | false alarm on none-* (windows / files) |
|---|---|---|---|---|---|---|---|---|
| ext 0.1, power 0.06, ifHeard | 517 | 252 (48.7 %) | 6053 | 1455 (24.0 %) | 3196 (52.8 %) | 45.5 % | 1741 (28.8 %) | 0 / 0 |
| ext 0.1, power 0.15, ifHeard | 517 | 253 (48.9 %) | 6053 | 1454 (24.0 %) | 3190 (52.7 %) | 45.6 % | 1736 (28.7 %) | 0 / 0 |
| ext 0.1, power 0.2, ifHeard | 517 | 253 (48.9 %) | 6053 | 1454 (24.0 %) | 3190 (52.7 %) | 45.6 % | 1736 (28.7 %) | 0 / 0 |
| ext 0.1, power 1, ifHeard | 517 | 253 (48.9 %) | 6053 | 1454 (24.0 %) | 3190 (52.7 %) | 45.6 % | 1736 (28.7 %) | 0 / 0 |
| ext 0.1, power 0.12, ifHeard | 517 | 253 (48.9 %) | 6053 | 1454 (24.0 %) | 3191 (52.7 %) | 45.6 % | 1737 (28.7 %) | 0 / 0 |
| ext 0.1, power 0.1, ifHeard | 517 | 253 (48.9 %) | 6053 | 1454 (24.0 %) | 3193 (52.8 %) | 45.5 % | 1739 (28.7 %) | 0 / 0 |
| ext 0.1, power 0.08, ifHeard | 517 | 253 (48.9 %) | 6053 | 1454 (24.0 %) | 3194 (52.8 %) | 45.5 % | 1740 (28.7 %) | 0 / 0 |
| ext 0.12, power 0.06, ifHeard | 517 | 253 (48.9 %) | 6053 | 1453 (24.0 %) | 3171 (52.4 %) | 45.8 % | 1718 (28.4 %) | 0 / 0 |
| ext 0.12, power 0.15, ifHeard | 517 | 254 (49.1 %) | 6053 | 1452 (24.0 %) | 3165 (52.3 %) | 45.9 % | 1713 (28.3 %) | 0 / 0 |
| ext 0.12, power 0.2, ifHeard | 517 | 254 (49.1 %) | 6053 | 1452 (24.0 %) | 3165 (52.3 %) | 45.9 % | 1713 (28.3 %) | 0 / 0 |
| previous values (ext 0.08, power 0.15, always) | 517 | 285 (55.1 %) | 6053 | 1243 (20.5 %) | 1954 (32.3 %) | 63.6 % | 711 (11.7 %) | 0 / 0 |

## AI (Basic Pitch): activation floor, margins and fallback

3000 combinations, top 10:

| rules | files | file correct ¹ | windows | window correct | windows with an answer | correct of answered | wrong chord (windows) | false alarm on none-* (windows / files) |
|---|---|---|---|---|---|---|---|---|
| floor 0.075, ext 0.04, power 0.06, ifHeard | 517 | 406 (78.5 %) | 517 | 406 (78.5 %) | 485 (93.8 %) | 83.7 % | 79 (15.3 %) | 0 / 0 |
| floor 0.075, ext 0.04, power 0.08, ifHeard | 517 | 406 (78.5 %) | 517 | 406 (78.5 %) | 485 (93.8 %) | 83.7 % | 79 (15.3 %) | 0 / 0 |
| floor 0.075, ext 0.04, power 0.1, ifHeard | 517 | 406 (78.5 %) | 517 | 406 (78.5 %) | 485 (93.8 %) | 83.7 % | 79 (15.3 %) | 0 / 0 |
| floor 0.075, ext 0.04, power 0.12, ifHeard | 517 | 406 (78.5 %) | 517 | 406 (78.5 %) | 485 (93.8 %) | 83.7 % | 79 (15.3 %) | 0 / 0 |
| floor 0.075, ext 0.04, power 0.15, ifHeard | 517 | 406 (78.5 %) | 517 | 406 (78.5 %) | 485 (93.8 %) | 83.7 % | 79 (15.3 %) | 0 / 0 |
| floor 0.075, ext 0.04, power 0.2, ifHeard | 517 | 406 (78.5 %) | 517 | 406 (78.5 %) | 485 (93.8 %) | 83.7 % | 79 (15.3 %) | 0 / 0 |
| floor 0.075, ext 0.04, power 1, ifHeard | 517 | 406 (78.5 %) | 517 | 406 (78.5 %) | 485 (93.8 %) | 83.7 % | 79 (15.3 %) | 0 / 0 |
| floor 0.08, ext 0.04, power 0.04, ifHeard | 517 | 406 (78.5 %) | 517 | 406 (78.5 %) | 492 (95.2 %) | 82.5 % | 86 (16.6 %) | 0 / 0 |
| floor 0.08, ext 0.04, power 0.06, ifHeard | 517 | 406 (78.5 %) | 517 | 406 (78.5 %) | 492 (95.2 %) | 82.5 % | 86 (16.6 %) | 0 / 0 |
| floor 0.08, ext 0.04, power 0.08, ifHeard | 517 | 406 (78.5 %) | 517 | 406 (78.5 %) | 492 (95.2 %) | 82.5 % | 86 (16.6 %) | 0 / 0 |
| previous values (floor 0.075, ext 0.02, power 0.06, ifHeard) | 517 | 405 (78.3 %) | 517 | 405 (78.3 %) | 488 (94.4 %) | 83.0 % | 83 (16.1 %) | 0 / 0 |

## Chosen

- DSP: extendedMargin 0.1, powerMargin 0.06, fallback ifHeard
- AI: activationFloor 0.075, extendedMargin 0.04, powerMargin 0.06, fallback ifHeard

Dev part of `tests/recordings/guitarset-segments` (major/minor labels), basic vocabulary (24 chords), chosen values: `tests/recordings/guitarset-segments`: 445 files from 86 recordings (file list sha256 `4b1a1c651b0a`)

| engine | files | file correct ¹ | windows | window correct | windows with an answer | correct of answered | wrong chord (windows) | false alarm on none-* (windows / files) |
|---|---|---|---|---|---|---|---|---|
| DSP | 445 | 313 (70.3 %) | 5207 | 1287 (24.7 %) | 1528 (29.3 %) | 84.2 % | 241 (4.6 %) | 0 / 0 |
| AI | 445 | 345 (77.5 %) | 445 | 345 (77.5 %) | 355 (79.8 %) | 97.2 % | 10 (2.2 %) | 0 / 0 |

¹ file correct = the most frequent chord among the windows with an answer is the played chord.
