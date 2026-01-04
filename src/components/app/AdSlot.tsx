"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({
  slot,
  format = "auto",
  fullWidthResponsive = true,
  minHeight = 90,
  className
}: {
  slot: string;
  format?: string;
  fullWidthResponsive?: boolean;
  minHeight?: number;
  className?: string;
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "";
  const enabled = Boolean(client && slot && process.env.NODE_ENV === "production");

  useEffect(() => {
    if (!enabled) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {}
  }, [enabled, slot]);

  if (!enabled) return null;

  return (
    <div className={className} style={{ minHeight, width: "100%" }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      />
    </div>
  );
}
