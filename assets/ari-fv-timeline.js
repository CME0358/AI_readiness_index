/**
 * ARI-FV-MASTER — HyperFrames-compatible timing architecture
 * Duration: 50s · FPS reference: 60
 */
(function (global) {
  'use strict';

  var PHASE_DEFS = [
    { phase: 'search', offset: 0, duration: 2 },
    { phase: 'discover', offset: 2, duration: 2 },
    { phase: 'understand', offset: 4, duration: 2 },
    { phase: 'compare', offset: 6, duration: 2 },
    { phase: 'recommend', offset: 8, duration: 1.6 },
    { phase: 'transition', offset: 9.6, duration: 0.4 }
  ];

  var FLOW_LABELS = [
    { id: 'search', label: '検索' },
    { id: 'discover', label: '発見' },
    { id: 'understand', label: '理解' },
    { id: 'compare', label: '比較' },
    { id: 'recommend', label: '推薦' }
  ];

  var INDUSTRIES = [
    {
      id: 'personal-gym',
      label: 'パーソナルジム',
      start: 0,
      duration: 10,
      phases: PHASE_DEFS,
      query: '渋谷で初心者でも通いやすいパーソナルジム。料金も比較したい。',
      conditions: ['渋谷', '初心者', '料金', '体験'],
      candidates: ['GYM A', 'GYM B', 'GYM C'],
      understand: [
        { key: '料金', value: '¥29,800〜' },
        { key: '初心者対応', value: 'あり' },
        { key: '体験', value: 'あり' },
        { key: 'アクセス', value: '徒歩5分' }
      ],
      compare: {
        headers: ['A', 'B', 'C'],
        rows: [
          { label: '初心者', values: ['◎', '○', '○'] },
          { label: '料金', values: ['◎', '○', '△'] },
          { label: 'アクセス', values: ['○', '△', '◎'] },
          { label: '体験', values: ['✓', '✓', '—'] }
        ]
      },
      recommend: {
        name: 'GYM A',
        summary: '初心者向けで、料金と体験条件のバランスが最も良い候補です。',
        reasons: ['初心者向けプラン', '料金情報が明確', '体験利用あり']
      }
    },
    {
      id: 'dental',
      label: '歯科',
      start: 10,
      duration: 10,
      phases: PHASE_DEFS,
      query: '新宿で土曜日に診てもらえる歯医者。初診でも行きやすいところ。',
      conditions: ['新宿', '土曜診療', '初診', '駅近'],
      candidates: ['歯科 A', '歯科 B', '歯科 C'],
      understand: [
        { key: '土曜診療', value: 'あり' },
        { key: '初診受付', value: '可' },
        { key: '診療時間', value: '9:00–18:00' },
        { key: 'アクセス', value: '駅徒歩3分' }
      ],
      compare: {
        headers: ['A', 'B', 'C'],
        rows: [
          { label: '土曜', values: ['◎', '○', '△'] },
          { label: '初診', values: ['◎', '◎', '○'] },
          { label: '駅近', values: ['◎', '△', '○'] },
          { label: '予約', values: ['✓', '✓', '—'] }
        ]
      },
      recommend: {
        name: '歯科 A',
        summary: '土曜診療と初診対応が明確で、駅近アクセスも良好な候補です。',
        reasons: ['土曜診療あり', '初診受付が明確', '駅から徒歩3分']
      }
    },
    {
      id: 'beauty-clinic',
      label: '美容クリニック',
      start: 20,
      duration: 10,
      phases: PHASE_DEFS,
      query: 'シミ治療を相談したい。料金が分かりやすくカウンセリングできるところ。',
      conditions: ['シミ治療', '料金', '相談', 'カウンセリング'],
      candidates: ['CLINIC A', 'CLINIC B', 'CLINIC C'],
      understand: [
        { key: '対象施術', value: 'シミ・肝斑' },
        { key: '料金', value: '¥15,000〜' },
        { key: '相談', value: '無料' },
        { key: 'カウンセリング', value: '当日可' }
      ],
      compare: {
        headers: ['A', 'B', 'C'],
        rows: [
          { label: '料金', values: ['◎', '○', '△'] },
          { label: '相談', values: ['◎', '◎', '○'] },
          { label: '施術', values: ['◎', '○', '○'] },
          { label: '予約', values: ['✓', '✓', '—'] }
        ]
      },
      recommend: {
        name: 'CLINIC A',
        summary: '料金とカウンセリング条件が明確で、相談から始めやすい候補です。',
        reasons: ['料金が明確', '無料相談あり', '当日カウンセリング可']
      }
    },
    {
      id: 'restaurant',
      label: '飲食店',
      start: 30,
      duration: 10,
      phases: PHASE_DEFS,
      query: '銀座で接待に使える個室の和食店。落ち着いた店を比較して。',
      conditions: ['銀座', '接待', '個室', '和食'],
      candidates: ['和食 A', '和食 B', '和食 C'],
      understand: [
        { key: '個室', value: 'あり（4〜8名）' },
        { key: '接待用途', value: '対応' },
        { key: '価格帯', value: '¥8,000〜' },
        { key: '営業時間', value: '17:00–23:00' }
      ],
      compare: {
        headers: ['A', 'B', 'C'],
        rows: [
          { label: '個室', values: ['◎', '○', '△'] },
          { label: '接待', values: ['◎', '◎', '○'] },
          { label: '価格', values: ['○', '◎', '△'] },
          { label: '予約', values: ['✓', '✓', '—'] }
        ]
      },
      recommend: {
        name: '和食 A',
        summary: '個室と接待用途が明確で、落ち着いた雰囲気の候補です。',
        reasons: ['個室あり', '接待対応', '価格帯が明確']
      }
    },
    {
      id: 'hotel',
      label: 'ホテル',
      start: 40,
      duration: 10,
      phases: PHASE_DEFS,
      query: '横浜で家族4人で泊まれる、駅から近いホテルを探して。',
      conditions: ['横浜', '家族4人', '駅近', '宿泊'],
      candidates: ['HOTEL A', 'HOTEL B', 'HOTEL C'],
      understand: [
        { key: '4名利用', value: 'ファミリー可' },
        { key: 'アクセス', value: '駅徒歩4分' },
        { key: '客室', value: 'ツイン×2' },
        { key: '料金', value: '¥18,000〜' }
      ],
      compare: {
        headers: ['A', 'B', 'C'],
        rows: [
          { label: '4名', values: ['◎', '○', '○'] },
          { label: '駅近', values: ['◎', '△', '◎'] },
          { label: '料金', values: ['○', '◎', '△'] },
          { label: '予約', values: ['✓', '✓', '—'] }
        ]
      },
      recommend: {
        name: 'HOTEL A',
        summary: '家族4名の宿泊条件と駅近アクセスのバランスが最も良い候補です。',
        reasons: ['4名利用可', '駅徒歩4分', '客室タイプが明確']
      }
    }
  ];

  global.ARI_FV_MASTER = Object.freeze({
    id: 'ARI-FV-MASTER',
    duration: 50,
    fps: 60,
    flowLabels: FLOW_LABELS,
    phaseDefs: PHASE_DEFS,
    industries: INDUSTRIES
  });
})(typeof window !== 'undefined' ? window : globalThis);
