# pitch.ts — коментар до кожного рядка

**Мета:** зрозуміти шлях від масиву чисел звуку до відповіді «частота знайдена» або «придатної відповіді немає». Нижче весь поточний `src/audio/pitch.ts` у початковому порядку, без пропущених рядків. Межі пояснювальних блоків іноді проходять усередині класу або методу: для запуску використовуй повний файл, а не окремий уривок.

Коментарі в коді англійською; пояснення під кожним блоком українською. Читай по одному блоку. [Вихідний файл](../src/audio/pitch.ts) · [Практична перевірка](LAB-02.md)

## 1. Звідки беремо потрібні інструменти

```ts
// Block 1: Import the tools used by this file.
import { PitchDetector } from "pitchy"; // Load the library that estimates a tone's frequency.
import { measureSignal } from "./signal.ts"; // Load our helper for measuring signal level.
```

**Навіщо цей блок:** наш файл не виконує весь математичний пошук сам. `PitchDetector` із бібліотеки Pitchy шукає частоту, а наша функція `measureSignal` оцінює рівень звуку. Поки ми лише підключили їх; звук ще не аналізується.

> **Детектор** — код, який шукає певну характеристику в даних. Тут це частота: кількість коливань за секунду.

## 2. Які результати погоджуємося показувати

```ts
// Block 2: Set the initial acceptance limits for this application.
export const MIN_PITCH_HZ = 60; // Reject frequencies below 60 cycles per second.
export const MAX_PITCH_HZ = 1500; // Reject frequencies above 1500 cycles per second.
export const MIN_PITCH_DBFS = -55; // Skip signals whose measured level is below -55 dBFS.
export const MIN_CLARITY = 0.9; // Require a Pitchy clarity score of at least 0.9; this is not a probability.
```

**Що вирішуємо:** приймаємо частоти від 60 до 1500 Hz включно. Окремо перевірятимемо рівень сигналу та clarity. Це наші початкові налаштування, а не універсальні вимоги Pitchy.

> **Hz / герц** — одиниця частоти: 440 Hz означає 440 коливань за секунду. **dBFS** — шкала цифрового рівня: −70 dBFS тихіше за −55, а −20 — сильніше. **Clarity** — оцінка вираженості тону від 0 до 1; 0.9 не означає 90% гарантії правильної ноти.

**Що далі:** збережені числа використаємо в умовах `if`, щоб вирішувати, чи показувати результат.

## 3. У якому вигляді повертаємо відповідь

```ts
// Block 3: Describe the two possible shapes of an analysis result.
export type PitchReading = // Export a TypeScript type; it does not process sound itself.
  | { status: "detected"; frequency: number; clarity: number } // An accepted result includes a frequency in Hz.
  | { // All other states share the following shape.
      status: "idle" | "quiet" | "unclear" | "out-of-range"; // Explain why no frequency is available.
      frequency: null; // Explicitly remove the previous frequency from the result.
      clarity: number; // Keep the score, or use zero when no score was obtained.
    }; // Finish the result type.
```

**Що означає тип:** виклик поверне або знайдену частоту, або пояснення, чому її немає. При `status: "detected"` поле `frequency` містить число. За іншого статусу воно містить `null`.

> **PitchReading** — наша назва структури відповіді. **Статус** — коротка позначка стану. `idle` — не визначаємо; `quiet` — надто тихо; `unclear` — немає придатного результату; `out-of-range` — поза обраним діапазоном.

**Навіщо `null`:** після тиші інтерфейс має прибрати стару ноту. Повернення попередньої частоти могло б створити враження, що звук досі звучить. Сам тип нічого не перевіряє під час виконання — відповідні перевірки напишемо нижче.

## 4. Що показує інтерфейс

```ts
// Block 4: Provide the initial state and the messages shown in the interface.
export const IDLE_PITCH: PitchReading = { // Create the result used when detection is inactive.
  status: "idle", // No active measurement is available.
  frequency: null, // There is no measured frequency to display.
  clarity: 0, // No clarity score has been obtained yet.
}; // Finish the initial result.
export const PITCH_MESSAGES = { // Map each result status to a user-facing message.
  idle: "Увімкни мікрофон або тестовий сигнал", // Tell the user how to begin.
  quiet: "Звук надто тихий — зіграй одну ноту", // Explain that the signal is below our level threshold.
  unclear: "Не вдалося виділити один тон — зіграй протяжну ноту", // Explain that no usable tone was found.
  "out-of-range": "Звук поза робочим діапазоном 60–1500 Hz", // State the supported frequency range.
  detected: "Тон визначено", // Confirm that the result passed our checks.
}; // Finish the message map.
```

**Як це використовується:** `IDLE_PITCH` — готова відповідь для початкового стану й зупинки. `PITCH_MESSAGES` пов'язує внутрішні статуси з українськими написами. Так математична частина повертає дані, а компоненти показують зрозумілий текст.

> **Початковий стан** — що показуємо до появи першого вимірювання. Тут частоти ще немає; нуль у `clarity` теж не є результатом вимірювання.

## 5. Що створюємо перед першим аналізом

```ts
// Block 5: Allocate the detector and its reusable working array once.
export class ToneDetector { // Group the reusable resources and the analysis method.
  private detector: PitchDetector<Float32Array>; // Store a Pitchy detector that works with floating-point arrays.
  private centered: Float32Array; // Store a separate array for the signal after removing its average value.

  constructor(frameSize: number) { // Receive the number of samples that each input frame must contain.
    this.detector = PitchDetector.forFloat32Array(frameSize); // Prepare Pitchy for exactly this input length.
    this.centered = new Float32Array(frameSize); // Allocate a zero-filled working array of the same length.
  } // Finish setup; reuse these resources for later frames.
```

**Конкретний приклад:** коли наш хук виконує `new ToneDetector(2048)`, запускається конструктор. Він готує Pitchy до фрагментів із 2048 чисел і створює ще один масив такої самої довжини. Цей додатковий масив потім перезаписуватимемо, а не створюватимемо заново для кожного фрагмента.

> **Семпл** — одне числове значення сигналу в один момент часу. **Фрагмент / frame** — порція послідовних семплів. **Float32Array** — масив, що зберігає дробові числа у 32-бітному форматі.

`detector` зберігає об'єкт бібліотеки. `centered` зберігатиме підготовлені числа. `private` означає, що ці поля призначені для внутрішньої роботи класу; інший код користується методом `analyze`.

**Важливо:** у конструкторі ще не визначається жодна частота. Ми лише готуємо інструменти й пам'ять.

## 6. Чи можна працювати з отриманими даними

```ts
// Block 6: Validate the input before doing any calculations.
  analyze(samples: Float32Array, sampleRate: number): PitchReading { // Accept signal values and samples per second; return one result.
    if ( // Reject the frame if any of the following conditions is true.
      samples.length !== this.centered.length || // Pitchy requires the input length chosen in the constructor.
      !samples.length || // An empty array contains no sound data.
      !Number.isFinite(sampleRate) || // Reject NaN and positive or negative Infinity.
      sampleRate <= 0 // A sampling rate must be greater than zero.
    ) { // Enter the rejection branch for invalid input.
      return { status: "unclear", frequency: null, clarity: 0 }; // Stop this call without producing a frequency.
    } // Valid input continues below.
```

**Що надходить:** `samples` — числа з мікрофона або генератора; `sampleRate` — скільки таких чисел відповідає одній секунді. Наприклад, масив із 2048 чисел і `sampleRate = 48000`.

> **Частота дискретизації / sampleRate** — кількість семплів за секунду. Це не частота зіграної ноти. **NaN** — спеціальне значення «не число» після некоректного числового обчислення; **Infinity** — нескінченність.

**Чому ці перевірки потрібні:** масив має відповідати розміру, до якого підготували Pitchy. Порожні дані або неправильна швидкість їх надходження не дозволяють зробити коректне вимірювання. `||` поєднує причини відмови: достатньо будь-якої однієї. `return` одразу завершує поточний виклик — рядки нижче вже не виконуються.

## 7. Прибираємо постійний зсув хвилі

```ts
// Block 7: Remove the constant offset without changing the original samples.
    let mean = 0; // Begin with an empty sum of sample values.
    for (const sample of samples) { // Visit every value in the input frame.
      if (!Number.isFinite(sample)) { // A sample must be an ordinary finite number.
        return { status: "unclear", frequency: null, clarity: 0 }; // Reject the whole frame if one value is invalid.
      } // Continue when this sample is valid.
      mean += sample; // Add this value to the sum.
    } // All valid sample values have now been added.
    mean /= samples.length; // Divide the sum by the count to obtain the average.
    for (let i = 0; i < samples.length; i++) { // Visit the same positions in both arrays.
      this.centered[i] = samples[i] - mean; // Subtract the average and write the result into the working array.
    } // The working signal is now centered around zero, within floating-point precision.
```

**Приклад із малими числами:** нехай отримали `[0.3, 0.5, 0.7]`. Спочатку додаємо числа: 1.5. Ділимо на їхню кількість: `1.5 / 3 = 0.5`. Потім від кожного віднімаємо 0.5 й отримуємо приблизно `[-0.2, 0, 0.2]`.

> **Середнє значення / mean** — сума чисел, поділена на їхню кількість. **Постійне зміщення / DC offset** — зсув середнього значення хвилі вище або нижче нуля.

**Навіщо віднімати середнє:** наприклад, `[0.5, 0.5, 0.5]` — рівна лінія без коливань. Після віднімання середнього вона перетвориться на нулі й не пройде перевірку рівня як звук. Ми прибираємо постійний зсув, а не весь шум. Вихідний масив `samples` не змінюється: результат записуємо в `centered`.

Спочатку перевіряємо кожне число на придатність. Один `NaN` зіпсував би всю суму, тому такий фрагмент одразу відхиляємо.

## 8. Відсіюємо надто тихий сигнал

```ts
// Block 8: Skip silence and signals that are too quiet for our initial policy.
    if (measureSignal(this.centered).dbfs < MIN_PITCH_DBFS) { // Compare the centered signal's level with -55 dBFS.
      return { status: "quiet", frequency: null, clarity: 0 }; // Do not call Pitchy or keep the old frequency.
    } // A sufficiently strong signal continues to frequency detection.
```

**Що робить умова:** `measureSignal` повертає показники рівня, з яких беремо `.dbfs`. Порівнюємо його з −55. Наприклад, −70 менше за −55, тому повернемо `quiet`. Значення −20 більше, тому підемо далі.

> **Поріг** — граничне значення для рішення. Тут це мінімальний рівень, за якого ми пробуємо визначити частоту.

**Навіщо це тюнеру:** у тиші не хочемо показувати випадкову ноту. Pitchy на цьому кроці ще не викликається. Поріг зменшує кількість небажаних відповідей, але не відрізняє будь-який шум від музики.

## 9. Отримуємо частоту від Pitchy

```ts
// Block 9: Ask Pitchy to estimate the frequency from the actual signal.
    const [frequency, clarity] = this.detector.findPitch( // Unpack Pitchy's two returned numbers into named variables.
      this.centered, // Supply the prepared signal values, not the generator's frequency setting.
      sampleRate, // Supply samples per second so Pitchy can express its estimate in Hz.
    ); // The library call has completed; our acceptance checks still follow.
    const safeClarity = Number.isFinite(clarity) // Check whether the returned clarity score is finite.
      ? Math.max(0, Math.min(1, clarity)) // For a finite score, limit it to the interval from 0 to 1.
      : 0; // Replace an invalid score with zero so it cannot pass our threshold.
```

**Головний виклик у файлі:** передаємо бібліотеці підготовлений масив і кількість семплів за секунду. Вона повертає два числа. Запис `[frequency, clarity]` розкладає їх у дві змінні.

> **frequency** — оцінена частота в Hz. **Clarity** — оцінка вираженості тону, а не ймовірність того, що відповідь правильна.

**Навчальний приклад відповіді:** бібліотека могла повернути `[439.8, 0.98]`. Тоді `frequency` дорівнює 439.8, а `clarity` — 0.98. Це приклад для читання коду, не нове вимірювання мікрофона.

`safeClarity` підготовлює оцінку до перевірки: скінченне число обмежуємо від 0 до 1, а некоректне замінюємо нулем. `Math.min(1, clarity)` не дає перевищити 1; `Math.max(0, ...)` не дає опуститися нижче 0. Така обробка не робить саму оцінку надійнішою.

**Важливий зв'язок:** значення повзунка генератора в цей виклик не передається. Частота визначається з чисел сигналу.

## 10. Перевіряємо відповідь і повертаємо результат

```ts
// Block 10: Accept only usable results and return them to the caller.
    if ( // Reject an invalid frequency or an insufficient clarity score.
      !Number.isFinite(frequency) || // A displayed frequency cannot be NaN or Infinity.
      frequency <= 0 || // Zero and negative values are not usable tone frequencies.
      safeClarity < MIN_CLARITY // Reject scores below our chosen threshold of 0.9.
    ) { // At least one quality check failed.
      return { status: "unclear", frequency: null, clarity: safeClarity }; // Keep the score but do not present a frequency.
    } // The estimate passed the basic quality checks.
    if (frequency < MIN_PITCH_HZ || frequency > MAX_PITCH_HZ) { // Check our chosen range of 60 through 1500 Hz.
      return { status: "out-of-range", frequency: null, clarity: safeClarity }; // Explain that this estimate lies outside the range.
    } // The estimate is inside the supported range.
    return { status: "detected", frequency, clarity: safeClarity }; // Return the accepted frequency and score to React's update hook.
  } // Finish one call to analyze.
} // Finish the ToneDetector class.
```

**Перша перевірка:** частота має бути скінченним додатним числом, а clarity — не нижчою за 0.9. Якщо оцінка становить 0.4, повернемо `unclear`, навіть коли число частоти виглядає правдоподібно.

**Друга перевірка:** частота має лежати між 60 і 1500 Hz включно. Наприклад, 1800 Hz із високою clarity поверне `out-of-range`: бібліотека могла знайти тон, але він поза межами нашої першої версії.

**Якщо обидві перевірки пройдено:** повертаємо `detected`, частоту та оцінку. Для навчального прикладу з попереднього блоку це `{ status: "detected", frequency: 439.8, clarity: 0.98 }`.

**На цьому робота файлу завершена.** Він визначає частоту, але не назву ноти. Хук `usePitchDetection.ts` передає відповідь у React; файл `notes.ts` перетворює частоту на ноту й відхилення від неї. Саме його розбиратимемо після цього файлу.

## Що тримати в голові

Отримали числа → перевірили їх → прибрали постійний зсув → перевірили рівень → викликали Pitchy → перевірили відповідь → повернули результат. Два головні розрізнення: підготовка детектора не є вимірюванням; знайдена частота ще не є назвою ноти.

## Словничок

| Слово | Значення |
| --- | --- |
| Семпл | Одне число: значення сигналу в один момент |
| Фрагмент / frame | Порція послідовних семплів |
| sampleRate | Кількість семплів за секунду |
| Частота, Hz | Кількість коливань за секунду |
| Детектор / Pitchy | Код для пошуку частоти / бібліотека, яку використовуємо |
| Float32Array | Масив дробових чисел у 32-бітному форматі |
| Середнє / mean | Сума значень, поділена на їхню кількість |
| DC offset | Постійний зсув середнього значення хвилі від нуля |
| dBFS | Шкала цифрового рівня сигналу |
| Clarity | Оцінка вираженості тону від Pitchy; не ймовірність правильності |
| Поріг | Граничне значення, за яким приймаємо або відхиляємо результат |
| NaN / Infinity | Некоректний числовий результат / нескінченність |
| PitchReading / статус | Наша структура відповіді / позначка її стану |
| Нота | Музична назва висоти звуку, наприклад Ля |
