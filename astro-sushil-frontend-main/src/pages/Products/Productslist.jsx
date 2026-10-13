/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useState, useMemo, useEffect } from "react";
import { Search, X, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import PageHero from "../../components/HeroPage";
import Pagination from "../../components/Pagination";
import ProductCard2 from "./ProductCard2";
import { useProductStore } from "../../store/useProductStore";
import { useAuthStore } from "../../store/useAuthStore";
import LoginRequiredModal from "../../utils/LoginRequiredModal";
import Seo from "../../components/Seo";
import { useWishlistStore } from "../../store/useWishlistStore";

const PAGE_SIZE = 12;

const TABS = [
  { id: "digital", label: "Digital Products" },
  { id: "physical", label: "Physical Products" },
];

function getBadge(p) {
  if (p.isBestSeller) return "Best Seller";
  if (p.isTrending) return "Trending";
  if (p.isFeatured) return "Featured";
  return null;
}

function getPrice(product) {
  if (product.hasVariants && product.variants?.length) {
    const prices = product.variants.map((v) => v.price).filter(Boolean);
    const mrps = product.variants.map((v) => v.mrp).filter(Boolean);
    const pricesUSD = product.variants.map((v) => v.priceUSD).filter(Boolean);
    const mrpsUSD = product.variants.map((v) => v.mrpUSD).filter(Boolean);
    return {
      sale: prices.length ? Math.min(...prices) : null,
      mrp: mrps.length ? Math.min(...mrps) : null,
      usd: pricesUSD.length ? Math.min(...pricesUSD) : null,
      mrpUsd: mrpsUSD.length ? Math.min(...mrpsUSD) : null,
    };
  }
  return {
    sale: product.price ?? null,
    mrp: product.mrp || null,
    usd: product.priceUSD ?? null,
    mrpUsd: product.mrpUSD ?? null,
  };
}

function fmt(n) {
  if (!n) return null;
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function SearchBar({ value, onChange }) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        className="w-full pl-4 pr-11 py-2.5 rounded-full border-2 border-primary placeholder:text-primary bg-white text-black text-sm font-body shadow-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all duration-200"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear"
          className="absolute right-px top-[57%] -translate-y-1/2 pointer-events-none bg-primary rounded-full p-3.5 text-white"
        >
          <X size={15} />
        </button>
      ) : (
        <button
          type="button"
          aria-label="Search"
          className="absolute right-px top-[50%] -translate-y-1/2 pointer-events-none bg-primary rounded-full p-3.5 text-white"
        >
          <Search size={15} />
        </button>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-black/8 overflow-hidden animate-pulse">
      <div className="h-52 bg-black/8" />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-3 bg-black/8 rounded-full w-1/3" />
        <div className="h-4 bg-black/8 rounded-full w-full" />
        <div className="h-4 bg-black/8 rounded-full w-4/5" />
        <div className="h-8 bg-black/8 rounded-xl mt-2" />
      </div>
    </div>
  );
}

export default function ProductsList() {
  const { getWishlist } = useWishlistStore();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { user } = useAuthStore();
  const { products, loading, getProducts } = useProductStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("digital");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    getProducts({ limit: 1000 });
    if (user) getWishlist();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.filter((p) => p.type === activeTab);
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.shortDescription?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q),
    );
  }, [products, search, activeTab]);

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <>
      <Seo page="products" />
      <PageHero
        title="Huge Range of Featured Products"
        highlight="Featured Products"
        subtitle="Discover authentic astrology products, digital wallpapers, gemstones, Rudraksha, Yantras, and Vedic remedy kits carefully selected to support your spiritual journey, positive energy, and daily life."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Products", href: "/products" },
        ]}
      />

      <main className="w-full bg-white">
        <div className="max-w-7xl mx-auto px-5 py-10 sm:py-12 lg:py-14">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div
              className="flex gap-3 flex-wrap"
              role="tablist"
              aria-label="Consultation types"
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                  className={`relative cursor-pointer flex items-center gap-2 px-8 sm:px-10 lg:px-16 py-2.5 rounded-xl font-heading font-semibold text-sm sm:text-lg transition-all duration-700
                    focus-visible:outline-none
                      ${
                        activeTab === tab.id && tab.id === "physical"
                          ? "bg-gold text-white"
                          : activeTab === tab.id && tab.id === "digital"
                            ? "text-white bg-gold"
                            : "bg-[url('/Image/card-bg.webp')] bg-cover bg-center bg-no-repeat hover:bg-gold text-white"
                      }`}
                >
                  <img
                    src="/Image/mission-icon.png"
                    alt=""
                    aria-hidden="true"
                    width={20}
                    height={20}
                    loading="lazy"
                    decoding="async"
                    className="absolute top-2 left-2 -translate-x-1/2 w-8 h-8 object-contain z-5"
                  />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.span
                      layoutId="tab-indicator"
                      className="absolute inset-0 rounded-md ring-2 ring-inset ring-white/20"
                    />
                  )}
                </button>
              ))}
            </div>
            <SearchBar value={search} onChange={handleSearch} />
          </div>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4  2xl:grid-cols-5 gap-5 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center">
                <Package size={28} className="text-primary/50" />
              </div>
              <p className="font-heading text-black/50 text-xl">
                No products found
              </p>
              <p className="text-black/35 text-sm font-body">
                Try a different search term
              </p>
              <button
                type="button"
                onClick={() => handleSearch("")}
                className="mt-2 px-5 py-2 rounded-xl bg-primary text-white text-sm font-body hover:bg-primary/85 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Clear search
              </button>
            </motion.div>
          )}

          {!loading && paginated.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${search}-${safePage}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
              >
                {paginated.map((product, i) => {
                  const { sale, mrp, usd, mrpUsd } = getPrice(product);
                  return (
                    <motion.div
                      key={product._id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: i * 0.04 }}
                    >
                      <ProductCard2
                        user={user}
                        onLoginRequired={() => setShowLoginModal(true)}
                        _id={product._id}
                        image={product.thumbnail || product.images?.[0]}
                        badge={getBadge(product)}
                        title={product.name}
                        shortDescription={product.shortDescription}
                        originalPrice={mrp}
                        salePrice={sale}
                        gstType={product.gst?.type}
                        usdPrice={usd}
                        mrpUsdPrice={mrpUsd}
                        type={product.type}
                        rating={product.rating}
                        reviewsCount={product.reviewsCount}
                        hasVariants={product.hasVariants}
                        variants={product.variants ?? []}
                        onBook={() => navigate(`/product/${product.slug}`)}
                      />
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {!loading && totalPages > 1 && (
            <div className="mt-10 sm:mt-12">
              <Pagination
                current={safePage}
                total={totalPages}
                onChange={(p) => {
                  setPage(p);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          )}
        </div>
        <LoginRequiredModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          title="Login Required"
          message="Please login to add items to your cart and continue shopping."
          redirectTo="/dashboard/"
        />
      </main>
    </>
  );
}
