# ContractExtensionModal Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align ContractExtensionModal with the app's design system — semantic colors, standardized spacing, proper motion variants, and component variants.

**Architecture:** Single-file edit to `src/components/ContractExtensionModal.tsx`. All changes are CSS class swaps and motion variant restructuring. No logic, props, or behavior changes.

**Tech Stack:** React, Tailwind CSS (oklch semantic variables), motion/react (Framer Motion v5+), shadcn/ui (Badge, Card, Progress, Button, Dialog)

**Spec:** `docs/superpowers/specs/2026-04-12-contract-extension-modal-polish-design.md`

---

## File Structure

- Modify: `src/components/ContractExtensionModal.tsx` (all 3 tasks touch this single file)

No new files. No test files — these are purely visual class name changes with no testable logic. Verification is visual via `npm run dev` and opening the modal.

---

### Task 1: Replace shrink-close inline styles with motion variants and standardize stagger delays

**Files:**
- Modify: `src/components/ContractExtensionModal.tsx:10-11,111-121,184-214,217-258,261-286,289-302,332-360`

- [ ] **Step 1: Add motion variants object above the component**

At line 13 (after the imports, before the interface), add:

```tsx
const modalVariants = {
  visible: { opacity: 1, scale: 1 },
  hidden: { opacity: 0, scale: 0.05 },
};
```

- [ ] **Step 2: Replace DialogContent inline style with motion.div wrapper**

Replace the current DialogContent (lines 113-121):

```tsx
      <DialogContent
        className="max-w-md border-0 shadow-2xl !animate-none origin-center"
        hideCloseButton
        style={{
          opacity: isModalContentVisible ? 1 : 0,
          scale: isModalContentVisible ? '1' : '0.05',
          transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), scale 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="relative">
```

With:

```tsx
      <DialogContent
        className="max-w-md border-0 shadow-2xl !animate-none origin-center"
        hideCloseButton
      >
        <motion.div
          className="relative"
          variants={modalVariants}
          initial="visible"
          animate={isModalContentVisible ? "visible" : "hidden"}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
```

And at the bottom of the component, replace the closing `</div>` before `</DialogContent>` (line 362):

```tsx
        </motion.div>
```

- [ ] **Step 3: Standardize all stagger delays to 0.05s increments**

Update each `motion.div` transition delay:

Status card (currently `delay: 0.1`):
```tsx
            transition={{ delay: 0.05 }}
```

Game selector (currently `delay: 0.15`):
```tsx
            transition={{ delay: 0.1 }}
```

Cost breakdown (currently `delay: 0.2`):
```tsx
            transition={{ delay: 0.15 }}
```

New total (currently `delay: 0.25`):
```tsx
            transition={{ delay: 0.2 }}
```

Action buttons (currently `delay: 0.3`):
```tsx
            transition={{ delay: 0.25 }}
```

- [ ] **Step 4: Verify the build compiles**

Run: `cd C:/Users/josiah/Downloads/espfunfrontend/espfun_frontend && npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/josiah/Downloads/espfunfrontend/espfun_frontend
git add src/components/ContractExtensionModal.tsx
git commit -m "refactor(ContractExtensionModal): replace inline style animation with motion variants

Swap raw CSS style prop for proper motion/react variants object.
Standardize entrance stagger delays to 0.05s increments."
```

---

### Task 2: Replace hard-coded colors with semantic CSS variables

**Files:**
- Modify: `src/components/ContractExtensionModal.tsx`

All changes in this task are CSS class replacements. No structural changes.

- [ ] **Step 1: Update status badge classes**

Replace the status badge (the Badge inside the status card with the conditional className):

```tsx
                <Badge
                  variant="secondary"
                  className={`${
                    contractStatus === 'expiring' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                    contractStatus === 'active' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' :
                    'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                  }`}
                >
```

With:

```tsx
                <Badge
                  variant={contractStatus === 'expiring' ? 'destructive' : 'secondary'}
                  className={
                    contractStatus === 'active' ? 'text-yellow-600 dark:text-yellow-400' :
                    contractStatus === 'healthy' ? 'text-green-600 dark:text-green-400' :
                    ''
                  }
                >
```

- [ ] **Step 2: Update progress bar classes**

Replace the Progress className:

```tsx
              <Progress
                value={Math.min((gamesRemaining / 10) * 100, 100)}
                className={`h-2 ${
                  contractStatus === 'expiring' ? '[&>[data-slot=progress-indicator]]:bg-red-500' :
                  contractStatus === 'active' ? '[&>[data-slot=progress-indicator]]:bg-yellow-500' :
                  '[&>[data-slot=progress-indicator]]:bg-green-500'
                }`}
              />
```

With:

```tsx
              <Progress
                value={Math.min((gamesRemaining / 10) * 100, 100)}
                className={`h-2 ${
                  contractStatus === 'expiring' ? '[&>[data-slot=progress-indicator]]:bg-destructive' :
                  contractStatus === 'active' ? '[&>[data-slot=progress-indicator]]:bg-yellow-500' :
                  '[&>[data-slot=progress-indicator]]:bg-primary'
                }`}
              />
```

- [ ] **Step 3: Update cost breakdown card**

Replace the cost Card:

```tsx
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200">
```

With:

```tsx
            <Card className="p-4 bg-card border">
```

- [ ] **Step 4: Update cost total gradient text**

Replace:

```tsx
                    <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
```

With:

```tsx
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
```

- [ ] **Step 5: Update cost divider**

Replace:

```tsx
                <div className="border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
```

With:

```tsx
                <div className="border-t border-border pt-2 mt-2">
```

- [ ] **Step 6: Update new total banner**

Replace:

```tsx
            className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
```

With:

```tsx
            className="flex items-center justify-between p-4 bg-accent rounded-lg border border-border"
```

- [ ] **Step 7: Update status alert classes**

Replace the Alert className conditional:

```tsx
                <Alert className={`${
                  transactionStatus === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                  transactionStatus === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                  'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                }`}>
```

With:

```tsx
                <Alert className={`${
                  transactionStatus === 'success' ? 'bg-accent border-border' :
                  transactionStatus === 'error' ? 'bg-destructive/10 border-destructive/20' :
                  'bg-primary/10 border-primary/20'
                }`}>
```

- [ ] **Step 8: Update alert icon classes**

Replace the AlertCircle className conditional:

```tsx
                  <AlertCircle className={`h-4 w-4 ${
                    transactionStatus === 'success' ? 'text-green-600 dark:text-green-400' :
                    transactionStatus === 'error' ? 'text-red-600 dark:text-red-400' :
                    'text-blue-600 dark:text-blue-400'
                  }`} />
```

With:

```tsx
                  <AlertCircle className={`h-4 w-4 ${
                    transactionStatus === 'success' ? 'text-green-600 dark:text-green-400' :
                    transactionStatus === 'error' ? 'text-destructive' :
                    'text-primary'
                  }`} />
```

- [ ] **Step 9: Update extend button gradient**

Replace:

```tsx
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
```

With:

```tsx
              className="flex-1 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700"
```

- [ ] **Step 10: Verify the build compiles**

Run: `cd C:/Users/josiah/Downloads/espfunfrontend/espfun_frontend && npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 11: Commit**

```bash
cd C:/Users/josiah/Downloads/espfunfrontend/espfun_frontend
git add src/components/ContractExtensionModal.tsx
git commit -m "style(ContractExtensionModal): replace hard-coded colors with semantic CSS variables

Migrate all blue/green/red hard-coded Tailwind classes to semantic
tokens (bg-card, bg-accent, bg-destructive, bg-primary, border-border).
Use proper Badge variant='destructive' for expiring status.
Eliminates manual dark: overrides throughout the modal."
```

---

### Task 3: Normalize spacing (space-x to gap, tighten content wrapper, drop dashed border)

**Files:**
- Modify: `src/components/ContractExtensionModal.tsx`

- [ ] **Step 1: Tighten content wrapper spacing**

Replace:

```tsx
          <div className="space-y-6 mt-6">
```

With:

```tsx
          <div className="space-y-4 mt-4">
```

- [ ] **Step 2: Drop dashed border from status card**

Replace:

```tsx
            <Card className="p-4 border-2 border-dashed">
```

With:

```tsx
            <Card className="p-4 border">
```

- [ ] **Step 3: Normalize header image + text spacing**

Replace:

```tsx
                <div className="flex items-center space-x-4">
```

With:

```tsx
                <div className="flex items-center gap-4">
```

- [ ] **Step 4: Normalize header badges spacing**

Replace:

```tsx
                  <div className="flex items-center space-x-2 mt-2">
```

With:

```tsx
                  <div className="flex items-center gap-2 mt-2">
```

- [ ] **Step 5: Normalize game selector row spacing**

Replace:

```tsx
            <div className="flex items-center space-x-3">
```

With:

```tsx
            <div className="flex items-center gap-3">
```

- [ ] **Step 6: Normalize action buttons spacing**

Replace:

```tsx
            className="flex space-x-3"
```

With:

```tsx
            className="flex gap-3"
```

- [ ] **Step 7: Normalize new total icon spacing**

Replace:

```tsx
            <div className="flex items-center space-x-2">
```

With:

```tsx
            <div className="flex items-center gap-2">
```

- [ ] **Step 8: Verify the build compiles**

Run: `cd C:/Users/josiah/Downloads/espfunfrontend/espfun_frontend && npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 9: Visual verification**

Run: `cd C:/Users/josiah/Downloads/espfunfrontend/espfun_frontend && npm run dev`

Open the app in a browser. Navigate to a player you own and open the contract extension modal. Verify:
- Modal opens with smooth entrance animations (staggered sections)
- Close button shrinks the modal to a point before dismissing
- Status badge shows correct color for the player's contract status
- Cost breakdown card uses the app's card background (not blue gradient)
- Cost total text and extend button use the primary-to-blue gradient
- New total banner uses subtle accent background
- +/- buttons and game input are evenly spaced
- No visual regressions in dark mode

- [ ] **Step 10: Commit**

```bash
cd C:/Users/josiah/Downloads/espfunfrontend/espfun_frontend
git add src/components/ContractExtensionModal.tsx
git commit -m "style(ContractExtensionModal): normalize spacing to gap-based flex

Replace space-x-* with gap-* on flex containers. Tighten content
wrapper from space-y-6 to space-y-4. Drop dashed border from
status card to match app conventions."
```
