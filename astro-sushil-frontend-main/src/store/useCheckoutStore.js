import { create } from "zustand";
import axios from "axios";
import { showError } from "../utils/toast";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const CHECKOUT_URL = `${BASE_URL}/checkout`;

// Single source of truth for the checkout page — cart totals, addresses,
// which one is selected, whether COD is offered, and the live
// Shiprocket-quoted shipping charge for that address, all from one backend
// call (GET /checkout) instead of the page assembling /cart + /settings +
// /address + a shipping-quote call itself.
export const useCheckoutStore = create((set) => {
  let sequence = 0;

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  return {
    checkout: null,
    loading: false,

    // fetchCheckout(addressId, paymentMethod) — call on mount and whenever
    // the selected address, payment method, or cart contents change.
    // Guarded by an internal sequence counter (not left to the caller) —
    // clicking through addresses fires requests faster than they resolve,
    // and a slow earlier response landing after a newer one would
    // otherwise overwrite it with a stale quote.
    fetchCheckout: async (addressId, paymentMethod) => {
      const current = ++sequence;

      set({ loading: true });

      try {
        const res = await axios.get(CHECKOUT_URL, {
          ...getAuthHeaders(),
          params: {
            ...(addressId && { addressId }),
            ...(paymentMethod && { paymentMethod }),
          },
        });

        if (current === sequence) {
          set({ checkout: res.data?.data || null });
        }

        return { success: true, data: res.data?.data };
      } catch (err) {
        const message = err?.response?.data?.message || "Failed to load checkout";
        showError(err);

        if (current === sequence) {
          set({ checkout: null });
        }

        return { success: false, error: message };
      } finally {
        if (current === sequence) {
          set({ loading: false });
        }
      }
    },

    clearCheckout: () => set({ checkout: null }),
  };
});
