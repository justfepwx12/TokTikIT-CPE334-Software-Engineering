import { execSync } from 'node:child_process';

// E2E accounts are rotated to their known E2E password on first login. If a
// previous run (or a manual demo) left a different password, the helpers can
// no longer recover. Re-seed once per run so every suite starts from the
// documented demo state; the seed is idempotent and preserves user data.
export default function globalSetup(): void {
  execSync('pnpm --filter server exec tsx prisma/seed.ts', {
    stdio: 'inherit',
    timeout: 120_000,
  });
}
