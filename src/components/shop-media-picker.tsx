"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

type ShopMediaPickerProps = {
  name: "logo" | "banner";
  currentUrl: string;
  alt: string;
  inputClassName: string;
  previewClassName: string;
  fallbackClassName: string;
};

export function ShopMediaPicker({
  name,
  currentUrl,
  alt,
  inputClassName,
  previewClassName,
  fallbackClassName,
}: ShopMediaPickerProps) {
  const [preview, setPreview] = useState(currentUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    setFailed(false);
    setPreview((oldPreview) => {
      if (oldPreview.startsWith("blob:")) URL.revokeObjectURL(oldPreview);
      return URL.createObjectURL(file);
    });
  }

  return (
    <>
      {preview && !failed ? (
        <Image src={preview} alt={alt} width={1200} height={400} unoptimized className={previewClassName} onError={() => setFailed(true)} />
      ) : (
        <span className={fallbackClassName} aria-label={`${alt} unavailable`}>
          <ImageOff className="size-6 text-slate-400" aria-hidden="true" />
        </span>
      )}
      <input name={name} type="file" accept="image/png,image/jpeg,image/webp" className={inputClassName} onChange={(event) => chooseFile(event.target.files?.[0])} />
    </>
  );
}
