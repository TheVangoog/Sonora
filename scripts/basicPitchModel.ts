// Loading the Basic Pitch model in Node (the browser loads it by URL instead).
// TensorFlow.js in Node cannot read "file://" paths without the native addon,
// so we read model.json and the weights ourselves and hand them over in memory.
import { readFileSync } from "node:fs";
import * as tf from "@tensorflow/tfjs";

const MODEL_DIR = "node_modules/@spotify/basic-pitch/model/";

export function loadBasicPitchModelFromDisk(): Promise<tf.GraphModel> {
  const manifest = JSON.parse(readFileSync(MODEL_DIR + "model.json", "utf8"));
  const weightsFile = readFileSync(MODEL_DIR + manifest.weightsManifest[0].paths[0]);
  const weightData = weightsFile.buffer.slice(
    weightsFile.byteOffset,
    weightsFile.byteOffset + weightsFile.byteLength,
  );
  return tf.loadGraphModel(
    tf.io.fromMemory({
      modelTopology: manifest.modelTopology,
      weightSpecs: manifest.weightsManifest[0].weights,
      weightData,
    }),
  );
}
