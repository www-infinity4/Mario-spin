'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');
const deploy = read('.github/workflows/deploy.yml');
const browserConfig = read('assets/cfg.js');

test('public Pages build cannot interpolate GitHub secrets into browser assets', () => {
  assert.doesNotMatch(deploy, /\$\{\{\s*secrets\./i);
  assert.doesNotMatch(deploy, /Inject GHP token|GHP token injected/i);
  assert.match(deploy, /window\.MARIO_SPIN_TOKEN\s*=\s*""\s*;/);
  assert.match(deploy, /contents:\s*read/);
});

test('browser configuration starts without a credential or secret-injection instructions', () => {
  assert.match(browserConfig, /window\.MARIO_SPIN_TOKEN\s*=\s*window\.MARIO_SPIN_TOKEN\s*\|\|\s*""\s*;/);
  assert.doesNotMatch(browserConfig, /\bGHP\b|secret is injected|token only needs Actions/i);
  assert.doesNotMatch(browserConfig, /(?:gh[pousr]_|github_pat_)[a-z0-9_]{12,}/i);
});

test('release instructions describe local-only records and credential recovery', () => {
  const readme = read('README.md');
  assert.match(readme, /revoke that personal access token/i);
  assert.match(readme, /Automatic browser-to-GitHub writes are unavailable/i);
  assert.match(readme, /Simulated BTC entries do not represent Bitcoin mining/i);
  assert.doesNotMatch(readme, /GHP token is embedded in the deployed JavaScript/i);
});
