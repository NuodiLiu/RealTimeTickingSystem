import { useState } from "react";
import { CopyIcon, CheckIcon } from "./Icons";

interface CopyButtonProps {
  text: string;
  ariaLabel?: string;
  className?: string;
}

export default function CopyButton({ 
  text, 
  ariaLabel = `Copy ${text}`,
  className = "flex items-center justify-center p-1 rounded transition-colors duration-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
}: CopyButtonProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success'>('idle');

  const copyToClipboard = async () => {
    if (!text) return;
    
    try {
      setCopyStatus('copying');
      await navigator.clipboard.writeText(text);
      setCopyStatus('success');
      
      // Reset status after 2 seconds
      setTimeout(() => {
        setCopyStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setCopyStatus('idle');
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  return (
    <button
      onClick={copyToClipboard}
      disabled={copyStatus === 'copying'}
      className={className}
      aria-label={ariaLabel}
      title="Copy"
    >
      {copyStatus === 'success' ? (
        <CheckIcon className="w-3.5 h-3.5" />
      ) : (
        <CopyIcon className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
