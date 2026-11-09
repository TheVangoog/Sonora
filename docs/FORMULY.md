# Формули ladičky Sonora

Шпаргалка до коду тюнера. Терміни — словацькою.

---

## 1. Рівень сигналу — dBFS

Файл: `src/audio/signal.ts`

```
RMS  = √( (x₁² + x₂² + … + xₙ²) / n )      efektívna hodnota
dBFS = 20 · log10(RMS)
```

- **Vzorky** лежать у діапазоні **−1 … +1**, максимум = 1 → **0 dBFS**.
- Сигнал завжди ≤ 1, тому dBFS майже завжди **від'ємні**.
- **Кожні −6 dB = амплітуда вдвічі менша.**

| amplitúda | dBFS |
|---|---|
| 1 | 0 |
| 0.5 | −6 |
| 0.25 | −12 |
| 0.1 | −20 |
| 0.01 | −40 |
| ≈ 0.0018 | −55 ← **prah** тиші (`MIN_PITCH_DBFS`) |

- **dBFS** — рівень у цифрі, залежить від чутливості мікрофона й **zosilnenia (gain)**.
- **dB SPL** (*hladina akustického tlaku*) — реальна гучність у повітрі (шепіт ≈ 30, розмова ≈ 60, концерт ≈ 110).

Тихіше за −55 dBFS → статус `quiet`.

---

## 2. Jednosmerná zložka (DC offset)

Файл: `src/audio/pitch.ts`, блок 7

```
priemer     = (x₁ + x₂ + … + xₙ) / n
centered[i] = samples[i] − priemer
```

- Прибирає сталий зсув хвилі (від **zvukovej karty / A/D prevodníka**).
- Без цього завищується RMS і псується **autokorelácia**.
- Результат — в окремий масив `centered`: **не чіпаю чужих даних, не виділяю пам'ять у циклі.**

---

## 3. Zreteľnosť tónu (clarity)

- Від 0 до 1: наскільки хвиля **повторює сама себе** (періодичність).
- Гітара: **harmonické tóny** — цілі кратні **základnej frekvencie** (110, 220, 330 …) → спільний період → висока clarity.
- Шум: частоти не кратні → немає повтору → низька clarity.
- `MIN_CLARITY = 0.8` (було 0.9, знижено для справжньої гітари) — компроміс: 0.5 → хибні ноти від шуму; 0.99 → майже завжди `unclear`.

---

## 4. Frekvencia → nota

Файл: `src/audio/notes.ts`

```
midi       = round( 69 + 12 · log2(f / 440) )
pitchClass = midi % 12
octave     = floor(midi / 12) − 1
f_ціль     = 440 · 2^((midi − 69) / 12)
```

- **69** — номер MIDI ноти **A4 = 440 Hz** (еталон).
- **12** — кількість **poltónov** в **oktáve**.
- **−1** — щоб MIDI 60 = **C4** (середнє До фортепіано), MIDI 69 = **A4**.

Назви за `pitchClass`:

```
0  1   2  3   4  5  6   7  8   9  10  11
C  C♯  D  D♯  E  F  F♯  G  G♯  A  A♯  B
```

Корисне:

```
log2(x) = ln(x) / ln(2) = ln(x) / 0.693
log2(2) = 1    log2(0.5) = −1    log2(0.25) = −2
```

### Приклад: 110 Hz

```
110 / 440 = 0.25 → log2 = −2 → 12 · (−2) = −24 → 69 − 24 = 45
45 % 12 = 9           → A
floor(45 / 12) − 1 = 2 → A2   (відкрита 5-та struna)
```

### Відкриті struny гітари

| struna | nota | MIDI | Hz |
|---|---|---|---|
| 6 | E2 | 40 | 82.41 |
| 5 | A2 | 45 | 110.00 |
| 4 | D3 | 50 | 146.83 |
| 3 | G3 | 55 | 196.00 |
| 2 | B3 | 59 | 246.94 |
| 1 | E4 | 64 | 329.63 |

---

## 5. Centy

```
1 poltón = 100 centov
1 oktáva = 1200 centov

cents = 1200 · log2(f / f_ціль)
```

Швидко в голові (**лише біля 440 Hz**):

```
cents ≈ (f − 440) · 4
```

Скільки centov в 1 Hz (центи відносні — на низьких нотах герц «важчий»):

| nota | 1 Hz ≈ |
|---|---|
| E2 (82 Hz) | ~21 centov |
| A2 (110 Hz) | ~16 centov |
| A4 (440 Hz) | ~4 centy |

Статус (`IN_TUNE_CENTS = 5`):

```
|cents| ≤ 5  → in-tune  (naladený)
cents < −5   → flat     (podladený)  → підтягнути strunu
cents > +5   → sharp    (nadladený)  → послабити strunu
```

Приклади: 446 Hz → ≈ +23 → sharp; 437 Hz → ≈ −12 → flat.

---

## 6. Rámec і час

Файли: `src/audio/signal.ts`, `src/hooks/usePitchDetection.ts`

```
тривалість rámca = кількість vzoriek / vzorkovacia frekvencia
період ноти      = 1 / f
аналізів за секунду = 1000 / інтервал_мс
```

- `FRAME_SIZE = 2048` vzoriek
- аналіз ≈ раз на **75 мс**
