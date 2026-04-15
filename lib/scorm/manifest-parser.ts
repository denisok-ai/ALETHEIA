/**
 * SCORM manifest parser: parses imsmanifest.xml and extracts version, title, and items (with resource hrefs).
 * Supports SCORM 1.2 and SCORM 2004.
 */
import { XMLParser } from 'fast-xml-parser';

export type ParsedManifest = {
  version: '1.2' | '2004';
  title?: string;
  items: {
    identifier: string;
    title?: string;
    resourceId?: string;
    href?: string;
  }[];
};

type Parsed = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

function text(el: unknown): string | undefined {
  if (el == null) return undefined;
  if (typeof el === 'string') return el.trim() || undefined;
  if (typeof el === 'object' && el !== null && '#' in el && typeof (el as Record<string, unknown>)['#'] === 'string')
    return ((el as Record<string, unknown>)['#'] as string).trim() || undefined;
  return undefined;
}

function attr(obj: unknown, name: string): string | undefined {
  if (obj == null || typeof obj !== 'object') return undefined;
  const key = `@_${name}`;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' ? v.trim() || undefined : undefined;
}

function one<T>(val: T | T[] | undefined): T | undefined {
  if (val == null) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

function array<T>(val: T | T[] | undefined): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function detectVersion(manifest: Parsed): '1.2' | '2004' {
  const meta = manifest.metadata as Parsed | undefined;
  const schema = meta ? text(one(meta.schema)) : undefined;
  const schemaVersion = meta ? text(one(meta.schemaversion)) : undefined;
  const ver = attr(manifest, 'version');

  const combined = [schema, schemaVersion, ver].filter(Boolean).join(' ').toLowerCase();
  if (/2004|1\.3|3rd edition|4th edition/i.test(combined)) return '2004';
  return '1.2';
}

function collectItems(
  itemOrItems: unknown,
  resourceMap: Map<string, string>,
  acc: ParsedManifest['items']
): void {
  for (const it of array(itemOrItems)) {
    if (it == null || typeof it !== 'object') continue;
    const obj = it as Parsed;
    const identifier = attr(obj, 'identifier') ?? text(obj.identifier);
    if (!identifier) continue;

    const resourceId = attr(obj, 'identifierref') ?? text(obj.identifierref);
    const href = resourceId ? resourceMap.get(resourceId) : undefined;
    const title = text(one(obj.title));

    acc.push({
      identifier,
      title,
      resourceId: resourceId ?? undefined,
      href,
    });

    const children = obj.item;
    if (children) collectItems(children, resourceMap, acc);
  }
}

function buildResourceMap(resources: unknown): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of array(resources)) {
    if (r == null || typeof r !== 'object') continue;
    const res = r as Parsed;
    const id = attr(res, 'identifier') ?? text(res.identifier);
    const href = attr(res, 'href') ?? text(res.href);
    if (id && href) map.set(id, href);
  }
  return map;
}

/**
 * Parses imsmanifest.xml content and returns a normalized manifest or null on empty/invalid input.
 * Throws on invalid XML with a clear message.
 */
export function parseScormManifest(xmlContent: string): ParsedManifest | null {
  const trimmed = xmlContent?.trim();
  if (!trimmed) return null;

  let raw: unknown;
  try {
    raw = parser.parse(trimmed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid SCORM manifest XML: ${msg}`);
  }

  if (raw == null || typeof raw !== 'object') return null;

  const root = raw as Record<string, unknown>;
  const manifest = (root.manifest ?? root) as Parsed;
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid SCORM manifest: root element "manifest" not found');
  }

  const version = detectVersion(manifest);
  let title = text(one(manifest.title));

  const resourcesEl = manifest.resources;
  const resourceList =
    resourcesEl != null && typeof resourcesEl === 'object'
      ? (resourcesEl as Record<string, unknown>).resource
      : undefined;
  const resourceMap = buildResourceMap(resourceList);

  const orgs = manifest.organizations as Parsed | undefined;
  const defaultId = orgs ? attr(orgs, 'default') : undefined;
  const orgList = array(orgs?.organization);
  const org = defaultId
    ? orgList.find((o) => (o != null && typeof o === 'object' && (attr(o as Parsed, 'identifier') ?? text((o as Parsed).identifier)) === defaultId))
    : orgList[0];
  const orgObj = org != null && typeof org === 'object' ? (org as Parsed) : undefined;

  const items: ParsedManifest['items'] = [];
  if (orgObj) {
    if (!title) title = text(one(orgObj.title));
    const itemList = orgObj.item;
    if (itemList) collectItems(itemList, resourceMap, items);
  }

  return {
    version,
    title,
    items,
  };
}
