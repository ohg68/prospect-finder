import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Switch } from "../components/ui/switch";
import { MessageSquare, Send, User, Bot, Phone, Sparkles } from "lucide-react";

interface Conversation {
  id: number;
  title: string;
  externalId: string | null;
  status: string;
  isAutoAgentEnabled: string;
  createdAt: string;
}

interface Message {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (selectedId) {
      fetchMessages(selectedId);
      return () => {
        if(interval) clearInterval(interval);
      };
    }
    return undefined;
  }, [selectedId]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/whatsapp/conversations"); // We'll need to add this route
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (id: number) => {
    try {
      const res = await fetch(`/api/whatsapp/conversations/${id}/messages`); // We'll need to add this route
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedId) return;
    const conv = conversations.find(c => c.id === selectedId);
    if (!conv?.externalId) return;

    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: conv.externalId, text: input }),
      });
      if (res.ok) {
        setInput("");
        fetchMessages(selectedId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = async (id: number, enabled: boolean) => {
    try {
      await fetch(`/api/whatsapp/conversations/${id}/toggle-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Sidebar: Conversations List */}
      <Card className="w-80 flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="w-5 h-5 text-green-600" />
            WhatsApp Chats
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`p-4 cursor-pointer border-b transition-colors hover:bg-slate-50 ${selectedId === conv.id ? "bg-slate-100" : ""}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium truncate">{conv.title}</span>
                  <Badge variant={conv.status === "active" ? "default" : "secondary"} className="text-[10px]">
                    {conv.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-500">Agente IA:</span>
                  <Switch
                    checked={conv.isAutoAgentEnabled === "true"}
                    onCheckedChange={(val) => toggleAgent(conv.id, val)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main: Chat View */}
      <Card className="flex-1 flex flex-col">
        {selectedId ? (
          <>
            <CardHeader className="border-b py-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{conversations.find(c => c.id === selectedId)?.title}</h3>
                    <p className="text-xs text-slate-500">{conversations.find(c => c.id === selectedId)?.externalId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" asChild>
                     <a 
                       href={`https://web.whatsapp.com/send?phone=${conversations.find(c => c.id === selectedId)?.externalId?.replace(/\D/g, '')}`} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex items-center gap-2"
                     >
                       <Phone className="w-4 h-4" /> Abrir en Web
                     </a>
                   </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 relative">
              <ScrollArea className="h-full p-4">
                <div className="flex flex-col gap-4">
                  {messages.map((m: Message) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`max-w-[70%] p-3 rounded-2xl ${
                        m.role === "user" 
                          ? "bg-slate-100 text-slate-900 rounded-tl-none" 
                          : "bg-blue-600 text-white rounded-tr-none"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {m.role === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                            {m.role === "user" ? "Cliente" : "Agente IA"}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                        <span className="text-[9px] mt-1 block opacity-50 text-right">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <div className="p-4 border-t flex gap-2">
              <Input
                placeholder="Escribe un mensaje..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <Button size="icon" onClick={sendMessage} disabled={loading}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-center items-center justify-center text-slate-400 flex-col gap-4 max-w-md mx-auto text-center">
            <MessageSquare className="w-16 h-16 opacity-20" />
            <h3 className="text-slate-900 font-bold">Panel de WhatsApp</h3>
            <p className="text-sm">Selecciona una conversación para empezar o usa la API de Meta para automatizar.</p>
            
            <Card className="mt-8 bg-slate-50 border-dashed">
              <CardContent className="p-6">
                <h4 className="font-bold text-slate-700 mb-2 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  ¿No tienes API de Meta?
                </h4>
                <p className="text-xs leading-relaxed">
                  Puedes seguir contactando prospectos manualmente. Ve a la ficha de cualquier prospecto y usa el botón <strong>WhatsApp Web</strong>.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
}
