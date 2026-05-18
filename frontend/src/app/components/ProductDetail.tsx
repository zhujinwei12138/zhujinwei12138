import { useState } from "react";
import { ArrowLeft, Plus, Minus, Star, ThumbsUp, ShoppingCart } from "lucide-react";
import { Beer } from "./BeerCard";
import { useData } from "../context/DataContext";

interface Review {
  id: number;
  user: string;
  avatarBg: string;
  rating: number;
  comment: string;
  date: string;
  likes: number;
  tags?: string[];
}

interface BeerDetail {
  origin: string;
  brewProcess: string;
  servingTemp: string;
  ingredients: string;
  avgRating: number;
  reviewCount: number;
  ratingDist: number[]; // [5★%, 4★%, 3★%, 2★%, 1★%]
  reviews: Review[];
}

const BEER_DETAILS: Record<number, BeerDetail> = {
  1: {
    origin: "美国精酿", brewProcess: "全麦芽酿造 · 干投酒花", servingTemp: "4–7°C", ingredients: "水、麦芽、酒花、酵母",
    avgRating: 4.8, reviewCount: 128, ratingDist: [78, 16, 4, 1, 1],
    reviews: [
      { id: 1, user: "跑步的小熊", avatarBg: "#f59e0b", rating: 5, comment: "苦涩恰到好处，热带果香非常明显！每次来都必点。搭配炸鸡绝了！", date: "2026-05-12", likes: 23, tags: ["果香浓郁", "推荐"] },
      { id: 2, user: "夜猫子K", avatarBg: "#3b82f6", rating: 5, comment: "IPA里最好喝的一款，苦度适中，芒果和菠萝的香气很明显，朋友们都抢着点。", date: "2026-05-08", likes: 17, tags: ["回味悠长"] },
      { id: 3, user: "蹦蹦啤酒爱好者", avatarBg: "#10b981", rating: 4, comment: "味道不错，就是有时候温度不够低，建议冰镇久一点。", date: "2026-04-30", likes: 8 },
    ],
  },
  2: {
    origin: "德国慕尼黑风格", brewProcess: "小麦麦芽 60% · 上发酵", servingTemp: "5–8°C", ingredients: "水、小麦麦芽、大麦麦芽、酒花、酵母",
    avgRating: 4.6, reviewCount: 89, ratingDist: [65, 25, 7, 2, 1],
    reviews: [
      { id: 1, user: "慕尼黑来的风", avatarBg: "#8b5cf6", rating: 5, comment: "白啤里的清流！香蕉和丁香的味道恰到好处，夏天喝非常舒服。", date: "2026-05-14", likes: 31, tags: ["清爽", "夏日首选"] },
      { id: 2, user: "泡沫小姐", avatarBg: "#ec4899", rating: 4, comment: "味道轻盈，不会很苦，女生也很适合喝，就是泡沫多了点。", date: "2026-05-01", likes: 12 },
    ],
  },
  3: {
    origin: "英式世涛", brewProcess: "深度烘焙麦芽 · 下发酵", servingTemp: "8–12°C", ingredients: "水、烘焙麦芽、燕麦、酒花、酵母",
    avgRating: 4.7, reviewCount: 56, ratingDist: [72, 20, 5, 2, 1],
    reviews: [
      { id: 1, user: "咖啡与黑啤", avatarBg: "#1f2937", rating: 5, comment: "黑啤爱好者必喝！咖啡和黑巧克力的香气完美融合，回味带着淡淡甜感。", date: "2026-05-10", likes: 19, tags: ["咖啡香", "厚重"] },
      { id: 2, user: "冬夜温酒人", avatarBg: "#b45309", rating: 5, comment: "浓郁醇厚，很有层次感，入冬第一杯必须是这个！", date: "2026-04-28", likes: 14 },
      { id: 3, user: "陌生的啤客", avatarBg: "#6b7280", rating: 4, comment: "味道独特，但对初次喝黑啤的人来说可能有点重。", date: "2026-04-20", likes: 5 },
    ],
  },
  4: {
    origin: "中国青岛", brewProcess: "大麦麦芽 · 下发酵", servingTemp: "4–6°C", ingredients: "水、麦芽、大米、酒花、酵母",
    avgRating: 4.4, reviewCount: 203, ratingDist: [52, 32, 12, 3, 1],
    reviews: [
      { id: 1, user: "国产啤酒支持者", avatarBg: "#16a34a", rating: 5, comment: "国产经典，价格实惠，配烤串就是人间美味！", date: "2026-05-13", likes: 41, tags: ["性价比高", "经典"] },
      { id: 2, user: "普通打工人", avatarBg: "#2563eb", rating: 4, comment: "下班后喝一瓶，清爽！就是有时候批次口味有点差异。", date: "2026-05-05", likes: 22 },
    ],
  },
  5: {
    origin: "墨西哥", brewProcess: "拉格工艺 · 过滤清爽", servingTemp: "2–4°C", ingredients: "水、麦芽、玉米、酒花、酵母",
    avgRating: 4.5, reviewCount: 167, ratingDist: [60, 28, 8, 3, 1],
    reviews: [
      { id: 1, user: "海边的风", avatarBg: "#0891b2", rating: 5, comment: "夹着柠檬片一起喝，超级清爽！夏天的标配啤酒。", date: "2026-05-11", likes: 55, tags: ["清爽", "配柠檬"] },
      { id: 2, user: "旅行的意义", avatarBg: "#d97706", rating: 4, comment: "味道很中性，不挑人，聚会用很适合。搭配墨西哥菜更配。", date: "2026-04-25", likes: 18 },
    ],
  },
  6: {
    origin: "荷兰", brewProcess: "全麦芽 · 下发酵经典拉格", servingTemp: "4–7°C", ingredients: "水、麦芽、酒花、酵母",
    avgRating: 4.5, reviewCount: 134, ratingDist: [58, 30, 8, 3, 1],
    reviews: [
      { id: 1, user: "绿瓶爱好者", avatarBg: "#15803d", rating: 5, comment: "喜力一贯的高品质！苦涩平衡，麦香到位，绿瓶颜值也高。", date: "2026-05-09", likes: 27, tags: ["颜值高", "稳定"] },
      { id: 2, user: "周末小酌", avatarBg: "#7c3aed", rating: 4, comment: "稳定发挥，没有惊喜但也不会让你失望，朋友聚会好选择。", date: "2026-05-02", likes: 9 },
    ],
  },
  7: {
    origin: "美国密苏里州", brewProcess: "大米辅料 · 过滤精酿", servingTemp: "3–6°C", ingredients: "水、麦芽、大米、酒花、酵母",
    avgRating: 4.2, reviewCount: 189, ratingDist: [44, 38, 13, 4, 1],
    reviews: [
      { id: 1, user: "宵夜爱好者", avatarBg: "#dc2626", rating: 5, comment: "轻盈好入口，一口接一口，适合不喜欢苦味的朋友。", date: "2026-05-12", likes: 33, tags: ["易饮", "轻盈"] },
      { id: 2, user: "派对主持人", avatarBg: "#ea580c", rating: 4, comment: "派对首选，价格友好，大家都能接受的口味。", date: "2026-04-29", likes: 15 },
    ],
  },
  8: {
    origin: "英式淡色艾尔", brewProcess: "麦芽 · 特选酒花 · 上发酵", servingTemp: "5–8°C", ingredients: "水、淡色麦芽、水晶麦芽、酒花、酵母",
    avgRating: 4.6, reviewCount: 73, ratingDist: [63, 24, 9, 3, 1],
    reviews: [
      { id: 1, user: "精酿新手入坑", avatarBg: "#0d9488", rating: 5, comment: "进入精酿世界的完美起点！花香和麦香的平衡非常好，苦度适中不吓人。", date: "2026-05-13", likes: 28, tags: ["入门首选", "花香"] },
      { id: 2, user: "IPA爱好者", avatarBg: "#4f46e5", rating: 4, comment: "比IPA温和很多，很好喝，但我还是更爱IPA的强烈感。", date: "2026-05-07", likes: 11 },
    ],
  },
};

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}
        />
      ))}
    </div>
  );
}

interface ProductDetailProps {
  beer: Beer;
  onBack: () => void;
}

export function ProductDetail({ beer, onBack }: ProductDetailProps) {
  const { cart, addToCart, removeFromCart } = useData();
  const [imgError, setImgError] = useState(false);
  const [addedAnim, setAddedAnim] = useState(false);

  const detail = BEER_DETAILS[beer.id] ?? BEER_DETAILS[1];
  const cartItem = cart.find((i) => i.id === beer.id);
  const qty = cartItem?.quantity ?? 0;

  const handleAdd = () => {
    addToCart({ id: beer.id, name: beer.name, category: beer.category, price: beer.price, volume: beer.volume, image: beer.image, tag: beer.tag });
    setAddedAnim(true);
    setTimeout(() => setAddedAnim(false), 600);
  };

  const handleRemove = () => removeFromCart(beer.id);

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-28 bg-white">
      {/* Hero Image */}
      <div className="relative">
        <div className="w-full h-72 bg-amber-50">
          {!imgError ? (
            <img src={beer.image} alt={beer.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl">🍺</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
        >
          <ArrowLeft size={18} />
        </button>
        {beer.tag && (
          <span className="absolute top-4 right-4 bg-amber-500 text-white text-xs px-2.5 py-1 rounded-full" style={{ fontWeight: 600 }}>
            {beer.tag}
          </span>
        )}
      </div>

      {/* Basic Info */}
      <div className="px-4 pt-4 pb-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-gray-900" style={{ fontWeight: 700, fontSize: "1.3rem" }}>{beer.name}</h1>
          <span className="text-amber-600 flex-shrink-0 mt-1" style={{ fontWeight: 700, fontSize: "1.4rem" }}>¥{beer.price}</span>
        </div>
        <p className="text-gray-500 text-sm mt-1">{beer.desc}</p>
        <div className="flex items-center gap-3 mt-3">
          <StarRating rating={Math.round(detail.avgRating)} />
          <span className="text-amber-600 text-sm" style={{ fontWeight: 600 }}>{detail.avgRating}</span>
          <span className="text-gray-400 text-sm">{detail.reviewCount} 条评价</span>
        </div>
        <span className="inline-block mt-2 bg-amber-50 text-amber-600 text-xs px-2.5 py-1 rounded-full border border-amber-200">
          {beer.volume}
        </span>
      </div>

      {/* Product Details */}
      <div className="px-4 py-4 border-b border-gray-100">
        <h2 className="text-gray-800 mb-3" style={{ fontWeight: 600 }}>商品详情</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "产地", value: detail.origin },
            { label: "酿造工艺", value: detail.brewProcess },
            { label: "建议饮用温度", value: detail.servingTemp },
            { label: "主要成分", value: detail.ingredients },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 text-xs mb-0.5">{label}</p>
              <p className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-800" style={{ fontWeight: 600 }}>用户评价</h2>
          <span className="text-gray-400 text-sm">共 {detail.reviewCount} 条</span>
        </div>

        {/* Rating Summary */}
        <div className="flex gap-4 mb-5 bg-amber-50 rounded-2xl p-4">
          <div className="text-center flex-shrink-0">
            <p className="text-amber-600" style={{ fontWeight: 800, fontSize: "2.2rem", lineHeight: 1 }}>{detail.avgRating}</p>
            <StarRating rating={Math.round(detail.avgRating)} size={12} />
            <p className="text-gray-400 text-xs mt-1">{detail.reviewCount}人评价</p>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            {detail.ratingDist.map((pct, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-gray-400 text-xs w-4 text-right">{5 - idx}★</span>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-gray-400 text-xs w-6">{pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Review Cards */}
        <div className="flex flex-col gap-4">
          {detail.reviews.map((review) => (
            <div key={review.id} className="border border-gray-100 rounded-2xl p-4">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0" style={{ background: review.avatarBg, fontWeight: 700 }}>
                  {review.user[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>{review.user}</p>
                    <p className="text-gray-300 text-xs">{review.date}</p>
                  </div>
                  <StarRating rating={review.rating} size={12} />
                </div>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
              {review.tags && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {review.tags.map((tag) => (
                    <span key={tag} className="bg-amber-50 text-amber-600 text-xs px-2 py-0.5 rounded-full border border-amber-100">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 mt-3 text-gray-300">
                <ThumbsUp size={12} />
                <span className="text-xs">{review.likes}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Add to Cart Bar */}
      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto z-20 px-4 pb-3 pt-2 bg-white border-t border-gray-100 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {qty > 0 ? (
              <>
                <button onClick={handleRemove} className="w-9 h-9 rounded-full border-2 border-amber-400 flex items-center justify-center text-amber-500">
                  <Minus size={16} />
                </button>
                <span className="text-gray-900 text-lg min-w-[24px] text-center" style={{ fontWeight: 700 }}>{qty}</span>
              </>
            ) : null}
          </div>
          <button
            onClick={handleAdd}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white transition-transform active:scale-95 ${addedAnim ? "bg-green-500 scale-95" : "bg-amber-500"}`}
            style={{ fontWeight: 600 }}
          >
            <ShoppingCart size={18} />
            {qty > 0 ? `再加一杯 · ¥${beer.price}` : `加入购物车 · ¥${beer.price}`}
          </button>
        </div>
      </div>
    </div>
  );
}
