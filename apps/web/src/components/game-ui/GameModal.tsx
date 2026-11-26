import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

interface GameModalProps {
  open: boolean;
  align?: "center" | "top";
  onClose?: () => void;
  children: ReactNode;
}

export function GameModal({
  open,
  align = "center",
  onClose,
  children,
}: GameModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className={[
            "fixed inset-0 z-50 flex justify-center overflow-x-hidden overflow-y-auto bg-black/50 backdrop-blur-[2px]",
            align === "top"
              ? "items-start px-6 pb-6 pt-12 sm:pt-16"
              : "items-center px-6 py-4",
          ].join(" ")}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.78 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.86,
              transition: { duration: 0.14, ease: "easeIn" },
            }}
            transition={{
              type: "spring",
              stiffness: 520,
              damping: 22,
              mass: 0.85,
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full justify-center will-change-transform"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
