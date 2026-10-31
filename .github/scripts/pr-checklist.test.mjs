import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePullRequest } from './pr-checklist.mjs';

const CHECKLIST = [
  '- [x] Scope is limited to the linked issue (deferred items listed below)',
  '- [x] No secrets, tokens, keys, or credentials committed',
  '- [x] Docs cross-references re-checked (`ui-spec.md` / `api-spec.md` / `tests.md` route + count claims)',
  '- [x] `docs/lab-04/reviewer.md` updated when a review decision changed',
].join('\n');

const VALID_EVIDENCE = [
  '- `pnpm --filter server exec vitest run` → 239/239 passed.',
  '- `pnpm --filter client exec playwright test tests/e2e/lab-04/` → 33/33 passed.',
].join('\n');

function makeBody(overrides = {}) {
  const {
    linked = 'Closes #144',
    summary = '- Adds the required PR checklist check.',
    screenshots = 'N/A — docs/workflow-only (no UI changes).',
    evidence = VALID_EVIDENCE,
    checklist = CHECKLIST,
  } = overrides;

  return [
    '## Linked issue',
    '',
    linked,
    '',
    '## Summary',
    '',
    summary,
    '',
    '## UI screenshots',
    '',
    screenshots,
    '',
    '## Test evidence',
    '',
    evidence,
    '',
    '## Excluded-Scope checklist',
    '',
    checklist,
    '',
    '## Excluded scope',
    '',
    '- None.',
  ].join('\n');
}

const expectPass = (result) => {
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.deepEqual(result.errors, []);
};

const expectFail = (result, pattern) => {
  assert.equal(result.ok, false, 'expected validation to fail');
  assert.ok(result.errors.some((error) => pattern.test(error)), result.errors.join('\n'));
};

test('valid docs-only body passes', () => {
  expectPass(validatePullRequest({ body: makeBody() }));
});

test('CRLF bodies pass', () => {
  expectPass(validatePullRequest({ body: makeBody().replace(/\n/g, '\r\n') }));
});

test('draft PRs skip validation', () => {
  const result = validatePullRequest({ body: 'draft', draft: true });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
});

test('checklist items are matched without markdown backticks', () => {
  const checklist = CHECKLIST.replace('`docs/lab-04/reviewer.md`', 'docs/lab-04/reviewer.md');
  expectPass(validatePullRequest({ body: makeBody({ checklist }) }));
});

test('code fences do not create phantom sections', () => {
  const evidence = ['```text', '## Summary', 'server 239/239 passed', '```', VALID_EVIDENCE].join('\n');
  expectPass(validatePullRequest({ body: makeBody({ evidence }) }));
});

test('UI change accepts a markdown image', () => {
  expectPass(
    validatePullRequest({
      body: makeBody({ screenshots: '![Staff dashboard](https://example.com/staff-dashboard.png)' }),
      uiChanged: true,
    }),
  );
});

test('UI change accepts a GitHub user attachment link', () => {
  expectPass(
    validatePullRequest({
      body: makeBody({ screenshots: '![Mobile queue](https://github.com/user-attachments/assets/abc123-def456)' }),
      uiChanged: true,
    }),
  );
});

test('UI change accepts an HTML image', () => {
  expectPass(
    validatePullRequest({
      body: makeBody({ screenshots: '<img src="https://example.com/requester-dashboard.png" alt="requester dashboard">' }),
      uiChanged: true,
    }),
  );
});

test('UI change accepts a linked image URL', () => {
  expectPass(
    validatePullRequest({
      body: makeBody({ screenshots: '[Requester dashboard](https://example.com/requester-dashboard.png)' }),
      uiChanged: true,
    }),
  );
});

test('UI change accepts a relative committed screenshot path', () => {
  expectPass(
    validatePullRequest({
      body: makeBody({ screenshots: '![Staff detail](../docs/lab-04/images/staff-detail-1280.png)' }),
      uiChanged: true,
    }),
  );
});

test('missing linked issue fails', () => {
  expectFail(validatePullRequest({ body: makeBody({ linked: 'No issue linked.' }) }), /Linked issue/);
});

test('empty summary fails', () => {
  expectFail(validatePullRequest({ body: makeBody({ summary: '-' }) }), /Summary/);
});

test('placeholder summary fails', () => {
  expectFail(validatePullRequest({ body: makeBody({ summary: 'pending' }) }), /cannot be a placeholder/);
});

test('empty screenshots fail', () => {
  expectFail(validatePullRequest({ body: makeBody({ screenshots: '-' }) }), /UI screenshots/);
});

test('UI change rejects N/A', () => {
  expectFail(
    validatePullRequest({ body: makeBody({ screenshots: 'N/A — docs only' }), uiChanged: true }),
    /cannot be `N\/A`/,
  );
});

test('UI change rejects pending screenshots', () => {
  expectFail(
    validatePullRequest({ body: makeBody({ screenshots: 'pending' }), uiChanged: true }),
    /placeholder text/,
  );
});

test('UI change rejects screenshots coming soon', () => {
  expectFail(
    validatePullRequest({ body: makeBody({ screenshots: 'screenshots coming soon' }), uiChanged: true }),
    /placeholder text/,
  );
});

test('UI change rejects non-image text', () => {
  expectFail(
    validatePullRequest({ body: makeBody({ screenshots: 'I checked the screens locally.' }), uiChanged: true }),
    /must include at least one image or attachment link/,
  );
});

test('UI change rejects a plain link that is not an image', () => {
  expectFail(
    validatePullRequest({
      body: makeBody({ screenshots: '[Design doc](https://example.com/design-doc)' }),
      uiChanged: true,
    }),
    /must include at least one image or attachment link/,
  );
});

test('non-UI change accepts N/A with a reason', () => {
  expectPass(validatePullRequest({ body: makeBody({ screenshots: 'N/A — docs/workflow only.' }) }));
});

test('non-UI change rejects a bare N/A', () => {
  expectFail(validatePullRequest({ body: makeBody({ screenshots: 'N/A' }) }), /without a concrete reason/);
});

test('non-UI change rejects an N/A placeholder reason', () => {
  expectFail(validatePullRequest({ body: makeBody({ screenshots: 'N/A — pending' }) }), /without a concrete reason/);
});

test('non-UI change rejects evidence-free screenshot text', () => {
  expectFail(validatePullRequest({ body: makeBody({ screenshots: 'screenshots coming soon' }) }), /placeholder text/);
});

test('empty test evidence fails', () => {
  expectFail(validatePullRequest({ body: makeBody({ evidence: '-' }) }), /Test evidence/);
});

test('pending test evidence fails', () => {
  expectFail(validatePullRequest({ body: makeBody({ evidence: 'pending' }) }), /placeholder text/);
});

test('to-do test evidence fails', () => {
  expectFail(validatePullRequest({ body: makeBody({ evidence: 'to do' }) }), /placeholder text/);
});

test('test evidence without counts fails', () => {
  expectFail(
    validatePullRequest({ body: makeBody({ evidence: 'All tests pass on my machine.' }) }),
    /must include a suite\/command and outcome counts/,
  );
});

test('test evidence counts without a suite or command fail', () => {
  expectFail(validatePullRequest({ body: makeBody({ evidence: '239/239' }) }), /must include a suite\/command and outcome counts/);
});

test('test evidence commands without counts fail', () => {
  expectFail(validatePullRequest({ body: makeBody({ evidence: 'vitest run' }) }), /must include a suite\/command and outcome counts/);
});

test('test evidence with suite and counts passes', () => {
  expectPass(validatePullRequest({ body: makeBody({ evidence: 'server 239/239 passed' }) }));
});

test('unchecked checklist item fails', () => {
  const checklist = CHECKLIST.replace(
    '- [x] No secrets, tokens, keys, or credentials committed',
    '- [ ] No secrets, tokens, keys, or credentials committed',
  );
  expectFail(validatePullRequest({ body: makeBody({ checklist }) }), /unchecked/);
});
