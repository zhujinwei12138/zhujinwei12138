import { ShoppingCart, X, Trash2, Plus, Minus } from "lucide-react";
import { Beer } from "./BeerCard";

export interface CartItem {
  beer: Beer;
  quantity: number;
}

interface CartDrawerProps {
  items: CartItem[];
  open: boolean;
  onClose: () => void;
  onAdd: (beer: Beer) => void;
  onRemove: (beerId: number) => void;
  onClear: () => void;
  onSubmit: () => void;
}

export function CartDrawer({
  items,
  open,
  onClose,
  onAdd,
  onRemove,
  onClear,
  onSubmit,
}: CartDrawerProps) {
  const total = items.reduce((sum, i) => sum + i.beer.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-w-md mx-auto ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "70vh" }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-amber-500" />
            <span className="text-gray-900" style={{ fontWeight: 600 }}>
              已选商品
            </span>
            <span className="bg-amber-500 text-white text-xs rounded-full px-2 py-0.5">
              {count}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button
                onClick={onClear}
                className="text-gray-400 flex items-center gap-1 text-sm"
              >
                <Trash2 size={14} />
                清空
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-3" style={{ maxHeight: "calc(70vh - 160px)" }}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <span className="text-5xl mb-3">🍺</span>
              <p>快去选几杯吧</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div key={item.beer.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-amber-50 flex-shrink-0">
                    <img
                      src={item.beer.image}
                      alt={item.beer.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 truncate" style={{ fontWeight: 500 }}>
                      {item.beer.name}
                    </p>
                    <p className="text-amber-600 text-sm" style={{ fontWeight: 600 }}>
                      ¥{item.beer.price}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRemove(item.beer.id)}
                      className="w-7 h-7 rounded-full border-2 border-amber-400 flex items-center justify-center text-amber-500"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-gray-900 min-w-[20px] text-center" style={{ fontWeight: 600 }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onAdd(item.beer)}
                      className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-gray-400 text-xs">合计</p>
              <p className="text-amber-600" style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                ¥{total.toFixed(2)}
              </p>
            </div>
            <button
              onClick={onSubmit}
              className="bg-amber-500 text-white px-8 py-3 rounded-2xl active:scale-95 transition-transform"
              style={{ fontWeight: 600 }}
            >
              提交订单
            </button>
          </div>
        )}
      </div>
    </>
  );
}
