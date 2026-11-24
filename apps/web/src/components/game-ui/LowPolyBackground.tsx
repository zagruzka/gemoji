export type BackdropTheme = "arcade" | "night" | "uno";

interface LowPolyBackgroundProps {
  theme?: BackdropTheme;
}

const PALETTES: Record<BackdropTheme, { base: string; facets: string[] }> = {
  arcade: {
    base: "#5ca69c",
    facets: ["#6bc1aa", "#5aa9a0", "#76c9ad", "#51929f", "#649cb2", "#4c8899", "#72b4aa", "#5999a8"],
  },
  night: {
    base: "#1f1d45",
    facets: ["#292659", "#1d1b3f", "#342d6b", "#181838", "#2d2a60", "#221f4d", "#3c3278", "#151430"],
  },
  uno: {
    base: "#c94b4b",
    facets: ["#e05d4f", "#d1495b", "#ed7b49", "#b53f52", "#de6948", "#c24354", "#eb8a44", "#a8384c"],
  },
};

export function LowPolyBackground({ theme = "arcade" }: LowPolyBackgroundProps) {
  const palette = PALETTES[theme];

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: palette.base }}
      aria-hidden="true"
    >
      <svg
        className="h-full w-full object-cover opacity-95"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <polygon points="0,0 420,0 240,340" fill={palette.facets[0]} />
        <polygon points="420,0 820,0 590,260" fill={palette.facets[1]} />
        <polygon points="820,0 1200,0 1020,310" fill={palette.facets[3]} />
        <polygon points="0,0 240,340 0,560" fill={palette.facets[2]} />
        <polygon points="420,0 590,260 240,340" fill={palette.facets[6]} />
        <polygon points="820,0 1020,310 590,260" fill={palette.facets[4]} />
        <polygon points="1200,0 1200,480 1020,310" fill={palette.facets[5]} />
        <polygon points="240,340 590,260 470,590" fill={palette.facets[1]} />
        <polygon points="590,260 1020,310 830,610" fill={palette.facets[7]} />
        <polygon points="0,560 240,340 470,590" fill={palette.facets[0]} />
        <polygon points="0,560 470,590 210,800 0,800" fill={palette.facets[2]} />
        <polygon points="470,590 830,610 590,800 210,800" fill={palette.facets[6]} />
        <polygon points="830,610 1020,310 1200,480 1200,800" fill={palette.facets[4]} />
        <polygon points="830,610 1200,800 590,800" fill={palette.facets[5]} />
      </svg>
    </div>
  );
}
