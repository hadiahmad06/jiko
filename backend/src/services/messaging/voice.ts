// src/services/messaging/voice.ts
//
// Optional LLM rewrite of a nudge into the user's chosen voice. Off unless
// ANTHROPIC_API_KEY is set; falls back to the template text on any failure so
// a missing key or an outage never silences Jiko.
import { TriggerContext } from '../triggers/context.js';
import { VoiceT } from '../../types/user/UserPreferences.js';
import MessageRepository from '../repositories/MessageRepository.js';

export const VOICE_GUIDES: Record<VoiceT, string> = {
  older_sibling: 'You are the user\'s older sibling. Casual, lowercase, a little teasing, clearly on their side. Short.',
  drill_sergeant: 'You are a drill sergeant who genuinely wants the user to win. Blunt, no softeners, no cruelty. Short.',
  dry_coworker: 'You are a dry, deadpan coworker. Understated, observational, never exclamation marks. Short.',
  gentle: 'You are a kind friend. Warm, encouraging, never guilt-tripping. Short.',
  own_voice: 'Write the way the user texts: lowercase, minimal punctuation, their own slang if any appears in the conversation. Short.',
};

export interface VoiceProvider {
  rewrite(args: { text: string; voice: VoiceT; strictness: number; history: Array<{ role: 'user' | 'assistant'; content: string }>; name: string }): Promise<string>;
}

let provider: VoiceProvider | null | undefined;

async function loadProvider(): Promise<VoiceProvider | null> {
  if (provider !== undefined) return provider;
  if (!process.env.ANTHROPIC_API_KEY) { provider = null; return null; }
  try {
    const mod = await import('./anthropicVoice.js');
    provider = mod.anthropicVoice;
  } catch (err) {
    console.warn('[voice] provider unavailable:', (err as Error).message);
    provider = null;
  }
  return provider;
}

export function setVoiceProviderForTests(p: VoiceProvider | null | undefined) { provider = p; }

export async function voiceRewrite(text: string, ctx: TriggerContext): Promise<string> {
  const p = await loadProvider();
  if (!p) return text;
  try {
    const recent = await MessageRepository.recent(ctx.user_id, 8);
    const history = recent.map(m => ({ role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const, content: m.body }));
    const out = await p.rewrite({ text, voice: ctx.prefs.voice, strictness: ctx.prefs.strictness, history, name: await ctx.userName() });
    return out.trim() || text;
  } catch (err) {
    console.warn('[voice] rewrite failed, using template:', (err as Error).message);
    return text;
  }
}
