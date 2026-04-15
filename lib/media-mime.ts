/**
 * MIME lists for portal media viewer and cards (aligned across admin/student).
 */
export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
export const VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
];
export const AUDIO_MIMES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
export const PDF_MIMES = ['application/pdf'];

export function isImageMime(mime: string) {
  return IMAGE_MIMES.includes(mime);
}

export function isVideoMime(mime: string) {
  return VIDEO_MIMES.some((v) => mime.startsWith('video/')) || mime.startsWith('video/');
}

export function isAudioMime(mime: string) {
  return AUDIO_MIMES.some((a) => mime.startsWith('audio/')) || mime.startsWith('audio/');
}

export function isPdfMime(mime: string) {
  return PDF_MIMES.includes(mime) || mime.includes('pdf');
}
