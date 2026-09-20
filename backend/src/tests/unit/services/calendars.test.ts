import { isPrivateHost, normalizeIcsUrl } from '../../../services/calendars';

describe('normalizeIcsUrl', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('turns webcal into https', () => {
    expect(normalizeIcsUrl('webcal://calendar.example.com/feed.ics')).toEqual({ ok: true, url: 'https://calendar.example.com/feed.ics' });
  });

  it('keeps https as-is', () => {
    expect(normalizeIcsUrl('https://canvas.example.edu/feeds/calendars/user_abc.ics'))
      .toEqual({ ok: true, url: 'https://canvas.example.edu/feeds/calendars/user_abc.ics' });
  });

  it('rejects plain http unless allowed', () => {
    expect(normalizeIcsUrl('http://calendar.example.com/f.ics').ok).toBe(false);
    process.env.JIKO_ICS_ALLOW_HTTP = 'true';
    expect(normalizeIcsUrl('http://calendar.example.com/f.ics').ok).toBe(true);
  });

  it('rejects non-urls and other schemes', () => {
    expect(normalizeIcsUrl('not a url').ok).toBe(false);
    expect(normalizeIcsUrl('file:///etc/passwd').ok).toBe(false);
  });

  it('rejects private hosts unless allowed', () => {
    expect(normalizeIcsUrl('https://127.0.0.1/f.ics').ok).toBe(false);
    expect(normalizeIcsUrl('https://192.168.1.10/f.ics').ok).toBe(false);
    process.env.JIKO_ICS_ALLOW_PRIVATE = 'true';
    expect(normalizeIcsUrl('https://192.168.1.10/f.ics').ok).toBe(true);
  });
});

describe('isPrivateHost', () => {
  it('flags loopback, link-local and RFC1918', () => {
    for (const h of ['localhost', 'jiko.local', '127.0.0.1', '10.0.0.5', '172.16.4.1', '172.31.255.255', '192.168.0.1', '169.254.169.254', '::1', 'fd00::1', 'fe80::1']) {
      expect(isPrivateHost(h), h).toBe(true);
    }
  });

  it('allows public hosts', () => {
    for (const h of ['calendar.google.com', 'canvas.example.edu', '8.8.8.8', '172.32.0.1', '2606:4700::1111']) {
      expect(isPrivateHost(h), h).toBe(false);
    }
  });
});
