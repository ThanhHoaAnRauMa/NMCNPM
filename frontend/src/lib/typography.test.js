import { describe, expect, it } from 'vitest'

import tailwindConfig from '../../tailwind.config.js'

describe('frontend typography', () => {
  it('uses Vietnamese-capable sans-serif fallbacks for headings', () => {
    const displayFonts = tailwindConfig.theme.extend.fontFamily.display

    expect(displayFonts).toContain('Noto Sans')
    expect(displayFonts).toContain('Segoe UI')
    expect(displayFonts.at(-1)).toBe('sans-serif')
    expect(displayFonts).not.toContain('serif')
  })
})
