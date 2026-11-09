# Evaluation: synthetic (2026-11-05)

Folder `tests/recordings/synthetic`, 35 files. Each take is cut into non-overlapping windows after the first 0.3 s; the file's answer is the majority vote of its windows. "—" = no chord.

## Алгоритм: FFT + шаблони (`dsp`)

| Metric | Value |
|---|---|
| Files correct | 32 / 35 (91.4 %) |
| Windows correct | 367 / 420 (87.4 %) |
| Window length | 171 ms |
| Mean analysis time per window (Node, CPU) | 12.5 ms |
| Real-time factor (time ÷ window length; < 1 = keeps up) | 0.07 |

Confusion matrix (rows: played, columns: recognized):

| played ＼ recognized | A | Am | C | D | Dm | E | Em | F | G | — |
|---|---|---|---|---|---|---|---|---|---|---|
| **A** | 3 | · | · | · | · | · | · | · | · | · |
| **Am** | · | 3 | · | · | · | · | · | · | · | · |
| **C** | · | · | 3 | · | · | · | · | · | · | · |
| **D** | · | · | · | 3 | · | · | · | · | · | · |
| **Dm** | · | · | · | · | 3 | · | · | · | · | · |
| **E** | · | · | · | · | · | 3 | · | · | · | · |
| **Em** | · | · | · | · | · | · | 3 | · | · | · |
| **F** | · | · | · | · | · | · | · | 3 | · | · |
| **G** | · | · | · | · | · | · | · | · | 3 | · |
| **—** | · | · | · | · | · | 1 | · | · | 2 | 5 |

Mistakes: none-silence__01.wav → G, none-silence__02.wav → G, none-string__01.wav → E

## ШІ: Basic Pitch (`basic-pitch`)

| Metric | Value |
|---|---|
| Files correct | 27 / 35 (77.1 %) |
| Windows correct | 27 / 35 (77.1 %) |
| Window length | 1988 ms |
| Mean analysis time per window (Node, CPU) | 6559.0 ms |
| Real-time factor (time ÷ window length; < 1 = keeps up) | 3.30 |

Confusion matrix (rows: played, columns: recognized):

| played ＼ recognized | A | Am | C | D | Dm | E | Em | F | G | — |
|---|---|---|---|---|---|---|---|---|---|---|
| **A** | 3 | · | · | · | · | · | · | · | · | · |
| **Am** | · | 2 | · | · | · | · | · | · | · | 1 |
| **C** | · | · | 3 | · | · | · | · | · | · | · |
| **D** | · | · | · | 3 | · | · | · | · | · | · |
| **Dm** | · | · | · | · | 2 | · | · | · | · | 1 |
| **E** | · | · | · | · | · | 2 | 1 | · | · | · |
| **Em** | · | · | · | · | · | · | 2 | · | · | 1 |
| **F** | · | · | · | · | · | · | · | 2 | · | 1 |
| **G** | · | · | · | · | · | · | · | · | · | 3 |
| **—** | · | · | · | · | · | · | · | · | · | 8 |

Mistakes: Am__03.wav → —, Dm__03.wav → —, E__03.wav → Em, Em__03.wav → —, F__03.wav → —, G__01.wav → —, G__02.wav → —, G__03.wav → —
