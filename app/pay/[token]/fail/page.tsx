'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function PayFailPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F4F9] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center"
      >
        <div className="text-5xl mb-4">❌</div>
        <h1 className="text-xl font-semibold text-[#2D1B4E] mb-2">Оплата не завершена</h1>
        <p className="text-gray-600 mb-6">
          Платёж не был проведён. Попробуйте ещё раз или обратитесь к менеджеру.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push(`/pay/${token}`)}
            className="px-6 py-3 bg-[#D4AF37] text-[#2D1B4E] font-semibold rounded-lg hover:bg-[#c9a030] transition-colors"
          >
            Попробовать снова
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            На главную
          </button>
        </div>
      </motion.div>
    </div>
  );
}
