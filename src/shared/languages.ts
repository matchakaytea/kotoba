import { z } from 'zod';

export const Language = z.enum(['en', 'zh-Hans', 'zh-Hant', 'ko']);

export type Language = z.infer<typeof Language>;

export const LANGUAGES: { code: Language; name: string; english: string }[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'zh-Hans', name: '简体中文', english: 'Simplified Chinese' },
  { code: 'zh-Hant', name: '繁體中文', english: 'Traditional Chinese' },
  { code: 'ko', name: '한국어', english: 'Korean' },
];
