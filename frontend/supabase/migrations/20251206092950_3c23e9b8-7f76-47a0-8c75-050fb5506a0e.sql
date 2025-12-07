-- Create chat messages table for persistent conversations
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write messages (public chatbot for now)
CREATE POLICY "Anyone can read messages" 
ON public.chat_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (true);

-- Add index for faster ordering
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);