import { createBasicPitchEngine } from "./basicPitchEngine.ts";

// The model files live in public/models/basic-pitch (copied from the npm package).
// Relative to the app base, so the site also works from a subfolder (e.g. GitHub Pages).
const MODEL_URL = `${import.meta.env.BASE_URL}models/basic-pitch/model.json`;

// Dynamic import: the ~1 MB library is downloaded only when the AI is turned on.
export function createBrowserBasicPitchEngine() {
  return createBasicPitchEngine(loadBrowserBasicPitchModel);
}

/** Download the model from public/ (TensorFlow.js picks its backend first). */
export async function loadBrowserBasicPitchModel() {
  const tf = await import("@tensorflow/tfjs");
  await tf.ready();
  return tf.loadGraphModel(MODEL_URL);
}

/** Which backend TensorFlow.js ended up using ("webgl", "cpu", …). */
export async function tensorflowBackend(): Promise<string> {
  const tf = await import("@tensorflow/tfjs");
  await tf.ready();
  return tf.getBackend();
}
