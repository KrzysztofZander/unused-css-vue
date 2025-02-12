import * as vscode from 'vscode';

let activeEditor: vscode.TextEditor | undefined;
let timeout: ReturnType<typeof setTimeout> | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        triggerUpdateDecorations();
    }

    // Listen for changes to the active editor.
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    // Listen for document changes.
    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    function triggerUpdateDecorations() {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(updateDecorations, 500);
    }

    function updateDecorations() {
        if (!activeEditor) {
            return;
        }
        const doc = activeEditor.document;
        const text = doc.getText();

        // Process only .vue files.
        if (!doc.fileName.endsWith('.vue')) {
            return;
        }

        // =======================================================
        // Step 1. Extract used classes and count their occurrences.
        // =======================================================
        const usedCounts = new Map<string, number>();

        function addUsed(cls: string) {
            const key = cls.trim();
            if (!key) return;
            usedCounts.set(key, (usedCounts.get(key) || 0) + 1);
        }

        // Extract from all <template> blocks.
        const templateMatches = text.match(/<template[^>]*>([\s\S]*?)<\/template>/g);
        let templateContent = "";
        if (templateMatches) {
            for (const tmpl of templateMatches) {
                // Remove the outer <template> tags.
                const inner = tmpl.replace(/<\/?template[^>]*>/g, "");
                templateContent += inner + "\n";
            }
        }

        // Static classes: class="..."
        const staticMatches = templateContent.matchAll(/class\s*=\s*["']([^"']+)["']/g);
        for (const match of staticMatches) {
            const classes = match[1].split(/\s+/);
            for (const cls of classes) {
                addUsed(cls);
            }
        }

        // Dynamic object bindings: :class="{ 'some-class': true, ... }"
        const dynamicObjMatches = templateContent.matchAll(/(?:\:class|v-bind:class)\s*=\s*["']\{([^}]+)\}["']/g);
        for (const match of dynamicObjMatches) {
            const binding = match[1];
            const keys = binding.match(/['"]([^'"]+)['"]\s*:/g);
            if (keys) {
                for (const keyStr of keys) {
                    const cleaned = keyStr.replace(/['":]/g, '').trim();
                    addUsed(cleaned);
                }
            }
        }

        // Dynamic array bindings: :class="['class1', 'class2']"
        const dynamicArrMatches = templateContent.matchAll(/(?:\:class|v-bind:class)\s*=\s*["']\[(.*?)\]["']/g);
        for (const match of dynamicArrMatches) {
            const binding = match[1];
            const values = binding.match(/['"]([^'"]+)['"]/g);
            if (values) {
                for (const val of values) {
                    const cleaned = val.replace(/['"]/g, '').trim();
                    addUsed(cleaned);
                }
            }
        }

        // Also extract from <script> (e.g. this.classList.add('some-class'))
        const scriptMatch = text.match(/<script[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch) {
            const scriptContent = scriptMatch[1];
            const scriptMatches = scriptContent.matchAll(/classList\.add\(["']([a-zA-Z0-9_-]+)["']\)/g);
            for (const match of scriptMatches) {
                addUsed(match[1]);
            }
        }

        // =======================================================
        // Step 2. Extract declared CSS classes from <style> blocks.
        // Also, capture the declared color (if any) and the range for decoration.
        // =======================================================
        interface DeclaredInfo { range: vscode.Range, color: string | null }
        const declaredClasses = new Map<string, DeclaredInfo>();
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/g;
        let styleMatch: RegExpExecArray | null;
        while ((styleMatch = styleRegex.exec(text)) !== null) {
            const styleContent = styleMatch[1];
            // Match rules like ".className { ... }"
            const ruleRegex = /(\.[a-zA-Z0-9_-]+)\s*\{([\s\S]*?)\}/g;
            let ruleMatch: RegExpExecArray | null;
            while ((ruleMatch = ruleRegex.exec(styleContent)) !== null) {
                const selector = ruleMatch[1]; // e.g. ".custom-stepper-container"
                const className = selector.substring(1);
                const ruleBlock = ruleMatch[2];
                // Look for a "color:" property inside the rule.
                let declaredColor: string | null = null;
                const colorRegex = /color\s*:\s*([^;]+);/i;
                const colorMatch = ruleBlock.match(colorRegex);
                if (colorMatch) {
                    declaredColor = colorMatch[1].trim();
                }
                // Calculate the range of the selector in the document.
                const styleBlockFull = styleMatch[0]; // full <style>...</style> block
                const selectorIndexInStyle = styleBlockFull.indexOf(selector);
                if (selectorIndexInStyle === -1) {
                    continue;
                }
                const startOffset = styleMatch.index + selectorIndexInStyle;
                const endOffset = startOffset + selector.length;
                const startPos = doc.positionAt(startOffset);
                const endPos = doc.positionAt(endOffset);
                const range = new vscode.Range(startPos, endPos);
                declaredClasses.set(className, { range, color: declaredColor });
            }
        }

        // =======================================================
        // Step 3. Create decoration options for all declared classes.
        // For each declared class, determine its usage count.
        // If unused, set a decoration color to the darkened version of its declared color (or default).
        // If used, do not change its color (i.e. leave decoration style empty) but still show tooltip.
        // =======================================================
        const ignoredClasses = new Set(["router-link-active", "router-link-exact-active"]);
        const usedDecorations: vscode.DecorationOptions[] = [];
        const unusedDecorationsByColor = new Map<string, vscode.DecorationOptions[]>();

        declaredClasses.forEach((info, declared) => {
            // Skip if the class is in the ignored set.
            if (ignoredClasses.has(declared)) {
                return;
            }
            const usageCount = usedCounts.get(declared) || 0;
            const hoverMsg = `CSS class declaration: .${declared} (used ${usageCount} time${usageCount === 1 ? '' : 's'})`;
            const decorationOption: vscode.DecorationOptions = {
                range: info.range,
                hoverMessage: hoverMsg
            };

            if (usageCount === 0) {
                // For unused classes, darken the declared color (if available) or use default.
                const darkColor = info.color ? darkenColor(info.color, 0.2) : "#555555";
                if (!unusedDecorationsByColor.has(darkColor)) {
                    unusedDecorationsByColor.set(darkColor, []);
                }
                unusedDecorationsByColor.get(darkColor)!.push(decorationOption);
            } else {
                // For used classes, we do not alter the color (apply an empty style),
                // but still show the tooltip.
                usedDecorations.push(decorationOption);
            }
        });

        // =======================================================
        // Step 4. Apply decorations.
        // For used classes, we create a decoration type with no color override.
        if (usedDecorations.length > 0) {
            const usedDecorationType = vscode.window.createTextEditorDecorationType({});
            activeEditor.setDecorations(usedDecorationType, usedDecorations);
        }
        // For unused classes, apply decoration types grouped by darkened color.
        unusedDecorationsByColor.forEach((options, color) => {
            const decorationType = vscode.window.createTextEditorDecorationType({
                color: color
            });
            activeEditor?.setDecorations(decorationType, options);
        });
    }

    // Helper function: darken a hex color by a given factor (default: 20%)
    function darkenColor(color: string, factor: number = 0.2): string {
        // Supports only hex colors in the format "#rrggbb"
        if (!color.startsWith("#")) {
            // Fallback if not hex.
            return "#555555";
        }
        let hex = color.slice(1);
        if (hex.length !== 6) {
            return "#555555";
        }
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        r = Math.floor(r * (1 - factor));
        g = Math.floor(g * (1 - factor));
        b = Math.floor(b * (1 - factor));
        return "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");
    }
}

export function deactivate() {}
