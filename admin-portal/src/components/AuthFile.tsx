'use client';
import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Files are private: fetch with the access token, then show via an object URL. */
async function blobUrl(path: string) {
  const res = await api<Response>(`/files/${path}`, { raw: true });
  return URL.createObjectURL(await res.blob());
}

export function AuthImageLink({ path, children }: { path: string; children: ReactNode }) {
  return (
    <button type="button" className="font-medium text-brand-700 hover:text-brand-800" onClick={async () => window.open(await blobUrl(path), '_blank', 'noopener')}>
      {children}
    </button>
  );
}

export function AuthImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    blobUrl(path).then((u) => setSrc((url = u))).catch(() => setSrc(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return src ? <img src={src} alt={alt} className={className} /> : <div className={`bg-slate-100 ${className}`} aria-label={alt} />;
}
