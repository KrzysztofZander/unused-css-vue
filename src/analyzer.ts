interface TextBlock {
    content: string;
    contentStart: number;
}

export interface DeclaredSelectorInfo {
    startOffset: number;
    endOffset: number;
}

export interface VueUsageAnalysis {
    usedClassCounts: Map<string, number>;
    usedIdCounts: Map<string, number>;
    declaredClasses: Map<string, DeclaredSelectorInfo>;
    declaredIds: Map<string, DeclaredSelectorInfo>;
}

interface ParsedSelector {
    kind: 'class' | 'id';
    name: string;
    startOffset: number;
    endOffset: number;
}

interface StyleRule {
    selector: string;
    selectorStart: number;
}

export function analyzeVueSfc(text: string): VueUsageAnalysis {
    const styleBlocks = extractBlocks(text, 'style');
    const declared = extractDeclaredSelectors(styleBlocks);
    const usedClassCounts = new Map<string, number>();
    const usedIdCounts = new Map<string, number>();

    const templateContent = extractBlocks(text, 'template').map(block => block.content).join('\n');
    const scriptContent = extractBlocks(text, 'script').map(block => block.content).join('\n');

    collectTemplateUsage(templateContent, usedClassCounts, usedIdCounts);
    collectScriptUsage(scriptContent, usedClassCounts, usedIdCounts, declared.declaredClasses, declared.declaredIds);

    return {
        usedClassCounts,
        usedIdCounts,
        declaredClasses: declared.declaredClasses,
        declaredIds: declared.declaredIds
    };
}

function collectTemplateUsage(
    templateContent: string,
    usedClassCounts: Map<string, number>,
    usedIdCounts: Map<string, number>
) {
    const addClass = (className: string) => addUsage(usedClassCounts, className);
    const addId = (id: string) => addUsage(usedIdCounts, id);
    const attributeRegex = /([:@A-Za-z0-9_.-]+(?:[:.][A-Za-z0-9_.-]+)*)\s*=\s*(["'])([\s\S]*?)\2/g;
    let match: RegExpExecArray | null;

    while ((match = attributeRegex.exec(templateContent)) !== null) {
        const rawName = match[1];
        const attrValue = match[3];
        const name = rawName.split('.')[0];

        if (name === 'class') {
            addClassTokens(attrValue, addClass);
            continue;
        }

        if (name === ':class' || name === 'v-bind:class') {
            collectClassBindingExpression(attrValue, addClass);
            continue;
        }

        if (name === 'id') {
            addId(attrValue);
            continue;
        }

        if (name === ':id' || name === 'v-bind:id') {
            collectIdBindingExpression(attrValue, addId);
        }
    }
}

function collectClassBindingExpression(expression: string, addClass: (className: string) => void) {
    for (const literal of extractStringLiterals(expression)) {
        addClassTokens(literal, addClass);
    }

    const objectKeyRegex = /(?:^|[,{])\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g;
    let match: RegExpExecArray | null;
    while ((match = objectKeyRegex.exec(expression)) !== null) {
        addClass(match[1]);
    }
}

function collectIdBindingExpression(expression: string, addId: (id: string) => void) {
    for (const literal of extractStringLiterals(expression)) {
        const id = literal.trim();
        if (id && !/\s/.test(id)) {
            addId(id);
        }
    }
}

function collectScriptUsage(
    scriptContent: string,
    usedClassCounts: Map<string, number>,
    usedIdCounts: Map<string, number>,
    declaredClasses: Map<string, DeclaredSelectorInfo>,
    declaredIds: Map<string, DeclaredSelectorInfo>
) {
    const addClass = (className: string) => addUsage(usedClassCounts, className);
    const addId = (id: string) => addUsage(usedIdCounts, id);

    for (const literal of extractStringLiterals(scriptContent)) {
        collectKnownSelectorsFromString(literal, declaredClasses, declaredIds, addClass, addId);
    }
}

function collectKnownSelectorsFromString(
    value: string,
    declaredClasses: Map<string, DeclaredSelectorInfo>,
    declaredIds: Map<string, DeclaredSelectorInfo>,
    addClass: (className: string) => void,
    addId: (id: string) => void
) {
    for (const selector of parseCssSelectorTokens(value, 0)) {
        if (selector.kind === 'class' && declaredClasses.has(selector.name)) {
            addClass(selector.name);
        }
        if (selector.kind === 'id' && declaredIds.has(selector.name)) {
            addId(selector.name);
        }
    }

    for (const token of splitWhitespaceTokens(value)) {
        if (declaredClasses.has(token)) {
            addClass(token);
        }
        if (declaredIds.has(token)) {
            addId(token);
        }
    }
}

function extractDeclaredSelectors(styleBlocks: TextBlock[]) {
    const declaredClasses = new Map<string, DeclaredSelectorInfo>();
    const declaredIds = new Map<string, DeclaredSelectorInfo>();

    for (const block of styleBlocks) {
        for (const rule of extractStyleRules(block.content)) {
            const selectorText = rule.selector.trim();
            if (!selectorText || selectorText.startsWith('@')) {
                continue;
            }

            for (const selector of parseCssSelectorTokens(rule.selector, block.contentStart + rule.selectorStart)) {
                const target = selector.kind === 'class' ? declaredClasses : declaredIds;
                if (!target.has(selector.name)) {
                    target.set(selector.name, {
                        startOffset: selector.startOffset,
                        endOffset: selector.endOffset
                    });
                }
            }
        }
    }

    return { declaredClasses, declaredIds };
}

function extractStyleRules(styleContent: string): StyleRule[] {
    const rules: StyleRule[] = [];

    for (let index = 0; index < styleContent.length; index++) {
        const char = styleContent[index];

        if (char === '/' && styleContent[index + 1] === '*') {
            index = skipCssComment(styleContent, index);
            continue;
        }

        if (char === '"' || char === "'") {
            index = skipQuotedString(styleContent, index);
            continue;
        }

        if (char !== '{') {
            continue;
        }

        const closeIndex = findMatchingBrace(styleContent, index);
        if (closeIndex === -1) {
            break;
        }

        const selectorStart = findSelectorStart(styleContent, index);
        const selector = styleContent.slice(selectorStart, index);
        rules.push({ selector, selectorStart });
    }

    return rules;
}

function findSelectorStart(text: string, openBraceIndex: number): number {
    let index = openBraceIndex - 1;
    while (index >= 0 && text[index] !== '{' && text[index] !== '}' && text[index] !== ';') {
        index--;
    }

    index++;
    while (index < openBraceIndex && /\s/.test(text[index])) {
        index++;
    }

    return index;
}

function findMatchingBrace(text: string, openBraceIndex: number): number {
    let depth = 0;

    for (let index = openBraceIndex; index < text.length; index++) {
        const char = text[index];

        if (char === '/' && text[index + 1] === '*') {
            index = skipCssComment(text, index);
            continue;
        }

        if (char === '"' || char === "'") {
            index = skipQuotedString(text, index);
            continue;
        }

        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                return index;
            }
        }
    }

    return -1;
}

function parseCssSelectorTokens(selector: string, selectorOffset: number): ParsedSelector[] {
    const tokens: ParsedSelector[] = [];
    let bracketDepth = 0;

    for (let index = 0; index < selector.length; index++) {
        const char = selector[index];

        if (char === '\\') {
            index = skipCssEscape(selector, index);
            continue;
        }

        if (char === '"' || char === "'") {
            index = skipQuotedString(selector, index);
            continue;
        }

        if (char === '[') {
            bracketDepth++;
            continue;
        }

        if (char === ']') {
            bracketDepth = Math.max(0, bracketDepth - 1);
            continue;
        }

        if (bracketDepth > 0 || (char !== '.' && char !== '#')) {
            continue;
        }

        const identifier = readCssIdentifier(selector, index + 1);
        if (!identifier) {
            continue;
        }

        tokens.push({
            kind: char === '.' ? 'class' : 'id',
            name: decodeCssIdentifier(identifier.raw),
            startOffset: selectorOffset + index,
            endOffset: selectorOffset + identifier.end
        });

        index = identifier.end - 1;
    }

    return tokens;
}

function readCssIdentifier(text: string, start: number): { raw: string; end: number } | null {
    let index = start;
    let raw = '';

    while (index < text.length) {
        const char = text[index];

        if (char === '\\') {
            const escape = readCssEscape(text, index);
            raw += escape.raw;
            index = escape.end;
            continue;
        }

        if (/[A-Za-z0-9_-]/.test(char) || char.charCodeAt(0) > 127) {
            raw += char;
            index++;
            continue;
        }

        break;
    }

    if (!raw) {
        return null;
    }

    return { raw, end: index };
}

function decodeCssIdentifier(raw: string): string {
    return raw.replace(/\\([0-9A-Fa-f]{1,6}\s?|.)/g, (_match, escaped: string) => {
        const trimmed = escaped.trim();
        if (/^[0-9A-Fa-f]+$/.test(trimmed)) {
            const codePoint = parseInt(trimmed, 16);
            return Number.isNaN(codePoint) ? '' : String.fromCodePoint(codePoint);
        }

        return escaped;
    });
}

function readCssEscape(text: string, start: number): { raw: string; end: number } {
    let index = start + 1;
    let hexDigits = '';

    while (index < text.length && hexDigits.length < 6 && /[0-9A-Fa-f]/.test(text[index])) {
        hexDigits += text[index];
        index++;
    }

    if (hexDigits) {
        if (index < text.length && /\s/.test(text[index])) {
            index++;
        }

        return { raw: text.slice(start, index), end: index };
    }

    if (index < text.length) {
        index++;
    }

    return { raw: text.slice(start, index), end: index };
}

function skipCssEscape(text: string, start: number): number {
    return readCssEscape(text, start).end - 1;
}

function skipCssComment(text: string, start: number): number {
    const end = text.indexOf('*/', start + 2);
    return end === -1 ? text.length - 1 : end + 1;
}

function skipQuotedString(text: string, start: number): number {
    const quote = text[start];

    for (let index = start + 1; index < text.length; index++) {
        if (text[index] === '\\') {
            index++;
            continue;
        }

        if (text[index] === quote) {
            return index;
        }
    }

    return text.length - 1;
}

function extractStringLiterals(source: string): string[] {
    const literals: string[] = [];

    for (let index = 0; index < source.length; index++) {
        const quote = source[index];
        if (quote !== '"' && quote !== "'" && quote !== '`') {
            continue;
        }

        let value = '';
        for (let cursor = index + 1; cursor < source.length; cursor++) {
            const char = source[cursor];

            if (char === '\\') {
                if (cursor + 1 < source.length) {
                    value += source[cursor + 1];
                    cursor++;
                }
                continue;
            }

            if (char === quote) {
                literals.push(value);
                index = cursor;
                break;
            }

            value += char;
        }
    }

    return literals;
}

function extractBlocks(text: string, tagName: string): TextBlock[] {
    const blocks: TextBlock[] = [];
    const blockRegex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(text)) !== null) {
        const openTagEnd = match.index + match[0].indexOf('>') + 1;
        blocks.push({
            content: match[1],
            contentStart: openTagEnd
        });
    }

    return blocks;
}

function addClassTokens(value: string, addClass: (className: string) => void) {
    for (const token of splitWhitespaceTokens(value)) {
        if (!/[{}"'`=<>]/.test(token)) {
            addClass(token);
        }
    }
}

function splitWhitespaceTokens(value: string): string[] {
    return value.split(/\s+/).map(token => token.trim()).filter(Boolean);
}

function addUsage(usageMap: Map<string, number>, value: string) {
    const key = value.trim();
    if (!key) {
        return;
    }

    usageMap.set(key, (usageMap.get(key) || 0) + 1);
}
