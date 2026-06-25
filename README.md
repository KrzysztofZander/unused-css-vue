# Unused CSS Vue

**Unused CSS Vue** is a Visual Studio Code extension that highlights unused CSS class and ID selectors inside Vue single-file components.

The extension scans `.vue` files, compares selectors declared in `<style>` blocks with usage found in `<template>` and `<script>`, and decorates the declared selectors with usage tooltips.

## Features

- Detects unused CSS class selectors, for example `.card`.
- Detects unused CSS ID selectors, for example `#hero`.
- Counts usages from static template attributes such as `class="card active"` and `id="hero"`.
- Supports common Vue bindings such as `:class="{ active: isActive }"`, `:class="['card', isActive ? 'active' : 'inactive']"`, `:id="'hero'"`, and `v-bind:*` variants.
- Detects selectors referenced in script strings, including class arrays and DOM selector strings such as `document.querySelector('.card #hero')`.
- Supports escaped CSS selector names such as `.sm\:mt-4`, `.w-\[10px\]`, and `.hover\:bg-blue-500:hover`.
- Updates decorations as you edit the active Vue file.

## Decorations

- Unused class and ID declarations are shown with the configured unused selector color.
- Used declarations keep their normal editor styling.
- Hovering a declaration shows how many times that selector was detected.

## Configuration

The unused selector color can be changed in VS Code settings:

```json
"unusedCssVue.unusedSelectorColor": "#888888"
```

The value accepts any CSS color supported by VS Code decorations, for example:

```json
"unusedCssVue.unusedSelectorColor": "#d97706"
```

or:

```json
"unusedCssVue.unusedSelectorColor": "rgba(255, 0, 0, 0.75)"
```

## Usage

1. Open a `.vue` file.
2. Check class and ID declarations inside the `<style>` block.
3. Hover over a decorated selector to see the usage count.
4. Change `unusedCssVue.unusedSelectorColor` if you want unused selectors to use a different color.

## Development

Install dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run compile
```

Run linting:

```bash
npm run lint
```

Run tests:

```bash
npm test
```
