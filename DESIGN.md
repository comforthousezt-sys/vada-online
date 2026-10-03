---
name: VADA Renaissance Chaos
colors:
  background: '#12242a'
  surface: '#1d343a'
  primary: '#e3bd76'
  text: '#f1eadc'
  muted: '#b4c1bd'
  danger: '#f39c92'
typography:
  display:
    fontFamily: 'Georgia, Times New Roman, serif'
  body:
    fontFamily: 'Segoe UI, Arial, sans-serif'
  utility:
    fontFamily: 'Consolas, monospace'
spacing:
  unit: '6px'
rounded:
  control: '6px'
  panel: '12px'
---

# VADA design contract

An illuminated strategy table in a quiet Renaissance council chamber. A bronze and stone parliament is the hero. The teal board carries muted terracotta, ochre, sage and slate districts; five original NUMBRA use distinct silhouettes. This is a Ukrainian game for friends, not an administration dashboard.

The signature is the real interactive tabletop visible before starting a match. The left menu resembles a manuscript index; clear sans-serif controls surround the serif titles. State changes use precise labels and short explanations. No external fonts are required.

Token ownership: web/src/tokens.css owns runtime values. This document mirrors the accepted semantic values; components consume CSS variables. Babylon scene materials are authored world materials, not UI tokens. The Board reads creature/group colors from shared/content.ts, also used by ownership badges.

Desktop: side rail 240px, scene uses the remaining space; game details occupy a 310px panel. Phone: scene above naturally scrolling controls, navigation wraps, all actions remain reachable. Minimum target size 40px. Global scrollbars remain visible. Focus uses a gold outline. Reduced motion removes camera interpolation and cosmetic motion. Accessible HTML map buttons are always available as an alternative to the canvas.

No store, checkout, NFT, ranking or server account claim appears in this alpha. Collection and Manuscript are explicitly a reference archive until their persistent progression systems ship.
