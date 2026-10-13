import { create } from "zustand";
import axios from "axios";
import { showError } from "../utils/toast";

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3000";

const PRODUCT_URL = `${BASE_URL}/products`;

export const useProductStore = create((set) => ({
  products: [],
  product: null,
  loading: false,
  error: null,

  getProducts: async (params = {}) => {
    try {
      set({ loading: true, error: null });

      const token = localStorage.getItem("token");

      const res = await axios.get(PRODUCT_URL, {
        params,

        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      set({
        products: res.data?.data || [],
      });

      return {
        success: true,
        data: res.data?.data || [],
      };
    } catch (err) {
      showError(err);

      const message =
        err.response?.data?.message ||
        "Failed to fetch products";

      set({ error: message });

      return {
        success: false,
        error: message,
      };
    } finally {
      set({ loading: false });
    }
  },

  getProductById: async (id) => {
    try {
      set({ loading: true, error: null });

      const token = localStorage.getItem("token");

      const res = await axios.get(
        `${PRODUCT_URL}/${id}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        },
      );

      set({
        product: res.data?.data || null,
      });

      return {
        success: true,
        data: res.data?.data,
      };
    } catch (err) {
      showError(err);

      const message =
        err.response?.data?.message ||
        "Failed to fetch product";

      set({ error: message });

      return {
        success: false,
        error: message,
      };
    } finally {
      set({ loading: false });
    }
  },

  getProductBySlug: async (slug) => {
    try {
      set({ loading: true, error: null });

      const token = localStorage.getItem("token");

      const res = await axios.get(
        `${PRODUCT_URL}/slug/${slug}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        },
      );

      set({
        product: res.data?.data || null,
      });

      return {
        success: true,
        data: res.data?.data,
      };
    } catch (err) {
      showError(err);

      const message =
        err.response?.data?.message ||
        "Failed to fetch product";

      set({ error: message });

      return {
        success: false,
        error: message,
      };
    } finally {
      set({ loading: false });
    }
  },

  clearProduct: () => {
    set({ product: null });
  },
}));