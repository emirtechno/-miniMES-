/**
 * K4 gate — pure helper asserts (no vitest required).
 * Run: node frontend/scripts/assert-scrap-label.mjs
 */
import assert from 'node:assert/strict';
import { displayScrapKpi, formatScrapLabel } from '../src/utils/scrapLabel.js';

assert.equal(formatScrapLabel(12, 0), 'Σ Fire 12');
assert.equal(formatScrapLabel(12, 5), 'Σ Fire 12 · bu vardiyada manuel +5');
assert.equal(displayScrapKpi(12, 5), 12, 'manual scrap must NOT inflate displayed Σ Fire');
assert.equal(displayScrapKpi(0, 9), 0, 'fallback to manual for KPI is forbidden');
assert.notEqual(displayScrapKpi(12, 5), 12 + 5);

console.log('K4 scrapLabel asserts: PASS');
