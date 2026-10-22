import type { ClientConfig } from '../types';

/**
 * Per-client rules. Change these per client instead of touching any page.
 * Values below reproduce the logic used in the Client Review Deck.
 */
export const clientConfig: ClientConfig = {
  clientName: 'Client',
  vendorName: 'We360.ai',
  excludeFromTopApps: ['Google Chrome', 'Microsoft Edge', 'Windows Explorer'],
  nonWorkCategories: ['Social media', 'Video / streaming', 'Gaming', 'Gambling', 'Adult'],
  aiTools: {
    'Microsoft 365 Copilot': ['m365.cloud.microsoft', 'microsoft 365 copilot'],
    'Microsoft Copilot': ['copilot.microsoft.com', 'microsoft copilot'],
    ChatGPT: ['chatgpt.com', 'chat.openai.com'],
    Claude: ['claude.ai'],
    Gemini: ['gemini.google.com'],
    NotebookLM: ['notebooklm.google.com'],
    DeepSeek: ['chat.deepseek.com'],
    Perplexity: ['perplexity.ai'],
    Grok: ['grok.com'],
    'Blackbox AI': ['blackbox.ai'],
    Qwen: ['chat.qwen.ai'],
  },
  aiHubTool: 'Microsoft 365 Copilot',
  minPresentDaysForLists: 15,
  minGroupSize: 3,
  unassignedDepartment: 'Default',
  defaults: {
    underThreshold: { metric: 'active', op: '<', value: 3 },
    individualsThreshold: { metric: 'active', op: '<', value: 4 },
    redFlag: {
      combine: 'all',
      minPresentDays: 50,
      rules: [
        { id: 'r1', measure: 'avgActive', op: '<', value: 2, enabled: true },
        { id: 'r2', measure: 'productivePct', op: '<', value: 70, enabled: false },
        { id: 'r3', measure: 'nonWorkHrs', op: '>', value: 10, enabled: false },
        { id: 'r4', measure: 'aiHrs', op: '<', value: 0.5, enabled: false },
      ],
    },
    bands: { metric: 'active', low: 3, high: 6 },
    leaderCount: 5,
    aiPowerUserCount: 10,
    capacity: { metric: 'online', benchmark: 7, variancePct: 10 },
    insightRules: {
      mappingHrsPerDay: 1,
      lowActiveHrs: 2,
      lowOnlineHrs: 1,
      lowOnlineMinDays: 3,
      neutralHrs: 2,
      underBandSharePct: 50,
      severeCategories: ['Gaming', 'Adult', 'Gambling'],
      leisureCategories: ['Video / streaming', 'Social media'],
      leisureMinHrs: 1,
      leisureMaxHrs: 3,
      aiMaxHrs: 1,
      healthySharePct: 50,
      lowProductiveHrs: 3,
      minOnlineHrs: 3,
      overDaysSharePct: 50,
      minPresentDaysForDayShare: 7,
      leisureKeepHrs: 10,
      overDaysKeepRangePct: [30, 50],
      monthlyChangePct: 20,
      unproductiveSharePct: 5,
    },
    cohorts: [
      {
        id: 'c-redflag', name: 'Red flag', color: '#EF4444', combine: 'all',
        description: 'Sustained very low activity over a meaningful number of days',
        rules: [
          { id: 'r1', measure: 'active', mode: 'max', max: 2 },
          { id: 'r2', measure: 'presentDays', mode: 'min', min: 50 },
        ],
      },
      {
        id: 'c-idle', name: 'Idle-heavy', color: '#F59E0C', combine: 'all',
        description: 'Logged in for long stretches with little keyboard or mouse activity',
        rules: [
          { id: 'r1', measure: 'idle', mode: 'range', min: 5, max: 12 },
          { id: 'r2', measure: 'active', mode: 'max', max: 3 },
        ],
      },
      {
        id: 'c-nonwork', name: 'Non-work users', color: '#FF5777', combine: 'any',
        description: 'Noticeable time on gaming or video / streaming',
        rules: [
          { id: 'r1', measure: 'category', category: 'Gaming', mode: 'min', min: 5 },
          { id: 'r2', measure: 'category', category: 'Video / streaming', mode: 'min', min: 10 },
        ],
      },
      {
        id: 'c-healthy', name: 'Healthy & productive', color: '#15B8A6', combine: 'all',
        description: 'In the healthy activity band with a high productive share',
        rules: [
          { id: 'r1', measure: 'active', mode: 'range', min: 3, max: 6 },
          { id: 'r2', measure: 'productivePct', mode: 'min', min: 85 },
        ],
      },
    ],
  },
};
