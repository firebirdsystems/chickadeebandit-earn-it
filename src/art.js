// The two drawings Earn It shows: the chickadee wearing a medal, and the
// chickadee beside a target with an arrow in the bullseye.
//
// Pure string builders, so they can be dropped into a template and tested
// without a DOM. The bird is the hub mascot's geometry (ChickadeeIcon, 100×100)
// and the colours are the hub's brand palette, copied here because an app
// bundle cannot import from the hub. Each drawing sits on its own paper disc:
// the bird's black cap needs a light ground, whatever theme the app is in.

const C = {
  ink: "#1F1F22",
  charcoal: "#3C3D42",
  slate: "#62626A",
  cream: "#FEFCF6",
  paper: "#FAF1DC",
  body: "#EFE1BE",
  honey: "#E8A53A",
  honeyDark: "#D4913A",
  berry: "#C24D3F",
};

/** The bird, placed at (x, y) and scaled. `worn` is drawn over it, in the
 *  bird's own 100×100 coordinates. */
function bird(x, y, scale, worn = "") {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <path d="M 50 18 C 25 18, 16 38, 16 58 C 16 80, 30 92, 50 92 C 70 92, 84 80, 84 58 C 84 38, 75 18, 50 18 Z" fill="${C.body}"/>
    <path d="M 50 18 C 25 18, 16 38, 16 48 Q 16 52, 22 51 C 32 47, 68 47, 78 51 Q 84 52, 84 48 C 84 38, 75 18, 50 18 Z" fill="${C.ink}"/>
    <path d="M 72 56 C 80 62, 78 80, 70 86 C 62 84, 60 70, 64 60 Z" fill="${C.slate}"/>
    <path d="M 42 55 Q 50 67, 58 55 Q 58 64, 50 67 Q 42 64, 42 55 Z" fill="${C.ink}"/>
    <path d="M 46 53 L 50 60 L 54 53 Z" fill="${C.honey}"/>
    <circle cx="39" cy="43" r="4" fill="${C.body}"/><circle cx="39" cy="43" r="3" fill="${C.ink}"/><circle cx="39.8" cy="42.2" r="1" fill="${C.body}"/>
    <circle cx="61" cy="43" r="4" fill="${C.body}"/><circle cx="61" cy="43" r="3" fill="${C.ink}"/><circle cx="61.8" cy="42.2" r="1" fill="${C.body}"/>
    ${worn}
  </g>`;
}

function feet(x, y, spread, width = 3) {
  const half = spread / 2;
  return `<g stroke="${C.honey}" stroke-width="${width}" stroke-linecap="round" fill="none">
    <path d="M ${x - half} ${y} l -3 5 M ${x - half} ${y} l 3 5"/>
    <path d="M ${x + half} ${y} l -3 5 M ${x + half} ${y} l 3 5"/>
  </g>`;
}

function scene(size, label, inner) {
  return `<svg viewBox="0 0 160 160" width="${size}" height="${size}" role="img" aria-label="${label}" style="display:inline-block;vertical-align:middle">
    <circle cx="80" cy="80" r="80" fill="${C.paper}"/>
    ${inner}
  </svg>`;
}

// A berry ribbon from each shoulder to a honey medal on the chest, drawn over
// the wing so the ribbon is never cut by it.
const MEDAL = `
  <path d="M 27 53 L 50 72 L 73 53" fill="none" stroke="${C.berry}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="50" cy="77" r="8" fill="${C.honey}" stroke="${C.honeyDark}" stroke-width="2"/>
  <path transform="translate(50 77) scale(0.85) translate(-50 -82)" d="M 50 77 L 51.23 80.3 L 54.76 80.45 L 52 82.65 L 52.94 86.05 L 50 84.1 L 47.06 86.05 L 48 82.65 L 45.24 80.45 L 48.77 80.3 Z" fill="${C.cream}"/>`;

/** The chickadee wearing a medal. */
export function medalBird(size = 96) {
  return scene(size, "A chickadee wearing a medal", `
    <ellipse cx="80" cy="141" rx="40" ry="4.5" fill="${C.ink}" opacity="0.1"/>
    ${bird(26, 24, 1.08, MEDAL)}
    ${feet(80, 123, 12, 3.4)}`);
}

/** The chickadee beside a target, an arrow in the bullseye. */
export function targetBird(size = 96) {
  return scene(size, "A chickadee beside a target with an arrow in the bullseye", `
    <ellipse cx="80" cy="141" rx="56" ry="4.5" fill="${C.ink}" opacity="0.1"/>
    <path d="M 99 92 L 93 139 M 125 92 L 131 139" stroke="${C.charcoal}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="112" cy="62" r="34" fill="${C.berry}"/>
    <circle cx="112" cy="62" r="25.5" fill="${C.cream}"/>
    <circle cx="112" cy="62" r="17" fill="${C.berry}"/>
    <circle cx="112" cy="62" r="8.5" fill="${C.cream}"/>
    <path d="M 112 62 L 136 36" stroke="${C.charcoal}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M 136 36 l 9 -3 M 136 36 l 3 -9 M 131 41.4 l 9 -3 M 131 41.4 l 3 -9" stroke="${C.honey}" stroke-width="3" stroke-linecap="round"/>
    ${bird(4, 58, 0.74)}
    ${feet(41, 126, 10)}`);
}
