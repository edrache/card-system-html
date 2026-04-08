export const CARD = {
  width: 150,                                    // card width in px
  height: 210,                                   // card height in px
  borderRadius: 10,                              // corner rounding in px
  bgColor: 'oklch(96% 0.018 85)',               // warm cream paper
  outlineColor: 'oklch(22% 0.03 265)',          // dark ink card border
  outlineWidth: 2,                               // card border width in px
  slotBorderColor: 'oklch(68% 0.09 85 / 0.45)', // muted gold slot border (resting)
  slotOutlineColor: 'oklch(76% 0.13 85)',        // bright gold slot highlight when card is nearby
  fontFamily: "'Gravitas One', serif",           // font family for card text
  fontSize: 22,                                  // font size for card label text in px
  padding: 10,                                   // inner padding of the card in px
  shadow: '1px 3px 8px oklch(5% 0.04 152 / 0.45), 0 1px 3px oklch(5% 0.04 152 / 0.25)',
  shadowLifted: '4px 14px 32px oklch(5% 0.04 152 / 0.62), 0 4px 10px oklch(5% 0.04 152 / 0.32)',
  hoverOutlineColor: 'oklch(74% 0.13 85)',       // warm gold card border on hover
  tooltipDelay: 1000,                             // delay in ms before tooltip appears on hover
}
