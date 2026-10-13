import raw from '../../samples/it-n2.json';
import { LangTest } from '../shared/test-schema';

export const sampleTest = LangTest.parse(raw);
