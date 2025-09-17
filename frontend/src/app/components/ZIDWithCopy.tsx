import CopyButton from "./CopyButton";

interface ZIDWithCopyProps {
  zID: string | null;
  className?: string;
}

export default function ZIDWithCopy({ 
  zID, 
  className = "flex items-center gap-1 mb-3" 
}: ZIDWithCopyProps) {
  const displayZID = zID || "No zID provided";
  return (
    <div className={className}>
      <span className="text-xs text-gray-500 font-normal">
        {displayZID}
      </span>
      {zID && (
        <CopyButton 
          text={zID}
          ariaLabel={`Copy student ID ${zID}`}
        />
      )}
    </div>
  );
}
