#!/usr/bin/env node
// Leak guard: keeps a real family's details out of a public repo.
//
// Family Trivia runs on a family's own names, places and memories. Fixtures,
// stories, prompts, screenshots and commit messages must use made-up people
// (alice, bob, carol...). gitleaks catches credentials; this catches the
// things that are private without being secret: a name, a hometown, an email.
//
// Two layers:
//   1. Built-in patterns that are never fine in this repo (emails that aren't
//      placeholders, phone numbers, AWS account ids, real OAuth client ids,
//      generated CDK bucket names).
//   2. Your own list in `.leakguard` (gitignored, never committed): one term
//      per line, matched case-insensitively on word boundaries. `# comment`
//      lines are ignored; `!path/glob` lines skip a file (for a dedication you
//      chose to publish). CI can read the same list from LEAKGUARD_TERMS.
//
// Usage:
//   node scripts/leak-guard.mjs                 every tracked file
//   node scripts/leak-guard.mjs --staged        staged files (pre-commit)
//   node scripts/leak-guard.mjs --message FILE  a commit message (commit-msg)
//
// See docs/decisions/0006-privacy-by-default.md.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);

const BUILT_IN = [
  {
    name: 'email address',
    re: /\b[A-Za-z0-9._%+-]+@(?!example\.(?:com|org)|users\.noreply\.github\.com|anthropic\.com)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  { name: 'phone number', re: /(?<![\w.])\(?\b[2-9]\d{2}\)?[-. ]\d{3}[-. ]\d{4}\b/g },
  {
    name: 'AWS account id',
    re: /(?<![\w-])(?!123456789012)\d{12}(?![\w-])/g,
    only: /arn:|account|aws/i,
  },
  { name: 'Google OAuth client id', re: /\b\d{6,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com\b/g },
  {
    name: 'deployed CDK resource name',
    re: /\b[a-z]+stack-[a-z]+bucket[0-9a-f]{8}-[a-z0-9]{12}\b/g,
  },
  { name: 'CloudFront distribution domain', re: /\b(?!your-)[a-z0-9]{13,14}\.cloudfront\.net\b/g },
];

// Files that can't leak a family (lockfiles, binaries) or that hold the rules themselves.
const SKIP = [
  /(^|\/)pnpm-lock\.yaml$/,
  /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|mp3|wav)$/i,
  /^scripts\/leak-guard\.mjs$/,
  /mockServiceWorker\.js$/,
];

function loadList() {
  const raw = [
    existsSync(resolve(ROOT, '.leakguard'))
      ? readFileSync(resolve(ROOT, '.leakguard'), 'utf8')
      : '',
    process.env.LEAKGUARD_TERMS ?? '',
  ].join('\n');
  const terms = [];
  const skips = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (t.startsWith('!')) skips.push(globToRe(t.slice(1)));
    else terms.push(t);
  }
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return {
    re: escaped.length
      ? new RegExp(`(?<![A-Za-z])(?:${escaped.join('|')})(?![A-Za-z])`, 'gi')
      : null,
    skips,
    count: terms.length,
  };
}

function globToRe(glob) {
  return new RegExp(
    `^${glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '\0')
      .replace(/\*/g, '[^/]*')
      .replace(/\0/g, '.*')}$`,
  );
}

function git(...a) {
  return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function targets() {
  const i = args.indexOf('--message');
  if (i >= 0)
    return [
      { path: '(commit message)', text: readFileSync(args[i + 1], 'utf8').replace(/^#.*$/gm, '') },
    ];
  const files = (
    args.includes('--staged')
      ? git('diff', '--cached', '--name-only', '--diff-filter=ACMR')
      : git('ls-files')
  )
    .split('\n')
    .filter(Boolean);
  return files
    .filter((p) => !SKIP.some((re) => re.test(p)))
    .map((p) => ({ path: p, text: args.includes('--staged') ? git('show', `:${p}`) : safeRead(p) }))
    .filter((t) => t.text != null);
}

function safeRead(p) {
  try {
    return readFileSync(resolve(ROOT, p), 'utf8');
  } catch {
    return null;
  }
}

const list = loadList();
const findings = [];
for (const { path, text } of targets()) {
  const lines = text.split('\n');
  lines.forEach((line, n) => {
    for (const rule of BUILT_IN) {
      if (rule.only && !rule.only.test(line)) continue;
      for (const m of line.matchAll(rule.re))
        findings.push({ path, line: n + 1, what: rule.name, hit: m[0] });
    }
    if (list.re && !list.skips.some((re) => re.test(path))) {
      for (const m of line.matchAll(list.re))
        findings.push({ path, line: n + 1, what: 'term from your .leakguard list', hit: m[0] });
    }
  });
}

if (findings.length) {
  process.stderr.write(
    `\nLeak guard: ${findings.length} private detail(s) would be published.\n\n`,
  );
  for (const f of findings) process.stderr.write(`  ${f.path}:${f.line}  ${f.what}: "${f.hit}"\n`);
  process.stderr.write(
    '\nUse made-up people and places (alice, bob, Springfield). If one is a false positive,\nadd "!path" to .leakguard for that file. See docs/decisions/0006-privacy-by-default.md.\n\n',
  );
  process.exit(1);
}
const scope = args.includes('--message')
  ? 'commit message'
  : args.includes('--staged')
    ? 'staged files'
    : 'tracked files';
process.stdout.write(
  `Leak guard: ${scope} clean (${BUILT_IN.length} built-in patterns, ${list.count} private terms).\n`,
);
