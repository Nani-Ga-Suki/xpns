"use client"

import React, { useState, useRef, useEffect, FormEvent } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SendHorizontal, AlertCircle, ClipboardCopy, Maximize2, CornerDownLeft, BrainCircuit } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useTransactionsContext } from "@/contexts/transactions-context"
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  thinkingSteps?: string
  showThinkingDetails?: boolean
  isStreaming?: boolean
}

export function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false) // Overall submission loading
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false) // For the initial "Thinking..." pulse
  const [error, setError] = useState<Error | null>(null)

  const { transactions, isLoading: transactionsLoading } = useTransactionsContext()
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const toggleThinkingDetails = (messageId: string) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === messageId
          ? { ...msg, showThinkingDetails: !msg.showThinkingDetails }
          : msg
      )
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading || transactionsLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    }

    setMessages(prevMessages => [...prevMessages, userMessage])
    setInput("")
    setIsLoading(true)
    setIsWaitingForResponse(true) // Start global "Thinking..." indicator
    setError(null)

    const calculatedTotalBalance = transactions.reduce((acc, transaction) => {
      if (transaction.type === 'income') return acc + transaction.amount;
      if (transaction.type === 'expense') return acc - transaction.amount;
      return acc;
    }, 0);

    const financialSummary = {
      totalBalance: `$${calculatedTotalBalance.toFixed(2)}`,
      // ... other summary fields ...
    };

    const assistantMessageId = crypto.randomUUID();
    let accumulatedThinkingSteps = "";
    let accumulatedFinalContent = "";
    let assistantMessageAddedToState = false;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(({ role, content }) => ({ role, content })),
          transactions: transactions,
          financialSummary: financialSummary
        }),
      });

      // As soon as headers are received, stop the global "Thinking..." indicator
      if (isWaitingForResponse) setIsWaitingForResponse(false);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to read error response" }));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
      if (!response.body) throw new Error("Response body is null");

      // Add assistant placeholder now that we have a response body to process
      setMessages(prevMessages => {
        if (prevMessages.find(m => m.id === assistantMessageId)) return prevMessages; // Avoid double-add if error logic already did
        return [
          ...prevMessages,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: "", // Start with empty content, no cursor
            thinkingSteps: "",
            showThinkingDetails: false,
            isStreaming: true,
          }
        ];
      });
      assistantMessageAddedToState = true;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let thinkStartIndex = buffer.indexOf("<think>");
        let thinkEndIndex = buffer.indexOf("</think>");

        while (thinkStartIndex !== -1 && thinkEndIndex !== -1 && thinkStartIndex < thinkEndIndex) {
          accumulatedFinalContent += buffer.substring(0, thinkStartIndex);
          const thinkingBlock = buffer.substring(thinkStartIndex + "<think>".length, thinkEndIndex);
          accumulatedThinkingSteps += (accumulatedThinkingSteps ? "\n" : "") + thinkingBlock;
          buffer = buffer.substring(thinkEndIndex + "</think>".length);
          thinkStartIndex = buffer.indexOf("<think>");
          thinkEndIndex = buffer.indexOf("</think>");
        }
        
        const nextThinkTagStart = buffer.indexOf("<think>");
        if (nextThinkTagStart !== -1) {
            accumulatedFinalContent += buffer.substring(0, nextThinkTagStart);
            // Keep the rest of the buffer (containing the start of <think>) for the next iteration.
        } else {
            accumulatedFinalContent += buffer;
            buffer = ""; 
        }

        setMessages(currentMessages =>
          currentMessages.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: accumulatedFinalContent, // Update with streamed content, no cursor
                  thinkingSteps: accumulatedThinkingSteps,
                  isStreaming: true,
                }
              : msg
          )
        );
      }
      
      buffer += decoder.decode(); // Process any final leftovers
      let thinkStartIndex = buffer.indexOf("<think>");
      let thinkEndIndex = buffer.indexOf("</think>");
       while (thinkStartIndex !== -1 && thinkEndIndex !== -1 && thinkStartIndex < thinkEndIndex) {
            accumulatedFinalContent += buffer.substring(0, thinkStartIndex);
            const thinkingBlock = buffer.substring(thinkStartIndex + "<think>".length, thinkEndIndex);
            accumulatedThinkingSteps += (accumulatedThinkingSteps ? "\n" : "") + thinkingBlock;
            buffer = buffer.substring(thinkEndIndex + "</think>".length);
            thinkStartIndex = buffer.indexOf("<think>");
            thinkEndIndex = buffer.indexOf("</think>");
        }
      accumulatedFinalContent += buffer;

      setMessages(currentMessages =>
        currentMessages.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: accumulatedFinalContent, // Final content
                thinkingSteps: accumulatedThinkingSteps,
                isStreaming: false, // Streaming done
              }
            : msg
        )
      );

    } catch (err) {
      // Ensure global "Thinking..." indicator is off on error
      if (isWaitingForResponse) setIsWaitingForResponse(false);
      console.error("Chat fetch/stream error:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(err instanceof Error ? err : new Error(errorMessage));
      
      if (assistantMessageAddedToState) {
        setMessages(currentMessages => currentMessages.map(msg =>
          msg.id === assistantMessageId
          ? { ...msg, content: `Error: ${errorMessage}`, isStreaming: false, thinkingSteps: accumulatedThinkingSteps }
          : msg
        ));
      } else { // Error occurred before placeholder was added
        setMessages(prev => [...prev, {
            id: assistantMessageId,
            role: 'assistant',
            content: `Error: ${errorMessage}`,
            thinkingSteps: accumulatedThinkingSteps,
            isStreaming: false,
        }]);
      }
    } finally {
      setIsLoading(false);
      // Safeguard: ensure global "Thinking..." indicator is off
      if (isWaitingForResponse) setIsWaitingForResponse(false);
    }
  }

  useEffect(() => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollViewport = scrollAreaRef.current.querySelector("div[data-radix-scroll-area-viewport]")
        if (scrollViewport) {
          scrollViewport.scrollTop = scrollViewport.scrollHeight
        }
      }
    }, 100)
  }, [messages, isLoading])

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      console.log("Message copied to clipboard!");
    }).catch(err => {
      console.error("Failed to copy message: ", err);
    });
  };

  // Removed renderThinkingContentForBubble as CSS max-height will handle visual truncation
  // For "Show more" button visibility, we might need a way to detect if content is actually overflowing
  // For simplicity, we'll use a character count for now, similar to before.

  return (
    <div className="flex h-full flex-col border-l bg-background">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Chatbot Assistant</h2>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4 pr-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error.message || "An error occurred while fetching the chat response."}
              </AlertDescription>
            </Alert>
          )}

          {messages.map((message) => {
            const showAssistantMainContent = message.isStreaming || (message.content && message.content.trim() !== "");
            // A simple heuristic for "Show more": if not expanded and text is long enough to potentially be truncated by max-height.
            // This could be improved by measuring actual element height vs scrollHeight if perfect accuracy is needed.
            const thinkingTextIsLong = message.thinkingSteps && message.thinkingSteps.length > 150; // Adjust threshold as needed

            return (
              <div
                key={message.id}
                className={`flex group ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-[75%] rounded-lg px-3 py-2 text-sm transition-all duration-300 ease-in-out shadow-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground animate-in slide-in-from-right-sm fade-in"
                      : "bg-muted text-muted-foreground animate-in slide-in-from-left-sm fade-in"
                  }`}
                >
                  <span className="font-semibold block mb-1 text-foreground">
                    {message.role === "user" ? "You" : "Chatbot"}
                  </span>

                  {message.role === 'assistant' && message.thinkingSteps && (
                    <div className="mb-2 p-2 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 rounded-md text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center font-medium text-blue-700 dark:text-blue-400">
                          <BrainCircuit className="h-4 w-4 mr-2" />
                          THINKING
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-blue-600 dark:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-800"
                          onClick={() => toggleThinkingDetails(message.id)}
                          aria-label={message.showThinkingDetails ? "Collapse thinking" : "Expand thinking"}
                        >
                          {message.showThinkingDetails ? <CornerDownLeft className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                        </Button>
                      </div>
                      <pre
                        className={`whitespace-pre-wrap font-sans text-slate-600 dark:text-slate-400 overflow-hidden transition-all duration-300 ease-in-out ${
                          message.showThinkingDetails ? 'max-h-[500px] opacity-100 py-1' : 'max-h-[4.2em] opacity-70' // approx 3 lines (line-height 1.4 * 3)
                        }`}
                      >
                        {message.thinkingSteps}
                      </pre>
                      {/* "Show more" / "Show less" Buttons */}
                      {!message.showThinkingDetails && thinkingTextIsLong && (
                          <button 
                              onClick={() => toggleThinkingDetails(message.id)} 
                              className="text-blue-600 dark:text-blue-400 hover:underline text-xs mt-1 w-full text-left"
                          >
                              Show more
                          </button>
                      )}
                      {message.showThinkingDetails && (
                          <button 
                              onClick={() => toggleThinkingDetails(message.id)} 
                              className="text-blue-600 dark:text-blue-400 hover:underline text-xs mt-2 w-full text-left" // text-left for consistency or text-center
                          >
                              Show less
                          </button>
                      )}
                    </div>
                  )}
                  
                  {message.role === 'assistant' ? (
                    showAssistantMainContent && (
                      <div className={`prose prose-sm dark:prose-invert max-w-none text-muted-foreground ${
                        message.thinkingSteps ? 'pl-[calc(0.5rem)]' : '' 
                      }`}>
                        <ReactMarkdown>
                          {String(message.content || "")}
                        </ReactMarkdown>
                      </div>
                    )
                  ) : (
                    message.content.split('\n').map((line: string, index: number) => (
                      <React.Fragment key={index}>
                        {line}
                        {index < message.content.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))
                  )}

                  {!message.isStreaming && message.content && message.content.trim() !== "" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleCopyMessage(message.content)}
                      aria-label="Copy message"
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          {/* New "Thinking..." indicator with Brain Icon */}
          {isWaitingForResponse && (
             <div className="flex justify-start pl-2 pr-2 py-2">
               <div className="flex items-center space-x-2 text-sm text-muted-foreground bg-background p-2 rounded-lg shadow-sm">
                 <BrainCircuit className="h-5 w-5 text-blue-500" /> {/* Removed animate-pulse for static brain */}
                 <span>Thinking...</span>
               </div>
             </div>
           )}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Ask about your finances..."
            value={input}
            onChange={handleInputChange}
            className="flex-1"
            aria-label="Chat message input"
            disabled={isLoading || transactionsLoading}
          />
          <Button type="submit" size="icon" aria-label="Send message" disabled={isLoading || transactionsLoading || !input.trim()}>
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

// CSS for truncation (not directly used by pre tag with max-height, but kept if needed elsewhere)
// const styles = `...`; (Keep your style injection if other elements rely on it)
// For the pre tag, max-height + overflow:hidden gives the visual truncation effect.
// The 'truncate-3-lines' class is not applied to the <pre> tag in this version for smoother max-height transition.