import { z } from "zod";

import { createRuleAnswerStream } from "../../../answers/answer-rule-question";
import { activeCourtRules } from "../../../config/court-rules";

export const runtime = "nodejs";

const requestSchema = z
  .object({
    question: z.string().trim().min(3).max(500),
  })
  .strict();

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsedRequest = requestSchema.safeParse(requestBody);

  if (!parsedRequest.success) {
    return Response.json(
      { error: "Question must contain between 3 and 500 characters." },
      { status: 400 },
    );
  }

  try {
    const result = await createRuleAnswerStream({
      documentId: activeCourtRules.documentId,
      question: parsedRequest.data.question,
      signal: request.signal,
    });
    const encoder = new TextEncoder();
    const encodeEvent = (event: object) =>
      encoder.encode(`${JSON.stringify(event)}\n`);
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encodeEvent({ type: "sources", sources: result.sources }),
        );

        try {
          for await (const text of result.textStream) {
            controller.enqueue(encodeEvent({ type: "text", text }));
          }

          controller.enqueue(encodeEvent({ type: "done" }));
        } catch (error) {
          if (!request.signal.aborted) {
            console.error("Failed while streaming court-rule answer.", error);
            controller.enqueue(
              encodeEvent({
                type: "error",
                error: "The answer stream ended unexpectedly.",
              }),
            );
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to answer court-rule question.", error);

    return Response.json(
      { error: "The question could not be answered right now." },
      { status: 500 },
    );
  }
}
