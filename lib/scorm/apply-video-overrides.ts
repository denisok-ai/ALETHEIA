/**
 * После распаковки SCORM: добавляет CSS, чтобы медиа заполняло область без чёрных полос (как object-fit: cover).
 * Патчит корневой index.html пакета (React/плеер внутри iframe LMS).
 */
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const LINK_MARK = 'avaterra-video-overrides.css';

/** Подключается последним, перекрывает типичный object-fit: contain у встроенных плееров */
export const SCORM_VIDEO_OVERRIDES_CSS = `/* AVATERRA LMS */
html, body {
  background-color: #f4f0fa !important;
}
video,
img,
picture img {
  object-fit: cover !important;
  object-position: center center !important;
}
div[class*="react-player"] video,
div[class*="ReactPlayer"] video,
video[src] {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  object-fit: cover !important;
}
#root {
  min-height: 100vh;
}
`;

export async function applyScormVideoOverrides(packageRootAbsPath: string): Promise<boolean> {
  const cssAbs = path.join(packageRootAbsPath, 'static', 'css', 'avaterra-video-overrides.css');
  await mkdir(path.dirname(cssAbs), { recursive: true });
  await writeFile(cssAbs, SCORM_VIDEO_OVERRIDES_CSS, 'utf-8');

  const indexAbs = path.join(packageRootAbsPath, 'index.html');
  if (!existsSync(indexAbs)) {
    return false;
  }
  let html = await readFile(indexAbs, 'utf-8');
  if (html.includes(LINK_MARK)) {
    await writeFile(cssAbs, SCORM_VIDEO_OVERRIDES_CSS, 'utf-8');
    return true;
  }
  const link = '<link href="./static/css/avaterra-video-overrides.css" rel="stylesheet">';
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${link}</head>`);
  } else {
    html = link + html;
  }
  await writeFile(indexAbs, html, 'utf-8');
  return true;
}
