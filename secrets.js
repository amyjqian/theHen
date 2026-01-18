
const SECRETS = {
  OPENROUTER_API_KEY: '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'
};

if (typeof window !== 'undefined') {
  window.SECRETS = SECRETS;
}

if (typeof self !== 'undefined') {
  self.SECRETS = SECRETS;
}