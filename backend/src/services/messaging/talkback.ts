// src/services/messaging/talkback.ts
//
// The user replied. Turn a sentence into an effect and a short answer.
// Deterministic first (snooze/done/stop/status/help), LLM later for the rest.
import MessageRepository from '../repositories/MessageRepository.js';
import ObligationRepository from '../repositories/ObligationRepository.js';
import TriggerRepository from '../repositories/TriggerRepository.js';
import PreferencesRepository from '../repositories/PreferencesRepository.js';
import { sendMessage } from './outbox.js';
import { buildDailySummary, formatDailySummary } from '../summary.js';
import { MessageT } from '../../types/message/Message.js';
import { budgetStatus } from './outbox.js';

export interface TalkbackOutcome {
  intent: 'snooze' | 'done' | 'stop' | 'status' | 'help' | 'stricter' | 'gentler' | 'quiet' | 'ack' | 'unknown';
  reply: string;
  effects: string[];
}

const RE = {
  snooze: /\b(snooze|later|not now|in (\d+)\s*(min|mins|minutes|h|hr|hrs|hours?))\b|\b(\d+)\s*(more )?(min|mins|minutes)\b/i,
  done: /\b(done|finished|submitted|completed|did it|turned it in)\b/i,
  stop: /\b(stop|leave me alone|shut up|go away|unsubscribe|mute)\b/i,
  status: /\b(status|how am i doing|summary|today|report)\b/i,
  help: /^\s*(help|\?|commands)\s*$/i,
  stricter: /\b(stricter|be meaner|harder on me|more strict)\b/i,
  gentler: /\b(gentler|be nicer|ease up|less strict|chill)\b/i,
  quiet: /\b(quiet|silence|no more today|enough for today)\b/i,
  ack: /^\s*(ok|okay|k|fine|yeah|yes|yep|got it|on it|sure|alright)\s*[.!]*\s*$/i,
};

function snoozeMinutes(text: string): number {
  const m = text.match(/(\d+)\s*(min|mins|minutes|h|hr|hrs|hours?)?/i);
  if (!m) return 20;
  const n = Number(m[1]);
  if (!n) return 20;
  return m[2] && /^h/i.test(m[2]) ? n * 60 : n;
}

export async function handleInbound(user_id: string, inbound: MessageT): Promise<TalkbackOutcome> {
  const text = inbound.body.trim();
  const last = inbound.reply_to_id ? await MessageRepository.get(inbound.reply_to_id, user_id) : await MessageRepository.lastOutbound(user_id);
  const effects: string[] = [];
  let intent: TalkbackOutcome['intent'];
  let reply: string;

  // An answer to a tagged question (the Sunday reflection) is kept as an
  // answer, not run through the command parser.
  const answersTag = typeof last?.metadata?.tag === 'string' ? (last.metadata.tag as string) : null;
  if (answersTag === 'reflection' && !RE.help.test(text) && !RE.stop.test(text)) {
    await MessageRepository.tag(inbound.id, user_id, { kind: 'reflection', answers: last!.id });
    effects.push('stored this week\'s reflection');
    const reflectionReply = text.length > 40 ? 'noted. i\'ll bring it up monday.' : 'noted.';
    await sendMessage({ user_id, body: reflectionReply, reply_to_id: inbound.id, counts_as_interrupt: false, urgent: true, metadata: { talkback: 'reflection' } });
    return { intent: 'ack', reply: reflectionReply, effects };
  }

  if (RE.help.test(text)) {
    intent = 'help';
    reply = "you can say: 'snooze 30', 'done', 'status', 'quiet', 'stricter', 'gentler', or 'stop'. or just talk.";
  } else if (RE.stop.test(text)) {
    intent = 'stop';
    if (last?.trigger_id) {
      await TriggerRepository.update(last.trigger_id, user_id, { enabled: false });
      effects.push(`disabled trigger ${last.trigger_id}`);
      reply = "ok. that one's off. say 'help' if you want it back.";
    } else {
      await PreferencesRepository.update(user_id, { interrupt_budget_per_day: 0 });
      effects.push('interrupt budget set to 0');
      reply = "ok. i'll go quiet. set a budget in preferences when you want me back.";
    }
  } else if (RE.quiet.test(text)) {
    intent = 'quiet';
    const prefs = await PreferencesRepository.get(user_id);
    const status = await budgetStatus(user_id);
    // spend the rest of today's budget without sending anything
    const remaining = status.remaining;
    if (remaining > 0) {
      for (let i = 0; i < remaining; i++) {
        await MessageRepository.createOutbound({ user_id, body: '', channel: 'console', status: 'sent', metadata: { counts_as_interrupt: true, kind: 'budget_burn' } });
      }
    }
    effects.push(`burned ${remaining} interrupts for today`);
    reply = `got it. nothing else from me today${prefs.quiet_hours ? '' : ''}.`;
  } else if (RE.snooze.test(text)) {
    intent = 'snooze';
    const minutes = snoozeMinutes(text);
    if (last?.trigger_id) {
      const until = new Date(Date.now() + minutes * 60_000);
      await TriggerRepository.update(last.trigger_id, user_id, { last_fired_at: until });
      effects.push(`snoozed trigger ${last.trigger_id} for ${minutes} min`);
      reply = `${minutes} min. then i'm checking.`;
    } else {
      reply = `${minutes} min. i'll hold you to it.`;
    }
  } else if (RE.done.test(text)) {
    intent = 'done';
    const fragment = text.replace(RE.done, '').replace(/\b(with|the|my|it)\b/gi, '').trim();
    const target = fragment.length >= 3
      ? await ObligationRepository.findOpenByTitle(user_id, fragment)
      : (await ObligationRepository.dueWithin(user_id, 24 * 14))[0] ?? null;
    if (target) {
      await ObligationRepository.update(target.id, user_id, { completed: true });
      effects.push(`completed obligation ${target.id}`);
      reply = `${target.title}: done. nice.`;
    } else {
      reply = "nothing open matched that, but i'll take your word for it.";
    }
  } else if (RE.status.test(text)) {
    intent = 'status';
    const s = await buildDailySummary(user_id, 0);
    const prefs = await PreferencesRepository.get(user_id);
    const b = await budgetStatus(user_id);
    reply = `${formatDailySummary(s, prefs.strictness)} (${b.remaining} of ${b.budget} nudges left today.)`;
  } else if (RE.stricter.test(text)) {
    intent = 'stricter';
    const prefs = await PreferencesRepository.get(user_id);
    const strictness = Math.min(1, prefs.strictness + 0.2);
    await PreferencesRepository.update(user_id, { strictness, interrupt_budget_per_day: Math.min(10, prefs.interrupt_budget_per_day + 2) });
    effects.push(`strictness ${prefs.strictness} -> ${strictness}`);
    reply = 'noted. gloves off.';
  } else if (RE.gentler.test(text)) {
    intent = 'gentler';
    const prefs = await PreferencesRepository.get(user_id);
    const strictness = Math.max(0, prefs.strictness - 0.2);
    await PreferencesRepository.update(user_id, { strictness, interrupt_budget_per_day: Math.max(1, prefs.interrupt_budget_per_day - 1) });
    effects.push(`strictness ${prefs.strictness} -> ${strictness}`);
    reply = "ok. i'll ease up.";
  } else if (RE.ack.test(text)) {
    intent = 'ack';
    reply = '';
  } else {
    intent = 'unknown';
    reply = await freeformReply(user_id, text, last);
  }

  if (reply) {
    await sendMessage({ user_id, body: reply, reply_to_id: inbound.id, counts_as_interrupt: false, urgent: true, metadata: { talkback: intent } });
  }
  return { intent, reply, effects };
}

/** Anything the rules didn't catch. LLM if configured, otherwise a single honest line. */
async function freeformReply(user_id: string, text: string, last: MessageT | null): Promise<string> {
  try {
    const { conversationalReply } = await import('./anthropicVoice.js');
    if (process.env.ANTHROPIC_API_KEY) {
      const prefs = await PreferencesRepository.get(user_id);
      const recent = await MessageRepository.recent(user_id, 10);
      const history = recent.filter(m => m.body).map(m => ({ role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const, content: m.body }));
      return await conversationalReply({ text, voice: prefs.voice, strictness: prefs.strictness, history, lastNudge: last?.body ?? null });
    }
  } catch (err) {
    console.warn('[talkback] llm reply failed:', (err as Error).message);
  }
  return "heard. say 'help' if you want the shortcuts.";
}
