/**
 * OISUMMIT Agent Demo scenarios — enterprise / public / tech
 * Loaded before agent-demo-engine.js on OISUMMIT pages.
 */
(function (global) {
  'use strict';

  var ENTERPRISE_FLOW = [
    { id: 'search', label: 'SEARCH' },
    { id: 'understand', label: 'UNDERSTAND' },
    { id: 'compare', label: 'COMPARE' },
    { id: 'recommend', label: 'RECOMMEND' }
  ];

  var PUBLIC_FLOW = [
    { id: 'ask', label: 'ASK' },
    { id: 'discover', label: 'DISCOVER' },
    { id: 'connect', label: 'CONNECT' },
    { id: 'guide', label: 'GUIDE' }
  ];

  var TECH_FLOW = [
    { id: 'request', label: '依頼' },
    { id: 'confirm', label: '確認' },
    { id: 'execute', label: '実行' },
    { id: 'verify', label: '検証' }
  ];

  global.AGENT_DEMO_SCENARIOS = Object.freeze({
    enterprise: Object.freeze({
      id: 'oisummit-enterprise',
      duration: 10,
      loop: true,
      flowLabels: ENTERPRISE_FLOW,
      query: '法人向けAI導入支援会社を比較して。大企業とのPoC経験を重視したい。',
      staticFinalPhase: 'recommend',
      steps: [
        {
          at: 0,
          phase: 'search',
          render: 'thinking',
          text: '候補企業を検索しています',
          sub: 'DISCOVER · UNDERSTAND · COMPARE'
        },
        {
          at: 2,
          phase: 'understand',
          render: 'html',
          html:
            '<p class="ari-fv-ai-text">3社を比較しました</p>' +
            '<div class="ari-fv-struct">' +
            '<div class="ari-fv-struct__row"><span>候補A</span><strong>PoC実績 多数</strong></div>' +
            '<div class="ari-fv-struct__row"><span>候補B</span><strong>PoC実績 中</strong></div>' +
            '<div class="ari-fv-struct__row"><span>候補C</span><strong>PoC実績 少</strong></div>' +
            '</div>'
        },
        {
          at: 4.5,
          phase: 'compare',
          render: 'html',
          html:
            '<p class="ari-fv-ai-text">RECOMMENDATION</p>' +
            '<p class="ari-fv-ai-sub">条件との適合度が最も高い企業を推薦します。</p>' +
            '<div class="ari-fv-compare-lite">' +
            '<div class="ari-fv-compare-lite__row ari-fv-compare-lite__row--head"><span></span><span>A</span><span>B</span><span>C</span></div>' +
            '<div class="ari-fv-compare-lite__row"><span>PoC</span><span>◎</span><span>○</span><span>△</span></div>' +
            '<div class="ari-fv-compare-lite__row"><span>Enterprise</span><span>◎</span><span>○</span><span>○</span></div>' +
            '</div>'
        },
        {
          at: 7,
          phase: 'recommend',
          render: 'html',
          highlight: true,
          html:
            '<div class="ari-fv-rec">' +
            '<div class="ari-fv-rec__badge ari-fv-rec__badge--critical">RECOMMENDED</div>' +
            '<p class="ari-fv-ai-text">条件との適合度が最も高い候補を推薦します。</p>' +
            '<div class="ari-fv-rec__name">候補A（概念デモ）</div>' +
            '<div class="ari-fv-rec__reason">✓ 大企業PoC実績</div>' +
            '<div class="ari-fv-rec__reason">✓ Enterprise向け支援</div>' +
            '</div>'
        }
      ]
    }),

    public: Object.freeze({
      id: 'oisummit-public',
      duration: 10,
      loop: true,
      flowLabels: PUBLIC_FLOW,
      query: '子ども2人と移住して開業したいです。利用できる制度を教えて。',
      staticFinalPhase: 'guide',
      steps: [
        {
          at: 0,
          phase: 'ask',
          render: 'thinking',
          text: '自治体公式情報を確認',
          sub: '移住 · 住宅 · 子育て · 創業 · 補助金'
        },
        {
          at: 2,
          phase: 'discover',
          render: 'html',
          html:
            '<p class="ari-fv-ai-text">関連制度を整理しています…</p>' +
            '<div class="ari-fv-tags">' +
            '<span class="ari-fv-tag">移住</span><span class="ari-fv-tag">住宅</span>' +
            '<span class="ari-fv-tag">子育て</span><span class="ari-fv-tag">創業</span>' +
            '</div>'
        },
        {
          at: 4.5,
          phase: 'connect',
          render: 'html',
          html:
            '<p class="ari-fv-ai-text">あなたの場合</p>' +
            '<div class="ari-fv-program-list">' +
            '<div class="ari-fv-program"><span class="ari-fv-program__num">01</span><span>移住支援制度（概念）</span></div>' +
            '<div class="ari-fv-program"><span class="ari-fv-program__num">02</span><span>子育て世帯向け住宅支援（概念）</span></div>' +
            '<div class="ari-fv-program"><span class="ari-fv-program__num">03</span><span>創業支援制度（概念）</span></div>' +
            '</div>'
        },
        {
          at: 7,
          phase: 'guide',
          render: 'html',
          highlight: true,
          html:
            '<div class="ari-fv-rec">' +
            '<div class="ari-fv-rec__badge ari-fv-rec__badge--critical">RELEVANT PROGRAMS FOUND</div>' +
            '<p class="ari-fv-ai-sub">公式情報を確認</p>' +
            '<div class="ari-fv-rec__reason">✓ 複数制度を横断整理</div>' +
            '<div class="ari-fv-rec__reason">✓ Journeyに沿った案内</div>' +
            '</div>'
        }
      ]
    }),

    tech: Object.freeze({
      id: 'oisummit-tech',
      duration: 10,
      loop: true,
      flowLabels: TECH_FLOW,
      query: '9月15日 19:00から\n4名で予約して',
      staticFinalPhase: 'verify',
      steps: [
        {
          at: 0,
          phase: 'request',
          render: 'html',
          html:
            '<p class="ari-fv-ai-text">依頼内容</p>' +
            '<div class="ari-fv-req-grid">' +
            '<div class="ari-fv-req"><span> </span><strong>9月15日</strong></div>' +
            '<div class="ari-fv-req"><span>時間</span><strong>19:00</strong></div>' +
            '<div class="ari-fv-req"><span>人数</span><strong>4名</strong></div>' +
            '</div>'
        },
        {
          at: 2,
          phase: 'confirm',
          render: 'html',
          html:
            '<p class="ari-fv-ai-text">実行</p>' +
            '<div class="ari-fv-api-result"><span class="ari-fv-api-result__label">システム処理</span><span class="ari-fv-api-result__status">API 200 OK</span></div>'
        },
        {
          at: 4,
          phase: 'execute',
          render: 'html',
          html:
            '<p class="ari-fv-ai-text">予約確定</p>' +
            '<div class="ari-fv-req-grid">' +
            '<div class="ari-fv-req"><span> </span><strong>9月15日</strong></div>' +
            '<div class="ari-fv-req ari-fv-req--warn"><span>時間</span><strong>19:30</strong></div>' +
            '<div class="ari-fv-req"><span>人数</span><strong>4名</strong></div>' +
            '</div>'
        },
        {
          at: 6.5,
          phase: 'verify',
          render: 'html',
          highlight: true,
          html:
            '<div class="ari-fv-outcome">' +
            '<div class="ari-fv-outcome__row"><span>希望</span><span>確定</span></div>' +
            '<div class="ari-fv-outcome__times"><span>19:00</span><span class="ari-fv-outcome__neq">≠</span><span>19:30</span></div>' +
            '<div class="ari-fv-rec__badge ari-fv-rec__badge--critical ari-fv-rec__badge--danger">希望条件と不一致</div>' +
            '</div>'
        }
      ]
    })
  });
})(typeof window !== 'undefined' ? window : globalThis);
