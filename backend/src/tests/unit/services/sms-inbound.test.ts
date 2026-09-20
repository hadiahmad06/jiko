import { normalizePhone, parseSnsSmsMessage, parseWebhookBody } from '../../../services/messaging/smsInbound';

describe('normalizePhone', () => {
  it('keeps digits and forces a leading +', () => {
    expect(normalizePhone('+1 (555) 010-1234')).toBe('+15550101234');
    expect(normalizePhone('555.010.1234')).toBe('+5550101234');
    expect(normalizePhone('  ')).toBe('');
  });
});

describe('parseSnsSmsMessage', () => {
  it('reads AWS End User Messaging fields', () => {
    const sms = parseSnsSmsMessage(JSON.stringify({
      originationNumber: '+15550101234',
      destinationNumber: '+15550109999',
      messageBody: 'snooze 20',
      inboundMessageId: 'abc-123',
    }));
    expect(sms).toEqual({ from: '+15550101234', body: 'snooze 20', provider_id: 'abc-123' });
  });

  it('returns null for a payload without a body', () => {
    expect(parseSnsSmsMessage(JSON.stringify({ originationNumber: '+1555' }))).toBeNull();
    expect(parseSnsSmsMessage('not json')).toBeNull();
  });
});

describe('parseWebhookBody', () => {
  it('detects a subscription confirmation', () => {
    const env = parseWebhookBody(JSON.stringify({ Type: 'SubscriptionConfirmation', SubscribeURL: 'https://sns.example/confirm', TopicArn: 'arn:aws:sns:x' }));
    expect(env).toEqual({ kind: 'subscription_confirmation', subscribe_url: 'https://sns.example/confirm', topic_arn: 'arn:aws:sns:x' });
  });

  it('unwraps a notification', () => {
    const env = parseWebhookBody(JSON.stringify({
      Type: 'Notification',
      Message: JSON.stringify({ originationNumber: '+15550101234', messageBody: 'done' }),
    }));
    expect(env).toEqual({ kind: 'notification', sms: { from: '+15550101234', body: 'done' } });
  });

  it('accepts a plain { from, body } post', () => {
    const env = parseWebhookBody({ from: '15550101234', body: 'status' });
    expect(env).toEqual({ kind: 'notification', sms: { from: '+15550101234', body: 'status' } });
  });

  it('is unknown for anything else', () => {
    expect(parseWebhookBody({ hello: 'world' }).kind).toBe('unknown');
    expect(parseWebhookBody('garbage').kind).toBe('unknown');
  });
});
