/**
 * Проверка скилов Claude Code в .claude/skills/ (без БД и сети).
 *
 * Что проверяем:
 *  - SKILL.md есть, начинается с YAML-frontmatter, name совпадает с именем папки и kebab-case;
 *  - description непустой и не длиннее 1536 знаков (лимит строки скилов в Claude Code);
 *  - пути к файлам проекта, названные в обратных кавычках (lib/, scripts/, content/, docs/, prisma/, tests/),
 *    существуют;
 *  - в скилах нет слов, которые блокирует quality gate («калибр…», «метод», латинская Avaterra),
 *    кроме строк, где они названы как запрещённые или заменяются.
 *
 * Скил avaterra-school-rules перечисляет запрещённые слова по определению, поэтому для него
 * проверка слов не применяется.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(ROOT, '.claude', 'skills');
const WORD_CHECK_EXEMPT = new Set(['avaterra-school-rules']);
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DESCRIPTION_MAX = 1536;
const PATH_RE = /`((?:lib|scripts|content|docs|prisma|tests)\/[^`\s*]+)`/g;
const BANNED_RE = /калибр|(?<!\p{L})метод|\bAvaterra\b/u; // регистр важен: avaterra.yaml и avaterra-* — не латиница школы
// \b не работает с кириллицей, поэтому границы слов через \p{L}
const NEGATION_OR_REPLACE_RE = /(?<!\p{L})(не|нет|вместо|замен|запрещ|нельзя)(?!\p{L})|→/iu;

type Skill = { dir: string; name: string; file: string; text: string };

function listSkills(): Skill[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => {
      const file = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
      return { dir: entry.name, name: entry.name, file, text: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '' };
    });
}

/** Минимальный разбор frontmatter: ключ: значение и блоки «key: >» с отступом. */
function parseFrontmatter(text: string): Record<string, string> | null {
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  const out: Record<string, string> = {};
  let key: string | null = null;
  for (const raw of lines.slice(1, end)) {
    const top = /^([A-Za-z_-]+):\s*(.*)$/.exec(raw);
    if (top) {
      key = top[1];
      out[key] = top[2].trim();
    } else if (key && /^\s+\S/.test(raw)) {
      out[key] = `${out[key]} ${raw.trim()}`.trim();
    }
  }
  return out;
}

function projectPathExists(rel: string): boolean {
  const base = path.join(ROOT, rel.replace(/[.,;:)]+$/, ''));
  return [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].some((p) => fs.existsSync(p));
}

const skills = listSkills();

describe('скилы .claude/skills', () => {
  it('есть как минимум 5 скилов с префиксом avaterra-', () => {
    const own = skills.filter((s) => s.name.startsWith('avaterra-'));
    expect(own.length).toBeGreaterThanOrEqual(5);
    expect(own.length).toBeLessThanOrEqual(8);
  });

  for (const skill of skills) {
    describe(skill.name, () => {
      it('SKILL.md существует и начинается с frontmatter', () => {
        expect(skill.text, `нет ${skill.file}`).not.toBe('');
        expect(parseFrontmatter(skill.text), 'frontmatter не разобран').not.toBeNull();
      });

      it('name совпадает с папкой и записан в kebab-case', () => {
        const fm = parseFrontmatter(skill.text) ?? {};
        expect(fm.name).toBe(skill.dir);
        expect(NAME_RE.test(skill.dir)).toBe(true);
      });

      it('description непустой и в лимите', () => {
        const fm = parseFrontmatter(skill.text) ?? {};
        expect((fm.description ?? '').length).toBeGreaterThan(0);
        expect((fm.description ?? '').length).toBeLessThanOrEqual(DESCRIPTION_MAX);
      });

      it('пути к файлам проекта существуют', () => {
        const missing: string[] = [];
        for (const match of skill.text.matchAll(PATH_RE)) {
          if (!projectPathExists(match[1])) missing.push(match[1]);
        }
        expect(missing).toEqual([]);
      });

      it('запрещённые слова не употреблены без пометки «не» или замены', () => {
        if (WORD_CHECK_EXEMPT.has(skill.name)) return;
        const bad: string[] = [];
        skill.text.split('\n').forEach((line, i) => {
          if (BANNED_RE.test(line) && !NEGATION_OR_REPLACE_RE.test(line)) bad.push(`строка ${i + 1}: ${line.trim()}`);
        });
        expect(bad).toEqual([]);
      });
    });
  }
});
