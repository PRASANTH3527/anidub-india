import { spawn } from 'child_process';

// Filter and transform arguments from npm (e.g. --host=0.0.0.0 or --host 0.0.0.0 -> -H 0.0.0.0)
const rawArgs = process.argv.slice(2);
const cleanArgs = [];

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg.startsWith('--host=')) {
    const host = arg.split('=')[1];
    cleanArgs.push('-H', host);
  } else if (arg === '--host') {
    if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) {
      cleanArgs.push('-H', rawArgs[++i]);
    }
  } else if (arg.startsWith('--port=')) {
    const port = arg.split('=')[1];
    cleanArgs.push('-p', port);
  } else if (arg === '--port') {
    if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) {
      cleanArgs.push('-p', rawArgs[++i]);
    }
  } else {
    cleanArgs.push(arg);
  }
}

// Default port to 3000 if not specified
if (!cleanArgs.includes('-p') && !cleanArgs.includes('--port')) {
  cleanArgs.push('-p', process.env.PORT || '3000');
}

// Default hostname to 0.0.0.0 if not specified
if (!cleanArgs.includes('-H') && !cleanArgs.includes('--hostname')) {
  cleanArgs.push('-H', '0.0.0.0');
}

console.log('[Dev Runner] Starting Next.js with arguments:', cleanArgs);

const child = spawn('npx', ['next', 'dev', ...cleanArgs], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
