import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Lightbulb, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Drug, DrugSimilarity } from "@/types/drug";

// Simple markdown parser for chat messages
function parseMarkdown(text: string): React.ReactNode {
  // Split by code blocks first
  const parts = text.split(/(`[^`]+`)/g);
  
  return parts.map((part, index) => {
    // Inline code
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="bg-secondary/50 px-1 py-0.5 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    
    // Process other markdown
    let processed: React.ReactNode = part;
    
    // Bold **text**
    const boldParts = part.split(/\*\*([^*]+)\*\*/g);
    if (boldParts.length > 1) {
      processed = boldParts.map((segment, i) => 
        i % 2 === 1 ? <strong key={i}>{segment}</strong> : segment
      );
    }
    
    return <span key={index}>{processed}</span>;
  });
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatBotProps {
  selectedDrug?: Drug | null;
  similarDrugs?: DrugSimilarity[];
  allDrugs?: Drug[];
  threshold?: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drug-chat`;

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hello! I'm Elix, your drug repurposing assistant. Select a drug from the network and ask me about its similarities, mechanism, or potential repurposing opportunities.",
  timestamp: new Date(),
};

export const ChatBot = ({ selectedDrug, similarDrugs, allDrugs, threshold }: ChatBotProps) => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Start with empty history each session
  useEffect(() => {
    setIsLoadingHistory(false);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const saveMessage = async (role: "user" | "assistant", content: string) => {
    try {
      await supabase.from("chat_messages").insert({ role, content });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  const clearHistory = async () => {
    try {
      const { error } = await supabase.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      setMessages([WELCOME_MESSAGE]);
    } catch (error) {
      console.error("Error clearing history:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    const chatMessages = [...messages, userMessage]
      .filter(m => m.id !== "welcome")
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Save user message
    await saveMessage("user", userMessage.content);

    let assistantContent = "";

    try {
      // Build context object with dashboard state
      const context = selectedDrug ? {
        selectedDrug: {
          id: selectedDrug.id,
          drug: selectedDrug.drug,
          mechanism: selectedDrug.mechanism,
          cell_line: selectedDrug.cell_line,
          samples_aggregated: selectedDrug.samples_aggregated,
        },
        similarDrugs: similarDrugs?.map(sd => {
          const drugInfo = allDrugs?.find(d => d.id === sd.drugId);
          return {
            drugId: sd.drugId,
            drugName: drugInfo?.drug,
            similarity: sd.similarity,
          };
        }),
        threshold,
      } : undefined;

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: chatMessages, context }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id.startsWith("stream-")) {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [
                  ...prev,
                  {
                    id: `stream-${Date.now()}`,
                    role: "assistant",
                    content: assistantContent,
                    timestamp: new Date(),
                  },
                ];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      // Save assistant message after streaming completes
      if (assistantContent) {
        await saveMessage("assistant", assistantContent);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to get response");
      
      if (!assistantContent) {
        const errorContent = "Sorry, I encountered an error. Please try again.";
        setMessages(prev => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: errorContent,
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-xl overflow-hidden min-h-0">
      {/* Header */}
      <div className="p-3 border-b border-border/50 bg-card/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Lightbulb className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Ask Elix</h3>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearHistory}
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Clear chat history"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {isLoadingHistory && (
            <div className="text-center text-muted-foreground text-sm py-2">
              Loading chat history...
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-primary/20 text-foreground"
                    : "bg-muted/50 text-foreground"
                }`}
              >
                {parseMarkdown(message.content)}
              </div>
            </div>
          ))}
          {isLoading && !messages.some(m => m.id.startsWith("stream-")) && (
            <div className="flex justify-start">
              <div className="bg-muted/50 rounded-xl px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border/50 bg-card/30">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about drug similarities..."
            className="flex-1 bg-background/50 border-border/50"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
