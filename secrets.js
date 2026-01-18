const SECRETS = {
  OPENROUTER_API_KEY: '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'
};

if (typeof window !== 'undefined') {
  window.SECRETS = SECRETS;
}

if (typeof self !== 'undefined') {
  self.SECRETS = SECRETS;
}