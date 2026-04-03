const { watch } = require('fs');
const { exec } = require('child_process');
const path = require('path');

const repoDir = __dirname;
const debounceMs = 1000;
let debounceTimer = null;

const ignorePatterns = ['.git', 'node_modules', '.vscode', 'auto-push.js'];

function isIgnored(filePath) {
  return ignorePatterns.some((part) => filePath.includes(path.join(repoDir, part)));
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function runCommand(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, opts, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function syncGit() {
  try {
    const status = await runCommand('git status --porcelain', { cwd: repoDir });
    if (!status.stdout.trim()) {
      log('No unstaged changes detected; skipping commit/push.');
      return;
    }

    log('Changes detected, running git add/commit/push...');
    await runCommand('git add -A', { cwd: repoDir });
    await runCommand('git commit -m "Auto-sync changes from Live Server"', { cwd: repoDir });
    await runCommand('git push origin main', { cwd: repoDir });
    log('Auto-sync complete.');
  } catch (err) {
    log('Git sync failed:', err.stderr || err.error || err);
  }
}

watch(repoDir, { recursive: true }, (eventType, filename) => {
  if (!filename) return;

  const fullPath = path.join(repoDir, filename);
  if (isIgnored(fullPath)) return;

  log('FS event:', eventType, filename);

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(syncGit, debounceMs);
});

log('Watching', repoDir, 'for file changes.');
log('Note: Keep this script running while editing, and save files to trigger sync.');