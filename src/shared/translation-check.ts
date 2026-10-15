import type { LangTest } from './test-schema';

const JAPANESE = /[぀-ヿ㐀-鿿々〆ー]+/g;

export function checkTranslation(
  original: LangTest,
  translated: LangTest,
): string[] {
  const problems: string[] = [];

  if (translated.test_id !== original.test_id) {
    problems.push('test_id changed');
  }
  if (translated.questions.length !== original.questions.length) {
    problems.push(
      `question count changed from ${original.questions.length} to ${translated.questions.length}`,
    );
    return problems;
  }

  original.questions.forEach((before, i) => {
    const after = translated.questions[i];
    const where = `Question ${i + 1}`;

    if (after.template !== before.template) {
      problems.push(`${where}: template changed`);
      return;
    }
    if (JSON.stringify(after.targets) !== JSON.stringify(before.targets)) {
      problems.push(`${where}: targets changed`);
    }

    if (before.template === 'reading' && after.template === 'reading') {
      if (
        after.prompt !== before.prompt ||
        JSON.stringify(after.answers) !== JSON.stringify(before.answers) ||
        after.context !== before.context
      ) {
        problems.push(`${where}: reading question changed`);
      }
      return;
    }

    if (
      before.template === 'multiple_choice' &&
      after.template === 'multiple_choice'
    ) {
      if (after.answer_index !== before.answer_index) {
        problems.push(`${where}: answer_index changed`);
      }
      if (after.options.length !== before.options.length) {
        problems.push(`${where}: number of options changed`);
        return;
      }
      before.options.forEach((option, j) => {
        if (JAPANESE.test(option) && after.options[j] !== option) {
          problems.push(`${where}: Japanese option ${j + 1} changed`);
        }
        JAPANESE.lastIndex = 0;
      });
      for (const word of new Set(before.prompt.match(JAPANESE) ?? [])) {
        if (!after.prompt.includes(word)) {
          problems.push(
            `${where}: Japanese text “${word}” missing from the prompt`,
          );
        }
      }
    }
  });

  return problems;
}
