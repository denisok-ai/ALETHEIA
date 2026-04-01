/**
 * Имя для PDF сертификата: Profile и User могут расходиться (PATCH профиля не обновляет User.displayName).
 */
export function resolveCertificateRecipientName(parts: {
  profileDisplayName?: string | null;
  userDisplayName?: string | null;
  userEmail?: string | null;
}): string {
  const fromProfile = parts.profileDisplayName?.trim();
  if (fromProfile) return fromProfile;
  const fromUser = parts.userDisplayName?.trim();
  if (fromUser) return fromUser;
  const email = parts.userEmail?.trim();
  if (email) {
    const at = email.indexOf('@');
    const local = at > 0 ? email.slice(0, at) : email;
    const humanized = local.replace(/[._+-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (humanized.length > 0) return humanized;
    return email;
  }
  return 'Слушатель';
}
