export type XmlNode = {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
};

const entityMap: Record<string, string> = {
  '&amp;': '&',
  '&apos;': "'",
  '&gt;': '>',
  '&lt;': '<',
  '&quot;': '"',
};

function decodeXml(value: string): string {
  return value.replace(/&(amp|apos|gt|lt|quot);/g, (match) => entityMap[match] ?? match);
}

function parseAttributes(fragment: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null = attributePattern.exec(fragment);

  while (match) {
    attributes[match[1]] = decodeXml(match[2]);
    match = attributePattern.exec(fragment);
  }

  return attributes;
}

function createNode(name: string, attributes: Record<string, string>): XmlNode {
  return {
    name,
    attributes,
    children: [],
    text: '',
  };
}

export function parseXml(xml: string): XmlNode {
  const root = createNode('#document', {});
  const stack: XmlNode[] = [root];
  const tokenPattern = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<\/?[^>]+>/gi;

  let cursor = 0;
  let token = tokenPattern.exec(xml);

  while (token) {
    const rawText = xml.slice(cursor, token.index);
    if (rawText.trim()) {
      stack[stack.length - 1].text += decodeXml(rawText.trim());
    }

    const tag = token[0];
    cursor = token.index + tag.length;

    if (!tag.startsWith('<!--') && !tag.startsWith('<?') && !tag.startsWith('<!DOCTYPE')) {
      if (tag.startsWith('</')) {
        const closingName = tag.slice(2, -1).trim();
        const current = stack.pop();
        if (!current || current.name !== closingName) {
          throw new Error(`Malformed XML: expected </${current?.name ?? 'unknown'}> but found </${closingName}>.`);
        }
      } else {
        const selfClosing = tag.endsWith('/>');
        const inner = tag.slice(1, selfClosing ? -2 : -1).trim();
        const [name, ...rest] = inner.split(/\s+/);
        const node = createNode(name, parseAttributes(rest.join(' ')));
        stack[stack.length - 1].children.push(node);

        if (!selfClosing) {
          stack.push(node);
        }
      }
    }

    token = tokenPattern.exec(xml);
  }

  const tail = xml.slice(cursor);
  if (tail.trim()) {
    stack[stack.length - 1].text += decodeXml(tail.trim());
  }

  if (stack.length !== 1 || root.children.length !== 1) {
    throw new Error('Malformed XML: document did not close cleanly.');
  }

  return root.children[0];
}

export function findChildren(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((child) => child.name === name);
}

export function findFirstChild(node: XmlNode, name: string): XmlNode | null {
  return node.children.find((child) => child.name === name) ?? null;
}

export function walkXml(node: XmlNode, visitor: (node: XmlNode) => void): void {
  visitor(node);
  for (const child of node.children) {
    walkXml(child, visitor);
  }
}
