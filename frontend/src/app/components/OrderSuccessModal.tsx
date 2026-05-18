import { CheckCircle } from "lucide-react";

interface OrderSuccessModalProps {
  open: boolean;
  tableNo: string;
  merchantName: string;
  onClose: () => void;
}

export function OrderSuccessModal({ open, tableNo, merchantName, onClose }: OrderSuccessModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
      <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-xs w-full">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            <CheckCircle size={36} className="text-amber-500" />
          </div>
        </div>
        <h2 className="text-gray-900 mb-1">下单成功！</h2>
        <p className="text-gray-500 text-sm mb-1">{merchantName}</p>
        <p className="text-gray-400 text-sm mb-6">桌号：{tableNo} · 请稍等片刻</p>
        <button
          onClick={onClose}
          className="w-full bg-amber-500 text-white py-3 rounded-2xl"
          style={{ fontWeight: 600 }}
        >
          继续点单
        </button>
      </div>
    </div>
  );
}
