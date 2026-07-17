import { QuestionForm } from "./question-form";
import { activeCourtRules } from "../config/court-rules";

export default function Home() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Court Rule Navigator home">
          <span className="brand-mark" aria-hidden="true">
            CR
          </span>
          <span>
            <strong>Court Rule Navigator</strong>
            <small>N.D. California · Civil local rules</small>
          </span>
        </a>

        <div className="document-status">
          <span aria-hidden="true" />
          {activeCourtRules.versionLabel} rules indexed
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">Federal court research · CAND</p>
            <h1 id="page-title">Find the rule. Read the source.</h1>
            <p className="hero-copy">
              Ask a procedural question in plain language. The navigator searches
              the court&apos;s Civil Local Rules and answers from the matching
              passages.
            </p>
          </div>

          <aside className="scope-note" aria-label="Research scope">
            <span className="scope-label">Current scope</span>
            <strong>U.S. District Court</strong>
            <span>Northern District of California</span>
            <span>Civil Local Rules · {activeCourtRules.versionLabel}</span>
          </aside>
        </section>

        <QuestionForm
          indexedPassageCount={activeCourtRules.indexedPassageCount}
        />
      </main>

      <footer className="site-footer">
        <p>
          Research aid only. Verify the cited rule and any judge-specific standing
          orders before relying on an answer.
        </p>
        <span>{activeCourtRules.indexedPassageCount} source passages indexed</span>
      </footer>
    </div>
  );
}
