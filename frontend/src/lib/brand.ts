/**
 * Single source of truth for the product name and key copy.
 * The product is called Tandem — named after the tandem bicycle: people moving together toward a shared destination.
 * UI strings read the name from here (seed text and docs spell it out).
 */
export const BRAND = {
  name: 'Tandem',
  tagline: 'Better Together. Calgary Connected.',
  heroHeadline: 'Find your people. Find your Calgary.',
  heroSubheading:
    'From sunrise runs to late-night movie clubs, discover real experiences and meaningful connections with people who share your interests.',
  principle: 'Less scrolling. More doing.',
  valueProp: 'Find your people through the things you love doing.',
  closingLine: "doesn't measure how many people follow you. It helps you find people to go somewhere with.",
  mission: 'Make Calgary feel smaller, more welcoming, and more connected, one shared experience at a time.',
} as const

/** "Tandem Miles" */
export const MILES_NAME = `${BRAND.name} Miles`
