# Change Log

All notable changes to the "unused-css-vue" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2025-02-12

### Added
- Detection of unused `id` attributes in `.vue` files.
- Support for static `id="..."` attributes and dynamic bindings `:id="..."` / `v-bind:id="..."` in templates.
- Detection of IDs used in scripts, such as `getElementById('some-id')`.
- Extraction of declared ID selectors (`#id`) from `<style>` blocks.
- Calculation of ID selector positions and detection of associated colors for improved visualization.
