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
  },
};
