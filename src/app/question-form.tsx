"use client";

import { FormEvent, useState } from "react";

type Source = {
  citationNumber: number;
  ruleNumber: string;
  sectionNumber: string | null;
  sectionTitle: string | null;
  ruleTitle: string;
  pageRange: string;
  similarity: number;
};

type Answer = {
  answer: string;
  sources: Source[];
};

type StreamEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };

const exampleQuestions = [
  "What must parties do before raising a discovery dispute?",
  "How long can an opposition brief be?",
  "How do I ask the judge to reconsider an order?",
];

type QuestionFormProps = {
  indexedPassageCount: number;
};

export function QuestionForm({ indexedPassageCount }: QuestionFormProps) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function parseStreamEvent(line: string): StreamEvent {
    const event = JSON.parse(line) as Partial<StreamEvent>;

    if (event.type === "sources" && Array.isArray(event.sources)) {
      return { type: "sources", sources: event.sources };
    }

    if (event.type === "text" && typeof event.text === "string") {
      return { type: "text", text: event.text };
    }

    if (event.type === "done") {
      return { type: "done" };
    }

    if (event.type === "error" && typeof event.error === "string") {
      return { type: "error", error: event.error };
    }

    throw new Error("The server returned an unexpected stream event.");
  }

  function applyStreamEvent(event: StreamEvent) {
    if (event.type === "sources") {
      setResult({ answer: "", sources: event.sources });
    }

    if (event.type === "text") {
      setResult((currentResult) => ({
        answer: `${currentResult?.answer ?? ""}${event.text}`,
        sources: currentResult?.sources ?? [],
      }));
    }

    if (event.type === "error") {
      throw new Error(event.error);
    }
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuestion = question.trim();

    if (normalizedQuestion.length < 3) {
      setError("Enter a question with at least 3 characters.");
      return;
    }

    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: normalizedQuestion }),
      });
      if (!response.ok) {
        const responseBody = (await response.json()) as { error?: string };

        throw new Error(
          responseBody.error
            ? responseBody.error
            : "The question could not be answered right now.",
        );
      }

      if (!response.body) {
        throw new Error("The server did not return an answer stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bufferedText = "";

      while (true) {
        const { value, done } = await reader.read();
        bufferedText += decoder.decode(value, { stream: !done });
        const lines = bufferedText.split("\n");
        bufferedText = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            applyStreamEvent(parseStreamEvent(line));
          }
        }

        if (done) {
          break;
        }
      }

      if (bufferedText.trim()) {
        applyStreamEvent(parseStreamEvent(bufferedText));
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The question could not be answered right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="research-panel" aria-label="Court rule question">
      <div className="question-column">
        <form onSubmit={submitQuestion}>
          <label htmlFor="court-rule-question">Your procedural question</label>
          <textarea
            id="court-rule-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Example: What must counsel do before filing a discovery motion?"
            maxLength={500}
            rows={4}
            disabled={isLoading}
          />

          <div className="form-actions">
            <span>{question.length}/500</span>
            <button type="submit" disabled={isLoading || question.trim().length < 3}>
              {isLoading
                ? result
                  ? "Writing answer…"
                  : "Searching rules…"
                : "Find relevant rules"}
              {!isLoading && <span aria-hidden="true">→</span>}
            </button>
          </div>
        </form>

        <div className="examples" aria-label="Example questions">
          <span>Try an example</span>
          <div>
            {exampleQuestions.map((example) => (
              <button
                type="button"
                key={example}
                onClick={() => {
                  setQuestion(example);
                  setError(null);
                }}
                disabled={isLoading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div
          className="answer-region"
          aria-live={isLoading ? "off" : "polite"}
          aria-busy={isLoading}
        >
          {isLoading && !result && (
            <div className="loading-state">
              <span className="loading-line" />
              <span className="loading-line short" />
              <p>
                Comparing your question with {indexedPassageCount} rule passages…
              </p>
            </div>
          )}

          {error && (
            <div className="error-state" role="alert">
              <strong>Could not complete the search</strong>
              <p>{error}</p>
            </div>
          )}

          {!error && result && (
            <article className="answer">
              <p className="answer-label">
                {isLoading ? "Writing from sources" : "Source-backed answer"}
              </p>
              <p className={isLoading ? "answer-text is-streaming" : "answer-text"}>
                {result.answer}
              </p>
            </article>
          )}

          {!isLoading && !error && !result && (
            <div className="empty-state">
              <span aria-hidden="true">¶</span>
              <p>Your answer will appear here with the rules used to support it.</p>
            </div>
          )}
        </div>
      </div>

      <aside className="source-margin" aria-label="Sources">
        <div className="source-margin-heading">
          <span>Source margin</span>
          <small>{result?.sources.length ?? 0} cited</small>
        </div>

        {result && result.sources.length > 0 ? (
          <ol>
            {result.sources.map((source) => (
              <li key={`${source.ruleNumber}-${source.citationNumber}`}>
                <span className="citation-number">[{source.citationNumber}]</span>
                <div>
                  <strong>Rule {source.ruleNumber}</strong>
                  <p>{source.ruleTitle}</p>
                  {source.sectionTitle && (
                    <small>
                      Section {source.sectionNumber} · {source.sectionTitle}
                    </small>
                  )}
                  <small>{source.pageRange}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="source-empty">
            <span className="margin-rule" aria-hidden="true" />
            <p>
              Matching rule numbers and PDF pages will be listed here for
              verification.
            </p>
          </div>
        )}
      </aside>
    </section>
  );
}
