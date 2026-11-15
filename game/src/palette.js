// The look plan, in one place. DUSTLINE is a desert canyon rail yard at
// noon: warm sand and sun-bleached rock against a hard blue sky, with the
// payload cart's ember-orange beacon as the one strong colour on the track —
// so the objective reads at a glance even from the far lane. The same names
// are the CSS custom properties in index.html and the procedural textures in
// textures.js; no other colour appears. Day is not a filter on the old yard:
// the whole scene is lit for it — a high sun with shadows, dust haze in the
// air, heat-pale rock walls for the canyon, and rail steel that glints.
export const PALETTE = {
  canvas: '#c8a06a', // sand floor, sun-bleached
  surface: '#b08d5e', // rock walls, warm sandstone
  hairline: '#8a6f4a', // darker rock seams
  ink: '#1c1410', // dark text on light sand
  muted: '#6b5a44',
  accent: '#ff7a1a', // EMBER attackers
  alloy: '#2ec4b6', // ALLOY defenders
  danger: '#ff3b30',
  steel: '#7a7468', // rail steel, weathered
  sun: '#ffd9a0', // high noon sun
  crate: '#8a6b42',
  rust: '#8a4a26', // rusted containers
  tealbox: '#2e6b62', // teal containers, sun-faded
  olive: '#6b6b3a', // third container colour
  bridge: '#6e5a40', // rail bridge deck and legs
  hazard: '#d8a013', // hazard stripes
  container: '#4a6b72', // brushed container steel
  pipe: '#6e5a40', // overhead pipes
  lamp: '#ffb347', // site lamps (unused at noon, kept for the palette)
  smoke: '#a89a82', // smoke grenade cloud, dust-coloured
  sky: '#7fb2d9', // hard blue desert sky
  rock: '#a87e52', // canyon rock faces
  beacon: '#8a9ab0', // neutral checkpoint marker
  rail: '#3a3a3e', // rail steel, dark against the sand
};
