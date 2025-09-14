import CopyButton from "./CopyButton";

interface ZIDWithCopyProps {
  zID: string;
  className?: string;
}

export default function ZIDWithCopy({ 
  zID, 
  className = "flex items-center gap-1 mb-3" 
}: ZIDWithCopyProps) {
  return (
    <div className={className}>
      <span className="text-xs text-gray-500 font-normal">
        {zID}
      </span>
      <CopyButton 
        text={zID}
        ariaLabel={`Copy student ID ${zID}`}
      />
    </div>
  );
}
