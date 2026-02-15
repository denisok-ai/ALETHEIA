import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24">
      <h1 className="font-heading text-3xl font-semibold text-[#f5f0e8]">
        Политика конфиденциальности
      </h1>
      <p className="mt-6 text-white/80">
        Раздел в разработке. Здесь будет размещена политика обработки персональных данных.
      </p>
      <Link href="/" className="mt-8 inline-block text-[#D4AF37] hover:underline">
        ← На главную
      </Link>
    </div>
  );
}
