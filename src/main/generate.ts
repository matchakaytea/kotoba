import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type ClaudeCommand = {
  command: string;
  args: string[];
  shell: boolean;
};

const TIMEOUT_MS = 5 * 60 * 1000;

export function findClaude(env = process.env): ClaudeCommand | null {
  const candidates = [
    env.KOTOBA_CLAUDE_PATH,
    ...onPath(env.PATH ?? ''),
    standaloneInstall(env.USERPROFILE ?? env.HOME),
    newestDesktopCopy(env.APPDATA),
  ];
  const found = candidates.find((file) => file && fs.existsSync(file));
  if (!found) return null;
  return {
    command: found,
    args: [],
    shell: /\.(cmd|bat)$/i.test(found),
  };
}

function onPath(pathVariable: string): string[] {
  const names =
    process.platform === 'win32' ? ['claude.exe', 'claude.cmd'] : ['claude'];
  return pathVariable
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((dir) => names.map((name) => path.join(dir, name)));
}

function standaloneInstall(home: string | undefined): string | undefined {
  if (!home) return undefined;
  const name = process.platform === 'win32' ? 'claude.exe' : 'claude';
  return path.join(home, '.local', 'bin', name);
}

function newestDesktopCopy(appData: string | undefined): string | undefined {
  if (!appData) return undefined;
  const root = path.join(appData, 'Claude', 'claude-code');
  if (!fs.existsSync(root)) return undefined;
  const copies = fs
    .readdirSync(root)
    .flatMap((version) => {
      const versionDir = path.join(root, version);
      if (!fs.statSync(versionDir).isDirectory()) return [];
      return fs
        .readdirSync(versionDir)
        .map((build) => path.join(versionDir, build, 'claude.exe'))
        .filter((file) => fs.existsSync(file));
    })
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return copies[0];
}

export function runClaude(
  claude: ClaudeCommand,
  prompt: string,
  cwd: string,
  timeoutMs = TIMEOUT_MS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = claude.shell ? `"${claude.command}"` : claude.command;
    const child = spawn(
      command,
      [...claude.args, '-p', '--output-format', 'json'],
      {
        cwd,
        shell: claude.shell,
        windowsHide: true,
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.stderr.on('data', (chunk: string) => (stderr += chunk));

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Claude took longer than 5 minutes and was stopped.'));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', () => {
      clearTimeout(timer);
      try {
        resolve(readResult(stdout));
      } catch (error) {
        if (error instanceof ClaudeReportedError) {
          reject(error);
          return;
        }
        const detail = stderr.trim() || stdout.trim();
        reject(
          new Error(
            `${(error as Error).message}${detail ? `\n${detail.slice(0, 500)}` : ''}`,
          ),
        );
      }
    });

    child.stdin.end(prompt, 'utf8');
  });
}

export function readResult(stdout: string): string {
  let parsed: { is_error?: boolean; result?: unknown };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error('Claude did not return its usual JSON output.');
  }
  if (typeof parsed.result !== 'string') {
    throw new Error('Claude returned no result.');
  }
  if (parsed.is_error) {
    throw new ClaudeReportedError(parsed.result);
  }
  return parsed.result;
}

export class ClaudeReportedError extends Error {
  constructor(result: string) {
    const hint = /not logged in|\/login/i.test(result)
      ? ' Open a terminal, run the Claude CLI once and sign in with /login, then try again.'
      : '';
    super(`Claude reported an error: ${result}.${hint}`);
  }
}

export function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return text.trim();
  return text.slice(start, end + 1);
}
