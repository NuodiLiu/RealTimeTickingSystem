// "use client";

// import ConnectionDot from "./ConnectionDot";

// export default function Header({
//   staffName = "Staff",
//   online,
//   onLogout,
// }: {
//   staffName?: string;
//   online: boolean;
//   onLogout: () => void;
// }) {
//   return (
//     <header className="flex items-center justify-between border-b px-4 py-3">
//       <div className="flex items-center gap-3">
//         <div className="h-8 w-8 rounded-full bg-zinc-200" />
//         <div className="text-sm text-zinc-600 flex items-center gap-2">
//           <ConnectionDot online={online} />
//           <span className="text-zinc-500">status:</span>
//           <span className="font-medium">{online ? "online" : "offline"}</span>
//         </div>
//       </div>
//       <div className="flex items-center gap-3">
//         <span className="text-sm">Hello, <b>{staffName}</b></span>
//         <button
//           onClick={onLogout}
//           className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-50"
//         >
//           Logout
//         </button>
//       </div>
//     </header>
//   );
// }

"use client";

import Image from "next/image";

export default function Header({
  staffName = "Staff",
  onLogout,
}: {
  staffName?: string;
  onLogout: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-3">
        <Image 
          src="/img/unswcollege.png" 
          alt="UNSW College Logo" 
          width={128}
          height={128}
          className="rounded-lg object-cover"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm">Hello, <b>{staffName}</b></span>
        <button
          onClick={onLogout}
          className="bg-[#ffd600] text-black px-3 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
        >
          Logout
        </button>
      </div>
    </header>
  );
}