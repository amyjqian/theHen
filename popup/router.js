import { OpenRouter } from '@openrouter/sdk';

// To add api key: make .env file in theHen directory
// write API_KEY="<YOUR_API_KEY>"
const API_KEY = parseInt(process.env.API_KEY) || null;

const openRouter = new OpenRouter({
  apiKey: API_KEY,
  defaultHeaders: {
    // 'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    // 'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
  },
});

const characters = [];

console.log(completion.choices[0].message.content);

// Use when quiz answers are submitted: 
// from router import analyzeType
async function analyzeType(responses) {
  const completion = await openRouter.chat.send({
    model: 'openai/gpt-5.2',
    messages: [
      {
        role: 'user',
        content: 'Given this user\'s responses to these questions: ' + responses 
        + "\n and the following characters: " + string(characters)
        + "which character best suits their personality?",
      },
    ],
    stream: false,
  });
}