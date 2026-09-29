/**
 * Ставит зависимости server и client при выполнении `npm install` в корне.
 * Ошибки не блокируют установку корневого пакета: в конце выводится подсказка.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const alreadyInstalled = ['server/node_modules', 'client/node_modules'].every((dir) => existsSync(join(root, dir)));
const skip = process.env.DUTY_HUB_SKIP_INSTALL === '1' || process.env.npm_config_ignore_scripts === 'true';

if (skip) {
  process.exit(0);
}

if (alreadyInstalled) {
  console.log('[postinstall] Зависимости server и client уже установлены.');
  process.exit(0);
}

for (const prefix of ['server', 'client']) {
  const result = spawnSync(npm, ['--prefix', join(root, prefix), 'install', '--no-audit', '--no-fund'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.warn(`[postinstall] Не удалось поставить зависимости в ${prefix}. Выполните вручную: npm run install:all`);
  }
}
