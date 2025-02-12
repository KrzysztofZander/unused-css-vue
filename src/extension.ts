import * as vscode from 'vscode';

let activeEditor: vscode.TextEditor | undefined;
let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
// Przechowujemy aktualnie utworzone dekoracje, aby przy każdej aktualizacji je usunąć.
let currentDecorationTypes: vscode.TextEditorDecorationType[] = [];

export function activate(context: vscode.ExtensionContext) {
    activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        triggerUpdateDecorations();
    }

    // Nasłuch zmian aktywnego edytora.
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    // Nasłuch zmian dokumentu.
    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    // Nasłuch zapisu dokumentu.
    vscode.workspace.onDidSaveTextDocument(document => {
        if (activeEditor && document === activeEditor.document) {
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

        // Przetwarzamy tylko pliki .vue.
        if (!doc.fileName.endsWith('.vue')) {
            return;
        }

        // Usuń poprzednie dekoracje.
        currentDecorationTypes.forEach(decorationType => decorationType.dispose());
        currentDecorationTypes = [];

        // =======================================================
        // Krok 1. Wyodrębnienie użytych klas i id wraz z liczbą wystąpień.
        // =======================================================
        const usedCounts = new Map<string, number>();
        const usedIdCounts = new Map<string, number>();

        function addUsed(cls: string) {
            const key = cls.trim();
            if (!key) return;
            usedCounts.set(key, (usedCounts.get(key) || 0) + 1);
        }
        function addUsedId(id: string) {
            const key = id.trim();
            if (!key) return;
            usedIdCounts.set(key, (usedIdCounts.get(key) || 0) + 1);
        }

        // Wyodrębnij zawartość wszystkich bloków <template>.
        const templateMatches = text.match(/<template[^>]*>([\s\S]*?)<\/template>/g);
        let templateContent = "";
        if (templateMatches) {
            for (const tmpl of templateMatches) {
                // Usuń otaczające tagi <template>.
                const inner = tmpl.replace(/<\/?template[^>]*>/g, "");
                templateContent += inner + "\n";
            }
        }

        // -- Użycia klas --

        // Statyczne klasy: class="..."
        const staticMatches = templateContent.matchAll(/class\s*=\s*["']([^"']+)["']/g);
        for (const match of staticMatches) {
            const classes = match[1].split(/\s+/);
            for (const cls of classes) {
                addUsed(cls);
            }
        }

        // Dynamiczne wiązania obiektowe: :class="{ 'some-class': true, ... }"
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

        // Dynamiczne wiązania tablicowe: :class="['class1', 'class2']"
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

        // Z <script> – np. this.classList.add('some-class')
        const scriptMatch = text.match(/<script[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch) {
            const scriptContent = scriptMatch[1];
            const scriptClassMatches = scriptContent.matchAll(/classList\.add\(["']([a-zA-Z0-9_-]+)["']\)/g);
            for (const match of scriptClassMatches) {
                addUsed(match[1]);
            }
            // Użycia id z <script> – np. document.getElementById('some-id')
            const scriptIdMatches = scriptContent.matchAll(/getElementById\(["']([a-zA-Z0-9_-]+)["']\)/g);
            for (const match of scriptIdMatches) {
                addUsedId(match[1]);
            }
        }

        // -- Użycia id --

        // Statyczne id: id="..."
        const idStaticMatches = templateContent.matchAll(/id\s*=\s*["']([^"']+)["']/g);
        for (const match of idStaticMatches) {
            const idVal = match[1].trim();
            if (idVal) {
                addUsedId(idVal);
            }
        }
        // Dynamiczne wiązania id: :id="..."
        const idDynamicMatches = templateContent.matchAll(/(?:\:id|v-bind:id)\s*=\s*["']([^"']+)["']/g);
        for (const match of idDynamicMatches) {
            let idVal = match[1].trim();
            if ((idVal.startsWith("'") && idVal.endsWith("'")) || (idVal.startsWith('"') && idVal.endsWith('"'))) {
                idVal = idVal.substring(1, idVal.length - 1).trim();
            }
            if (idVal) {
                addUsedId(idVal);
            }
        }

        // =======================================================
        // Krok 2. Wyodrębnienie deklarowanych klas i id z bloków <style>.
        // Łapiemy również zadeklarowany kolor (jeśli występuje) oraz zakres (range) do dekoracji.
        // Każdy selektor dodajemy tylko raz – aby tooltip pojawił się tylko raz.
        // =======================================================
        interface DeclaredInfo { range: vscode.Range, color: string | null }
        const declaredClasses = new Map<string, DeclaredInfo>();
        const declaredIds = new Map<string, DeclaredInfo>();

        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/g;
        let styleMatch: RegExpExecArray | null;
        while ((styleMatch = styleRegex.exec(text)) !== null) {
            const styleContent = styleMatch[1];
            const styleBlockFull = styleMatch[0];

            // Deklaracje klas: np. ".className { ... }"
            const classRuleRegex = /(\.[a-zA-Z0-9_-]+)\s*\{([\s\S]*?)\}/g;
            let ruleMatch: RegExpExecArray | null;
            while ((ruleMatch = classRuleRegex.exec(styleContent)) !== null) {
                const selector = ruleMatch[1]; // np. ".custom-stepper-container"
                const className = selector.substring(1);
                const ruleBlock = ruleMatch[2];
                // Szukamy właściwości "color:"
                let declaredColor: string | null = null;
                const colorRegex = /color\s*:\s*([^;]+);/i;
                const colorMatch = ruleBlock.match(colorRegex);
                if (colorMatch) {
                    declaredColor = colorMatch[1].trim();
                }
                // Obliczamy zakres selektora w dokumencie.
                const selectorIndexInStyle = styleBlockFull.indexOf(selector);
                if (selectorIndexInStyle === -1) {
                    continue;
                }
                const startOffset = styleMatch.index + selectorIndexInStyle;
                const endOffset = startOffset + selector.length;
                const startPos = doc.positionAt(startOffset);
                const endPos = doc.positionAt(endOffset);
                const range = new vscode.Range(startPos, endPos);
                // Dodajemy klasę tylko raz.
                if (!declaredClasses.has(className)) {
                    declaredClasses.set(className, { range, color: declaredColor });
                }
            }

            // Deklaracje id: np. "#my-id { ... }"
            const idRuleRegex = /(\#[a-zA-Z0-9_-]+)\s*\{([\s\S]*?)\}/g;
            let idRuleMatch: RegExpExecArray | null;
            while ((idRuleMatch = idRuleRegex.exec(styleContent)) !== null) {
                const selector = idRuleMatch[1]; // np. "#my-id"
                const idName = selector.substring(1);
                const ruleBlock = idRuleMatch[2];
                // Szukamy właściwości "color:"
                let declaredColor: string | null = null;
                const colorRegex = /color\s*:\s*([^;]+);/i;
                const colorMatch = ruleBlock.match(colorRegex);
                if (colorMatch) {
                    declaredColor = colorMatch[1].trim();
                }
                // Obliczamy zakres selektora.
                const selectorIndexInStyle = styleBlockFull.indexOf(selector);
                if (selectorIndexInStyle === -1) {
                    continue;
                }
                const startOffset = styleMatch.index + selectorIndexInStyle;
                const endOffset = startOffset + selector.length;
                const startPos = doc.positionAt(startOffset);
                const endPos = doc.positionAt(endOffset);
                const range = new vscode.Range(startPos, endPos);
                // Dodajemy id tylko raz.
                if (!declaredIds.has(idName)) {
                    declaredIds.set(idName, { range, color: declaredColor });
                }
            }
        }

        // =======================================================
        // Krok 3. Przygotowanie opcji dekoracji dla deklarowanych selektorów.
        // Dla każdej klasy i id określamy liczbę użyć.
        // Jeśli selektor nie jest używany – ustawiamy dekorację z przyciemnionym kolorem (lub domyślnym).
        // Jeśli jest używany – dekoracja bez nadpisania koloru (ale z tooltipem).
        // =======================================================
        const ignoredClasses = new Set(["router-link-active", "router-link-exact-active"]);
        const usedDecorations: vscode.DecorationOptions[] = [];
        const unusedDecorationsByColor = new Map<string, vscode.DecorationOptions[]>();

        declaredClasses.forEach((info, declared) => {
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
                // Dla nieużywanych klas – przyciemniamy zadeklarowany kolor (lub używamy domyślnego).
                const darkColor = info.color ? darkenColor(info.color, 0.2) : "#555555";
                if (!unusedDecorationsByColor.has(darkColor)) {
                    unusedDecorationsByColor.set(darkColor, []);
                }
                unusedDecorationsByColor.get(darkColor)!.push(decorationOption);
            } else {
                usedDecorations.push(decorationOption);
            }
        });

        const usedIdDecorations: vscode.DecorationOptions[] = [];
        const unusedIdDecorationsByColor = new Map<string, vscode.DecorationOptions[]>();

        declaredIds.forEach((info, declared) => {
            const usageCount = usedIdCounts.get(declared) || 0;
            const hoverMsg = `CSS id declaration: #${declared} (used ${usageCount} time${usageCount === 1 ? '' : 's'})`;
            const decorationOption: vscode.DecorationOptions = {
                range: info.range,
                hoverMessage: hoverMsg
            };

            if (usageCount === 0) {
                const darkColor = info.color ? darkenColor(info.color, 0.2) : "#555555";
                if (!unusedIdDecorationsByColor.has(darkColor)) {
                    unusedIdDecorationsByColor.set(darkColor, []);
                }
                unusedIdDecorationsByColor.get(darkColor)!.push(decorationOption);
            } else {
                usedIdDecorations.push(decorationOption);
            }
        });

        // =======================================================
        // Krok 4. Zastosowanie dekoracji.
        // Dekoracje dla używanych selektorów (klas i id) – bez modyfikacji koloru.
        if (usedDecorations.length > 0) {
            const usedDecorationType = vscode.window.createTextEditorDecorationType({});
            currentDecorationTypes.push(usedDecorationType);
            activeEditor.setDecorations(usedDecorationType, usedDecorations);
        }
        unusedDecorationsByColor.forEach((options, color) => {
            const decorationType = vscode.window.createTextEditorDecorationType({ color });
            currentDecorationTypes.push(decorationType);
            activeEditor?.setDecorations(decorationType, options);
        });

        if (usedIdDecorations.length > 0) {
            const usedIdDecorationType = vscode.window.createTextEditorDecorationType({});
            currentDecorationTypes.push(usedIdDecorationType);
            activeEditor.setDecorations(usedIdDecorationType, usedIdDecorations);
        }
        unusedIdDecorationsByColor.forEach((options, color) => {
            const decorationType = vscode.window.createTextEditorDecorationType({ color });
            currentDecorationTypes.push(decorationType);
            activeEditor?.setDecorations(decorationType, options);
        });
    }

    // Helper: przyciemnia kolor hex o podany współczynnik (domyślnie 20%)
    function darkenColor(color: string, factor: number = 0.2): string {
        // Obsługuje tylko kolory hex w formacie "#rrggbb"
        if (!color.startsWith("#")) {
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
