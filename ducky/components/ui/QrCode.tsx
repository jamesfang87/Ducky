"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Black on white whatever the theme, so phone cameras always read it. */
export function QrCode({ value, size = 112, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 3, errorCorrectionLevel: "M" })
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [value, size]);
  if (!src) return <div style={{ width: size, height: size }} className="rounded-lg bg-ground" aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={label} className="rounded-lg bg-white p-1" />;
}
