// Stands in for the Claude CLI in tests. Behaviour is chosen by FAKE_CLAUDE_MODE.
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  const mode = process.env.FAKE_CLAUDE_MODE ?? 'ok';
  const args = process.argv.slice(2).join(' ');

  if (mode === 'ok') {
    const result =
      '```json\n{"echo": ' +
      JSON.stringify(input.slice(0, 20)) +
      ', "args": ' +
      JSON.stringify(args) +
      '}\n```';
    process.stdout.write(JSON.stringify({ is_error: false, result }));
  } else if (mode === 'not-logged-in') {
    process.stdout.write(
      JSON.stringify({
        is_error: true,
        result: 'Not logged in · Please run /login',
      }),
    );
  } else if (mode === 'garbage') {
    process.stdout.write('this is not json');
    process.stderr.write('something broke');
  } else if (mode === 'hang') {
    setTimeout(() => {}, 60_000);
  }
});
