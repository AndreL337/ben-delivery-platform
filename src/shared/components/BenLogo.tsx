import React from 'react'

export interface BenLogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

/**
 * Reusable Inline SVG Component (<BenLogo />) — Concept B Lowercase Connected Wordmark (`ben.`)
 * - #004225 British Racing Green lettering on light surfaces (#FFFFFF on dark HUD overlays)
 * - Continuous horizontal route-bridge connecting the crossbar of `e` into the left stem of `n`
 * - Circular Primrose Yellow (#F6EB61) waypoint dot ringed with a 2px #004225 border
 */
export const BenLogo: React.FC<BenLogoProps> = ({
  variant = 'light',
  size = 'md',
  className = ''
}) => {
  const fillPrimary = variant === 'dark' ? '#FFFFFF' : '#004225'
  const heightMap: Record<NonNullable<BenLogoProps['size']>, number> = {
    sm: 20,
    md: 26,
    lg: 32,
    xl: 40
  }
  const heightPx = heightMap[size]
  const widthPx = Math.round(heightPx * 2.55)

  return (
    <svg
      width={widthPx}
      height={heightPx}
      viewBox="0 0 112 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ben."
      className={`inline-block select-none shrink-0 ${className}`}
    >
      {/* Lowercase 'b': vertical ascender stem + geometric bowl */}
      <path
        d="M6 5H13.5V16.8C15.2 14.9 17.8 13.8 21 13.8C27.5 13.8 32.4 18.8 32.4 25.9C32.4 33 27.5 38 21 38C17.6 38 15 36.8 13.3 34.7V37.4H6V5ZM19.2 31.3C22.5 31.3 24.9 29 24.9 25.9C24.9 22.8 22.5 20.5 19.2 20.5C15.9 20.5 13.5 22.8 13.5 25.9C13.5 29 15.9 31.3 19.2 31.3Z"
        fill={fillPrimary}
      />

      {/* Lowercase 'e' with continuous horizontal bridge extending from crossbar into 'n' stem */}
      <path
        d="M47.8 13.8C55.1 13.8 59.8 18.6 59.8 25.4C59.8 26.3 59.7 27.2 59.6 27.9H42.5C43.1 30.6 45.3 32.1 48.3 32.1C50.7 32.1 52.4 31.2 53.5 29.7L59.2 33C57.1 36.3 53.3 38 48.1 38C40.3 38 35.2 33.1 35.2 25.9C35.2 18.7 40.3 13.8 47.8 13.8ZM42.6 23.1H52.7C52.2 20.6 50.4 19.2 47.8 19.2C45.1 19.2 43.2 20.6 42.6 23.1Z"
        fill={fillPrimary}
      />

      {/* Continuous horizontal route-bridge from 'e' crossbar into left stem of 'n' */}
      <rect x="52" y="22.8" width="16" height="5.1" rx="1" fill={fillPrimary} />

      {/* Lowercase 'n': left stem + arch + right stem */}
      <path
        d="M64.2 14.4H71.4V17.4C73.1 15 75.7 13.8 79.1 13.8C84.8 13.8 88.5 17.5 88.5 23.7V37.4H81V24.9C81 21.8 79.3 20.1 76.5 20.1C73.6 20.1 71.7 22 71.7 25.2V37.4H64.2V14.4Z"
        fill={fillPrimary}
      />

      {/* Terminal Waypoint Node (`.`): Primrose Yellow (#F6EB61) with 2px British Racing Green (#004225) outer ring */}
      <circle
        cx="99.5"
        cy="31.8"
        r="5.6"
        fill="#F6EB61"
        stroke="#004225"
        strokeWidth="2.2"
      />
    </svg>
  )
}

export default BenLogo
