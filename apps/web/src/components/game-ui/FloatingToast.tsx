import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export type ToastTone = "error" | "success" | "info";

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface FloatingToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const TONE_STYLES: Record<ToastTone, { card: string; iconBg: string }> = {
  error: {
    card: "border-[#e0326a] bg-[#fff0f5] text-[#8a123b] shadow-[0_6px_0_rgba(176,24,74,0.28),0_12px_24px_rgba(32,12,24,0.22)]",
    iconBg: "from-[#ff6b98] to-[#d9235d]",
  },
  success: {
    card: "border-[#4fc924] bg-[#f2ffe8] text-[#18591c] shadow-[0_6px_0_rgba(30,125,45,0.24),0_12px_24px_rgba(14,45,24,0.18)]",
    iconBg: "from-[#b2f538] to-[#39b516]",
  },
  info: {
    card: "border-[#17a3db] bg-[#eefbff] text-[#173f66] shadow-[0_6px_0_rgba(23,120,175,0.24),0_12px_24px_rgba(14,35,58,0.18)]",
    iconBg: "from-[#53ecff] to-[#1199e8]",
  },
};

export function FloatingToastStack({ toasts, onDismiss }: FloatingToastProps) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2.5 px-4"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = TONE_STYLES[toast.tone];
          return (
            <motion.div
              key={toast.id}
              layout
              role="status"
              initial={{ opacity: 0, y: -56, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: -44,
                scale: 0.92,
                transition: { duration: 0.2, ease: "easeIn" },
              }}
              transition={{
                type: "spring",
                stiffness: 460,
                damping: 20,
                mass: 0.85,
              }}
              drag="y"
              dragConstraints={{ top: -80, bottom: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.y < -28 || info.velocity.y < -250) {
                  onDismiss(toast.id);
                }
              }}
              className={[
                "pointer-events-auto flex w-full max-w-md cursor-grab items-center gap-3 rounded-2xl border-[3px] px-3.5 py-2.5 active:cursor-grabbing",
                style.card,
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gradient-to-b text-white shadow-sm",
                  style.iconBg,
                ].join(" ")}
              >
                {toast.tone === "error" && <AlertTriangle className="h-4 w-4 stroke-[2.5]" />}
                {toast.tone === "success" && <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />}
                {toast.tone === "info" && <Info className="h-4 w-4 stroke-[2.5]" />}
              </span>

              <span className="flex-1 text-sm font-extrabold leading-snug">{toast.message}</span>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Tutup notifikasi"
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/10 transition hover:bg-black/15 active:scale-95"
              >
                <X className="h-4 w-4 stroke-[2.75]" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
