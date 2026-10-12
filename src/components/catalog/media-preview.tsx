"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";

type MediaPreviewProps = {
  src: string;
  alt: string;
  className: string;
  fallbackClassName?: string;
};

export function MediaPreview({ src, alt, className, fallbackClassName }: MediaPreviewProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={fallbackClassName ?? className} aria-label={`${alt} unavailable`}>
        <ImageOff className="size-6 text-slate-400" aria-hidden="true" />
      </span>
    );
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}
