// Using standard Response object

// IMPORTANT: Set the runtime to edge for best performance
export const runtime = "edge"

// --- Cerebras API Configuration ---
const CEREBRAS_API_ENDPOINT = process.env.CEREBRAS_API_ENDPOINT || "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || "qwen-3-32b";

export async function POST(req: Request) {
  try {
    // Extract messages and transactions from the request body
    const { messages, transactions, financialSummary } = await req.json();

    // Basic validation for transactions (optional but recommended)
    if (!Array.isArray(transactions)) {
      return new Response(
        JSON.stringify({ error: "Invalid transactions format. Expected an array." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Basic validation for financialSummary (optional but recommended)
    if (typeof financialSummary !== 'object' || financialSummary === null) {
      return new Response(
        JSON.stringify({ error: "Invalid financialSummary format. Expected an object." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Cerebras API key not configured." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Prepare transaction context string (limit length if necessary)
    // Convert only essential fields to a string to avoid overly long prompts
    console.log("[API Route] Received transactions count:", transactions.length);
    // const slicedTransactions = transactions.slice(0, 100); // Removed slicing
    // console.log("[API Route] Sliced transactions count (to be used in prompt):", slicedTransactions.length); // Commented out log for sliced
    const transactionContext = transactions.length > 0
      ? `\n\nHere are the user's recent transactions:\n${JSON.stringify( // Changed "up to 40" to "transactions"
          transactions.map(t => ({ date: t.date, description: t.description, amount: t.amount, type: t.type, category: t.category })), // Use all transactions
          null, 2 // Pretty print for readability in logs if needed
        )}`
      : "\n\nNo transaction data available for the user.";

    // Prepare financial summary context string
    const financialContext = financialSummary
      ? `\n\nHere is the user's financial summary:
Total Balance: ${financialSummary.totalBalance} (Lifetime total across all categories)
This Month: ${financialSummary.thisMonth} (${financialSummary.thisMonthChange}% from last month)
Top Category: ${financialSummary.topCategory} (${financialSummary.topCategoryAmount} total received)
Savings Rate: ${financialSummary.savingsRate}% (${financialSummary.savingsRateInfo})`
      : "\n\nNo financial summary data available for the user.";

    // Add transaction and financial context to the system prompt
    // system prompt: You are an AI specialized in analyzing and organizing financial transactions. Your purpose is to provide direct, blunt, and precise responses exclusively on financial questions. Answer solely on financial subjects; ignore any queries on other topics. Do not use emotive language, filler, transitional phrases, or any expressions intended to engage or motivate. Do not mirror the user's tone. Terminate responses immediately after presenting the required financial information.
    const systemPrompt = `You are a helpful assistant integrated into a personal finance manager application. Be concise and helpful. Please format your responses using Markdown (e.g., bold text with **, bullet points with * or -). ${transactionContext} ${financialContext}`; // Added Markdown instruction and financial context

    const cerebrasMessages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
    ]

    const requestBody = {
      model: CEREBRAS_MODEL,
      messages: cerebrasMessages,
      stream: true,
      temperature: 0.7,
    };

    console.log(`Attempting to fetch: ${CEREBRAS_API_ENDPOINT}`);

    const apiResponse = await fetch(CEREBRAS_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error("Cerebras API Error:", apiResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: `Cerebras API error: ${apiResponse.status} ${errorBody}` }),
        { status: apiResponse.status, headers: { "Content-Type": "application/json" } }
      )
    }

    if (!apiResponse.body) {
      return new Response(
        JSON.stringify({ error: "Cerebras API response body is null." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Use TransformStream with buffering to handle partial JSON chunks in SSE
    let buffer = "";
    const transformStream = new TransformStream({
      transform(chunkUint8, controller) {
        buffer += new TextDecoder().decode(chunkUint8);
        let boundary = buffer.lastIndexOf('\n');
        if (boundary === -1) return; // Wait for more data if no newline

        let processData = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 1); // Keep potential incomplete line

        const lines = processData.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (typeof content === 'string' && content.length > 0) {
                controller.enqueue(new TextEncoder().encode(content));
              }
            } catch (e) {
              console.error("Error parsing buffered Cerebras stream chunk JSON:", data, e);
              // Put back the failed line for the next chunk if parsing fails mid-stream
              buffer = line + '\n' + buffer;
              break;
            }
          }
        }
      },
    });

    // Pipe the API response body through the transform stream
    const outputStream = apiResponse.body.pipeThrough(transformStream);

    // Return a standard Response object with the processed text stream
    return new Response(outputStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });

  } catch (error) {
    console.error("[Chat API Error]:", error)
    let errorMessage = "An internal server error occurred."
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}