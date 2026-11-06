/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Package,
  Check,
  Plus,
  Minus,
  Play,
} from "lucide-react";
import PageHero from "../../components/HeroPage";
import { useProductStore } from "../../store/useProductStore";
import Seo from "../../components/Seo";
import { useCartStore } from "../../store/useCartStore";
import { useSettingStore } from "../../store/usSettingStore";
import { useCurrency } from "../../hooks/useCurrency";
import { useSearchParams } from "react-router-dom";
import { isVariantOutOfStock } from "../../utils/stock";

const fmt = (n, cur = "₹") => `${cur}${Number(n).toLocaleString("en-IN")}`;

// Mirrors src/utils/ratti.js on the backend — must generate the exact same
// list, or a ratti value offered here could be rejected server-side. Kept
// as a plain client-side duplicate (no shared package between these
// separate repos) rather than an API round-trip, since it's a pure
// function of min/max.
const RATTI_STEP = 0.25;
function generateRattiOptions(minRatti, maxRatti) {
  const min = Number(minRatti);
  const max = Number(maxRatti);
  if (!Number.isFinite(min) || min <= 0) return [];
  const safeMax = Number.isFinite(max) && max >= min ? max : min;
  const minUnits = Math.round(min / RATTI_STEP);
  const maxUnits = Math.round(safeMax / RATTI_STEP);
  const options = [];
  for (let units = minUnits; units <= maxUnits; units += 1) {
    options.push(Math.round(units * RATTI_STEP * 100) / 100);
  }
  return options;
}

// `media` is a list of { type: "image" | "video", src }. A product's video
// (when it has one) is spliced in as the 2nd item by the caller — the
// thumbnail strip shows a play-icon tile (over the product's own thumbnail
// image, as a stand-in preview) for it instead of a broken <img>. A real
// per-frame poster would need either server-side extraction (ffmpeg) or the
// video's S3 bucket serving CORS headers permissive enough for a canvas to
// read its pixels — neither is set up yet, so this reuses the product's
// existing thumbnail rather than showing a blank/wrong frame.
function Gallery({ media, wished, onWishToggle, thumbnail }) {
  const [active, setActive] = useState(0);
  const current = media[active] || media[0];
  const videoPoster = thumbnail || media.find((m) => m.type === "image")?.src || null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-2xl overflow-hidden bg-secondary/20 aspect-square sm:aspect-4/3 shadow-md border-2 border-dashed border-gold p-1">
        <AnimatePresence mode="wait">
          {!current ? (
            // No media at all (a product with zero images) — same "no
            // image" placeholder ProductCard2 shows, instead of an
            // <img src={undefined}> that renders as a broken-image icon.
            <div className="w-full h-full flex items-center justify-center">
              <Package size={48} className="text-primary/20" />
            </div>
          ) : current.type === "video" ? (
            <motion.video
              key={active}
              src={current.src}
              poster={videoPoster || undefined}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-contain rounded-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <motion.img
              key={active}
              src={current.src}
              alt="Product image"
              className="w-full h-full object-contain rounded-2xl"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onError={(e) => {
                e.target.src = "/Image/placeholder.png";
              }}
            />
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={onWishToggle}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          <Heart
            size={17}
            className={wished ? "text-red-500 fill-red-500" : "text-black/40"}
            aria-hidden="true"
          />
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {media.map((m, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={m.type === "video" ? "Play video" : `View image ${i + 1}`}
            className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 border-dashed transition-all duration-700 bg-secondary/20
              ${i === active ? " border-gold shadow-md p-px" : "border-transparent opacity-55 hover:opacity-85"}`}
          >
            {m.type === "video" ? (
              <div
                className="relative w-full h-full bg-black/85 flex items-center justify-center rounded-xl bg-cover bg-center"
                style={videoPoster ? { backgroundImage: `url(${videoPoster})` } : undefined}
              >
                {videoPoster && (
                  <div className="absolute inset-0 bg-black/25 rounded-xl" aria-hidden="true" />
                )}
                <Play size={18} className="relative text-white fill-white" aria-hidden="true" />
              </div>
            ) : (
              <img
                src={m.src}
                alt=""
                className="w-full h-full object-cover rounded-xl"
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function TrustBadge({ icon: Icon, label, sub }) {
  return (
    <div className="flex flex-col items-center text-center gap-1 p-3">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon size={18} className="text-primary" aria-hidden="true" />
      </div>
      <span className="font-body text-black text-xs font-medium leading-tight">
        {label}
      </span>
      {sub && (
        <span className="text-black/40 text-[10px] font-body">{sub}</span>
      )}
    </div>
  );
}

// Cascading second level — a variant like "Color: Red" can narrow down to
// sub-variants "Size: S"/"Size: M". Same normalized shape as a top-level
// variant, just one level deeper.
function normalizeSubVariants(apiSubVariants = []) {
  if (!apiSubVariants.length) return [];

  const basePrice = apiSubVariants[0]?.price ?? 0;

  return apiSubVariants.map((sv) => ({
    label: `${sv.name}: ${sv.value}`,

    option: sv.name.toLowerCase(),
    optionValue: String(sv.value).toLowerCase(),

    value: sv._id,
    price: sv.price,
    mrp: sv.mrp,
    stock: sv.stock,
    priceAdd: sv.price - basePrice,
  }));
}

function normalizeVariants(apiVariants = []) {
  if (!apiVariants.length) return [];

  const basePrice = apiVariants[0]?.price ?? 0;

  return apiVariants.map((v) => ({
    label: `${v.name}: ${v.value}`,

    option: v.name.toLowerCase(),
    optionValue: String(v.value).toLowerCase(),

    value: v._id,
    price: v.price,
    mrp: v.mrp,
    stock: v.stock,
    priceAdd: v.price - basePrice,
    subVariants: normalizeSubVariants(v.subVariants),
  }));
}

export default function ProductDetailPage() {
  const { convert } = useCurrency();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    addToCart,
    incrementQuantity,
    decrementQuantity,
    isInCart,
    getProductQuantity,
  } = useCartStore();

  const {
    product: raw,
    loading,
    error,
    getProductBySlug,
    clearProduct,
  } = useProductStore();

  useEffect(() => {
    if (slug) getProductBySlug(slug);

    return () => clearProduct();
  }, [slug]);

  // Videos (up to 2, when the product has any) are spliced in right after
  // the primary image — not appended at the end.
  const mediaItems = useMemo(() => {
    const images = raw?.images?.length ? raw.images : [raw?.thumbnail].filter(Boolean);
    const items = images.map((src) => ({ type: "image", src }));
    const videoItems = (raw?.videos || []).map((src) => ({ type: "video", src }));
    items.splice(1, 0, ...videoItems);
    return items;
  }, [raw]);

  const p = raw
    ? {
        id: raw._id,
        type: raw.type,
        badge: raw.isBestSeller
          ? "Best Seller"
          : raw.isTrending
            ? "Trending"
            : null,
        sku: raw.sku,
        images: raw.images?.length
          ? raw.images
          : [raw.thumbnail].filter(Boolean),
        title: raw.name,
        shortDescription: raw.shortDescription,
        originalPrice: raw.variants?.[0]?.mrp ?? raw.mrp ?? raw.price ?? 0,
        salePrice: raw.variants?.[0]?.price ?? raw.discountedPrice ?? raw.price ?? 0,
        gstType: raw.gst?.type ?? "exclusive",
        gstRate: raw.gst?.rate ?? 0,

        stock: raw.stock ?? 0,
        variants: normalizeVariants(raw.variants),
        certificates: raw.certificates ?? [],
        soldByRatti: Boolean(raw.soldByRatti),
        minRatti: raw.minRatti ?? 1,
        maxRatti: raw.maxRatti ?? raw.minRatti ?? 1,
        outOfStockRattis: raw.outOfStockRattis ?? [],
        highlights: [],
        descriptionHtml: raw.description ?? "",
        reviews: [],
        shipping: {
          freeAbove: 999,
          estimatedDays: "5–7 business days",
          returnDays: 7,
        },
      }
    : null;

  // Guards the "Product Details" section below — a rich-text editor can
  // save something like "<p><br></p>" for an empty description, which is a
  // non-empty string but has no actual visible content, so a plain
  // truthy check on descriptionHtml isn't enough on its own.
  const hasDescription = Boolean(p?.descriptionHtml?.replace(/<[^>]*>/g, "").trim());

  // Variant from URL
  const variantParam = p?.variants?.[0]
    ? searchParams.get(p.variants[0].option)
    : null;

  // Set default variant when product loads
  useEffect(() => {
    if (!p?.variants?.length) return;

    const firstVariant = p.variants[0];

    if (!searchParams.get(firstVariant.option)) {
      setSearchParams(
        {
          [firstVariant.option]: firstVariant.optionValue,
        },
        { replace: true },
      );
    }
  }, [p]);

  // Selected variant
  const selectedVariant = useMemo(() => {
    if (!p?.variants?.length) return null;

    return (
      p.variants.find((v) => searchParams.get(v.option) === v.optionValue) ||
      p.variants[0]
    );
  }, [p, searchParams]);

  // Cascading second level — keyed by the sub-variant's own `_id` under a
  // single "sub" param, NOT the option/value scheme top-level variants use.
  // Sibling variants at the top level are expected to share one attribute
  // name (e.g. every one is "Size"), so switching between them just
  // overwrites one query key. Sub-variants have no such guarantee — each
  // row in the admin form is independent and can carry a totally different
  // name — so keying off name/value the same way let two sub-variants each
  // claim their own param key (`sub_colorA`, `sub_colorB`) instead of one
  // clicking replacing the other's selection, and the picker got stuck
  // showing whichever was set first. A single id-based key has no such
  // failure mode. No client-side filtering needed here since
  // selectedVariant.subVariants is already the correct pre-scoped set.
  const selectedSubVariant = useMemo(() => {
    const subs = selectedVariant?.subVariants;
    if (!subs?.length) return null;

    return subs.find((sv) => sv.value === searchParams.get("sub")) || subs[0];
  }, [selectedVariant, searchParams]);

  // Keep the "sub" param pointed at a sub-variant that actually belongs to
  // the currently-selected top-level variant — auto-selects the first one
  // whenever the variant changes (including on first load), and corrects a
  // stale id left over from a different variant's sub-variant set.
  useEffect(() => {
    const subs = selectedVariant?.subVariants;
    if (!subs?.length) return;

    const current = searchParams.get("sub");
    if (subs.some((sv) => sv.value === current)) return;

    const first = subs[0];

    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("sub", first.value);
        return params;
      },
      { replace: true },
    );
  }, [selectedVariant]);

  const settings = useSettingStore((s) => s.settings);
  const fetchSettings = useSettingStore((s) => s.fetchSettings);
  useEffect(() => {
    if (!settings) fetchSettings();
  }, []);
  const certificatesEnabled = Boolean(settings?.product?.certificatesEnabled);

  // Single-select dropdown — "" means no certificate chosen. Derived rather
  // than reset via effect: a choice that doesn't belong to the currently
  // loaded product's certificates (e.g. right after navigating to a
  // different product) just falls back to "", same pattern as
  // selectedRattiChoice above.
  const [certificateChoice, setCertificateChoice] = useState("");
  const selectedCertificate =
    certificatesEnabled && p?.certificates?.length
      ? p.certificates.find((c) => c._id === certificateChoice) || null
      : null;
  const selectedCertificateId = selectedCertificate?._id || "";
  const certificatesExtra =
    selectedCertificate && !selectedCertificate.includedInPrice
      ? Number(selectedCertificate.price) || 0
      : 0;

  const [qty, setQty] = useState(1);
  const [wished, setWished] = useState(false);
  const [addedCart, setAddedCart] = useState(false);
  const inCart = isInCart(p?._id || p?.id);
  const cartQty = getProductQuantity(p?._id || p?.id);

  // Gemstone ratti selection — mutually exclusive with variants (a
  // soldByRatti product has none, see product.modal.js on the backend).
  // Sold-out weights (outOfStockRattis, admin-set) stay IN this list rather
  // than being hidden — the picker shows them as a disabled option (same
  // pattern as the variant chips below) so the customer can see a weight
  // exists but is unavailable, instead of it silently not being there.
  const rattiOptions = useMemo(
    () => (p?.soldByRatti ? generateRattiOptions(p.minRatti, p.maxRatti) : []),
    [p],
  );
  const outOfStockRattiSet = useMemo(
    () => new Set((p?.outOfStockRattis || []).map((r) => Number(r))),
    [p],
  );
  const inStockRattiOptions = useMemo(
    () => rattiOptions.filter((r) => !outOfStockRattiSet.has(r)),
    [rattiOptions, outOfStockRattiSet],
  );
  // Derived rather than initialized-via-effect: `selectedRattiChoice` only
  // ever holds an explicit user pick, and falls back to the first IN-STOCK
  // option whenever it's unset or no longer valid for the loaded product
  // (e.g. the very first render, navigating between two gemstones, or the
  // previously-selected weight just got marked out of stock) — never to a
  // disabled option.
  const [selectedRattiChoice, setSelectedRattiChoice] = useState(null);
  const selectedRatti = inStockRattiOptions.includes(selectedRattiChoice)
    ? selectedRattiChoice
    : (inStockRattiOptions[0] ?? null);

  const effectivePrice = p?.soldByRatti
    ? Math.round((p.salePrice ?? 0) * (selectedRatti ?? 0) * 100) / 100
    : selectedSubVariant
      ? selectedSubVariant.price
      : selectedVariant
        ? selectedVariant.price
        : (p?.salePrice ?? 0);
  const effectiveOriginal = p?.soldByRatti
    ? Math.round((p.originalPrice ?? 0) * (selectedRatti ?? 0) * 100) / 100
    : selectedSubVariant
      ? selectedSubVariant.mrp
      : selectedVariant
        ? selectedVariant.mrp
        : (p?.originalPrice ?? 0);
  const discount =
    effectiveOriginal > effectivePrice
      ? Math.round(100 - (effectivePrice / effectiveOriginal) * 100)
      : 0;

  // Additive on top of the variant/ratti price, not folded into
  // effectivePrice/effectiveOriginal — mirrors how the backend keeps
  // certificatePrice a separate snapshot field rather than merging it into
  // price/mrp (see priceengine.js).
  const displayPrice = effectivePrice + certificatesExtra;

  const effectiveGstRate = p?.gstRate ?? 0;

  const activeStock = selectedSubVariant
    ? selectedSubVariant.stock
    : selectedVariant
      ? selectedVariant.stock
      : (p?.stock ?? 0);
  // Mirrors cart.controler.js's own convention (`product.stock > 0 ? Math.min(...) : nextQuantity`):
  // 0/undefined means stock isn't tracked for this product/variant, not
  // "zero available" — treating it as a hard cap disabled the "+" button
  // immediately (qty 1 >= stock 0) for every product an admin never set a
  // stock count on, and produced NaN for variants with no stock set at all
  // (Math.min(undefined, q+1)).
  const hasStockLimit = activeStock > 0;
  const isPhysical = p?.type === "physical";
  const isDigital = p?.type === "digital";
  // Unlike hasStockLimit (only used to cap the qty stepper's "+"), this
  // drives the actual "can this be bought" gate — checkout genuinely fails
  // once the resolved stock (sub-variant, else variant, else base product)
  // is exhausted, so 0 here is treated as a real out-of-stock signal. Only
  // physical products are inventory-tracked — `stock` defaults to 0 for
  // every type, so a digital/service product must never be gated on it.
  const isOutOfStock = isPhysical && activeStock <= 0;

  const handleAddCart = async () => {
    if (isOutOfStock) return;
    if (p.soldByRatti && !selectedRatti) return;
    const payload = {
      productId: p.id,
      quantity: qty,
    };

    if (p.soldByRatti) {
      payload.selectedRatti = selectedRatti;
    } else {
      if (selectedVariant?.value) {
        payload.variantId = selectedVariant.value;
      }
      if (selectedSubVariant?.value) {
        payload.subVariantId = selectedSubVariant.value;
      }
    }

    if (selectedCertificateId) {
      payload.certificateId = selectedCertificateId;
    }

    await addToCart(payload);

    setAddedCart(true);

    setTimeout(() => {
      setAddedCart(false);
    }, 2000);
  };
  const handleBuyNow = async () => {
    if (isOutOfStock) return;
    if (p.soldByRatti && !selectedRatti) return;
    const payload = {
      productId: p.id,
      quantity: qty,
    };

    if (p.soldByRatti) {
      payload.selectedRatti = selectedRatti;
    } else {
      if (selectedVariant?.value) {
        payload.variantId = selectedVariant.value;
      }
      if (selectedSubVariant?.value) {
        payload.subVariantId = selectedSubVariant.value;
      }
    }

    if (selectedCertificateId) {
      payload.certificateId = selectedCertificateId;
    }

    if (!inCart) {
      await addToCart(payload);
    }

    navigate("/checkout");
  };

  const seo = useMemo(() => {
    return {
      title: selectedVariant?.metaTitle || raw?.metaTitle || raw?.name || "",

      description:
        selectedVariant?.metaDescription ||
        raw?.metaDescription ||
        raw?.shortDescription ||
        "",

      keywords: raw?.keywords?.join(", ") || "",
      image: raw?.thumbnail || "",
    };
  }, [selectedVariant, raw]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !p) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="font-heading text-black text-xl">Product not found</p>
        <p className="text-black/50 text-sm font-body">
          {error ?? "This product could not be loaded."}
        </p>
      </div>
    );
  }

  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        image={seo.image}
      />
      <PageHero
        title="Huge Range of Featured Products"
        highlight="Featured Products"
        subtitle="The extraordinary world of astrology, an ancient science that illuminates personality, purpose, and possibility. Every moment holds cosmic meaning"
        image="/Image/page-hero-bg.webp"
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: p.title.slice(0, 25) + "...", href: `/product/${p.id}` },
        ]}
      />

      <main className="w-full bg-white">
        <div className="max-w-7xl mx-auto px-5 py-10 sm:py-12 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 xl:gap-20">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Gallery
                media={mediaItems}
                thumbnail={raw?.thumbnail}
                wished={wished}
                onWishToggle={() => setWished((w) => !w)}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="flex flex-col gap-5"
            >
              <div className="flex items-center gap-2 flex-wrap">
                {p.badge && (
                  <span className="px-3 py-1 rounded-full bg-gradient-gold text-black text-xs font-body font-medium">
                    {p.badge}
                  </span>
                )}

                <button
                  type="button"
                  className={`relative cursor-pointer flex items-center gap-2 px-8 sm:px-10 py-2.5 rounded-xl font-heading font-semibold text-sm sm:text-lg transition-all duration-700
                    focus-visible:outline-none bg-gold text-white`}
                >
                  <img
                    src="/Image/mission-icon.png"
                    alt=""
                    aria-hidden="true"
                    width={20}
                    height={20}
                    loading="lazy"
                    decoding="async"
                    className="absolute left-1 sm:top-2 sm:left-2 -translate-x-1/2 sm:w-8 sm:h-8 object-contain z-5"
                  />
                  {isDigital ? "Digital Product" : "Physical Product"}
                </button>

                {/* <span
                  className={`px-3 py-1 rounded-full text-xs font-body font-medium flex items-center gap-1
                  ${isDigital ? "bg-primary/10 text-primary" : "bg-green-50 text-green-700"}`}
                >
                  {isDigital ? (
                    <Download size={11} aria-hidden="true" />
                  ) : (
                    <Package size={11} aria-hidden="true" />
                  )}
                  {isDigital ? "Digital Product" : "Physical Product"}
                </span> */}
              </div>

              <div className="flex flex-col gap-1">
                <h1 className="font-heading text-primary text-2xl sm:text-3xl lg:text-[1.85rem] xl:text-3xl leading-snug">
                  {p.title}
                </h1>
                {p.sku && (
                  <span className="text-black/35 text-xs font-body">
                    SKU: {p.sku}
                  </span>
                )}
              </div>

              {/* Short description */}
              <p className="text-black/60 text-sm sm:text-base font-body leading-relaxed border-b border-black/8 pb-5 whitespace-pre-wrap">
                {p.shortDescription}
              </p>

              {/* Price */}
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  {effectiveOriginal > effectivePrice && (
                    <>
                      <span className="text-black/35 text-xl font-body line-through">
                        {convert(effectiveOriginal)}
                      </span>
                    </>
                  )}

                  <span className="font-body text-primary font-semibold text-3xl">
                    {convert(displayPrice)}
                  </span>
                  {/* <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-body font-medium flex items-center gap-1">
                    <Tag size={11} aria-hidden="true" /> {discount}% OFF
                  </span> */}
                </div>
                <span className="text-black/35 text-xs font-body">
                  {p.gstType === "inclusive" ? "Inclusive" : "Exclusive"} of GST
                  {effectiveGstRate > 0 ? ` (${effectiveGstRate}%)` : ""}
                </span>
                {isOutOfStock && (
                  <span className="w-fit mt-1 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-body font-semibold border border-red-200">
                    Out of Stock
                  </span>
                )}
              </div>

              {/* Ratti selector — gemstone products priced per ratti, see
                  product.modal.js on the backend. Mutually exclusive with
                  the variant picker below. */}
              {p.soldByRatti && rattiOptions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="ratti-select"
                    className="text-black/55 text-xs uppercase tracking-widest font-body"
                  >
                    Select Ratti
                  </label>
                  <select
                    id="ratti-select"
                    value={selectedRatti ?? ""}
                    onChange={(e) => setSelectedRattiChoice(Number(e.target.value))}
                    className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-black/15 text-sm font-body text-black/80 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {rattiOptions.map((ratti) => {
                      const outOfStock = outOfStockRattiSet.has(ratti);
                      return (
                        <option key={ratti} value={ratti} disabled={outOfStock}>
                          {ratti} ratti
                          {outOfStock
                            ? " — Out of Stock"
                            : ` — ${fmt(Math.round((p.salePrice ?? 0) * ratti))}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Variants */}
              {!p.soldByRatti && p.variants?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-black/55 text-xs uppercase tracking-widest font-body">
                    Size / Variant
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {p.variants.map((v) => {
                      const variantOutOfStock = isVariantOutOfStock(v);
                      return (
                      <button
                        key={v.value}
                        type="button"
                        disabled={variantOutOfStock}
                        title={variantOutOfStock ? "Out of stock" : undefined}
                        onClick={() =>
                          !variantOutOfStock &&
                          setSearchParams((prev) => {
                            const params = new URLSearchParams(prev);

                            params.set(v.option, v.optionValue);

                            return params;
                          })
                        }
                        aria-pressed={
                          searchParams.get(v.option) === v.optionValue
                        }
                        className={`px-4 py-2 rounded-xl border text-sm font-body transition-all duration-200
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                          ${
                            variantOutOfStock
                              ? "border-black/10 text-black/25 bg-black/5 cursor-not-allowed line-through"
                              : searchParams.get(v.option) === v.optionValue
                                ? "border-primary bg-primary text-white shadow-sm"
                                : "border-black/15 text-black/65 hover:border-primary/50"
                          }`}
                      >
                        {v.label}
                        {v.priceAdd > 0 && (
                          <span className="ml-1 text-[10px] opacity-70">
                            +{fmt(v.priceAdd, p.currency)}
                          </span>
                        )}
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-variants — cascading second level, only shown once the
                  selected variant actually has any. Label is generic (not
                  derived from any one sub-variant's own name) since sibling
                  sub-variant rows aren't required to share an attribute name
                  the way top-level variants are. */}
              {selectedVariant?.subVariants?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-black/55 text-xs uppercase tracking-widest font-body">
                    Select Option
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedVariant.subVariants.map((sv) => {
                      const subVariantOutOfStock = (sv.stock ?? 0) <= 0;
                      return (
                      <button
                        key={sv.value}
                        type="button"
                        disabled={subVariantOutOfStock}
                        title={subVariantOutOfStock ? "Out of stock" : undefined}
                        onClick={() =>
                          !subVariantOutOfStock &&
                          setSearchParams((prev) => {
                            const params = new URLSearchParams(prev);

                            params.set("sub", sv.value);

                            return params;
                          })
                        }
                        aria-pressed={searchParams.get("sub") === sv.value}
                        className={`px-4 py-2 rounded-xl border text-sm font-body transition-all duration-200
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                          ${
                            subVariantOutOfStock
                              ? "border-black/10 text-black/25 bg-black/5 cursor-not-allowed line-through"
                              : searchParams.get("sub") === sv.value
                                ? "border-primary bg-primary text-white shadow-sm"
                                : "border-black/15 text-black/65 hover:border-primary/50"
                          }`}
                      >
                        {sv.label}
                        {sv.priceAdd > 0 && (
                          <span className="ml-1 text-[10px] opacity-70">
                            +{fmt(sv.priceAdd, p.currency)}
                          </span>
                        )}
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Certificates — single-select dropdown, gated by the
                  site-wide Setting.product.certificatesEnabled toggle. */}
              {certificatesEnabled && p.certificates?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="certificate-select"
                    className="text-black/55 text-xs uppercase tracking-widest font-body"
                  >
                    Certificate
                  </label>
                  <select
                    id="certificate-select"
                    value={selectedCertificateId}
                    onChange={(e) => setCertificateChoice(e.target.value)}
                    className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-black/15 text-sm font-body text-black/80 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <option value="">None</option>
                    {p.certificates.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} — {c.includedInPrice ? "included" : `+${fmt(c.price, p.currency)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isPhysical && (
                <div className="max-w-max flex items-center border border-black/15 rounded-full bg-secondary text-primary overflow-hidden py-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label="Decrease quantity"
                    className="w-8 h-8 rounded-full ml-1 flex items-center justify-center text-white bg-primary hover:bg-gold transition-colors duration-700 focus-visible:outline-none cursor-pointer"
                  >
                    <Minus size={12} aria-hidden="true" />
                  </button>
                  <span
                    className="w-8 text-center font-heading text-primary text-base select-none"
                    aria-live="polite"
                  >
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => (hasStockLimit ? Math.min(activeStock, q + 1) : q + 1))}
                    disabled={hasStockLimit && qty >= activeStock}
                    aria-label="Increase quantity"
                    className="w-8 h-8 rounded-full mr-1 flex items-center justify-center text-white bg-primary hover:bg-gold transition-colors duration-700 focus-visible:outline-none cursor-pointer"
                  >
                    <Plus size={12} aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Qty + Add to Cart + Buy Now */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleAddCart}
                  disabled={isOutOfStock}
                  className="flex-1 px-4 py-2 cursor-pointer rounded-lg font-medium bg-primary text-white font-body text-sm sm:text-base tracking-widest uppercase flex items-center justify-center gap-1.5 hover:bg-gold hover:text-white active:scale-[0.98] transition-all duration-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-w-27.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <AnimatePresence mode="wait">
                    {isOutOfStock ? (
                      <motion.span key="oos" className="flex items-center gap-1.5">
                        Out of Stock
                      </motion.span>
                    ) : addedCart ? (
                      <motion.span
                        key="done"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1.5"
                      >
                        <Check size={13} aria-hidden="true" /> Added!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="cart"
                        className="flex items-center gap-1.5"
                      >
                        {/* <ShoppingCart size={13} aria-hidden="true" />  */}
                        Add to Cart
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <button
                  onClick={handleBuyNow}
                  type="button"
                  disabled={isOutOfStock}
                  className="flex-1 px-4 py-2 cursor-pointer rounded-lg bg-primary text-white border-2 font-body text-sm sm:text-base tracking-widest uppercase flex items-center justify-center gap-1.5 hover:bg-gold hover:text-white active:scale-[0.98] transition-all duration-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-w-25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* <Zap size={13} aria-hidden="true" />  */}
                  Buy Now
                </button>
              </div>

              {/* Digital notice */}
              {/* {isDigital && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-primary/6 border border-primary/15">
                  <Download size={15} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-black/65 text-xs font-body leading-relaxed">
                    Instant delivery — download link sent to your email within seconds of purchase.
                    Access forever from your account dashboard.
                  </p>
                </div>
              )} */}

              {/* Trust badges */}
              {/* <div className="grid grid-cols-3 gap-0 border border-black/8 rounded-2xl mt-1 divide-x divide-black/8">
                {isPhysical ? (
                  <>
                    <TrustBadge
                      icon={Truck}
                      label="Free Shipping"
                      sub={`Above ${fmt(p.shipping.freeAbove, p.currency)}`}
                    />
                    <TrustBadge
                      icon={RotateCcw}
                      label={`${p.shipping.returnDays}-Day Returns`}
                      sub="No questions asked"
                    />
                    <TrustBadge
                      icon={Shield}
                      label="100% Authentic"
                      sub="Verified & energised"
                    />
                  </>
                ) : (
                  <>
                    <TrustBadge
                      icon={Download}
                      label="Instant Access"
                      sub="Lifetime downloads"
                    />
                    <TrustBadge
                      icon={Shield}
                      label="Secure Payment"
                      sub="256-bit encryption"
                    />
                    <TrustBadge
                      icon={RotateCcw}
                      label="30-Day Refund"
                      sub="No questions asked"
                    />
                  </>
                )}
              </div> */}
            </motion.div>
          </div>
        </div>

        {(hasDescription || p.highlights?.length > 0) && (
        <div className="border-t border-black/8 bg-secondary/10">
          <div className="max-w-7xl mx-auto px-5 py-12 sm:py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="font-heading text-primary text-2xl mb-6">
                Product Details
              </h2>
              {hasDescription && (
                <div
                  className="max-w-full mx-auto prose prose-sm prose-gray sm:prose-base prose-headings:font-philosopher [&_h1]:text-primary [&_h2]:text-primary [&_h3]:text-primary [&_h4]:text-primary [&_a]:text-primary [&_strong]:text-primary"
                  dangerouslySetInnerHTML={{ __html: p.descriptionHtml }}
                />
              )}

              {p.highlights?.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-heading text-primary text-lg mb-4">
                    Highlights
                  </h3>
                  <ul className="flex flex-col gap-2.5">
                    {p.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Check
                            size={11}
                            className="text-primary"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="text-black/65 text-sm font-body">
                          {h}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </div>
        </div>
        )}
      </main>
    </>
  );
}
