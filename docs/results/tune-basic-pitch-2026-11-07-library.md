# Basic Pitch: choosing the activation floor (2026-11-07, library evaluateModel — 2 passes per window)

Kinds of outcome: **correct**; **silent** = a chord was played but the engine said nothing; **wrong chord** = it named a different chord; **false alarm** = nothing was played (none-*) but it named a chord.

## tests/recordings/guitarset-segments (681 files)

| floor | correct | silent | wrong chord | false alarm |
|---|---|---|---|---|
| 0.02 | 258 (37.9 %) | 423 | 0 | 0 |
| 0.03 | 334 (49.0 %) | 345 | 2 | 0 |
| 0.04 | 388 (57.0 %) | 287 | 6 | 0 |
| 0.05 | 438 (64.3 %) | 230 | 13 | 0 |
| 0.06 | 480 (70.5 %) | 184 | 17 | 0 |
| 0.07 | 497 (73.0 %) | 156 | 28 | 0 |
| 0.075 (current) | 505 (74.2 %) | 144 | 32 | 0 |
| 0.08 | 498 (73.1 %) | 146 | 37 | 0 |
| 0.09 | 488 (71.7 %) | 148 | 45 | 0 |
| 0.1 | 450 (66.1 %) | 184 | 47 | 0 |
| 0.15 | 413 (60.6 %) | 221 | 47 | 0 |
| 0.2 | 398 (58.4 %) | 237 | 46 | 0 |
| 0.25 | 383 (56.2 %) | 253 | 45 | 0 |
| 0.3 | 371 (54.5 %) | 267 | 43 | 0 |
| 0.35 | 359 (52.7 %) | 278 | 44 | 0 |

## tests/recordings/real (51 files)

| floor | correct | silent | wrong chord | false alarm |
|---|---|---|---|---|
| 0.02 | 38 (74.5 %) | 13 | 0 | 0 |
| 0.03 | 44 (86.3 %) | 7 | 0 | 0 |
| 0.04 | 45 (88.2 %) | 6 | 0 | 0 |
| 0.05 | 48 (94.1 %) | 3 | 0 | 0 |
| 0.06 | 48 (94.1 %) | 3 | 0 | 0 |
| 0.07 | 47 (92.2 %) | 4 | 0 | 0 |
| 0.075 (current) | 46 (90.2 %) | 5 | 0 | 0 |
| 0.08 | 45 (88.2 %) | 6 | 0 | 0 |
| 0.09 | 45 (88.2 %) | 6 | 0 | 0 |
| 0.1 | 45 (88.2 %) | 6 | 0 | 0 |
| 0.15 | 41 (80.4 %) | 10 | 0 | 0 |
| 0.2 | 39 (76.5 %) | 12 | 0 | 0 |
| 0.25 | 38 (74.5 %) | 13 | 0 | 0 |
| 0.3 | 38 (74.5 %) | 13 | 0 | 0 |
| 0.35 | 34 (66.7 %) | 17 | 0 | 0 |
