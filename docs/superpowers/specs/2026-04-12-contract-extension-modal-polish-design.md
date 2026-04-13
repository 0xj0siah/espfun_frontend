# ContractExtensionModal Design System Alignment

> **For agentic workers:** This spec covers a visual polish pass on `src/components/ContractExtensionModal.tsx`. No functionality changes. No new features.

**Goal:** Align the ContractExtensionModal with the app's design system — semantic CSS variables, consistent spacing, standardized animations, proper component variants.

**Scope:** Polish only. Layout structure, game selection logic, cost calculation, and transaction flow are untouched.

**File:** `src/components/ContractExtensionModal.tsx` (single file change)

---

## 1. Color & Theme Treatment

Replace all hard-coded Tailwind colors with semantic CSS variables. Eliminate manual `dark:` overrides.

| Element | Current | New |
|---------|---------|-----|
| Cost breakdown card background | `bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200` | `bg-card border` |
| Cost total gradient text | `from-blue-600 to-indigo-600` | `from-primary to-blue-600` |
| Cost divider | `border-blue-200 dark:border-blue-800` | `border-border` |
| Extend button gradient | `from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700` | `from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700` |
| New total banner | `bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800` | `bg-accent` with semantic green for icon/text |
| New total text | `text-green-600 dark:text-green-400` | `text-green-600 dark:text-green-400` (keep — no semantic "success" token) |
| Status alert (success) | `bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800` | `bg-accent border-border` with green icon |
| Status alert (error) | `bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800` | `bg-destructive/10 border-destructive/20` |
| Status alert (pending) | `bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800` | `bg-primary/10 border-primary/20` |
| Alert icons (success) | `text-green-600 dark:text-green-400` | `text-green-600 dark:text-green-400` |
| Alert icons (error) | `text-red-600 dark:text-red-400` | `text-destructive` |
| Alert icons (pending) | `text-blue-600 dark:text-blue-400` | `text-primary` |

## 2. Layout & Spacing

No structural changes. Tighten spacing system and normalize to gap-based flex.

| Element | Current | New |
|---------|---------|-----|
| Content wrapper | `space-y-6 mt-6` | `space-y-4 mt-4` |
| Status card border | `border-2 border-dashed` | `border` (no dashed — not used elsewhere in app) |
| Game selector row | `space-x-3` | `gap-3` |
| Header badges | `space-x-2` | `gap-2` |
| Header image + text | `space-x-4` | `gap-4` |
| Action buttons row | `space-x-3` | `gap-3` |

Where `space-x-*` is used on flex containers, replace with `gap-*`. Vertical `space-y-*` stays.

## 3. Animation & Motion

### Entrance stagger

Standardize delays to 0.05s increments:

| Section | Current delay | New delay |
|---------|--------------|-----------|
| Status card | 0.1s | 0.05s |
| Game selector | 0.15s | 0.10s |
| Cost breakdown | 0.2s | 0.15s |
| New total | 0.25s | 0.20s |
| Action buttons | 0.3s | 0.25s |

Pattern stays the same: `initial={{ opacity: 0, y: 10 }}` / `animate={{ opacity: 1, y: 0 }}`.

### Shrink-close effect

Replace inline `style` prop with motion variants:

```tsx
const modalVariants = {
  visible: { opacity: 1, scale: 1 },
  hidden: { opacity: 0, scale: 0.05 }
};

// Wrapper inside DialogContent:
<motion.div
  variants={modalVariants}
  initial="visible"
  animate={isModalContentVisible ? "visible" : "hidden"}
  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
>
```

Remove the `style` prop from `DialogContent`. The `!animate-none` and `origin-center` classes on DialogContent stay to prevent Radix's default animation from conflicting.

### Status alert

`AnimatePresence` block is already clean. No changes.

## 4. Component Details

### Status badge

Replace verbose conditional classes with badge variants:

| Status | Current (6+ classes per state) | New |
|--------|-------------------------------|-----|
| expiring | `bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800` | `variant="destructive"` |
| active | `bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800` | `variant="secondary"` + `text-yellow-600 dark:text-yellow-400` |
| healthy | `bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800` | `variant="secondary"` + `text-green-600 dark:text-green-400` |

### Progress bar

| Status | Current | New |
|--------|---------|-----|
| expiring | `[&>[data-slot=progress-indicator]]:bg-red-500` | `[&>[data-slot=progress-indicator]]:bg-destructive` |
| active | `[&>[data-slot=progress-indicator]]:bg-yellow-500` | `[&>[data-slot=progress-indicator]]:bg-yellow-500` (keep — no warning token) |
| healthy | `[&>[data-slot=progress-indicator]]:bg-green-500` | `[&>[data-slot=progress-indicator]]:bg-primary` |

### Buttons

- **Extend:** Gradient updated per color section above
- **Cancel:** `variant="outline"` — no change
- **Close (X):** Ghost + `rounded-full` — no change

---

## Out of Scope

- Game selection logic (min 5, max 100, step 5)
- Cost calculation formula
- Transaction flow (pending/success/error states)
- New features or UI sections
- Layout restructuring
