# Unused CSS Vue

**Unused CSS Vue** is a Visual Studio Code extension that enhances your Vue single-file components by visually indicating the usage of CSS classes declared in the `<style>` sections. The extension scans your Vue files to determine how many times each CSS class is used (both in static and dynamic bindings) and then decorates the CSS class selectors accordingly:

- **Unused classes** are displayed in a darkened version of their declared color (or a default dark gray if no color is specified).
- **Used classes** are decorated with a tooltip showing the number of times they are used, without altering their original color.

This makes it easier to identify and manage unused CSS rules and maintain a cleaner codebase.

---

## Features

- **Automatic Analysis:**  
  Scans the entire `.vue` file—including `<template>`, `<script>`, and `<style>` sections—to determine which CSS classes are used and how often.

- **Dynamic Decorations:**  
  Unused classes are visually marked by darkening their text color based on their declared color in the `<style>` block (or using a default dark color). Used classes remain unchanged but show a tooltip with the usage count.

- **Live Updates:**  
  The extension updates decorations in real-time as you edit your Vue components.

- **Support for Dynamic Bindings:**  
  Handles both static class attributes (e.g., `class="my-class"`) and dynamic class bindings (e.g., `:class="{ 'my-class': condition }"` or `:class="['my-class', dynamicClass]"`).

---

## Installation

### From the VS Code Marketplace

1. Open Visual Studio Code.
2. Go to the Extensions view by clicking on the Extensions icon in the Activity Bar or pressing `Ctrl+Shift+X`.
3. Search for **Unused CSS Vue**.
4. Click **Install**.

### From a VSIX Package

1. Download the `.vsix` file (e.g., `unused-css-vue-0.0.1.vsix`).
2. In VS Code, open the command palette (`Ctrl+Shift+P`) and run the command:
3. Select the downloaded file to install the extension.

---

## Usage

1. **Open a Vue File:**  
When you open a `.vue` file, the extension will automatically scan its contents.

2. **View Decorations:**  
- **Unused CSS classes** in the `<style>` block will appear in a darkened color.
- **Used CSS classes** remain with their original color.
- Hover over any CSS class declaration to see a tooltip that shows the number of times that class is used in the file.

3. **Dynamic Updates:**  
As you modify your Vue file (for example, adding or removing class bindings), the decorations and tooltips will update automatically.

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (which includes npm)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Yeoman](https://yeoman.io/) and [generator-code](https://github.com/microsoft/vscode-generator-code) (for extension scaffolding)

### Building the Extension

1. Clone or download the extension source code.
2. Open the project folder in VS Code.
3. Install dependencies:
```bash
npm install
