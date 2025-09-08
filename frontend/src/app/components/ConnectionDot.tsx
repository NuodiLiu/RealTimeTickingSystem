export default function ConnectionDot({ online }: { online: boolean }) {
    return (
      <span
        className={`inline-block h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-zinc-400"}`}
        aria-label={online ? "online" : "offline"}
        title={online ? "online" : "offline"}
      />
    );
  }