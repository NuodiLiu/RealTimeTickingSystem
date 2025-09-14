import { useEffect, useState, useRef, RefObject } from "react";

interface TruncationResult {
  text: string;
  isTruncated: boolean;
}

export function useTextTruncation(originalText: string): {
  truncatedText: string;
  isTruncated: boolean;
  elementRef: RefObject<HTMLDivElement | null>;
} {
  const [truncatedText, setTruncatedText] = useState("");
  const [isTruncated, setIsTruncated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Function to truncate text by whole words
  const truncateByWords = (text: string, maxWidth: number): TruncationResult => {
    if (!elementRef.current) return { text, isTruncated: false };
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return { text, isTruncated: false };
    
    // Get computed styles from the element
    const styles = window.getComputedStyle(elementRef.current);
    context.font = `${styles.fontSize} ${styles.fontFamily}`;
    
    // Check if full text fits
    if (context.measureText(text).width <= maxWidth) {
      return { text, isTruncated: false };
    }
    
    const words = text.split(' ');
    let truncated = '';
    
    for (let i = 0; i < words.length; i++) {
      const testText = truncated + (truncated ? ' ' : '') + words[i];
      const testWithEllipsis = testText + '...';
      
      if (context.measureText(testWithEllipsis).width > maxWidth) {
        return { 
          text: truncated + (truncated ? '...' : ''), 
          isTruncated: true 
        };
      }
      
      truncated = testText;
    }
    
    return { text: truncated, isTruncated: false };
  };

  // Update truncated text when component mounts or originalText changes
  useEffect(() => {
    const updateTruncation = () => {
      if (elementRef.current && originalText) {
        // Get the actual available width for text (excluding padding)
        const containerWidth = elementRef.current.clientWidth;
        if (containerWidth > 0) { // Ensure the element is rendered
          const result = truncateByWords(originalText, containerWidth);
          setTruncatedText(result.text);
          setIsTruncated(result.isTruncated);
        }
      }
    };

    // Use a small delay to ensure the element is fully rendered
    const timeoutId = setTimeout(updateTruncation, 0);
    return () => clearTimeout(timeoutId);
  }, [originalText]);

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      if (elementRef.current && originalText) {
        // Get the actual available width for text (excluding padding)
        const containerWidth = elementRef.current.clientWidth;
        if (containerWidth > 0) {
          const result = truncateByWords(originalText, containerWidth);
          setTruncatedText(result.text);
          setIsTruncated(result.isTruncated);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [originalText]);

  return {
    truncatedText,
    isTruncated,
    elementRef
  };
}
