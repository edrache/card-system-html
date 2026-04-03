export const ANIM = {
  liftScale: 1.15,           // scale factor when card is picked up (1.0 = no change)
  tiltMax: 40,               // maximum rotation in degrees during drag
  tiltVelocityScale: 180,     // higher value = less sensitive tilt (px of drag per full tilt)
  snapDuration: 0.05,        // duration of snap-to-slot/card animation in seconds
  snapEase: 'sine.in',       // easing for snap animation (GSAP easing string)
  liftDuration: 0.15,        // duration of lift and drop animations in seconds
  liftEase: 'o.out',         // easing when picking up a card
  dropEase: 'power3.in',     // easing when card falls back down after a click
  slotSnapRadius: 60,        // distance in px at which a card snaps to a slot
  cardSnapRadius: 60,        // distance in px at which a card snaps to another card
}
