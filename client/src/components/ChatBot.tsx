import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Trash2 } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAuth } from '@/contexts/AuthContext';
import { storageApi } from '@/api/storage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: Date;
  isError?: boolean;
}

const QUICK_ACTIONS = [
  'How much storage do I have?',
  'How do I share a file?',
  'What file types are supported?',
  'Merhaba, nasıl yardımcı olabilirsin?',
];

const CHAR_LIMIT = 1000;

function formatTs(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: string): string {
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return '0 B';
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
}

function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text) as string);
}

export default function ChatBot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  const [pulsed, setPulsed] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const lastSentRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setPulsed(false), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hi! I'm CloudAssistant. How can I help you today? ☁️",
        ts: new Date(),
      }]);
      setHasNewMsg(false);
    }
    if (open) {
      setHasNewMsg(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const clearConversation = () => {
    setMessages([{
      role: 'assistant',
      content: "Hi! I'm CloudAssistant. How can I help you today? ☁️",
      ts: new Date(),
    }]);
  };

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setMessages(msgs => [...msgs, {
            role: 'assistant',
            content: 'Hazır! Şimdi tekrar deneyebilirsin ✓',
            ts: new Date(),
          }]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || countdown > 0 || trimmed.length > CHAR_LIMIT) return;

    const cooldownRemaining = 4000 - (Date.now() - lastSentRef.current);
    if (cooldownRemaining > 0) {
      await new Promise(r => setTimeout(r, cooldownRemaining));
    }

    setInput('');

    const userMsg: Message = { role: 'user', content: trimmed, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'CloudAssistant yapılandırılmamış. Gemini API key eksik.',
        ts: new Date(),
        isError: true,
      }]);
      setLoading(false);
      return;
    }

    let userContext = '';
    if (user) {
      let totalFiles: number | undefined;
      try {
        const sr = await storageApi.getStats();
        totalFiles = sr.data?.breakdown?.reduce((sum, b) => sum + b.count, 0);
      } catch { /* ignore */ }
      userContext =
        `Name: ${user.displayName} | ` +
        `Storage used: ${formatBytes(user.storageUsed)} | ` +
        `Storage limit: ${formatBytes(user.storageLimit)} | ` +
        `Total files: ${totalFiles ?? 'unknown'} | ` +
        `Plan: ${user.plan ?? 'free'}`;
    }

    const systemPrompt =
      `You are CloudAssistant, a friendly AI assistant built into CloudDrive, a cloud storage web application.\n` +
      `Help users with file management, storage tips, and CloudDrive features. You can also have casual conversations.\n` +
      `Always respond in the same language the user writes in.\n` +
      `Be friendly, concise, and use emojis occasionally.\n` +
      (userContext ? `User context: ${userContext}` : '');

    // Build strictly alternating user/model history — last 10 non-error messages
    const historyMessages = [...messages.filter(m => !m.isError), userMsg].slice(-10);
    const conversationHistory: { role: string; parts: { text: string }[] }[] = [];
    for (const msg of historyMessages) {
      if (msg.role === 'user') {
        conversationHistory.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        conversationHistory.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }
    // Ensure starts with user and roles alternate — collapse consecutive same-role entries
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const entry of conversationHistory) {
      if (contents.length > 0 && contents[contents.length - 1].role === entry.role) {
        // Merge consecutive same-role by keeping the last one
        contents[contents.length - 1] = entry;
      } else {
        contents.push(entry);
      }
    }
    // Must start with user
    while (contents.length > 0 && contents[0].role !== 'user') contents.shift();

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini API error:', errorData);
        console.error('Response status:', response.status);
        if (response.status === 429) throw new Error('RATE_LIMIT');
        throw new Error(`API_ERROR: ${response.status}`);
      }

      const data = await response.json() as {
        candidates?: { content: { parts: { text: string }[] } }[];
      };
      console.error('Gemini response:', data);
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error('NO_RESPONSE');

      lastSentRef.current = Date.now();
      setMessages(prev => [...prev, { role: 'assistant', content: responseText, ts: new Date() }]);
      if (!open) setHasNewMsg(true);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'UNKNOWN';
      console.error('Gemini API error:', err);
      if (errMsg === 'RATE_LIMIT') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Çok fazla istek gönderildi. Lütfen 15 saniye bekleyin. ⏳',
          ts: new Date(),
          isError: true,
        }]);
        startCountdown(15);
      } else if (errMsg === 'NO_RESPONSE') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Yanıt alınamadı. Tekrar deneyin. 🔄',
          ts: new Date(),
          isError: true,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Bir şeyler ters gitti. Tekrar deneyin! 🔄',
          ts: new Date(),
          isError: true,
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const showQuickActions = messages.length === 1 && messages[0].role === 'assistant' && !loading;
  const overLimit = input.length > CHAR_LIMIT;
  const sendDisabled = !input.trim() || loading || overLimit || countdown > 0;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999 }}
        className={`relative w-13 h-13 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-lg flex items-center justify-center transition-all ${pulsed ? 'ring-4 ring-[#4F46E5]/40 animate-pulse' : ''}`}
        aria-label="Open CloudAssistant"
      >
        <MessageCircle className="w-6 h-6" strokeWidth={1.5} />
        {hasNewMsg && (
          <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{ position: 'fixed', bottom: 84, right: 20, zIndex: 9998, width: 'clamp(280px, 90vw, 360px)', height: '500px' }}
          className="flex flex-col bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl shadow-2xl overflow-hidden animate-modal-in"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E5E5E5] dark:border-[#2A2A2A] shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#4F46E5] flex items-center justify-center shrink-0">
              <MessageCircle className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
            </div>
            <span className="flex-1 text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">CloudAssistant</span>
            <button
              onClick={clearConversation}
              title="Clear conversation"
              className="p-1.5 rounded-lg text-[#AAAAAA] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-[#AAAAAA] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'assistant' && !msg.isError ? (
                    <div
                      className="chat-md px-3 py-2 rounded-2xl rounded-bl-sm text-xs leading-relaxed bg-[#F0F0F0] dark:bg-[#252525] text-[#0A0A0A] dark:text-[#F5F5F5]"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  ) : (
                    <div
                      className={`px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                        msg.isError
                          ? 'bg-red-50 dark:bg-red-900/10 text-red-500 dark:text-red-400 rounded-bl-sm border border-red-100 dark:border-red-900/30'
                          : 'bg-[#4F46E5] text-white rounded-br-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                  <span className="text-[10px] text-[#AAAAAA] dark:text-[#444444] px-1">{formatTs(msg.ts)}</span>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#F0F0F0] dark:bg-[#252525] px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-[#AAAAAA] dark:bg-[#555555] animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick action chips — only before the first user message */}
            {showQuickActions && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_ACTIONS.map((qa, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(qa)}
                    className="text-[10px] px-2.5 py-1.5 rounded-full border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#4F46E5] hover:text-[#4F46E5] transition-colors"
                  >
                    {qa}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 px-3 py-3 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
            <div className={`flex items-center gap-2 bg-[#F8F8F8] dark:bg-[#0A0A0A] border rounded-xl px-3 focus-within:border-[#4F46E5] transition-colors ${overLimit ? 'border-red-400 dark:border-red-500' : 'border-[#E5E5E5] dark:border-[#2A2A2A]'}`}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={countdown > 0 ? `Please wait ${countdown}s…` : 'Ask anything…'}
                disabled={loading || countdown > 0}
                className="flex-1 h-10 bg-transparent text-xs text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none disabled:opacity-60"
              />
              {input.length > 800 && (
                <span className={`text-[10px] shrink-0 tabular-nums ${overLimit ? 'text-red-500' : 'text-[#AAAAAA]'}`}>
                  {CHAR_LIMIT - input.length}
                </span>
              )}
              <button
                onClick={() => sendMessage(input)}
                disabled={sendDisabled}
                className="p-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 text-white transition-all"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
