## [0.1.2] - 2026-06-25

### Added
- Configurable unused selector decoration color via `unusedCssVue.unusedSelectorColor`.
- Regression tests for common Vue class binding patterns, escaped CSS selectors, and script string usage.

### Fixed
- Improved CSS class usage detection for common Vue bindings such as unquoted object keys, array bindings, and ternary expressions.
- Improved detection of class and ID selectors referenced from `<script>` string values.
- Improved matching for escaped CSS selectors such as `.sm\:mt-4`, `.w-\[10px\]`, and `.hover\:bg-blue-500`.
- Unused selectors now use a consistent configured decoration color instead of inheriting from their CSS `color` declaration.

## [0.1.1] - 2025-02-12

### Fixed
- Improved detection of **unused CSS classes and IDs** in `<style>` blocks.
- Now correctly identifies **selectors with additional elements**, such as `.some-unused-class div { ... }` and `#some-unused-id span { ... }`, ensuring they are properly marked as unused when not referenced in the template or script.

## [0.1.0] - 2025-02-12

### Added
- Detection of unused `id` attributes in `.vue` files.
- Support for static `id="..."` attributes and dynamic bindings `:id="..."` / `v-bind:id="..."` in templates.
- Detection of IDs used in scripts, such as `getElementById('some-id')`.
- Extraction of declared ID selectors (`#id`) from `<style>` blocks.
- Calculation of ID selector positions and detection of associated colors for improved visualization.
