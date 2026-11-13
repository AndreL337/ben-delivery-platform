import React from 'react'

export interface BenLogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

/**
 * Reusable Master Wordmark Component (<BenLogo />)
 * Renders the approved Concept B lowercase connected `ben.` master PNG (`/brand/ben-logo.png`)
 * with `mix-blend-multiply` so the #FFFFFF background blends transparently on light navbars & cards.
 */
export const BenLogo: React.FC<BenLogoProps> = ({
  variant = 'light',
  size = 'md',
  className = ''
}) => {
  const heightClassMap: Record<NonNullable<BenLogoProps['size']>, string> = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
    xl: 'h-12'
  }

  const imgElement = (
    <img
      src="/brand/ben-logo.png"
      alt="ben."
      className={`${heightClassMap[size]} w-auto object-contain mix-blend-multiply select-none shrink-0 ${
        variant === 'light' ? className : ''
      }`}
    />
  )

  if (variant === 'dark') {
    return (
      <span
        className={`inline-flex items-center rounded-lg bg-white/95 px-2 py-1 select-none shrink-0 ${className}`}
      >
        {imgElement}
      </span>
    )
  }

  return imgElement
}

export default BenLogo
