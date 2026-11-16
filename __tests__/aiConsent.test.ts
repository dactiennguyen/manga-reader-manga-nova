import { aiConsentGiven, aiRoute } from '../src/state/useSettings';

const base = { aiBaseUrl: '', aiConsentFor: '', aiDemo: true };

describe('consent before text goes to an AI server', () => {
  it('sends to a server only with consent for that very address', () => {
    expect(aiRoute({ ...base, aiBaseUrl: 'ai.example.com' })).toBe('noConsent');
    expect(aiRoute({ ...base, aiBaseUrl: 'ai.example.com', aiConsentFor: 'https://ai.example.com/v1' })).toBe('server');
    // Another address needs consent again.
    expect(aiRoute({ ...base, aiBaseUrl: 'other.example.com', aiConsentFor: 'https://ai.example.com/v1' })).toBe('noConsent');
    expect(aiConsentGiven({ aiBaseUrl: 'other.example.com', aiConsentFor: 'https://ai.example.com/v1' })).toBe(false);
  });

  it('keeps the labelled sample answers while no server is set', () => {
    expect(aiRoute(base)).toBe('demo');
    expect(aiRoute({ ...base, aiDemo: false })).toBe('off');
    expect(aiConsentGiven({ aiBaseUrl: '', aiConsentFor: '' })).toBe(false);
  });
});
