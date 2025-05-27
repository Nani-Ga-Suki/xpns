# Required Dependencies

Install the following packages using your preferred package manager (npm, yarn, or pnpm):

```bash
npm install ai
# or
yarn add ai
# or
pnpm add ai
```

**Explanation:**

*   `ai`: The Vercel AI SDK, used for the `useChat` hook in the frontend component (`components/chatbot.tsx`) to handle chat state and streaming.

**Environment Variable:**

You will also need to set up an environment variable for your Cerebras API key. Create a `.env.local` file in the root of your project (if it doesn't exist) and add your key:

```
CEREBRAS_API_KEY=your_cerebras_api_key_here