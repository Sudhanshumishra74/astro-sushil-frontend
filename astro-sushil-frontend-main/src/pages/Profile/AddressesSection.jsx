/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Home,
  Briefcase,
  Star,
  Loader2,
  X,
} from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { AddAddressModal } from "./AddAddressModal";

const TYPE_ICON = { home: Home, work: Briefcase, other: MapPin };

function AddressListCard({ address, onEdit, onDelete, onSetDefault }) {
  const Icon = TYPE_ICON[address.type] || MapPin;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex flex-col gap-3 p-4 rounded-2xl border border-black/8 bg-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Icon size={14} className="text-primary" />
          </span>
          <span className="font-body text-xs font-semibold text-black/50 capitalize">
            {address.type}
          </span>
        </div>

        {address.isDefault && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-primary bg-primary/10">
            <Star size={10} className="fill-primary text-primary" /> Default
          </span>
        )}
      </div>

      <div>
        <p className="font-heading text-primary text-sm">{address.fullName}</p>
        <p className="font-body text-black/50 text-xs mt-1 leading-relaxed">
          {address.addressLine1}
          {address.addressLine2 ? `, ${address.addressLine2}` : ""}
          {address.landmark ? `, ${address.landmark}` : ""}
          <br />
          {address.city}, {address.state} – {address.pincode}
        </p>
        <p className="font-body text-black/40 text-xs mt-1">{address.phone}</p>
      </div>

      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-black/6">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary border border-primary/25 bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          <Pencil size={12} /> Edit
        </button>
        {!address.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-black/60 border border-black/10 hover:bg-black/5 transition-colors"
          >
            <Star size={12} /> Set as default
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors ml-auto"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </motion.div>
  );
}

// Small, local confirm step — deliberately not the shared LogoutConfirm,
// which is hardcoded to logout-specific copy and isn't parameterized for
// reuse here.
function DeleteConfirmModal({ open, onCancel, onConfirm, deleting }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onCancel()}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Delete address?</h2>
              <button
                onClick={onCancel}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-gray-500">
                This address will be permanently removed from your account.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AddressesSection() {
  const { addresses = [], loading, getAddresses, deleteAddress, setDefaultAddress } =
    useAuthStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getAddresses();
  }, []);

  const openAddModal = () => {
    setEditingAddress(null);
    setModalOpen(true);
  };

  const openEditModal = (address) => {
    setEditingAddress(address);
    setModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    await deleteAddress(confirmDeleteId);
    setDeleting(false);
    setConfirmDeleteId(null);
  };

  return (
    <div className="min-h-screen flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-primary text-lg">Saved Addresses</h2>
          <p className="font-body text-black/40 text-xs mt-0.5">
            Manage the delivery addresses on your account
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-white bg-primary hover:bg-gold transition-colors"
        >
          <Plus size={14} /> Add New
        </button>
      </div>

      {loading && !addresses.length ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 border-2 border-dashed border-black/10 rounded-2xl">
          <MapPin size={36} className="text-black/15 mb-3" />
          <p className="font-body text-black/60 text-sm font-semibold mb-1">
            No addresses saved yet
          </p>
          <p className="font-body text-black/35 text-xs mb-4">
            Add a delivery address to speed up checkout
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-primary hover:bg-gold transition-colors"
          >
            <Plus size={14} /> Add Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatePresence>
            {addresses.map((addr) => (
              <AddressListCard
                key={addr._id}
                address={addr}
                onEdit={() => openEditModal(addr)}
                onDelete={() => setConfirmDeleteId(addr._id)}
                onSetDefault={() => setDefaultAddress(addr._id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AddAddressModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        address={editingAddress}
      />

      <DeleteConfirmModal
        open={Boolean(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
      />
    </div>
  );
}
