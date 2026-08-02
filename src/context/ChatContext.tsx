"use client";

import { createContext, useContext, useState } from "react";
import PRDChatbot from "@/components/PRDChatbot";

interface ChatContextType {
  isChatOpen: boolean;
  openChat: (prd?: string, brief?: string, summary?: any) => void;
  closeChat: () => void;
  prdContent: string;
  projectBrief: string;
  summary: any;
  setPrdContext: (prd: string, brief?: string, summary?: any) => void;
}

const ChatContext = createContext<ChatContextType>({
  isChatOpen: false,
  openChat: () => {},
  closeChat: () => {},
  prdContent: "",
  projectBrief: "",
  summary: null,
  setPrdContext: () => {},
});

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [prdContent, setPrdContentState] = useState("");
  const [projectBrief, setProjectBriefState] = useState("");
  const [summary, setSummaryState] = useState<any>(null);

  const setPrdContext = (prd: string, brief?: string, sum?: any) => {
    if (prd) setPrdContentState(prd);
    if (brief !== undefined) setProjectBriefState(brief);
    if (sum !== undefined) setSummaryState(sum);
  };

  const openChat = (prd?: string, brief?: string, sum?: any) => {
    if (prd) setPrdContentState(prd);
    if (brief !== undefined) setProjectBriefState(brief);
    if (sum !== undefined) setSummaryState(sum);
    setIsChatOpen(true);
  };

  const closeChat = () => setIsChatOpen(false);

  return (
    <ChatContext.Provider
      value={{
        isChatOpen,
        openChat,
        closeChat,
        prdContent,
        projectBrief,
        summary,
        setPrdContext,
      }}
    >
      {children}
      <PRDChatbot
        isOpen={isChatOpen}
        onClose={closeChat}
        prdContent={prdContent}
        projectBrief={projectBrief}
        summary={summary}
      />
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
