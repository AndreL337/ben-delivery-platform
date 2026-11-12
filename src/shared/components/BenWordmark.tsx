import React from 'react'

export interface BenWordmarkProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Concept B Locked Wordmark (`ben.`)
 * - Lowercase `ben.` in Outfit 800 ExtraBold (-0.05em tracking)
 * - Deep British Racing Green (#004225) on light surfaces; White (#FFFFFF) on dark HUD overlays
 * - Signature connecting route-bridge ligature between the crossbar of `e` and the stem of `n`
 * - Circular Primrose Yellow (#F6EB61) waypoint node ringed with a 2px #004225 outer border
 */
export const BenWordmark: React.FC<BenWordmarkProps> = ({
  variant = 'light',
  size = 'md',
  className = ''
}) => {
  const textColor = variant === 'dark' ? 'text-white' : 'text-[#004225]'
  const bridgeColor = variant === 'dark' ? '#FFFFFF' : '#004225'
  const sizeClasses =
    size === 'lg'
      ? 'text-[28px]'
      : size === 'sm'
      ? 'text-[19px]'
      : 'text-[24px]'

  return (
    <span
      className={`ben-wordmark ${sizeClasses} ${textColor} select-none ${className}`}
      aria-label="ben."
    >
      <span>b</span>
      <span className="relative inline-flex items-baseline">
        <span>e</span>
        {/* Signature Concept B Route-Bridge Ligature connecting 'e' crossbar into 'n' stem */}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 6"
          className="ben-ligature-bridge"
          fill="none"
        >
          <path
            d="M0 3H12"
            stroke={bridgeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
        <span>n</span>
      </span>
      <span className="ben-wordmark-dot" aria-hidden="true" />
    </span>
  )
}

export default BenWordmark
