/**
 * Записывает образцы PDF в public/certificates-samples/ — прямые ссылки без API.
 * Запуск: npx tsx scripts/export-sample-certificates.ts
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generateCertificatePdf } from '../lib/certificates';
import { CERTIFICATE_SAMPLE_DEMO } from '../lib/certificate-sample-demo';
import { CERTIFICATE_TEMPLATE_IDS } from '../lib/certificates-constants';

const outDir = join(process.cwd(), 'public', 'certificates-samples');

async function main() {
  mkdirSync(outDir, { recursive: true });
  for (const id of CERTIFICATE_TEMPLATE_IDS) {
    const buf = await generateCertificatePdf(CERTIFICATE_SAMPLE_DEMO, id);
    const file = join(outDir, `sample-${id}.pdf`);
    writeFileSync(file, buf);
    console.log('OK', file, buf.length, 'bytes');
  }
  console.log('\nОткройте в браузере: /certificates-samples/sample-default.pdf и др.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
