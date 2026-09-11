import { demoRequests } from '../../demo-data';
import { localExpenseFixtures } from '../expenses/fixtures';
import type { BusinessInsightsInput } from './types';

export const localInsightsPreview: BusinessInsightsInput = {
  requests: structuredClone(demoRequests),
  expenses: structuredClone(localExpenseFixtures),
  source: 'local_preview',
  periodLabel: 'Local example records',
};

export const disconnectedInsightsInput: BusinessInsightsInput = {
  requests: [],
  expenses: [],
  source: 'not_connected',
  periodLabel: 'No repository connected',
};
