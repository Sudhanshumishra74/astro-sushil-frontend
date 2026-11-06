/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, PackageOpen, CalendarCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useConsultationStore } from "../../store/useConsultationStore";

function flattenRecommendations(bookings) {
  return bookings
    .flatMap((b) =>
      (b.recommendedProducts || [])
        .filter((rp) => rp.product)
        .map((rp) => ({
          id: `${b._id}-${rp.product._id || rp.product}`,
          product: rp.product,
          note: rp.note,
          recommendedAt: rp.recommendedAt,
          consultationTitle: b.consultationId?.title || "Consultation",
        })),
    )
    .sort((a, b) => new Date(b.recommendedAt) - new Date(a.recommendedAt));
}

function RecommendationCard({ item, index }) {
  const navigate = useNavigate();

  const product = item.product || {};
  const productId = product._id;
  const image = product.thumbnail || product.images?.[0] || null;
  const title = product.name || "Recommended Product";

  const baseVariant = product.variants?.[0] || null;
  const salePrice = product.hasVariants
    ? baseVariant?.price ?? null
    : product.price ?? null;
  const originalPrice = product.hasVariants
    ? baseVariant?.mrp !== baseVariant?.price
      ? baseVariant?.mrp
      : null
    : product.mrp !== product.price
      ? product.mrp
      : null;

  const goToProduct = () => navigate(`/product/${product.slug || productId}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      onClick={goToProduct}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && goToProduct()}
      className="group relative flex flex-col rounded-2xl overflow-hidden bg-white border border-black/8 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-secondary/20 shrink-0">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            onError={(e) => {
              e.target.src = "/Image/placeholder.png";
            }}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PackageOpen size={36} className="text-primary/20" />
          </div>
        )}

        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-body font-medium">
          <Sparkles size={10} /> Recommended
        </span>
      </div>

      <div className="flex flex-col flex-1 p-3 gap-2">
        <span className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/15 border border-gold/40 text-[10.5px] font-body font-semibold text-amber-700">
          <CalendarCheck size={11} />
          {item.consultationTitle}
        </span>

        <h3
          className="font-heading text-primary text-sm leading-snug line-clamp-2"
          title={title}
        >
          {title}
        </h3>

        {item.note && (
          <p className="text-xs font-body text-black/50 italic line-clamp-2">
            "{item.note}"
          </p>
        )}

        <div className="flex items-baseline gap-2 flex-wrap">
          {originalPrice && originalPrice !== salePrice && (
            <span className="text-black/35 text-xs font-body line-through">
              ₹{Number(originalPrice).toLocaleString("en-IN")}
            </span>
          )}
          {salePrice ? (
            <span className="font-heading text-primary text-base">
              ₹{Number(salePrice).toLocaleString("en-IN")}
            </span>
          ) : (
            <span className="text-black/30 text-xs font-body">View for price</span>
          )}
        </div>

        <div className="mt-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToProduct();
            }}
            className="w-full h-9 rounded-xl cursor-pointer bg-primary hover:bg-gold font-body text-sm font-medium text-white flex items-center justify-center active:scale-[0.97] transition-all duration-700"
          >
            View Product
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function MyRecommendationsPage() {
  const { myBookings, myBookingsLoading, getMyBookings } = useConsultationStore();
  const navigate = useNavigate();

  useEffect(() => {
    getMyBookings();
  }, []);

  const recommendations = useMemo(
    () => flattenRecommendations(myBookings),
    [myBookings],
  );

  return (
    <main className="min-h-screen">
      {myBookingsLoading && recommendations.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-secondary/30 animate-pulse aspect-3/4"
            />
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 gap-4 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-secondary/40 flex items-center justify-center">
            <Sparkles size={26} className="text-primary/30" />
          </div>
          <p className="font-heading font-medium text-primary/50 text-lg">
            No recommendations yet
          </p>
          <p className="text-sm font-body text-black/35 max-w-xs">
            After a consultation, any products your astrologer personally
            recommends for you will show up here.
          </p>
          <button
            type="button"
            onClick={() => navigate("/online-consultations")}
            className="mt-1 px-5 py-2 rounded-xl bg-primary text-white text-sm font-body hover:bg-primary/85 transition-colors"
          >
            Book a Consultation
          </button>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {recommendations.map((item, i) => (
              <RecommendationCard key={item.id} item={item} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </main>
  );
}
