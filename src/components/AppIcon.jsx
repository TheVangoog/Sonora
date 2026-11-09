const paths = {
  wave: "M4 10v4M8 5v14M12 2v20M16 7v10M20 10v4",
  tune: "M8 3v7a4 4 0 0 0 8 0V3M12 14v7M5 3h6M13 3h6",
  note: "M9 18V5l11-2v13M9 9l11-2M9 18c0 1.7-1.8 3-4 3s-3-1-3-2.5S4 16 6 16c1.1 0 2.2.5 3 1M20 16c0 1.7-1.8 3-4 3s-3-1-3-2.5S15 14 17 14c1.1 0 2.2.5 3 1",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8",
  headphones: "M3 14v-3a9 9 0 0 1 18 0v3M3 13h3v8H3zM18 13h3v8h-3z",
  info: "M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  chord: "M6 5v14M6 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0M12 3v12M12 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0M18 1v10M18 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0M6 5l12-4",
};

export default function AppIcon({ name = "wave", size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.wave} />
    </svg>
  );
}
