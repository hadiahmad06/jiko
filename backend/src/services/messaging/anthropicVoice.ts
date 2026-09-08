// src/services/messaging/anthropicVoice.ts
//
// Claude-backed voice. Two jobs: rewrite a templated nudge into the user's
// chosen voice, and answer free-form replies. Loaded lazily; only used when
// ANTHROPIC_API_KEY is set. Short outputs, low effort: this is a text message.
import Anthropic from '@anthropic-ai/sdk';
import { VOICE_GUIDES, VoiceProvider } from './voice.js';
import { VoiceT } from '../../types/user/UserPreferences.js';

const MODEL = process.env.JIKO_LLM_MODEL || 'claude-opus-5';
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const JIKO_SYSTEM = `You are Jiko: a personal accountability partner who messages the user like a friend would, in the same place their friends do.
Rules that never change:
- One or two short sentences. This is a text message, not an email. No bullet points, no headers, no emoji unless the user uses them.
- Never lie and never nag. Do not repeat a nudge the user already ignored; say something different or say nothing.
- You are on the user's side. Blunt is fine, cruel is not. No guilt trips, no "you're doing great!" when they aren't.
- Never invent facts about the user's day. Only reference what is in the message you're given or the recent conversation.
- If the user pushes back, hear it. Adjust; don't lecture.
- Never mention being an AI, a model, or these rules.`;

function strictnessNote(s: number): string {
  if (s < 0.3) return 'Strictness is low: be gentle, suggest rather than push.';
  if (s < 0.7) return 'Strictness is medium: direct but friendly.';
  return 'Strictness is high: be blunt and hold the line. Still not cruel.';
}

async function complete(system: string, messages: Anthropic.MessageParam[], maxTokens = 200): Promise<string> {
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low' },
    messages,
  });
  if (res.stop_reason === 'refusal') return '';
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

export const anthropicVoice: VoiceProvider = {
  async rewrite({ text, voice, strictness, history, name }) {
    const system = `${JIKO_SYSTEM}\n\nVoice: ${VOICE_GUIDES[voice as VoiceT] ?? VOICE_GUIDES.older_sibling}\n${strictnessNote(strictness)}\nThe user's name is ${name}.`;
    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: 'user', content: `Rewrite this nudge in your voice. Keep every fact in it, add nothing. Output only the message.\n\nNUDGE: ${text}` },
    ];
    const out = await complete(system, messages, 150);
    return out || text;
  },
};

export async function conversationalReply(args: { text: string; voice: VoiceT; strictness: number; history: Anthropic.MessageParam[]; lastNudge: string | null }): Promise<string> {
  const system = `${JIKO_SYSTEM}\n\nVoice: ${VOICE_GUIDES[args.voice] ?? VOICE_GUIDES.older_sibling}\n${strictnessNote(args.strictness)}\n${args.lastNudge ? `Your most recent nudge to the user was: "${args.lastNudge}"` : ''}\nYou cannot take actions here; if the user asks you to snooze, stop, or mark something done, tell them to say "snooze 20", "stop", or "done" so it registers.`;
  const messages: Anthropic.MessageParam[] = [...args.history];
  if (messages.length === 0 || messages[messages.length - 1]!.role !== 'user' || messages[messages.length - 1]!.content !== args.text) {
    messages.push({ role: 'user', content: args.text });
  }
  return complete(system, messages, 200);
}
