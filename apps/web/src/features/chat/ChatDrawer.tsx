import type { ChatChannel, ChatMessage } from "@undercover/shared";
import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GameButton } from "../../components/game-ui";

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  allowedChannels: ChatChannel[];
  myPlayerId: string | null;
  onSend: (channel: ChatChannel, content: string) => void;
}

function getChannelLabel(channel: ChatChannel): string {
  if (channel === "lobby") return "Lobby";
  if (channel === "public") return "Publik";
  if (channel === "dead") return "Eliminasi";
  if (channel === "secret:werewolf") return "Serigala";
  return channel.replace("secret:", "Rahasia: ");
}

export function ChatDrawer({
  open,
  onClose,
  messages,
  allowedChannels,
  myPlayerId,
  onSend,
}: ChatDrawerProps) {
  const [activeChannel, setActiveChannel] = useState<ChatChannel>(allowedChannels[0] ?? "lobby");
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (allowedChannels.length > 0 && !allowedChannels.includes(activeChannel)) {
      setActiveChannel(allowedChannels[0]!);
    }
  }, [allowedChannels, activeChannel]);

  const filtered = messages.filter((m) => m.channel === activeChannel);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, filtered.length]);

  if (!open) return null;

  const handleSubmit = () => {
    const clean = text.trim();
    if (!clean) return;
    onSend(activeChannel, clean);
    setText("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/45 sm:items-stretch">
      <div className="flex h-[78dvh] w-full flex-col rounded-t-[28px] border-t-4 border-[#c8bf94] bg-[#f4eecb] shadow-2xl sm:h-full sm:max-w-sm sm:rounded-none sm:rounded-l-[28px] sm:border-l-4 sm:border-t-0">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-[24px] bg-gradient-to-b from-[#f65287] to-[#e0326a] px-4 py-3 text-white sm:rounded-tl-[24px] sm:rounded-tr-none">
          <h3 className="font-display game-title-stroke text-xl font-bold">Obrolan Room</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup chat"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#6d1839] text-white"
          >
            <X className="h-5 w-5 stroke-[3]" />
          </button>
        </div>

        {/* Channel Tabs */}
        {allowedChannels.length > 1 && (
          <div className="flex gap-1.5 border-b-2 border-[#dcd3a6] bg-[#ebe4be] px-3 py-2">
            {allowedChannels.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setActiveChannel(ch)}
                className={[
                  "font-display cursor-pointer rounded-xl px-3 py-1 text-xs font-bold transition",
                  ch === activeChannel
                    ? "bg-[#e0326a] text-white shadow"
                    : "bg-[#fffdf0] text-[#6d5f47]",
                ].join(" ")}
              >
                {getChannelLabel(ch)}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 space-y-2 overflow-y-auto p-3.5">
          {filtered.length === 0 && (
            <div className="py-10 text-center text-xs font-bold text-[#8a7d63]">
              Belum ada pesan di channel {getChannelLabel(activeChannel)}.
            </div>
          )}

          {filtered.map((msg) => {
            if (msg.isSystem) {
              return (
                <div
                  key={msg.id}
                  className="mx-auto max-w-[92%] px-2 py-0.5 text-center text-[10.5px] font-semibold leading-snug text-[#8a7d63]/75"
                >
                  {msg.content}
                </div>
              );
            }

            const isMe = msg.senderId === myPlayerId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <span className="mb-0.5 px-1 text-[11px] font-extrabold text-[#786b51]">
                  {isMe ? "Kamu" : msg.senderName}
                </span>
                <div
                  className={[
                    "max-w-[82%] break-words rounded-2xl border-2 px-3 py-2 text-sm font-bold",
                    isMe
                      ? "border-[#e0326a] bg-[#ffe3ec] text-[#5c1632]"
                      : "border-[#d8cfa3] bg-[#fffdf0] text-[#3d2940]",
                  ].join(" ")}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2 border-t-2 border-[#dcd3a6] bg-[#ebe4be] p-3">
          <input
            type="text"
            maxLength={300}
            placeholder={`Kirim ke ${getChannelLabel(activeChannel)}...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            className="flex-1 rounded-xl border-2 border-[#cfc595] bg-[#fffdf0] px-3 py-2 text-sm font-bold text-[#3d2940] outline-none focus:border-[#e0326a]"
          />
          <GameButton
            variant="yellow"
            size="sm"
            disabled={!text.trim()}
            onClick={handleSubmit}
          >
            <Send className="h-4 w-4" />
          </GameButton>
        </div>
      </div>
    </div>
  );
}
