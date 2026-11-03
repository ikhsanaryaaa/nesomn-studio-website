import { Mail, Instagram } from 'lucide-react';

export function ContactIcon({
  kind,
}: {
  kind: 'mail' | 'gmail' | 'whatsapp' | 'instagram' | 'telegram';
}) {
  if (kind === 'mail') return <Mail size={24} aria-hidden="true" />;
  if (kind === 'instagram') return <Instagram size={24} aria-hidden="true" />;
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      {kind === 'gmail' ? (
        <path d="M3 19V5l9 7 9-7v14M3 5l9 7 9-7M3 19h4V9m14 10h-4V9" />
      ) : kind === 'telegram' ? (
        <path d="m3 11 18-7-4 17-6-6-4 3 1-6 10-6-7 9" />
      ) : (
        <>
          <path d="M20.5 11.7a8.5 8.5 0 0 1-12.8 7.4L3 20.5l1.4-4.6a8.5 8.5 0 1 1 16.1-4.2Z" />
          <path d="M8 7.5c-.8 2.3 1.8 6 5.2 7.5 1.5.6 2.7-.4 2.8-1.5l-2.5-1.2-.9 1c-1.5-.8-2.6-1.9-3.2-3.2l1-.8L9.2 7Z" />
        </>
      )}
    </svg>
  );
}
