import { useEffect, useState } from "react";

export function useCountdown(endsAt: number | null): number | null {
  const [remainingSec, setRemainingSec] = useState<number | null>(() =>
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : null,
  );

  useEffect(() => {
    if (!endsAt) {
      setRemainingSec(null);
      return;
    }

    const tick = () => {
      setRemainingSec(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return remainingSec;
}
