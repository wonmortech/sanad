# Sanad: direction card

```
Subject noun:      the paper certificate and the signature it carries (guilloche security print + seal)
States:            1 plain paper (hero) -> 2 scanned: fields light up, seal turns green -> 3 forged copy: one field changes, seal breaks red
                   -> 4 travels issuer -> holder -> verifier (how it works) -> 5 checked in a chat (Telegram mock)
Register:          product with premium paper (serif display, ivory paper, mono for data)
Accent:            #1f8a74 guilloche teal (banknote / security-print green-blue); good = seal green, bad = forgery red
Type:              display Source Serif 4 / body Hanken Grotesk + Onest (Cyrillic) / data JetBrains Mono (all self-hosted, Latin + Cyrillic checked)
Signature:         a living certificate: canvas guilloche rosette and border that slowly breathe (moire), pointer tilt,
                   scan beam that verifies fields and stamps the seal; a forged copy visibly fails. Canvas 2D + CSS 3D, no WebGL.
Second moment:     the in-browser WebCrypto demo: flip one field, the real Ed25519 check fails
Differentiators:   "a QR code is not a signature"; offline verification; open standards, no token
Deliberately off:  coins, chains, blockchain imagery, gradients from violet to blue, invented users/logos/numbers, countdowns
```

Palette generated with `vau-design/scripts/palette.mjs --accent "#1f8a74"` (see `.qa/tokens.css`), then tuned to an ivory paper ground.
