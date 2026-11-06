import { create } from "zustand";
import axios from "axios";
import { showError, showSuccess } from "../utils/toast";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const CART_URL = `${BASE_URL}/cart`;

// incrementQuantity/decrementQuantity read the current quantity out of
// `cart.items` and PUT `current +/- 1` — correct for a single click, but
// concurrent clicks on the same row (a user tapping +/+ quickly, or a
// double-fire from a fast tap) all read the SAME stale `cart.items` before
// any of their PUT+refetch round-trips land, so they compute the same
// "next" quantity and net fewer increments than clicks. Queuing per-item
// mutations so each one only starts once the previous has fully resolved
// (PUT + getCartItems refresh) means every click reads a state that
// already reflects every click before it — no drops, no rename to move
// this update logic into.
const itemMutationQueues = new Map();

function queueItemMutation(key, run) {
  const previous = itemMutationQueues.get(key) || Promise.resolve();
  const next = previous.then(run, run);
  itemMutationQueues.set(key, next);
  return next;
}

function matchesCartItem(item, productId) {
  const itemId = item.product?._id || item.product;
  return itemId === productId;
}

export const useCartStore = create((set, get) => {
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");

    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  return {
    cart: [],
    user: null,
    loading: false,
    error: null,

    appliedCoupon: null,
    couponLoading: false,
    couponError: null,

    getCartItems: async () => {
      try {
        set({
          loading: true,
          error: null,
        });

        const res = await axios.get(CART_URL, getAuthHeaders());

        set({
          cart: res.data?.data || {},
          user: res.data?.data?.user || null,
        });

        return {
          success: true,
          data: res.data,
        };
      } catch (err) {
        const message =
          err?.response?.data?.message || "Failed to fetch cart items";

        set({
          error: message,
          cart: [],
        });

        return {
          success: false,
          error: message,
        };
      } finally {
        set({ loading: false });
      }
    },

    applyCoupon: async (code) => {
      set({ couponLoading: true, couponError: null });
      try {
        const res = await axios.post(
          `${CART_URL}/coupon`,
          { code: code },
          getAuthHeaders(),
        );

        // The response body *is* the cart (ApiResponse(200, cart, ...)) —
        // couponCode/discount are its only real fields; there's no nested
        // `coupon` object with type/maxDiscount on it (the old code guessed
        // at that shape and always fell back to defaults for those two).
        const data = res.data?.data;

        const appliedCoupon = {
          code: data?.couponCode || code,
          discount: data?.discount ?? 0,
        };

        set({ appliedCoupon, couponError: null });

        // Refresh cart so totals are accurate
        await get().getCartItems();

        return { success: true, data: appliedCoupon };
      } catch (err) {
        const message =
          err?.response?.data?.message || "Invalid or expired coupon";
        set({ couponError: message, appliedCoupon: null });
        return { success: false, error: message };
      } finally {
        set({ couponLoading: false });
      }
    },

    // Used to only clear local state — cart.couponCode stayed set
    // server-side (there was no DELETE endpoint at all), so calculateCart
    // kept re-applying the "removed" coupon on every subsequent cart read
    // and at order creation. Now actually clears it server-side too.
    removeCoupon: async () => {
      try {
        const res = await axios.delete(`${CART_URL}/coupon`, getAuthHeaders());
        set({ appliedCoupon: null, couponError: null });
        await get().getCartItems();
        return { success: true, data: res.data };
      } catch (err) {
        showError(err);
        return { success: false, error: err?.response?.data?.message };
      }
    },
    addToCart: async (product) => {
      try {
        if (!product?.productId) {
          throw new Error("Product ID is required");
        }

        const payload = {
          productId: product.productId,
          quantity: product.quantity || 1,
        };

        if (product.variantId) {
          payload.variantId = product.variantId;
        }

        // Cascading second level — only meaningful when the selected
        // variant has sub-variants (see product.modal.js's variantSchema).
        if (product.subVariantId) {
          payload.subVariantId = product.subVariantId;
        }

        // Gemstone products (product.soldByRatti) have no variants at all —
        // this is their entire selection instead.
        if (product.selectedRatti) {
          payload.selectedRatti = product.selectedRatti;
        }

        // Single certificate chosen from product.certificates (dropdown,
        // see Productdetailpage.jsx) — gated site-wide by
        // Setting.product.certificatesEnabled.
        if (product.certificateId) {
          payload.certificateId = product.certificateId;
        }

        const res = await axios.post(
          `${CART_URL}/add`,
          payload,
          getAuthHeaders(),
        );

        await get().getCartItems();

        showSuccess(res);

        return {
          success: true,
          data: res.data,
        };
      } catch (err) {
        showError(err);

        const message =
          err?.response?.data?.message || "Failed to add item to cart";

        return {
          success: false,
          error: message,
        };
      }
    },

    // `itemId` (the cart line's own _id) is the unambiguous identifier —
    // pass it whenever you have it (e.g. from a real cart-page row). It's
    // optional for callers that only ever deal in unambiguous internal
    // products (a listing card's qty stepper, keyed by product+variant).
    removeFromCart: async (productId, variantId, itemId) => {
      try {
        const res = await axios.delete(`${CART_URL}/remove`, {
          data: {
            itemId,
            productId,
            variantId,
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        await get().getCartItems();

        showSuccess(res);

        return {
          success: true,
          data: res.data,
        };
      } catch (err) {
        showError(err);

        return {
          success: false,
          error: err?.response?.data?.message,
        };
      }
    },

    updateQuantity: async (productId, variantId, quantity, itemId) => {
      try {
        const res = await axios.put(
          `${CART_URL}/update`,
          {
            itemId,
            productId,
            variantId,
            quantity,
          },
          getAuthHeaders(),
        );

        await get().getCartItems();

        return {
          success: true,
          data: res.data,
        };
      } catch (err) {
        showError(err);

        return {
          success: false,
          error: err?.response?.data?.message,
        };
      }
    },

    // If `itemId` is given, it's used directly (no ambiguity possible). If
    // not, falls back to a product+variant lookup. Either way, once the
    // matching line is found, its own `_id` is what actually gets sent to
    // the backend from here on, so a caller that only had product+variant
    // still ends up mutating the exact right row.
    incrementQuantity: async (productId, variantId, itemId) => {
      const key = itemId || `${productId}:${variantId || ""}`;

      return queueItemMutation(key, async () => {
        const items = get().cart?.items || [];

        const item = itemId
          ? items.find((i) => i._id === itemId)
          : items.find(
              (i) =>
                i.product === productId &&
                String(i.variantId || "") === String(variantId || ""),
            );

        if (!item) {
          return;
        }

        return await get().updateQuantity(
          productId,
          variantId,
          item.quantity + 1,
          item._id,
        );
      });
    },

    decrementQuantity: async (productId, variantId, itemId) => {
      const key = itemId || `${productId}:${variantId || ""}`;

      return queueItemMutation(key, async () => {
        const items = get().cart?.items || [];

        const item = itemId
          ? items.find((i) => i._id === itemId)
          : items.find(
              (i) =>
                i.product === productId &&
                String(i.variantId || "") === String(variantId || ""),
            );

        if (!item) {
          return;
        }

        const newQty = item.quantity - 1;

        if (newQty <= 0) {
          return await get().removeFromCart(productId, variantId, item._id);
        }

        return await get().updateQuantity(productId, variantId, newQty, item._id);
      });
    },

    clearCart: () => {
      set({
        cart: [],
        user: null,
        error: null,
      });
    },

    getCartItemCount: () => {
      const items = get().cart?.items || [];

      return items.reduce((total, item) => total + (item.quantity || 0), 0);
    },

    getCartTotal: () => {
      const items = get().cart?.items || [];

      return items.reduce((total, item) => {
        const price = item.price || 0;

        return total + price * (item.quantity || 0);
      }, 0);
    },

    isInCart: (productId) => {
      const items = get().cart?.items || [];

      return items.some((item) => matchesCartItem(item, productId));
    },

    getProductQuantity: (productId) => {
      const items = get().cart?.items || [];

      const item = items.find((item) => matchesCartItem(item, productId));

      return item ? item.quantity : 0;
    },

    clearError: () => {
      set({ error: null });
    },
  };
});
