/**
 * Относительный URL статики SCORM для iframe на том же origin.
 * Абсолютные URL с хостом из request за прокси давали localhost в браузере.
 */
export function scormPublicUrl(pathRelativeToUploadsScorm: string): string {
  const s = pathRelativeToUploadsScorm.replace(/^\/+/, '').replace(/\\/g, '/');
  return `/uploads/scorm/${s}`.replace(/\/+/g, '/');
}
