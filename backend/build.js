// Bundles the Lambda for local runs and inspection. The deployed bundle is
// built by NodejsFunction in infra/ with the same target, so the two match.
// The API contract is generated separately (`just contract`).
const path = require('node:path');
const esbuild = require('esbuild');

const dev = process.argv[2] === 'dev';

esbuild
  .build({
    entryPoints: [path.join(__dirname, 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: path.join(__dirname, 'dist', 'index.js'),
    external: ['@aws-sdk/*'],
    sourcemap: dev ? 'inline' : true,
    minify: !dev,
    logLevel: 'info',
  })
  .catch(() => process.exit(1));
