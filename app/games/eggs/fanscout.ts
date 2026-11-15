// ─── Sneaky Eggs: the FanScout house ad ─────────────────────────────────────
//
// Everything that makes the ad look and read like FanScout lives here: the
// winged-F mark, the brand colours and the lines of copy. They are copied from
// the FanScout app (`public/fanscout-logo-simple.svg`, `src/theme/palette.ts`
// and the landing page), so if the brand changes there, change it here too.
//
// How long the ad runs and what it pays out is game tuning, and lives in
// `config.ts` (`AD_REWARDS` and friends).

/** FanScout's brand colours (`brand` and `sectionSurfaces` in its palette). */
export const FS = {
  green: "#81c04d",
  greenDark: "#6aab3a",
  greenLight: "#9bd168",
  blue: "#4d81c0",
  pink: "#c04d81",
  /** The near-black band behind the hero on fanscoutapp.com. */
  slab: "#0f1923",
  slabLight: "#1f2630",
  ink: "#e7ecf3",
  muted: "#a5b0bf",
} as const;

export const FANSCOUT = {
  name: "FanScout",
  /** Shown on the ad, the way the share card shows it. */
  site: "fanscoutapp.com",
  cta: "Visit FanScout",
} as const;

/** Where a tap on the ad goes. `placement` says which spot in the game sent them. */
export const fanscoutUrl = (placement: string) =>
  `https://fanscoutapp.com/?utm_source=sneaky-eggs&utm_medium=house-ad&utm_campaign=${encodeURIComponent(placement)}`;

/** The winged-F mark as one SVG path, drawn in a 512 x 512 box. */
export const FANSCOUT_MARK_BOX = 512;
export const FANSCOUT_MARK =
  "M416.1 97.8L409.8 99.1L408.6 99.6L397 102.5L365.3 111.9L349 117L343.2 118.6L335.8 121.1" +
  "L330.1 122.6L324.8 124.4L319.2 126L286.9 136L277.4 139.2L273.9 140.1L266.8 142.5L250.7 147.4" +
  "L249.8 147.9L242 150.1L239.1 151.3L220.6 156.8L185.5 168L175.5 170.9L160 176.1L140 182.3" +
  "L121.3 189L112.4 193.2L107.6 195.7L103.5 198.6L96.5 204.4L90.5 211.7L88.1 215.3L86.7 218.1" +
  "L84 225.1L82.6 233.1L82.5 407.5L83.1 408.7L83.4 410.3L84.3 411.7L86.3 413.6L88.1 414.2" +
  "L89.7 414.3L94.3 412.9L97.9 410.6L104.3 404.3L109.2 398.3L120.4 385.8L130.2 376L139.1 368.4" +
  "L149.2 360.9L158.6 354.9L166.2 350.7L179.6 344.6L187.2 341.9L195.4 339.3L209.2 335.9L216.5 334.6" +
  "L218.7 334.4L220.3 333.9L235.2 331.9L239.3 331.7L249 330.5L261.2 329.7L267.1 329L277.6 327" +
  "L286.4 324.4L295.1 320.3L300.8 316.4L306.2 311.6L309.8 307.5L312.6 302.7L313.9 298.9L314 294.5" +
  "L313.8 293.6L312.2 291.7L310.9 290.9L308.2 290.3L301.8 289.7L288.9 290.4L285.3 290.8L279.6 290.9" +
  "L262.9 292.8L258.9 293L243.5 295L226.6 297.7L225 298.2L208.3 301.1L197.4 303.6L189.3 305.1" +
  "L178.4 307.8L166.1 311.1L149.5 316.5L138.1 321.1L129.4 325.8L123.7 329.4L116.3 335.1L116.2 327.4" +
  "L117.6 321.8L118.9 318.6L120.2 316L123.6 311.4L127.4 307.7L132.3 304L138.1 300.5L146.6 296.4" +
  "L156.8 292.3L165.2 289.6L179.5 285.6L181 285.4L182 284.9L183.6 284.8L184.7 284.3L189.1 283.4" +
  "L190.1 282.9L191.7 282.8L204.6 279.6L206.3 279.4L207.6 278.9L244.3 272.2L272.3 268.1L282 267.2" +
  "L308.4 264.1L312.1 264L315.4 263.4L320.4 263.3L322.8 262.9L331.1 262.1L335.9 262L341.1 260.6" +
  "L342.7 259.9L346.9 256.9L353.5 251L363.2 240.6L368.7 233.7L374.3 225.5L377 220.9L379.7 215.5" +
  "L381 212L381.7 209.4L381.7 204.1L381.1 202.6L379.1 200.7L375.7 199.8L367.6 199.8L360.9 200.4" +
  "L345.6 202.4L343.4 202.9L340.8 203.1L327.9 205.6L321.9 206.4L320.4 206.9L318.3 207.1L301.1 210.5" +
  "L287.4 213.7L279.1 215.2L271.8 217L270 217.2L268.7 217.7L267.1 217.9L262.6 219L260.9 219.2" +
  "L259.7 219.7L255.3 220.5L254.2 221L252.5 221.2L243.1 223.7L241.4 223.9L240.3 224.4L230.6 226.6" +
  "L229.4 227L222.4 228.6L196.7 235.3L178.9 240.5L172.7 242L159.7 246L144.4 251.4L136 254.8" +
  "L126.3 259.5L117 265.3L116.9 261.1L117.6 257.1L119 252.6L120.9 248.4L123.1 244.8L127.3 240.3" +
  "L130.3 237.7L134.4 234.8L142 230.6L146.6 228.6L155.6 225.2L171.9 220.3L174.9 219.2L178.6 218.3" +
  "L186.2 215.9L195 213.7L205.4 210.5L227.1 204.9L230.7 203.8L237.4 202.2L243.6 200.4L245.1 200.2" +
  "L246.3 199.7L256.1 197.6L265.1 195.1L277.9 192.2L282 191L283.6 190.8L284.8 190.3L293.4 188.3" +
  "L298.3 187.5L317.5 183L326 181.4L340.4 178.3L345.8 177.4L347.2 176.9L349.1 176.8L350.6 176.2" +
  "L359.4 174.8L367.7 172.9L377.5 171.4L378.8 170.9L381.4 170.7L390.8 168.6L394.4 166.5L399.3 162.3" +
  "L405.4 155.5L409.2 150.3L415.2 141.7L419.3 135L422.1 129.5L422.6 129L428 116.8L429.3 111.8" +
  "L429.6 108L429.3 103.6L428.2 101L426 98.9L423.8 97.8Z";

export interface AdSlide {
  eyebrow: string;
  /** Two lines: the first white, the second FanScout green. */
  title: [string, string];
  body: string;
}

/** One slide per reward. The first is FanScout's own headline; the rest are its landing-page hooks. */
export const AD_SLIDES: AdSlide[] = [
  {
    eyebrow: "Your local fan scene",
    title: ["Find your fans.", "Watch together."],
    body: "See where your team is watching: live, nearby, right now.",
  },
  {
    eyebrow: "Game day",
    title: ["Check in.", "Rally the crowd."],
    body: "Earn points every time you show up and become the captain of your favorite spot.",
  },
  {
    eyebrow: "Live game chats",
    title: ["Talk during", "the game."],
    body: "Checking in drops you straight into your team's live chat. No group to find, no invite to chase.",
  },
  {
    eyebrow: "Never miss kickoff",
    title: ["Every game in", "your calendar."],
    body: "Pick your teams once and their whole season lands in your phone's calendar.",
  },
];
