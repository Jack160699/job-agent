# Kairela brand system

Design tokens live in `src/app/globals.css`. Components in `src/components/brand/`.

## Positioning

- **Name:** Kairela
- **Promise:** Kairela manages your job search with honesty, clarity, and care.
- **Audience:** Job seekers (22–30), employers, recruiters, agencies

## Voice

Human, professional, optimistic, calm, trustworthy, intelligent. Avoid hype and generic AI visual clichés.

## Logo

- **Mark:** Upward path with center point — career momentum with a human center
- **Wordmark:** Geist Sans semibold
- **Files:** `public/icons/favicon.svg`, `public/icons/apple-touch-icon.svg`

## Color tokens

| Token | Value | Use |
|-------|-------|-----|
| `--canvas` | `#f7f6f3` | Page background (warm paper) |
| `--surface` | `#ffffff` | Cards, panels |
| `--ink` | `#1a1a18` | Primary text |
| `--accent` | `#0d7c66` | Brand teal, CTAs |
| `--accent-muted` | `#e6f5f1` | Selected states |
| `--success` | `#15803d` | Positive status |
| `--warning` | `#b45309` | Caution |
| `--error` | `#b91c1c` | Errors |

## Typography

- **Sans:** Geist Sans (`--font-geist-sans`)
- **Mono:** Geist Mono (`--font-geist-mono`)
- Scale: `--text-xs` through `--text-2xl`

## Spacing & layout

- Base grid: 4px (`--space-1` … `--space-10`)
- Tap target minimum: 44px (`--tap-target`)
- Radius: `--radius-xs` (4px) … `--radius-lg` (14px)

## Usage

```tsx
import { KairelaLogo } from "@/components/brand/kairela-logo";
import { BRAND } from "@/lib/brand";
```
