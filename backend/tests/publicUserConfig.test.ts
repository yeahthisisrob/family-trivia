import { toPublicUserConfig } from '../services/users';

test('passphrases never reach players', () => {
  const out = toPublicUserConfig({
    version: '1',
    lastUpdated: '2026-01-01',
    users: { alice: { group: 'g', color: '#000', passphrase: 'happy-tiger', isAdmin: true } },
  });
  expect(out.users.alice).toEqual({ group: 'g', color: '#000', isAdmin: true });
  expect(JSON.stringify(out)).not.toContain('happy-tiger');
});
