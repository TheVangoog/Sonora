# Записи для тестового стенда

| Папка | Що там | Звідки |
|---|---|---|
| `real/` | **справжня гітара**, твої записи | сторінка **Запис** (`/#/record`) → «Зберегти WAV» → перенести сюди |
| `synthetic/` | штучні акорди з шумом кімнати | `npm run make:synthetic`. Лише щоб перевірити, що стенд працює |
| `guitarset/` | відкритий набір **GuitarSet 1.1.0** (сирі дані: `annotation/`, `audio/`) | [Zenodo 3371780](https://zenodo.org/records/3371780), CC BY 4.0: `annotation.zip` + `audio_mono-mic.zip`, розпакувати сюди |
| `guitarset-segments/` | 681 шматок GuitarSet, по одному акорду (≤ 3 с) | `npm run make:guitarset` |

## GuitarSet: як із нього зроблено тестовий набір

Скрипт `scripts/make-guitarset-set.ts`:
1. Бере лише записи акомпанементу (`*_comp`), без соло, і звук із **мікрофона**.
2. Зводить кожен акорд до наших 24 (`scripts/guitarsetLabels.ts`): `A:min7` → `Am`, `D#:maj7` → `D♯`. Зменшені, sus, power chords і акорди без терції пропускає.
3. Залишає акорд, лише якщо **ноти з партитури** (lead sheet) і **реально зігране** зводяться до одного акорду.
4. Залишає акорди тривалістю від 2,3 с (менше Basic Pitch не встигає оцінити) і обрізає до 3 с, як наші записи.

Посилання для роботи: Q. Xi, R. Bittner, J. Pauwels, X. Ye, J. P. Bello, *GuitarSet: A Dataset for Guitar Transcription*, ISMIR 2018.

## Назви файлів

`<мітка>__<номер>.wav`, наприклад `Am__03.wav` або `none-silence__01.wav`.

- мітка акорду (`C`, `G`, `D`, `A`, `E`, `Am`, `Em`, `Dm`, `F`) — очікуємо саме цей акорд;
- `none-…` (`none-string`, `none-silence`, `none-speech`) — очікуємо **жодного** акорду.

## Протокол запису (щоб результати були чесними)

1. Кожен акорд **5–10 разів**: тихо, нормально, голосно; удар униз і перебором.
2. Записи «без акорду»: 6 одиночних струн, 2–3 тиші, 2–3 розмови.
3. Записати, на чому записано: ноутбук або телефон, мікрофон, кімната. Це піде в розділ про пристрої.
4. Не видаляти «погані» записи: вони теж частина реальності.

## Запуск

```bash
npm run eval             # real/, обидва двигуни
npm run eval:synthetic   # synthetic/
npm run eval:guitarset   # guitarset-segments/ (Basic Pitch на CPU: ~75 хв)
node scripts/evaluate.ts tests/recordings/real dsp   # лише наш алгоритм (швидко)
```

Звіт зберігається в `docs/results/eval-<папка>-<дата>.md`.
