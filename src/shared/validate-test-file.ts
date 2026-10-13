import { LangTest } from './test-schema';

export type ValidationResult =
  | { ok: true; test: LangTest }
  | { ok: false; errors: string[] };

export function validateTestFile(text: string): ValidationResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }

  const result = LangTest.safeParse(data);
  if (result.success) {
    return { ok: true, test: result.data };
  }
  return { ok: false, errors: result.error.issues.map(formatIssue) };
}

function formatIssue(issue: { path: PropertyKey[]; message: string }): string {
  const [first, second, ...rest] = issue.path;
  if (first === 'questions' && typeof second === 'number') {
    const where = rest.length > 0 ? ` → ${formatPath(rest)}` : '';
    return `Question ${second + 1}${where}: ${issue.message}`;
  }
  if (issue.path.length === 0) {
    return issue.message;
  }
  return `${formatPath(issue.path)}: ${issue.message}`;
}

function formatPath(path: PropertyKey[]): string {
  return path
    .map((key, i) =>
      typeof key === 'number'
        ? `[${key}]`
        : i === 0
          ? String(key)
          : `.${String(key)}`,
    )
    .join('');
}
