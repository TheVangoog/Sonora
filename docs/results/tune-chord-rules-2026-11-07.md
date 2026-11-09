# Choosing the rules for non-standard chords (2026-11-07)

Chosen on `tests/recordings/guitarset-segments-ext` (most correct files; ties → fewer wrong chords), then checked on `tests/recordings/real` and `tests/recordings/guitarset-segments`. "basic" = only the 24 major/minor chords (as before). Margin 1 = practically never.

## Algorithm (DSP)

### Choosing on tests/recordings/guitarset-segments-ext (top 10 of 200)

| rules | correct | wrong chord | silent | false alarm |
|---|---|---|---|---|
| extended 0.08, power 0.15, fallback always | 433/762 (56.8 %) | 256 | 73 | 0 |
| extended 0.06, power 0.15, fallback always | 432/762 (56.7 %) | 260 | 70 | 0 |
| extended 0.08, power 0.12, fallback always | 428/762 (56.2 %) | 301 | 33 | 0 |
| extended 0.12, power 0.15, fallback always | 426/762 (55.9 %) | 252 | 84 | 0 |
| extended 0.06, power 0.12, fallback always | 426/762 (55.9 %) | 305 | 31 | 0 |
| extended 0.1, power 0.15, fallback always | 425/762 (55.8 %) | 256 | 81 | 0 |
| extended 0.08, power 0.2, fallback always | 423/762 (55.5 %) | 230 | 109 | 0 |
| extended 0.08, power 1, fallback always | 423/762 (55.5 %) | 230 | 109 | 0 |
| extended 0.04, power 0.15, fallback always | 423/762 (55.5 %) | 275 | 64 | 0 |
| extended 0.06, power 0.2, fallback always | 422/762 (55.4 %) | 235 | 105 | 0 |
| … current (extended 0.08, power 0.15, fallback always) | 433/762 (56.8 %) | 256 | 73 | 0 |
| … basic (major/minor only) | 399/762 (52.4 %) | 202 | 161 | 0 |

**Chosen: extended 0.08, power 0.15, fallback always** → put into `DEFAULT_RULES in chords.ts`.

By chord type (chosen rules vs. basic):

| type | files | correct (chosen) | correct (basic) |
|---|---|---|---|
| power | 67 | 24 (36 %) | 0 (0 %) |
| dominant7 | 99 | 31 (31 %) | 0 (0 %) |
| major | 366 | 265 (72 %) | 291 (80 %) |
| minor7 | 57 | 9 (16 %) | 0 (0 %) |
| minor | 125 | 97 (78 %) | 108 (86 %) |
| major7 | 32 | 7 (22 %) | 0 (0 %) |
| augmented | 2 | 0 (0 %) | 0 (0 %) |
| halfDiminished7 | 14 | 0 (0 %) | 0 (0 %) |

### Check on tests/recordings/real

| rules | correct | wrong chord | silent | false alarm |
|---|---|---|---|---|
| chosen: extended 0.08, power 0.15, fallback always | 40/51 (78.4 %) | 2 | 7 | 2 |
| basic (major/minor only) | 42/51 (82.4 %) | 0 | 7 | 2 |

### Check on tests/recordings/guitarset-segments

| rules | correct | wrong chord | silent | false alarm |
|---|---|---|---|---|
| chosen: extended 0.08, power 0.15, fallback always | 398/681 (58.4 %) | 234 | 49 | 0 |
| basic (major/minor only) | 455/681 (66.8 %) | 117 | 109 | 0 |

## AI (Basic Pitch)

### Choosing on tests/recordings/guitarset-segments-ext (top 10 of 200)

| rules | correct | wrong chord | silent | false alarm |
|---|---|---|---|---|
| extended 0.02, power 0.06, fallback ifHeard | 598/762 (78.5 %) | 114 | 50 | 0 |
| extended 0.02, power 0.08, fallback ifHeard | 598/762 (78.5 %) | 114 | 50 | 0 |
| extended 0.02, power 0.1, fallback ifHeard | 598/762 (78.5 %) | 114 | 50 | 0 |
| extended 0.02, power 0.12, fallback ifHeard | 598/762 (78.5 %) | 114 | 50 | 0 |
| extended 0.02, power 0.15, fallback ifHeard | 598/762 (78.5 %) | 114 | 50 | 0 |
| extended 0.02, power 0.2, fallback ifHeard | 598/762 (78.5 %) | 114 | 50 | 0 |
| extended 0.02, power 1, fallback ifHeard | 598/762 (78.5 %) | 114 | 50 | 0 |
| extended 0.04, power 0.06, fallback ifHeard | 595/762 (78.1 %) | 112 | 55 | 0 |
| extended 0.04, power 0.08, fallback ifHeard | 595/762 (78.1 %) | 112 | 55 | 0 |
| extended 0.04, power 0.1, fallback ifHeard | 595/762 (78.1 %) | 112 | 55 | 0 |
| … current (extended 0.02, power 0.06, fallback ifHeard) | 598/762 (78.5 %) | 114 | 50 | 0 |
| … basic (major/minor only) | 433/762 (56.8 %) | 102 | 227 | 0 |

**Chosen: extended 0.02, power 0.06, fallback ifHeard** → put into `BASIC_PITCH_RULES in basicPitchEngine.ts`.

By chord type (chosen rules vs. basic):

| type | files | correct (chosen) | correct (basic) |
|---|---|---|---|
| power | 67 | 55 (82 %) | 0 (0 %) |
| dominant7 | 99 | 50 (51 %) | 0 (0 %) |
| major | 366 | 321 (88 %) | 324 (89 %) |
| minor7 | 57 | 31 (54 %) | 0 (0 %) |
| minor | 125 | 106 (85 %) | 109 (87 %) |
| major7 | 32 | 22 (69 %) | 0 (0 %) |
| augmented | 2 | 0 (0 %) | 0 (0 %) |
| halfDiminished7 | 14 | 13 (93 %) | 0 (0 %) |

### Check on tests/recordings/real

| rules | correct | wrong chord | silent | false alarm |
|---|---|---|---|---|
| chosen: extended 0.02, power 0.06, fallback ifHeard | 45/51 (88.2 %) | 1 | 5 | 0 |
| basic (major/minor only) | 46/51 (90.2 %) | 0 | 5 | 0 |

### Check on tests/recordings/guitarset-segments

| rules | correct | wrong chord | silent | false alarm |
|---|---|---|---|---|
| chosen: extended 0.02, power 0.06, fallback ifHeard | 451/681 (66.2 %) | 186 | 44 | 0 |
| basic (major/minor only) | 499/681 (73.3 %) | 31 | 151 | 0 |
