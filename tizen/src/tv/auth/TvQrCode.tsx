import React from 'react';

interface TvQrCodeProps {
  url: string;
  size?: number;
}

export const TvQrCode: React.FC<TvQrCodeProps> = ({ url, size = 180 }) => {
  // Generates clean SVG QR code via lightweight SVG generator or SVG data URI
  const encodedUrl = encodeURIComponent(url);
  const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedUrl}&format=svg`;

  return (
    <div
      className="bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center shrink-0 border border-white/20"
      style={{ width: size + 24, height: size + 24 }}
    >
      <img src={qrApi} alt="QR Code" width={size} height={size} className="block" />
    </div>
  );
};

