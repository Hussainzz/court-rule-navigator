import { z } from "zod";

export const embeddingModel = "embeddinggemma:300m-qat-q4_0";
export const embeddingDimensions = 768;

const ollamaEmbedResponseSchema = z.object({
  model: z.string(),
  embeddings: z.array(z.array(z.number())),
});

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) {
    throw new Error("Provide at least one text to embed.");
  }

  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: texts,
      dimensions: embeddingDimensions,
      truncate: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama embedding request failed (${response.status}): ${await response.text()}`,
    );
  }

  const result = ollamaEmbedResponseSchema.parse(await response.json());

  if (result.embeddings.length !== texts.length) {
    throw new Error(
      `Expected ${texts.length} embeddings, received ${result.embeddings.length}.`,
    );
  }

  result.embeddings.forEach((embedding, index) => {
    if (embedding.length !== embeddingDimensions) {
      throw new Error(
        `Expected embedding ${index + 1} to have ${embeddingDimensions} dimensions, received ${embedding.length}.`,
      );
    }

    if (!embedding.every(Number.isFinite)) {
      throw new Error(
        `Ollama returned a non-finite value in embedding ${index + 1}.`,
      );
    }
  });

  return {
    embeddings: result.embeddings,
    model: result.model,
  };
}

export async function embedText(text: string) {
  const result = await embedTexts([text]);
  const [embedding] = result.embeddings;

  if (!embedding) {
    throw new Error("Ollama did not return an embedding.");
  }

  return {
    embedding,
    model: result.model,
  };
}
