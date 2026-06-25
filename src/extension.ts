import * as vscode from 'vscode';
import { analyzeVueSfc, type DeclaredSelectorInfo } from './analyzer';

let activeEditor: vscode.TextEditor | undefined;
let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
let currentDecorationTypes: vscode.TextEditorDecorationType[] = [];
const defaultUnusedSelectorColor = '#888888';

export function activate(context: vscode.ExtensionContext) {
    activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        triggerUpdateDecorations();
    }

    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidSaveTextDocument(document => {
        if (activeEditor && document === activeEditor.document) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('unusedCssVue.unusedSelectorColor')) {
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
        if (!doc.fileName.endsWith('.vue')) {
            return;
        }

        currentDecorationTypes.forEach(decorationType => decorationType.dispose());
        currentDecorationTypes = [];

        const analysis = analyzeVueSfc(doc.getText());
        const unusedSelectorColor = getUnusedSelectorColor();
        const ignoredClasses = new Set(['router-link-active', 'router-link-exact-active']);
        const usedDecorations: vscode.DecorationOptions[] = [];
        const unusedDecorationsByColor = new Map<string, vscode.DecorationOptions[]>();

        analysis.declaredClasses.forEach((info, declared) => {
            if (ignoredClasses.has(declared)) {
                return;
            }

            const usageCount = analysis.usedClassCounts.get(declared) || 0;
            const decorationOption = createDecorationOption(
                doc,
                info,
                `CSS class declaration: .${declared} (used ${usageCount} time${usageCount === 1 ? '' : 's'})`
            );

            if (usageCount === 0) {
                if (!unusedDecorationsByColor.has(unusedSelectorColor)) {
                    unusedDecorationsByColor.set(unusedSelectorColor, []);
                }
                unusedDecorationsByColor.get(unusedSelectorColor)!.push(decorationOption);
            } else {
                usedDecorations.push(decorationOption);
            }
        });

        const usedIdDecorations: vscode.DecorationOptions[] = [];
        const unusedIdDecorationsByColor = new Map<string, vscode.DecorationOptions[]>();

        analysis.declaredIds.forEach((info, declared) => {
            const usageCount = analysis.usedIdCounts.get(declared) || 0;
            const decorationOption = createDecorationOption(
                doc,
                info,
                `CSS id declaration: #${declared} (used ${usageCount} time${usageCount === 1 ? '' : 's'})`
            );

            if (usageCount === 0) {
                if (!unusedIdDecorationsByColor.has(unusedSelectorColor)) {
                    unusedIdDecorationsByColor.set(unusedSelectorColor, []);
                }
                unusedIdDecorationsByColor.get(unusedSelectorColor)!.push(decorationOption);
            } else {
                usedIdDecorations.push(decorationOption);
            }
        });

        applyDecorations(usedDecorations, unusedDecorationsByColor);
        applyDecorations(usedIdDecorations, unusedIdDecorationsByColor);
    }
}

function createDecorationOption(
    doc: vscode.TextDocument,
    info: DeclaredSelectorInfo,
    hoverMessage: string
): vscode.DecorationOptions {
    return {
        range: new vscode.Range(doc.positionAt(info.startOffset), doc.positionAt(info.endOffset)),
        hoverMessage
    };
}

function getUnusedSelectorColor(): string {
    const configuredColor = vscode.workspace
        .getConfiguration('unusedCssVue')
        .get<string>('unusedSelectorColor', defaultUnusedSelectorColor)
        .trim();

    return configuredColor || defaultUnusedSelectorColor;
}

function applyDecorations(
    usedDecorations: vscode.DecorationOptions[],
    unusedDecorationsByColor: Map<string, vscode.DecorationOptions[]>
) {
    if (!activeEditor) {
        return;
    }

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
}

export function deactivate() {}
