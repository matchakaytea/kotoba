export type FuriganaPart = { text: string; ruby?: string; target?: boolean };

/** Splits Anki furigana such as `妹[いもうと]は<b> 高校[こうこう]</b>` into display parts. */
export function parseFurigana(source: string): FuriganaPart[] {
  const parts: FuriganaPart[] = [];
  let target = false;
  const tokens = source.split(/(<\/?b>)/);
  for (const token of tokens) {
    if (token === '<b>') {
      target = true;
      continue;
    }
    if (token === '</b>') {
      target = false;
      continue;
    }
    const pattern =
      /\s?([^\s[\]]+?)\[([^\]]+)\]|([^[\]]+?)(?=\s?[^\s[\]]+\[|$)/gu;
    for (const match of token.replace(/<[^>]+>/g, '').matchAll(pattern)) {
      if (match[1]) {
        parts.push({
          text: match[1],
          ruby: match[2],
          ...(target ? { target } : {}),
        });
      } else if (match[3]) {
        const text = match[3].replace(/ /g, '');
        if (text) parts.push({ text, ...(target ? { target } : {}) });
      }
    }
  }
  return parts;
}
