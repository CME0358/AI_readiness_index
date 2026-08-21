import React, { useEffect } from "react";
import { trackPreviewVisit } from "./analytics.js";
import PartnerPreviewVideo from "./PartnerPreviewVideo.jsx";
import { CheckBadge } from "./preview-shared.jsx";
import { isPartnerPreviewPath } from "./partner-preview-routing.js";
import {
  PARTNER_CTA,
  PARTNER_SAMPLE_CHECK_SUMMARY,
  PARTNER_SAMPLE_COMPANY,
  PARTNER_SAMPLE_OBSERVATIONS,
  PARTNER_SAMPLE_PILLARS,
  PARTNER_VIDEO,
} from "./partner-preview-data.js";
import "./partner-preview.css";

export { isPartnerPreviewPath };

function FlowStep({ children, variant = "default" }) {
  return (
    <div className={`partner-flow__step partner-flow__step--${variant}`}>
      {children}
    </div>
  );
}

function FlowArrow() {
  return <div className="partner-flow__arrow" aria-hidden="true">↓</div>;
}

function SampleReportSection() {
  const summary = PARTNER_SAMPLE_CHECK_SUMMARY;
  const checkItems = summary.check_items || [];

  return (
    <section className="partner-section partner-sample" aria-labelledby="partner-sample-heading">
      <div className="partner-sample__banner">
        <span>SAMPLE — サンプルレポート（架空データ。実購入レポートとはデータソースが異なります）</span>
      </div>

      <h2 id="partner-sample-heading" className="partner-section__title">
        ある企業をAI視点で分析すると──
      </h2>
      <p className="partner-section__lead">
        完全版レポートでは、クライアント企業の公式サイトを対象に、AIから
        <strong> 発見・理解・比較・推薦・実行 </strong>
        されやすい状態を23項目で可視化します。以下は架空のサンプル表示です。
      </p>

      <div className="partner-card partner-card--sample">
        <div className="partner-sample__company">
          <div className="partner-sample__eyebrow">Illustrative Company Report</div>
          <h3 className="partner-sample__name">{PARTNER_SAMPLE_COMPANY.company_name}</h3>
          <p className="partner-sample__url">{PARTNER_SAMPLE_COMPANY.url}</p>
          <p className="partner-sample__industry">{PARTNER_SAMPLE_COMPANY.industry}</p>
        </div>

        <div className="partner-pillars">
          {PARTNER_SAMPLE_PILLARS.map((pillar) => (
            <div key={pillar.id} className="partner-pillar">
              <div className="partner-pillar__header">
                <div>
                  <div className="partner-pillar__label">{pillar.label}</div>
                  <div className="partner-pillar__jp">{pillar.jp}</div>
                </div>
                <CheckBadge status={pillar.status} />
              </div>
              <p className="partner-pillar__summary">{pillar.summary}</p>
            </div>
          ))}
        </div>

        {PARTNER_SAMPLE_OBSERVATIONS.length > 0 && (
          <ul className="partner-observations">
            {PARTNER_SAMPLE_OBSERVATIONS.map((obs) => (
              <li key={obs.code}>
                <strong>{obs.copy}</strong>
                {obs.qualification && (
                  <span className="partner-observations__qual">{obs.qualification}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="partner-checklist">
          <div className="partner-checklist__header">
            <h4>確認項目（抜粋）</h4>
            <span>{summary.checked_count ?? 0} / {summary.total_teaser ?? 23} 項目</span>
          </div>
          <ul>
            {checkItems.map((item) => (
              <li key={item.id}>
                <span>{item.label}</span>
                <CheckBadge status={item.status} />
              </li>
            ))}
          </ul>
          <p className="partner-checklist__note">
            完全版レポート（¥29,800 税別）では23項目すべてを評価し、改善優先順位を提示します。
          </p>
        </div>
      </div>
    </section>
  );
}

export default function PartnerPreviewPage() {
  useEffect(() => {
    document.title = "Agency Partner Preview｜Agent Readiness";

    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, follow");

    trackPreviewVisit({
      preview_token_hash: "partner_preview",
      campaign_id: "ari_agency_partner_v1",
    });
  }, []);

  return (
    <div className="partner-preview">
      <div className="partner-preview__inner">
        {/* Hero */}
        <header className="partner-hero">
          <div className="partner-hero__eyebrow">Agency Partner Preview</div>
          <h1 className="partner-hero__title">
            御社のクライアント、
            <br className="partner-br-sm" />
            検索では見つかるのに
            <br />
            AIでは候補から外れていませんか？
          </h1>
          <p className="partner-hero__lead">
            SEO・MEO・広告で集客基盤を整えている企業でも、
            AIに同じ条件で探させると、
            候補に出ない・比較で選ばれないケースが増えてきています。
          </p>

          <div className="partner-flow partner-flow--hero" aria-label="検索とAIの差">
            <FlowStep variant="muted">SEO / MEO / Web / 広告</FlowStep>
            <FlowArrow />
            <FlowStep variant="positive">検索では見つかる</FlowStep>
            <FlowArrow />
            <FlowStep variant="muted">AI検索・AIエージェント</FlowStep>
            <FlowArrow />
            <div className="partner-flow__issues">
              <FlowStep variant="attention">候補に出ない</FlowStep>
              <FlowStep variant="attention">比較で選ばれない</FlowStep>
              <FlowStep variant="attention">推薦されない</FlowStep>
            </div>
          </div>
        </header>

        {/* Video */}
        <PartnerPreviewVideo video={PARTNER_VIDEO} />

        {/* Problem */}
        <section className="partner-section" aria-labelledby="partner-problem-heading">
          <h2 id="partner-problem-heading" className="partner-section__title">
            クライアント企業は、
            <br className="partner-br-sm" />
            この変化にまだ気づいていないかもしれません。
          </h2>
          <div className="partner-prose">
            <p>Webサイトを整備している。</p>
            <p>SEOにも取り組んでいる。</p>
            <p>MEOも運用している。</p>
            <p>広告も出している。</p>
            <p className="partner-prose__emphasis">
              それでも、「AIから発見・理解・比較・推薦される状態になっているか」は別の確認が必要です。
            </p>
            <p>
              既存施策の上に、新しい確認領域が追加された——
              それが Agent Readiness（ARI）の位置づけです。
            </p>
          </div>
        </section>

        {/* Sample Report */}
        <SampleReportSection />

        {/* Agency Opportunity */}
        <section className="partner-section" aria-labelledby="partner-opportunity-heading">
          <h2 id="partner-opportunity-heading" className="partner-section__title">
            これは、既存クライアントへの
            <br className="partner-br-sm" />
            新しい提案機会でもあります。
          </h2>
          <p className="partner-section__lead">
            ARIは既存サービスの競合ではありません。課題を可視化し、
            Web制作・SEO・MEO・コンテンツ・技術改善への接続点を示します。
          </p>

          <div className="partner-opportunity">
            <div className="partner-opportunity__col">
              <h3>現在のサービス</h3>
              <ul>
                <li>Web制作</li>
                <li>SEO</li>
                <li>MEO</li>
                <li>広告運用</li>
                <li>マーケティング支援</li>
              </ul>
            </div>
            <div className="partner-opportunity__plus" aria-hidden="true">＋</div>
            <div className="partner-opportunity__col partner-opportunity__col--accent">
              <h3>Agent Readiness</h3>
              <p>AIから</p>
              <ul className="partner-opportunity__actions">
                <li>発見</li>
                <li>理解</li>
                <li>比較</li>
                <li>推薦</li>
              </ul>
              <p>される状態を確認</p>
            </div>
          </div>
        </section>

        {/* Client Expansion Flow */}
        <section className="partner-section" aria-labelledby="partner-expansion-heading">
          <h2 id="partner-expansion-heading" className="partner-section__title">
            クライアント展開のイメージ
          </h2>
          <p className="partner-section__lead">
            ARIは分析・可視化レイヤーです。改善実装はAgencyの既存サービスと接続できます。
          </p>

          <div className="partner-expansion-flow">
            {[
              "既存クライアント",
              "ARIで現状分析",
              "AI上の課題を可視化",
              "改善ポイントを確認",
              "クライアントへ提案",
              "Web / SEO / MEO / コンテンツ / 技術改善へ接続",
            ].map((step, i, arr) => (
              <React.Fragment key={step}>
                <FlowStep>{step}</FlowStep>
                {i < arr.length - 1 && <FlowArrow />}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Strong Agency Message */}
        <section className="partner-section partner-section--emphasis" aria-labelledby="partner-message-heading">
          <h2 id="partner-message-heading" className="partner-section__title partner-section__title--light">
            御社が支援しているクライアントを、
            <br className="partner-br-sm" />
            AIで検索してみてください。
          </h2>
          <div className="partner-message-steps">
            <div className="partner-message-step">
              <span className="partner-message-step__num">1</span>
              <p>検索では見つかるのに、AIの候補には出てこない企業がありませんか？</p>
            </div>
            <div className="partner-message-step">
              <span className="partner-message-step__num">2</span>
              <p>そこが、新しい提案余地になる可能性があります。</p>
            </div>
            <div className="partner-message-step">
              <span className="partner-message-step__num">3</span>
              <p>ARIで可視化し、既存サービスへの改善提案につなげられます。</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="partner-cta" aria-labelledby="partner-cta-heading">
          <h2 id="partner-cta-heading" className="partner-cta__title">
            次のステップ
          </h2>
          <div className="partner-cta__actions">
            <a href={PARTNER_CTA.primary.href} className="partner-cta__primary">
              {PARTNER_CTA.primary.label}
            </a>
            <a
              href={PARTNER_CTA.secondary.href}
              className="partner-cta__secondary"
              target={PARTNER_CTA.secondary.external ? "_blank" : undefined}
              rel={PARTNER_CTA.secondary.external ? "noopener noreferrer" : undefined}
            >
              {PARTNER_CTA.secondary.label}
            </a>
          </div>
          <p className="partner-cta__note">
            有料レポートは¥29,800（税別）。クライアント展開の相談は30分のオンライン面談から開始できます。
          </p>
        </section>
      </div>
    </div>
  );
}
