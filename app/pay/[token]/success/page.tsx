'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';

export default function PaySuccessPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F4F9] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center"
      >
        <div className="flex justify-center mb-4">
          <Image src="/images/LOGO.png" alt="АВАТЕРРА" width={100} height={32} />
        </div>
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-semibold text-[#2D1B4E] mb-2">Оплата прошла успешно!</h1>
        <p className="text-gray-600 mb-6">
          Чек об оплате отправлен на ваш email. Спасибо за покупку!
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-[#2D1B4E] text-white rounded-lg hover:bg-[#1a1030] transition-colors"
        >
          На главную
        </button>
      </motion.div>
    </div>
  );
}
