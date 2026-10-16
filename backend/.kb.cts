const { buildSome } = require('./features/knowledge/index');
(async () => {
  for (let round = 1; round <= 40; round++) {
    const r = await buildSome(60_000);
    process.stdout.write(`round ${round}: read ${r.read}, personas ${r.personas}, left ${r.left}${r.failures?.length ? ', failures ' + r.failures.join(',') : ''}\n`);
    if (!r.left) break;
  }
})();
