## [0.1.0] - 2025-02-12

### Added
- Detection of unused `id` attributes in `.vue` files.
- Support for static `id="..."` attributes and dynamic bindings `:id="..."` / `v-bind:id="..."` in templates.
- Detection of IDs used in scripts, such as `getElementById('some-id')`.
- Extraction of declared ID selectors (`#id`) from `<style>` blocks.
- Calculation of ID selector positions and detection of associated colors for improved visualization.

## [0.1.1] - 2025-02-12

### Fixed
- Improved detection of **unused CSS classes and IDs** in `<style>` blocks.
- Now correctly identifies **selectors with additional elements**, such as `.some-unused-class div { ... }` and `#some-unused-id span { ... }`, ensuring they are properly marked as unused when not referenced in the template or script.
