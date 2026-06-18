import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QRCodeCanvasProps {
  value: string
  size?: number
  className?: string
  darkColor?: string
  lightColor?: string
}

export default function QRCodeCanvas({
  value,
  size = 160,
  className = '',
  darkColor = '#1f2937',
  lightColor = '#ffffff',
}: QRCodeCanvasProps) {
  const [dataUrl, setDataUrl] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch((err) => {
        console.error('[QRCodeCanvas] failed to generate QR:', err)
      })
    return () => {
      cancelled = true
    }
  }, [value, size, darkColor, lightColor])

  if (!dataUrl) {
    return (
      <div
        className={`rounded-lg bg-white/40 dark:bg-white/5 animate-pulse ${className}`}
        style={{ width: size, height: size }}
        aria-label="Loading QR code"
      />
    )
  }

  return (
    <img
      src={dataUrl}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      className={`block rounded-lg ${className}`}
      loading="lazy"
      decoding="async"
    />
  )
}
