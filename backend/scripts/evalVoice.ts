// scripts/evalVoice.ts
// `npm run eval:voice [-- --out evals/2026-09-19.json --min 0.8 --voice gentle]`
//
// Writes the full report as JSON so two runs can be diffed, prints the summary,
// and exits 1 when the pass rate is under --min (default 0.8).
import dotenv from 'dotenv';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { formatReport, runVoiceEval } from '../src/evals/runVoiceEval.js';
import { VOICE_CASES, VOICES } from '../src/evals/voiceCases.js';
import { VoiceT } from '../src/types/user/UserPreferences.js';

dotenv.config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. This eval calls the real API.');
  process.exit(2);
}

const min = Number(arg('min') ?? 0.8);
const voiceArg = arg('voice');
const caseArg = arg('case');
const out = arg('out') ?? path.join('evals', `voice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);

const voices = voiceArg ? (voiceArg.split(',') as VoiceT[]) : VOICES;
const cases = caseArg ? VOICE_CASES.filter(c => caseArg.split(',').includes(c.id)) : VOICE_CASES;
if (cases.length === 0) {
  console.error(`no cases matched "${caseArg}". known: ${VOICE_CASES.map(c => c.id).join(', ')}`);
  process.exit(2);
}

console.log(`running ${cases.length} cases x ${voices.length} voices...`);
const report = await runVoiceEval({ cases, voices });
console.log('');
console.log(formatReport(report));

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(report, null, 2));
console.log(`\nwrote ${out}`);

if (report.pass_rate < min) {
  console.error(`\npass rate ${report.pass_rate} is below --min ${min}`);
  process.exit(1);
}
