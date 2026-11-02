import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

test('client builds with ordinary CSS and no Tailwind packages or compiler directives', () => {
  const pkg = JSON.parse(readFileSync('client/package.json', 'utf8'));
  assert.ok(
    !Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((name) =>
      /tailwind/i.test(name),
    ),
  );
  assert.doesNotMatch(
    readFileSync('bun.lock', 'utf8'),
    /"(?:@tailwindcss\/[^"]+|tailwindcss|tailwind-merge)"\s*:/,
  );
  assert.doesNotMatch(readFileSync('client/vite.config.ts', 'utf8'), /tailwind/i);
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (path.endsWith('.css'))
        assert.doesNotMatch(
          readFileSync(path, 'utf8'),
          /@(?:theme|tailwind|apply|screen)\b|--tw-|tailwindcss/,
          path,
        );
    }
  }
  walk('client/src');
});

test('component class expressions contain semantic CSS classes rather than utility syntax', () => {
  const utility =
    /^(?:flex|grid|hidden|block|inline-flex|relative|absolute|fixed|sticky|truncate|sr-only|underline|uppercase|outline-none|(?:[a-z]+:|\[&)|(?:bg|gap|p[xytrbl]?|m[xytrbl]?|w|h|min-w|min-h|max-w|max-h|size|rounded|border|items|justify|overflow|space|transition|duration|ring|shadow|z)-|text-(?:xs|sm|base|lg|xl|[2-7]xl|\[|accent|danger|success|foreground|muted|faint|center|left)|font-(?:display|mono|bold|medium|semibold))$/;
  // Prefix rules also capture utility values; semantic names such as ui-button remain unconstrained.
  const prefix =
    /^(?:bg|gap|p[xytrbl]?|m[xytrbl]?|w|h|min-w|min-h|max-w|max-h|size|rounded|border|items|justify|overflow|space|transition|duration|ring|shadow|z)-/;
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!path.endsWith('.tsx')) continue;
      const source = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function strings(node) {
        if (ts.isStringLiteralLike(node)) {
          for (const token of node.text.split(/\s+/))
            assert.ok(
              !utility.test(token) && !prefix.test(token) && !token.includes(':'),
              path + ': ' + token,
            );
        }
        ts.forEachChild(node, strings);
      }
      function visit(node) {
        if (
          ts.isJsxAttribute(node) &&
          node.name.getText(source) === 'className' &&
          node.initializer
        )
          strings(node.initializer);
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'cva') strings(node);
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  walk('client/src');
});
