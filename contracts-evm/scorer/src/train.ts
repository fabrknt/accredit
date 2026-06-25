// SPDX-License-Identifier: Apache-2.0
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import trainingData from "../data/training.json" with { type: "json" };
import { canonicalStringify, trainLogisticModel } from "./training.js";
import type { TrainingDataset } from "./types.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const modelPath = resolve(currentDirectory, "model.json");

async function main(): Promise<void> {
  const dataset = trainingData as TrainingDataset;
  const outcome = trainLogisticModel(dataset);
  const modelContents = `${canonicalStringify(outcome.model)}\n`;

  await writeFile(modelPath, modelContents, "utf8");

  console.log(`Wrote ${modelPath}`);
  console.log(
    `Held-out accuracy: ${outcome.metrics.correct}/${outcome.metrics.total} (${outcome.metrics.accuracy.toFixed(4)})`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
