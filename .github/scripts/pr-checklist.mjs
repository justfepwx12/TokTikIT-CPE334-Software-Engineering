import { pathToFileURL } from 'node:url';

const REQUIRED_CHECKS = [
  'Scope is limited to the linked issue',
  'No secrets, tokens, keys, or credentials committed',
  'Docs cross-references re-checked',
  '`docs/lab-04/reviewer.md` updated when a review decision changed',
];

const PLACEHOLDER = /^(?:pending|todo|to do|tbd|tba|n\/?a|none|nothing|wip|work in progress|coming soon|screenshots? coming soon|screenshots? pending|will (?:add|attach|provide|run|update|do)(?: .{0,80})?|not run|not yet|placeholder|no evidence(?: yet)?|later|soon)$/i;

const COUNT = /\b\d{1,5}\s*\/\s*\d{1,5}\b|\b\d{1,5}\s+(?:tests?|cases?|suites?|runs?|passed|passing|failed|skipped)\b|\b(?:passed|failed|skipped)\s*[:=]?\s*\d{1,5}\b/i;

const TEST_COMMAND = /\b(?:vitest|jest|playwright|pnpm|npm|yarn|tsc|eslint|lint|build|prisma|test|tests|suite|server|client|e2e|unit|migration|workflow|rtl|api)\b/i;

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?(?:https?:\/\/[^\s)>]+|(?:\.{0,2}\/)?[^\s)>]+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s)>]*)?)>?\s*(?:"[^"]*")?\s*\)/i;

const MARKDOWN_IMAGE_LINK = /\[[^\]]*\]\(\s*<?(?:https?:\/\/[^\s)>]+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s)>]*)?|(?:\.{0,2}\/)?[^\s)>]+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s)>]*)?)>?\s*(?:"[^"]*")?\s*\)/i;

const HTML_IMAGE = /<img\b[^>]*\bsrc\s*=\s*(?:"(?:https?:\/\/[^"]+|(?:\.{0,2}\/)?[^"]+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^"]*)?)"|'(?:https?:\/\/[^']+|(?:\.{0,2}\/)?[^']+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^']*)?)'|(?:https?:\/\/\S+|(?:\.{0,2}\/)?\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?))/i;

const GITHUB_ATTACHMENT = /https?:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+/i;

const BARE_IMAGE = /https?:\/\/[^\s)<]+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s)<]*)?/i;

const NA_REASON = /^(?:n\/a|not applicable)\s*(?:[—–:-]\s*)?(.+)$/i;

const BAD_NA_REASON = /^(?:pending|todo|to do|tbd|tba|coming soon|will\b|later|soon|not yet|none|nothing)\b/i;

export const normalize = (value) => value.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const stripComments = (body) => (body || '').replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');

const meaningful = (text) =>
  (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^[-*+]\s*$/.test(line) && !/^-\s*\[\s*\]\s*$/.test(line))
    .join('\n')
    .trim();

const isPlaceholder = (text) => {
  const value = normalize(meaningful(text)).replace(/[.!?,;:]+$/g, '').trim();
  return !value || PLACEHOLDER.test(value);
};

const hasImageEvidence = (text) =>
  MARKDOWN_IMAGE.test(text) ||
  MARKDOWN_IMAGE_LINK.test(text) ||
  HTML_IMAGE.test(text) ||
  GITHUB_ATTACHMENT.test(text) ||
  BARE_IMAGE.test(text);

const hasNaReason = (text) => {
  const match = normalize(meaningful(text)).match(NA_REASON);
  if (!match) return false;
  const reason = match[1].trim();
  return reason.length >= 5 && /[a-z]/i.test(reason) && !BAD_NA_REASON.test(reason);
};

const hasTestResults = (text) => COUNT.test(text) && TEST_COMMAND.test(text);

const parseSections = (body) => {
  const cleaned = stripComments(body);
  const lines = cleaned.split('\n');
  const headings = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) headings.push({ name: match[1].trim().toLowerCase(), line: index });
  }

  const sections = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const start = headings[index].line + 1;
    const end = index + 1 < headings.length ? headings[index + 1].line : lines.length;
    sections.set(headings[index].name, lines.slice(start, end).join('\n'));
  }
  return { sections, cleaned };
};

export function validatePullRequest({ body, uiChanged = false, draft = false } = {}) {
  if (draft) return { ok: true, skipped: true, errors: [] };

  const errors = [];
  const { sections } = parseSections(body);
  const getSection = (name) => sections.get(name.toLowerCase()) ?? null;

  const linkedIssue = meaningful(getSection('Linked issue'));
  if (!/^\s*(?:Closes|Fixes|Resolves)\s+#\d+/im.test(linkedIssue)) {
    errors.push('`## Linked issue` must contain `Closes #<issue-number>` (or Fixes/Resolves).');
  }

  const summary = meaningful(getSection('Summary'));
  if (!summary) {
    errors.push('`## Summary` must describe what changed and the key decisions.');
  } else if (isPlaceholder(summary)) {
    errors.push('`## Summary` cannot be a placeholder such as `pending`, `TBD`, or `to do`.');
  }

  const screenshots = meaningful(getSection('UI screenshots'));
  if (!screenshots) {
    errors.push('`## UI screenshots` is required — attach a live-stack image/attachment link, or `N/A — <reason>` when no UI changed.');
  } else if (uiChanged) {
    if (/^N\/A\b/i.test(screenshots)) {
      errors.push('UI files changed, so `## UI screenshots` cannot be `N/A` — attach at least one image/attachment link from the live stack.');
    } else if (isPlaceholder(screenshots)) {
      errors.push('`## UI screenshots` cannot be placeholder text such as `pending`, `screenshots coming soon`, or `to do`.');
    } else if (!hasImageEvidence(screenshots)) {
      errors.push('UI files changed, so `## UI screenshots` must include at least one image or attachment link (e.g. `![staff dashboard](https://github.com/user-attachments/assets/...)`).');
    }
  } else if (hasImageEvidence(screenshots)) {
    // Evidence present; no further action.
  } else if (/^(?:n\/a|not applicable)\b/i.test(normalize(meaningful(screenshots)))) {
    if (!hasNaReason(screenshots)) {
      errors.push('`## UI screenshots` uses `N/A` without a concrete reason — use `N/A — <short reason>` (e.g. `N/A — docs only`).');
    }
  } else if (isPlaceholder(screenshots)) {
    errors.push('`## UI screenshots` cannot be placeholder text such as `pending`, `screenshots coming soon`, or `to do`.');
  } else {
    errors.push('`## UI screenshots` must be an image/attachment link or `N/A — <short reason>` (e.g. `N/A — docs only`).');
  }

  const evidence = meaningful(getSection('Test evidence'));
  if (!evidence) {
    errors.push('`## Test evidence` must list the suites/commands you ran and their outcome counts.');
  } else if (isPlaceholder(evidence)) {
    errors.push('`## Test evidence` cannot be placeholder text such as `pending` or `to do`.');
  } else if (!hasTestResults(evidence)) {
    errors.push('`## Test evidence` must include a suite/command and outcome counts (e.g. `pnpm --filter server exec vitest run` → `239/239 passed`).');
  }

  const excludedScopeChecklist = getSection('Excluded-Scope checklist');
  if (excludedScopeChecklist === null) {
    errors.push('`## Excluded-Scope checklist` section is required.');
  } else {
    const checkedItems = excludedScopeChecklist
      .split('\n')
      .map((line) => line.match(/^\s*[-*+]\s*\[[xX]\]\s*(.*)$/))
      .filter(Boolean)
      .map((match) => normalize(match[1]));

    for (const item of REQUIRED_CHECKS) {
      if (!checkedItems.some((checked) => checked.includes(normalize(item)))) {
        errors.push(`Excluded-Scope checklist item is unchecked: "${item}".`);
      }
    }
  }

  return { ok: errors.length === 0, skipped: false, errors };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const result = validatePullRequest({
    body: process.env.PR_BODY || '',
    uiChanged: process.env.UI_CHANGED === 'true',
    draft: process.env.PR_DRAFT === 'true',
  });

  if (result.skipped) {
    console.log('Draft PR — checklist validation will run when it is marked ready for review.');
    process.exit(0);
  }

  if (!result.ok) {
    console.error(['PR checklist is incomplete:', ...result.errors.map((error) => `- ${error}`)].join('\n'));
    process.exit(1);
  }

  console.log('PR checklist is complete.');
}
