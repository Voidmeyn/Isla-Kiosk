import { spawn } from 'node:child_process';

const server = spawn(process.execPath, ['server.js'], {
  stdio: 'inherit',
  env: { ...process.env, HOST: '0.0.0.0' },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}

server.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : code || 0;
});
