import { useState } from "react";
import { Plus, Minus } from "lucide-react";

export interface Beer {
  id: number;
  name: string;
  nameEn: string;
  category: string;
  price: number;
  volume: string;
  desc: string;
  image: string;
  tag?: string;
}

interface BeerCardProps {
  beer: Beer;
  quantity: number;
  onAdd: (beer: Beer) => void;
  onRemove: (beerId: number) => void;
  onCardClick?: (beer: Beer) => void;
}

export function BeerCard({ beer, quantity, onAdd, onRemove, onCardClick }: BeerCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-amber-100 flex flex-col">
      {/* Clickable image + info area */}
      <div
        className="cursor-pointer"
        onClick={() => onCardClick?.(beer)}
      >
        <div className="relative">
          <div className="w-full h-40 bg-amber-50 overflow-hidden">
            {!imgError ? (
              <img
                src={beer.image}
                alt={beer.name}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">🍺</div>
            )}
          </div>
          {beer.tag && (
            <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
              {beer.tag}
            </span>
          )}
        </div>
        <div className="px-3 pt-3 pb-1">
          <h3 className="text-gray-900 truncate">{beer.name}</h3>
          <p className="text-gray-400 text-xs truncate mt-0.5">{beer.desc}</p>
          <p className="text-gray-300 text-xs mt-0.5">{beer.volume}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 pb-3 mt-auto pt-2">
        <span className="text-amber-600" style={{ fontSize: "1.1rem", fontWeight: 700 }}>
          ¥{beer.price}
        </span>
        <div className="flex items-center gap-2">
          {quantity > 0 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(beer.id); }}
                className="w-7 h-7 rounded-full border-2 border-amber-400 flex items-center justify-center text-amber-500 transition-all active:scale-90"
              >
                <Minus size={14} />
              </button>
              <span className="text-gray-900 min-w-[16px] text-center" style={{ fontWeight: 600 }}>
                {quantity}
              </span>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(beer); }}
            className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-md transition-all active:scale-90 hover:bg-amber-600"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
