// Writes tools/tts/lines.json: the bake-off's lines, spoken as the game speaks them, by the game's own
// code. Bundled with esbuild and run with node in the repo's node container (README).
import { writeFileSync } from 'node:fs';
import { buildPlan, PACE_RATES } from '$lib/dictation/script';
import { splitChunks } from '$lib/dictation/segment';
import { spokenForm } from '$lib/dictation/spoken';
import { frenchSpacing } from '$lib/text/french';
import { fill } from '$lib/dialogue/select';
import seed from '@content/seed/028-muses-dragon-des-muses.json';
import camp from '@content/dialogue/camp.json';

const plan = buildPlan(seed.body);
const s = plan.sentences[1];
const chunks = splitChunks(s.text);
const chunk = (text: string) => ({ text, spoken: plan.chunks.find((c) => c.text === text)!.spoken });
const line = camp.lines['camp.weekly'][2].text;
const out = {
  source: {
    a: 'content/seed/028-muses-dragon-des-muses.json, sentence 2 (splitSentences), spokenForm',
    b: 'the same sentence, splitChunks chunks 1 and 2, spokenForm',
    c: 'content/dialogue/camp.json camp.weekly[2], fill + frenchSpacing as sayKey renders it (dialogue is not spoken today)',
  },
  slowRate: PACE_RATES[1],
  lines: {
    a: { text: s.text, spoken: spokenForm(s.text, { newParagraph: s.newParagraph }) },
    b1: chunk(chunks[0]),
    b2: chunk(chunks[1]),
    c: { text: line, spoken: frenchSpacing(fill(line, { hero: 'Ariane' })) },
  },
};
writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
