const esbuild = require('esbuild');
const path = require('path');
const { execSync } = require('child_process');

const isDev = process.argv[2] === 'dev';
const schemaPath = path.join(__dirname, '../../shared/schemas/api.openapi.yaml');
const typesPath = path.join(__dirname, '../../shared/generated/api-types.ts');

async function build() {
  const startTime = Date.now();

  // Validate OpenAPI spec and generate types
  try {
    console.log('Validating OpenAPI spec...');
    execSync(
      `npx @redocly/cli lint ${schemaPath} --skip-rule operation-4xx-response --skip-rule security-defined --skip-rule no-server-example.com --skip-rule info-license`,
      { stdio: 'pipe', cwd: path.join(__dirname, '../..') }
    );
    console.log('Generating TypeScript types from OpenAPI...');
    execSync(
      `npx openapi-typescript ${schemaPath} -o ${typesPath}`,
      { stdio: 'pipe', cwd: path.join(__dirname, '../..') }
    );
    console.log('OpenAPI types generated successfully');
  } catch (err) {
    console.error('OpenAPI validation/generation failed:', err.stderr?.toString() || err.message);
    process.exit(1);
  }

  await esbuild.build({
    entryPoints: [path.join(__dirname, 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: path.join(__dirname, 'dist', 'index.js'),
    external: [
      '@aws-sdk/*',
      'aws-lambda',
    ],
    sourcemap: isDev ? 'inline' : true,
    minify: !isDev,
    format: 'cjs',
  });

  const elapsed = Date.now() - startTime;
  console.log(`Built in ${elapsed}ms (${isDev ? 'dev' : 'prod'})`);
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
