/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Package,
  Calendar,
  Truck,
  CreditCard,
  MapPin,
  Phone,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  ShoppingBag,
  Mic,
  MessageCircle,
  Video,
  Star,
  ChevronRight,
  Tag,
  Ban,
  RotateCcw,
  Minus,
  Plus,
  ExternalLink,
  Hash,
  Circle,
  CalendarClock,
  FileText,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";

import { usePaymentStore } from "../../store/usePaymentStore";
import { useSettingStore } from "../../store/usSettingStore";
import ResponsiveDialog from "../../components/ResponsiveDialog";
import toast from "react-hot-toast";

// Not blocked once the order reaches these statuses — cancelling a
// delivered order makes no sense, and re-cancelling an already-cancelled
// one is a no-op.
const NOT_CANCELLABLE_STATUSES = ["delivered", "cancelled"];

// Mirrors cancelOrder's exact rule in order.controller.js: blocked once
// delivered/cancelled, and (if a window is configured — 0 means no limit,
// same convention as returnPolicyDays) once more than
// cancellationWindowHours have passed since order placement.
function isOrderCancellable(order, cancellationWindowHours) {
  if (!order?.orderStatus || NOT_CANCELLABLE_STATUSES.includes(order.orderStatus)) {
    return false;
  }
  if (!cancellationWindowHours || cancellationWindowHours <= 0) return true;

  const cutoff = new Date(
    new Date(order.createdAt).getTime() + cancellationWindowHours * 60 * 60 * 1000,
  );
  return new Date() <= cutoff;
}

// Mirrors requestReturn()'s eligibility logic in fulfillment.service.js
// exactly, so the UI never offers a return the backend would reject: a
// shipment must be "delivered", and only items on that shipment — minus
// whatever's already returned or claimed by another pending request — are
// actually returnable. Each returnable item is tagged with its shipmentId
// since a single return request may only cover items from ONE shipment
// (the backend rejects a request spanning two).
function getReturnEligibility(order, returnPolicyDays) {
  const claimedQtyFor = (productId) => {
    let claimed = 0;
    (order.returns || []).forEach((r) => {
      if (r.status !== "requested") return;
      (r.items || []).forEach((it) => {
        if (String(it.product) === String(productId)) claimed += it.quantity;
      });
    });
    return claimed;
  };

  const returnableItems = [];

  for (const shipment of order?.shipments || []) {
    if (shipment.status !== "delivered") continue;

    const deliveredAt =
      shipment.statusHistory?.find((h) => h.status === "delivered")?.at ||
      shipment.updatedAt ||
      shipment.createdAt;

    const cutoff = deliveredAt
      ? new Date(new Date(deliveredAt).getTime() + returnPolicyDays * 24 * 60 * 60 * 1000)
      : null;
    if (!cutoff || new Date() > cutoff) continue;

    const shipmentProductIds = new Set((shipment.items || []).map((i) => String(i.product)));

    for (const item of order.items || []) {
      const productId = String(item.product?._id || item.product);
      if (!shipmentProductIds.has(productId)) continue;

      const remaining = item.quantity - (item.returnedQuantity || 0) - claimedQtyFor(productId);
      if (remaining <= 0) continue;

      returnableItems.push({
        productId,
        shipmentId: shipment.shipmentId,
        name: item.name,
        image: item.image,
        remaining,
      });
    }
  }

  return { eligible: returnableItems.length > 0, returnableItems };
}

// A product's variant/sub-variant selection — resolved to human-readable
// name+value pairs at order-creation time (order.controller.js), not just
// variantId/subVariantId.
function variantItemTags(item) {
  return [
    item.variantName ? `${item.variantName}: ${item.variantValue}` : null,
    item.subVariantName ? `${item.subVariantName}: ${item.subVariantValue}` : null,
    item.selectedRatti ? `${item.selectedRatti} ratti` : null,
    item.certificateName
      ? `${item.certificateName}${item.certificateIncludedInPrice ? "" : ` (+₹${item.certificatePrice})`}`
      : null,
  ].filter(Boolean);
}

function formatDate(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Same status buckets the admin panel uses (OrderShipmentsTab.jsx) — kept
// independent so wording/colors here can stay customer-friendly without
// the admin page's terminology leaking through.
function shipmentStatusVariant(status) {
  if (!status) return "default";
  if (["delivered", "fulfilled", "self_fulfilled"].includes(status)) return "success";
  if (
    status.startsWith("rto") ||
    ["cancelled", "lost", "damaged", "destroyed", "qc_failed", "undelivered", "untraceable", "failed"].includes(
      status,
    )
  ) {
    return "danger";
  }
  if (["pending", "awaiting_manual_fulfillment"].includes(status)) return "warning";
  return "info";
}

// The raw status strings are internal fulfillment vocabulary (Shiprocket
// codes, or "awaiting_manual_fulfillment" for an item pending manual
// admin action before courier info is available) — none of that is
// something a customer needs to know about how the order gets fulfilled
// behind the scenes. This maps every status down to plain shipping language;
// anything not explicitly listed falls back to "Processing" (happy path) or
// "Delayed" (RTO/lost/damaged/qc-failed/etc.), so no internal code ever
// reaches the page.
const CUSTOMER_STATUS_LABEL = {
  pending: "Processing",
  awaiting_manual_fulfillment: "Processing",
  processing: "Processing",
  pickup_scheduled: "Pickup Scheduled",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  fulfilled: "Delivered",
  self_fulfilled: "Delivered",
  cancelled: "Cancelled",
};

function customerStatusLabel(status) {
  if (CUSTOMER_STATUS_LABEL[status]) return CUSTOMER_STATUS_LABEL[status];
  return shipmentStatusVariant(status) === "danger" ? "Delayed" : "Processing";
}

const SHIPMENT_BADGE_STYLE = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  danger: "bg-red-50 text-red-600 border-red-200",
  warning: "bg-amber-50 text-amber-600 border-amber-200",
  info: "bg-blue-50 text-blue-600 border-blue-200",
  default: "bg-gray-50 text-gray-500 border-gray-200",
};

function ShipmentBadge({ label, status }) {
  const resolvedVariant = shipmentStatusVariant(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${SHIPMENT_BADGE_STYLE[resolvedVariant]}`}
    >
      {label || customerStatusLabel(status)}
    </span>
  );
}

// A real event-by-event history of what happened to this shipment, not just
// the 4-step Ordered/Confirmed/Shipped/Delivered overview above — sourced
// from shipment.statusHistory, which Shiprocket's webhook or an admin's
// manual update appends to.
function ShipmentTimeline({ history }) {
  const events = [...history].reverse();

  return (
    <div className="flex flex-col">
      {events.map((h, i) => (
        <div key={i} className="flex items-start gap-3 relative">
          {i !== events.length - 1 && (
            <div className="absolute left-2.75 top-6 w-0.5 h-full -translate-x-1/2 bg-gray-100" />
          )}
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
              i === 0 ? "bg-primary border-primary" : "bg-white border-gray-200"
            }`}
          >
            {i === 0 ? (
              <CheckCircle className="w-3 h-3 text-white" />
            ) : (
              <Circle className="w-2.5 h-2.5 text-gray-300" />
            )}
          </div>
          <div className="pt-0.5 pb-4">
            <p className={`text-xs font-semibold ${i === 0 ? "text-gray-900" : "text-gray-400"}`}>
              {customerStatusLabel(h.status)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{formatDateTime(h.at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// One card per self-fulfilled shipment on the order — normally just one,
// since every self-fulfilled item ships together (createSelfShipment bundles
// them). Real Shiprocket courier/AWB/tracking makes a detailed per-shipment
// card worthwhile here. Only the status is shown — which fulfillment path
// got it there is an internal detail, not something the customer needs.
function ShipmentTrackingCard({ shipment }) {
  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <ShipmentBadge status={shipment.status} />
        {shipment.items?.length > 0 && (
          <div className="flex flex-col items-end text-right">
            {shipment.items.map((it, i) => (
              <span key={it._id || i} className="text-xs text-gray-400">
                {it.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        {shipment.courier && (
          <p className="text-xs text-gray-600">
            <span className="text-gray-400">Courier: </span>
            <span className="font-medium">{shipment.courier}</span>
          </p>
        )}
        {shipment.awb && (
          <p className="text-xs text-gray-600 flex items-center gap-1">
            <Hash className="w-3 h-3 text-gray-400" />
            <span className="text-gray-400">AWB: </span>
            <span className="font-medium">{shipment.awb}</span>
          </p>
        )}
        {shipment.edd && (
          <p className="text-xs text-gray-600 flex items-center gap-1">
            <CalendarClock className="w-3 h-3 text-gray-400" />
            <span className="text-gray-400">Expected delivery: </span>
            <span className="font-medium">{shipment.edd}</span>
          </p>
        )}
      </div>

      {shipment.trackingUrl && (
        <a
          href={shipment.trackingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-gold transition-colors mb-1"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Track Package
        </a>
      )}

      {!shipment.courier && !shipment.awb && !shipment.trackingUrl && (
        <p className="text-xs text-gray-400">Tracking details will appear here once your order ships.</p>
      )}

      {shipment.statusHistory?.length > 0 && (
        <div className="pt-3 mt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Tracking history
          </p>
          <ShipmentTimeline history={shipment.statusHistory} />
        </div>
      )}
    </div>
  );
}

function getCurrencySymbol(order) {
  return order?.payment?.currency?.toUpperCase() === "USD" ? "$" : "₹";
}

// Return lifecycle stages are already customer-legible on their own (unlike
// shipment statuses, there's no internal-only vocabulary to hide here) — a
// direct label map is enough, no "everything else falls back to X" bucket
// needed.
const RETURN_STATUS_LABEL = {
  requested: "Requested",
  approved: "Approved",
  pickup_scheduled: "Pickup Scheduled",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  received: "Received",
  inspection_pending: "Being Inspected",
  approved_for_refund: "Approved for Refund",
  rejected: "Rejected",
  refunded: "Refunded",
};

// A short, plain-language explanation of what each stage means — the badge
// label alone ("In Transit") doesn't tell the customer what to expect next,
// this fills that gap directly under it.
const RETURN_STATUS_DESCRIPTION = {
  requested: "We've received your return request and it's awaiting review.",
  approved: "Your return has been approved. Pickup will be scheduled shortly.",
  pickup_scheduled: "A pickup has been scheduled for your returned item(s).",
  picked_up: "Your item(s) have been picked up and are on their way to us.",
  in_transit: "Your return shipment is on its way to our warehouse.",
  received: "We've received your returned item(s) and will inspect them shortly.",
  inspection_pending: "Your returned item(s) are currently being inspected.",
  approved_for_refund: "Inspection passed — your refund is being processed.",
  rejected: "This return request was not approved.",
  refunded: "Your refund has been processed.",
};

// Statuses a return can still move on from — used both to decide whether to
// keep polling for updates and, per-card, whether it's still worth showing
// "we'll update you" language.
const RETURN_TERMINAL_STATUSES = ["refunded", "rejected"];

function returnStatusVariant(status) {
  if (status === "refunded") return "success";
  if (status === "rejected") return "danger";
  if (["requested", "inspection_pending"].includes(status)) return "warning";
  return "info";
}

function ReturnStatusBadge({ status }) {
  const variant = returnStatusVariant(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${SHIPMENT_BADGE_STYLE[variant]}`}
    >
      {RETURN_STATUS_LABEL[status] || "Requested"}
    </span>
  );
}

// Shows what actually happened to a return request after it was submitted —
// previously the only return-related UI on this page was the "Request
// Return" button itself; once submitted, the customer had no way to see
// whether it was approved, where the pickup stood, or what got refunded.
function ReturnRequestCard({ ret, order }) {
  const currencySymbol = getCurrencySymbol(order);
  const { downloadCreditNote } = usePaymentStore();
  const [downloadingCreditNote, setDownloadingCreditNote] = useState(false);

  const handleDownloadCreditNote = async () => {
    setDownloadingCreditNote(true);
    const result = await downloadCreditNote(order._id, ret.returnId);
    setDownloadingCreditNote(false);
    if (result?.error) toast.error(result.error);
  };

  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1.5">
        <ReturnStatusBadge status={ret.status} />
        <p className="text-[11px] text-gray-400">Requested {formatDate(ret.requestedAt)}</p>
      </div>

      {RETURN_STATUS_DESCRIPTION[ret.status] && (
        <p className="text-xs text-gray-500 mb-3">{RETURN_STATUS_DESCRIPTION[ret.status]}</p>
      )}

      <div className="flex flex-col gap-2 mb-2">
        {ret.items?.map((item, i) => {
          const orderItem = order?.items?.find(
            (oi) => String(oi.product?._id || oi.product) === String(item.product),
          );
          return (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-gray-100">
              {orderItem?.image ? (
                <img
                  src={orderItem.image}
                  alt={item.name}
                  className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-gray-300" />
                </div>
              )}
              <p className="text-sm text-gray-700 flex-1 truncate">
                {item.name}
                {item.quantity > 1 && <span className="text-gray-400"> × {item.quantity}</span>}
              </p>
            </div>
          );
        })}
      </div>

      {ret.reason && (
        <p className="text-xs text-gray-500 mb-1">
          <span className="text-gray-400">Reason: </span>
          {ret.reason}
        </p>
      )}
      {ret.customerComment && <p className="text-xs text-gray-400 italic mb-2">"{ret.customerComment}"</p>}

      {/* Courier/AWB are only ever populated once Shiprocket has scheduled
          the return pickup — until then there's nothing meaningful to show
          here beyond the status badge above. */}
      {ret.fulfillmentType === "self" && (ret.courier || ret.awb) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-2">
          {ret.courier && (
            <p className="text-xs text-gray-600">
              <span className="text-gray-400">Courier: </span>
              <span className="font-medium">{ret.courier}</span>
            </p>
          )}
          {ret.awb && (
            <p className="text-xs text-gray-600 flex items-center gap-1">
              <Hash className="w-3 h-3 text-gray-400" />
              <span className="text-gray-400">AWB: </span>
              <span className="font-medium">{ret.awb}</span>
            </p>
          )}
        </div>
      )}

      {ret.fulfillmentType === "self" && ret.trackingUrl && (
        <a
          href={ret.trackingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-gold transition-colors mb-2"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Track return
        </a>
      )}

      {ret.status === "rejected" && ret.adminNote && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 mb-2">
          <p className="text-xs text-red-600">{ret.adminNote}</p>
        </div>
      )}

      {/* Surfaced independently of adminNote/rejected above — `error` is set
          when something failed on our side while processing the return
          (e.g. a Shiprocket pickup call or refund attempt errored out), not
          when the return itself was reviewed and rejected. Shown regardless
          of status since it can appear alongside any in-progress stage. */}
      {ret.error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 mb-2">
          <p className="text-xs font-medium text-red-600">Something went wrong with this return.</p>
          <p className="text-[11px] text-red-500 mt-0.5">
            {ret.error} — please contact support for help.
          </p>
        </div>
      )}

      {ret.refundAmount != null && (
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-emerald-700">
              Refunded{" "}
              <span className="font-semibold">
                {currencySymbol}{ret.refundAmount.toLocaleString("en-IN")}
              </span>
              {ret.refundIncludesShipping ? " (incl. shipping)" : ""}
            </p>
            {ret.status === "refunded" && (
              <button
                onClick={handleDownloadCreditNote}
                disabled={downloadingCreditNote}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 border border-emerald-300 bg-white hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                {downloadingCreditNote ? "Downloading…" : "Download Credit Note"}
              </button>
            )}
          </div>
          {(ret.refundMethod || ret.refundedAt) && (
            <div className="flex items-center gap-3 flex-wrap text-[11px] text-emerald-600 pt-2 border-t border-emerald-100">
              {ret.refundMethod && (
                <span>
                  Via{" "}
                  <span className="font-medium">
                    {ret.refundMethod === "razorpay" ? "Razorpay" : "Bank transfer / cash"}
                  </span>
                </span>
              )}
              {ret.refundedAt && <span>{formatDate(ret.refundedAt)}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.07,
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

// Uppercase, matched against getOrderStatus()'s uppercased orderStatus.
// "PLACED" (not "ORDERED" — the backend's real enum value, order.model.js)
// and "PROCESSING" were both missing before, which meant the whole
// Delivery Progress section below silently disappeared for any order still
// at "placed" or "processing" — i.e. most of the time — since
// indexOf() returned -1 and the section only rendered when it didn't.
// Digital product orders skip processing/shipped (nothing physically ships),
// mirroring the admin panel's own DIGITAL_STATUSES split.
const STATUS_STEPS = ["PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];
const DIGITAL_STATUS_STEPS = ["PLACED", "CONFIRMED", "DELIVERED"];

const CONSULTATION_TYPE_LABEL = {
  CHAT: {
    label: "Chat Consultation",
    icon: <MessageCircle className="w-4 h-4" />,
    color: "from-blue-500 to-cyan-500",
  },
  VIDEO: {
    label: "Video Consultation",
    icon: <Video className="w-4 h-4" />,
    color: "from-purple-500 to-pink-500",
  },
  VOICE: {
    label: "Voice Consultation",
    icon: <Mic className="w-4 h-4" />,
    color: "from-teal-500 to-emerald-500",
  },
  CALL: {
    label: "Call Consultation",
    icon: <Mic className="w-4 h-4" />,
    color: "from-teal-500 to-emerald-500",
  },
};

const statusConfig = (status) => {
  if (["COMPLETED", "DELIVERED", "PAID"].includes(status))
    return {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
      icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
      label: status,
    };
  if (["PENDING", "ORDERED", "SHIPPED", "CONFIRMED"].includes(status))
    return {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      dot: "bg-amber-500",
      icon: <Clock className="w-4 h-4 text-amber-600" />,
      label: status,
    };
  if (["FAILED", "CANCELLED"].includes(status))
    return {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      dot: "bg-red-500",
      icon: <XCircle className="w-4 h-4 text-red-600" />,
      label: status,
    };
  return {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-700",
    dot: "bg-gray-400",
    icon: <Package className="w-4 h-4 text-gray-500" />,
    label: status,
  };
};

export default function OrderDetail() {
  const [downloadingId, setDownloadingId] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showReturnSheet, setShowReturnSheet] = useState(false);
  const [returnQty, setReturnQty] = useState({});
  const [returnReason, setReturnReason] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const { orderId } = useParams();
  const navigate = useNavigate();

  const {
    order,
    loading,
    error,
    getOrderDetails,
    clearOrder,
    downloadInvoice,
    cancelOrder,
    requestReturn,
  } = usePaymentStore();

  const { settings, fetchSettings } = useSettingStore();

  useEffect(() => {
    if (orderId) {
      clearOrder();
      getOrderDetails(orderId);
    }
  }, [orderId]);

  useEffect(() => {
    if (!settings) fetchSettings();
  }, []);

  // Poll while a return is in progress so status changes made server-side
  // (e.g. a Shiprocket webhook advancing pickup_scheduled -> in_transit, or
  // an admin approving/refunding the return) show up here without a
  // manual reload. Reads the store's live state on every tick rather than
  // depending on `order` directly, so the interval is only ever
  // (re)created when the orderId itself changes — not on every refetch —
  // and is always cleared on unmount/orderId change.
  useEffect(() => {
    if (!orderId) return undefined;

    const intervalId = setInterval(() => {
      const currentOrder = usePaymentStore.getState().order;
      const hasActiveReturn = currentOrder?.returns?.some(
        (r) => !RETURN_TERMINAL_STATUSES.includes(r.status),
      );
      if (hasActiveReturn) {
        getOrderDetails(orderId);
      }
    }, 25000);

    return () => clearInterval(intervalId);
  }, [orderId]);

  // ✅ FIX: response mein orderStatus & payment.status use karo
  const getOrderStatus = () => {
    if (!order) return "PENDING";
    if (["physical", "PRODUCT"].includes(order.orderType)) {
      return (order.orderStatus || "PENDING").toUpperCase();
    }
    return (
      order.payment?.status ||
      order.paymentStatus ||
      "PENDING"
    ).toUpperCase();
  };

  const handleDownloadInvoice = async (id, e) => {
    e.stopPropagation();
    try {
      setDownloadingId(id);
      const result = await downloadInvoice(id);
      if (result?.error) toast.error(result.error);
    } catch {
      toast.error("Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    const result = await cancelOrder(order._id);
    setCancelling(false);
    setShowCancelConfirm(false);

    if (result?.success) {
      toast.success("Order cancelled");
      // Belt-and-suspenders: cancelOrder already merges the PATCH response
      // into the store, but requestReturn below does an explicit refetch
      // too — doing the same here guarantees this page reflects the true
      // saved state (including the shipment-cancellation side effects
      // cancelOrder now triggers) rather than relying on the response
      // shape staying in sync forever.
      getOrderDetails(order._id);
    } else {
      toast.error(result?.error || "Failed to cancel order");
    }
  };

  const openReturnSheet = (returnableItems) => {
    setReturnQty(Object.fromEntries(returnableItems.map((i) => [i.productId, 0])));
    setReturnReason("");
    setReturnComment("");
    setShowReturnSheet(true);
  };

  const handleSubmitReturn = async () => {
    const items = Object.entries(returnQty)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    if (!items.length) {
      toast.error("Select at least one item to return");
      return;
    }
    if (!returnReason) {
      toast.error("Please select a reason for the return");
      return;
    }

    // A single return request can only cover items from one shipment (the
    // backend rejects a request spanning two), so a customer selecting
    // items split across multiple shipments needs to submit separate
    // requests for each.
    const shipmentIds = new Set(
      items.map(({ productId }) => returnableItems.find((i) => i.productId === productId)?.shipmentId),
    );
    if (shipmentIds.size > 1) {
      toast.error("Please request returns for items from different shipments separately");
      return;
    }

    setSubmittingReturn(true);
    const result = await requestReturn(order._id, {
      items,
      reason: returnReason,
      customerComment: returnComment || undefined,
    });
    setSubmittingReturn(false);

    if (result?.success) {
      toast.success("Return requested");
      setShowReturnSheet(false);
      getOrderDetails(order._id);
    } else {
      toast.error(result?.error || "Failed to request return");
    }
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-12 h-12 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm font-medium tracking-wide">
            Loading order details...
          </p>
        </motion.div>
      </div>
    );
  }

  if (!loading && !order) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center px-4"
        >
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-gray-800 text-lg font-bold mb-1">
            Order Not Found
          </p>
          <p className="text-gray-400 text-sm mb-6">
            {error || "We couldn't load this order."}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-gold cursor-pointer transition-all"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  const isProductOrder = !!order?.items?.length;

  const currentStatus = getOrderStatus();
  const config = statusConfig(currentStatus);

  const deliverySteps = order?.orderType === "digital" ? DIGITAL_STATUS_STEPS : STATUS_STEPS;
  const currentStepIndex = deliverySteps.indexOf(currentStatus);
  const isOrderCancelledStatus = order?.orderStatus === "cancelled";
  const isPrePaymentStatus = ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(currentStatus);

  // order.payment.status alone ("refunded"/"partially_refunded") tells us a
  // refund happened, but not how much — refundTransactions (getOrderDetails,
  // order.controller.js) carries the actual Transaction record(s) so this
  // can show a real amount instead of just a status word.
  const paymentStatus = order?.payment?.status;
  const refundTransactions = order?.refundTransactions || [];
  const totalRefunded = refundTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const isRefunded = paymentStatus === "refunded" || paymentStatus === "partially_refunded";
  // Cancellation always tries to refund a "paid" razorpay order immediately
  // (refundOrderOnCancellation) — if payment.status is still "paid" despite
  // the order being cancelled, that attempt failed and is a manual
  // follow-up, not "no refund needed". Surfacing that distinctly instead of
  // silently showing nothing, which otherwise reads as if the money simply
  // vanished with no explanation.
  const refundPending =
    isOrderCancelledStatus && order?.payment?.method === "razorpay" && paymentStatus === "paid";
  const lastRefundedAt = refundTransactions[refundTransactions.length - 1]?.createdAt;

  const consultationType =
    CONSULTATION_TYPE_LABEL[order?.orderType?.toUpperCase()] ||
    CONSULTATION_TYPE_LABEL.VOICE;

  // Trust the backend's own subTotal rather than re-deriving it from
  // items[] client-side — avoids silently drifting from the authoritative
  // figure if the backend ever applies rounding/promos not visible here.
  const subtotal =
    order?.subTotal ??
    order?.items?.reduce((t, i) => t + i.price * i.quantity, 0) ??
    0;
  const discount = order?.discount || 0;
  const couponCode = order?.coupon?.code;
  const tax = order?.tax || 0;

  // ✅ FIX: totalAmount use karo
  const totalAmount = order?.totalAmount ?? order?.amount ?? 0;

  const cancellationWindowHours = settings?.order?.cancellationWindowHours ?? 24;
  const canCancel = isProductOrder && isOrderCancellable(order, cancellationWindowHours);

  const returnPolicyDays = settings?.order?.returnPolicyDays ?? 7;
  const { eligible: canRequestReturn, returnableItems } = isProductOrder
    ? getReturnEligibility(order, returnPolicyDays)
    : { eligible: false, returnableItems: [] };

  // ✅ FIX: payment.method use karo
  const paymentMethod =
    order?.payment?.method?.toUpperCase() || order?.paymentMethod || "—";

  const actionButtons = (
    <>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={(e) => handleDownloadInvoice(order._id, e)}
        disabled={downloadingId === order._id}
        className="w-full px-5 py-3.5 bg-primary text-white rounded-xl hover:bg-gold cursor-pointer transition-all duration-700 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-teal-100"
      >
        {downloadingId === order._id ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Downloading...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Download Invoice
          </>
        )}
      </motion.button>

      {canRequestReturn && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.01 }}
          onClick={() => openReturnSheet(returnableItems)}
          className="w-full px-5 py-3.5 border border-primary/25 text-primary rounded-xl hover:bg-primary/5 transition-all text-sm font-semibold flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Request Return
        </motion.button>
      )}

      {canCancel && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.01 }}
          onClick={() => setShowCancelConfirm(true)}
          className="w-full px-5 py-3.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-all text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Ban className="w-4 h-4" />
          Cancel Order
        </motion.button>
      )}

      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.01 }}
        onClick={() => navigate(-1)}
        className="w-full px-5 py-3.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all text-sm font-semibold flex items-center justify-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Orders
      </motion.button>
    </>
  );

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* ── Header ── */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mb-6 sm:mb-8"
        >
          <div className="flex items-start gap-3 flex-wrap mb-6">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Order Details
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5 wrap-break-word">
                #{order._id?.slice(-8).toUpperCase()} · Placed{" "}
                {formatDateTime(order.createdAt)}
              </p>
            </div>
            <div
              className={`ml-auto flex items-center gap-2 px-3.5 py-1.5 rounded-xl border shrink-0 ${config.bg} ${config.border}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`}
              />
              {config.icon}
              <span
                className={`text-xs font-bold uppercase tracking-wide ${config.text}`}
              >
                {config.label}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Mobile quick actions — see actionButtons comment above; hidden
            on lg+ where the sidebar copy below takes over. */}
        <motion.div
          custom={0.5}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="lg:hidden flex flex-col gap-3 mb-6"
        >
          {actionButtons}
        </motion.div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          {/* ═══ LEFT COLUMN ═══ */}
          <div className="space-y-5">
            {/* ✅ FIX: order.items check karo */}
            {isProductOrder && order.items?.length > 0 && (
              <motion.div
                custom={1}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Items Ordered
                  </h2>

                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
                    {order.items.length}{" "}
                    {order.items.length === 1 ? "item" : "items"}
                  </span>
                </div>

                <div className="divide-y divide-gray-50">
                  {order.items.map((item, idx) => {
                    const product = item.product;
                    return (
                      <motion.div
                        key={item._id || idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.25 + idx * 0.06,
                          duration: 0.35,
                        }}
                        className="flex gap-3 sm:gap-4 p-4 sm:p-5 hover:bg-gray-50/60 transition-colors"
                      >
                        <div className="relative shrink-0">
                          <img
                            src={
                              item.image ||
                              product?.thumbnail ||
                              product?.images?.[0] ||
                              "https://via.placeholder.com/100"
                            }
                            alt={item.name || product?.name || "Product"}
                            className="w-14 h-14 sm:w-20 sm:h-20 object-cover rounded-xl border border-gray-100"
                            onError={(e) => {
                              e.target.src = "https://via.placeholder.com/100";
                            }}
                          />
                          {item.quantity > 1 && (
                            <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                              {item.quantity}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 line-clamp-2 mb-1">
                            {item.name || product?.name || "Product"}
                          </h4>
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-3">
                            {product?.shortDescription ||
                              "No description available"}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                              Qty: {item.quantity}
                            </span>
                            <span className="text-xs text-gray-400">
                              ₹{item.price?.toFixed(2)} each
                            </span>
                            {item.mrp && item.mrp > item.price && (
                              <span className="text-xs text-gray-300 line-through">
                                ₹{item.mrp?.toFixed(2)}
                              </span>
                            )}
                            {item.taxRate > 0 && (
                              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                                GST {item.taxRate}%
                              </span>
                            )}
                          </div>
                          {variantItemTags(item).length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-2">
                              {variantItemTags(item).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] text-primary bg-primary/8 px-2 py-0.5 rounded-md"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm sm:text-base font-bold text-gray-900">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="px-6 py-4 bg-gray-50/70 border-t border-gray-100 space-y-2.5">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span className="font-medium text-gray-700">
                      ₹{subtotal.toFixed(2)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" /> Discount
                        {couponCode ? ` (${couponCode})` : ""}
                      </span>
                      <span className="font-semibold">
                        − ₹{discount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {/* Admin-chosen live preference (Setting.shipping.displayMode) —
                      "separate" shows self-fulfilled shipping as its own row
                      instead of a combined line. */}
                  {order.shippingDisplayMode === "separate" ? (
                    order.selfShippingAmount > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5" /> Shipping
                        </span>
                        <span className="font-medium text-gray-700">
                          ₹{order.selfShippingAmount?.toFixed(2)}
                        </span>
                      </div>
                    )
                  ) : (
                    order.shipping > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5" /> Shipping
                        </span>
                        <span className="font-medium text-gray-700">
                          ₹{order.shipping?.toFixed(2)}
                        </span>
                      </div>
                    )
                  )}
                  {tax > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Tax</span>
                      <span className="font-medium text-gray-700">
                        ₹{tax.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-gray-900 pt-2.5 border-t border-gray-200">
                    <span>Total Paid</span>
                    <span className="text-primary text-lg">
                      ₹{totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {isProductOrder && order?.orderType !== "digital" && (
              <motion.div
                custom={2}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
              >
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-5">
                  Delivery Progress
                </h2>

                {isOrderCancelledStatus ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                      <Ban className="w-5 h-5 text-red-400" />
                    </div>
                    <p className="text-sm font-semibold text-red-500">Order Cancelled</p>
                    <p className="text-xs text-gray-400">
                      This order was cancelled and will not be processed further.
                    </p>

                    {isRefunded && (
                      <div className="mt-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 flex flex-col items-center gap-0.5">
                        <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5" />
                          {paymentStatus === "refunded" ? "Refund Processed" : "Partial Refund Processed"}
                        </p>
                        {totalRefunded > 0 && (
                          <p className="text-xs text-emerald-700">
                            ₹{totalRefunded.toFixed(2)} refunded to your original payment method
                          </p>
                        )}
                        {lastRefundedAt && (
                          <p className="text-[11px] text-emerald-500">
                            on {formatDateTime(lastRefundedAt)}
                          </p>
                        )}
                      </div>
                    )}

                    {refundPending && (
                      <div className="mt-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100 flex flex-col items-center gap-0.5 max-w-xs">
                        <p className="text-sm font-semibold text-amber-600 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Refund Pending
                        </p>
                        <p className="text-xs text-amber-600">
                          We're processing your refund of ₹{Number(order?.totalAmount || 0).toFixed(2)}.
                          If it doesn't reflect in 5–7 business days, please contact support.
                        </p>
                      </div>
                    )}
                  </div>
                ) : isPrePaymentStatus ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-500" />
                    </div>
                    <p className="text-sm font-semibold text-amber-600">Awaiting Payment</p>
                    <p className="text-xs text-gray-400">
                      Delivery progress will show here once your payment is confirmed.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start pb-8">
                    {deliverySteps.map((step, idx) => {
                      const isDone = idx <= currentStepIndex;
                      const isCurrent = idx === currentStepIndex;
                      return (
                        <React.Fragment key={step}>
                          {idx !== 0 && (
                            <div
                              className={`flex-1 h-0.5 mt-3.5 sm:mt-4 transition-all ${
                                isDone ? "bg-primary" : "bg-gray-100"
                              }`}
                            />
                          )}
                          <motion.div
                            className="relative w-7 sm:w-8 shrink-0"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + idx * 0.08, duration: 0.35 }}
                          >
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                                isDone ? "bg-primary border-primary" : "bg-white border-gray-200"
                              } ${isCurrent ? "ring-4 ring-primary/15" : ""}`}
                            >
                              {isDone ? (
                                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                              ) : (
                                <Circle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-300" />
                              )}
                            </div>
                            <p
                              className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 sm:mt-3 w-16 sm:w-20 text-[10px] sm:text-xs font-semibold text-center leading-tight ${
                                isDone ? "text-gray-900" : "text-gray-400"
                              }`}
                            >
                              {step.charAt(0) + step.slice(1).toLowerCase()}
                            </p>
                          </motion.div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {isProductOrder && order.shipments?.length > 0 && (
              <motion.div
                custom={2.5}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
              >
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                  Shipment Tracking
                </h2>
                <div className="flex flex-col gap-3">
                  {order.shipments.map((shipment) => (
                    <ShipmentTrackingCard key={shipment.shipmentId} shipment={shipment} />
                  ))}
                </div>
              </motion.div>
            )}

            {isProductOrder && order.returns?.length > 0 && (
              <motion.div
                custom={2.7}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
              >
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                  Return Requests
                </h2>
                <div className="flex flex-col gap-3">
                  {order.returns.map((ret) => (
                    <ReturnRequestCard key={ret.returnId} ret={ret} order={order} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Astrologer Card (Consultation Orders) */}
            {!isProductOrder && order.astrologerId && (
              <motion.div
                custom={2}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Astrologer
                  </h2>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <img
                        src={
                          order.astrologerId.picture?.url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(order.astrologerId.name || "A")}&background=0d9488&color=fff&size=128`
                        }
                        alt={order.astrologerId.name}
                        className="w-16 h-16 rounded-2xl object-cover border border-gray-100"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(order.astrologerId.name || "A")}&background=0d9488&color=fff&size=128`;
                        }}
                      />
                      {order.astrologerId.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-gray-900">
                        {order.astrologerId.name}
                      </p>
                      {order.astrologerId.specialization && (
                        <p className="text-sm text-gray-400 mt-0.5">
                          {order.astrologerId.specialization}
                        </p>
                      )}
                      <div
                        className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-linear-to-r ${consultationType.color} text-white text-xs font-semibold`}
                      >
                        {consultationType.icon}
                        {consultationType.label}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4">
                    {order.duration && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">Duration</p>
                        <p className="text-sm font-bold text-gray-900">
                          {order.duration} Min
                        </p>
                      </div>
                    )}
                    {order.newUserDiscount > 0 && (
                      <div className="bg-emerald-50 rounded-xl p-3">
                        <p className="text-xs text-emerald-600 mb-1">
                          New User Discount
                        </p>
                        <p className="text-sm font-bold text-emerald-700">
                          − ₹{order.newUserDiscount?.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {order.loyalUserDiscount > 0 && (
                      <div className="bg-emerald-50 rounded-xl p-3">
                        <p className="text-xs text-emerald-600 mb-1">
                          Loyal User Discount
                        </p>
                        <p className="text-sm font-bold text-emerald-700">
                          − ₹{order.loyalUserDiscount?.toFixed(2)}
                        </p>
                      </div>
                    )}
                    <div className="bg-teal-50 rounded-xl p-3">
                      <p className="text-xs text-teal-600 mb-1">Amount Paid</p>
                      <p className="text-sm font-bold text-teal-700">
                        ₹{totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div className="space-y-5">
            {/* Order Summary Card */}
            <motion.div
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Order Summary
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {[
                  {
                    icon: <Calendar className="w-4 h-4 text-teal-600" />,
                    label: "Order Date",
                    value: formatDate(order.createdAt),
                    bg: "bg-teal-50",
                  },
                  isProductOrder && {
                    icon: <Truck className="w-4 h-4 text-blue-600" />,
                    label: "Delivery Date",
                    // ✅ deliveryDate response mein nahi hai, so fallback
                    value: order.deliveryDate
                      ? formatDate(order.deliveryDate)
                      : "To be updated",
                    bg: "bg-blue-50",
                  },
                  !isProductOrder &&
                    order.duration && {
                      icon: <Clock className="w-4 h-4 text-violet-600" />,
                      label: "Duration",
                      value: `${order.duration} Min`,
                      bg: "bg-violet-50",
                    },
                  {
                    icon: <CreditCard className="w-4 h-4 text-emerald-600" />,
                    label: "Payment Method",
                    // ✅ FIX: order.payment.method
                    value: paymentMethod,
                    bg: "bg-emerald-50",
                  },
                  {
                    icon: <Package className="w-4 h-4 text-violet-500" />,
                    label: "Order Status",
                    // ✅ FIX: order.orderStatus
                    value: currentStatus,
                    bg: "bg-violet-50",
                  },
                  {
                    icon: <ShoppingBag className="w-4 h-4 text-orange-500" />,
                    label: "Total Amount",
                    // ✅ FIX: totalAmount
                    value: `₹${totalAmount.toFixed(2)}`,
                    bg: "bg-orange-50",
                    bold: true,
                  },
                  isRefunded && {
                    icon: <RotateCcw className="w-4 h-4 text-emerald-600" />,
                    label: paymentStatus === "refunded" ? "Refund" : "Refund (Partial)",
                    value:
                      totalRefunded > 0
                        ? `₹${totalRefunded.toFixed(2)} refunded`
                        : "Refunded",
                    bg: "bg-emerald-50",
                  },
                  refundPending && {
                    icon: <Clock className="w-4 h-4 text-amber-600" />,
                    label: "Refund",
                    value: "Pending",
                    bg: "bg-amber-50",
                  },
                ]
                  .filter(Boolean)
                  .map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center shrink-0`}
                      >
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">{item.label}</p>
                        <p
                          className={`text-sm truncate ${item.bold ? "font-bold text-teal-700" : "font-semibold text-gray-900"}`}
                        >
                          {item.value}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>

            {/* Shipping Address */}
            {isProductOrder && order.shippingAddress && (
              <motion.div
                custom={3}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Shipping Address
                  </h2>
                </div>
                <div className="p-6">
                  {/* ✅ FIX: fullName use karo */}
                  <p className="text-sm font-bold text-gray-900 mb-1">
                    {order.shippingAddress.fullName ||
                      order.shippingAddress.name ||
                      "—"}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {order.shippingAddress.addressLine1}
                    {order.shippingAddress.addressLine2 &&
                      `, ${order.shippingAddress.addressLine2}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                    — {order.shippingAddress.pincode}
                  </p>
                  {order.shippingAddress.phone && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
                        <Phone className="w-3.5 h-3.5 text-teal-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {order.shippingAddress.phone}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Action Buttons — desktop only, see actionButtons comment above */}
            <motion.div
              custom={4}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="hidden lg:flex lg:flex-col gap-3"
            >
              {actionButtons}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Cancel confirmation */}
      <ResponsiveDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="Cancel this order?"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Keep Order
            </button>
            <button
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
            >
              {cancelling ? "Cancelling…" : "Yes, Cancel"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-500">
          This can't be undone. If you've already paid, any applicable refund will be processed after
          cancellation.
        </p>
      </ResponsiveDialog>

      {/* Return request */}
      <ResponsiveDialog
        isOpen={showReturnSheet}
        onClose={() => setShowReturnSheet(false)}
        title="Request a Return"
        footer={
          <button
            onClick={handleSubmitReturn}
            disabled={submittingReturn}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-gold disabled:opacity-60 transition-colors"
          >
            {submittingReturn ? "Submitting…" : "Submit Return Request"}
          </button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Select items &amp; quantity
            </p>
            {returnableItems.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/60"
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-11 h-11 object-cover rounded-lg border border-gray-200 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.name}</p>
                  <p className="text-xs text-gray-400">Up to {item.remaining} returnable</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setReturnQty((prev) => ({
                        ...prev,
                        [item.productId]: Math.max(0, (prev[item.productId] || 0) - 1),
                      }))
                    }
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold text-gray-900">
                    {returnQty[item.productId] || 0}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setReturnQty((prev) => ({
                        ...prev,
                        [item.productId]: Math.min(item.remaining, (prev[item.productId] || 0) + 1),
                      }))
                    }
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Reason
            </label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-primary"
            >
              <option value="">Select a reason</option>
              <option value="Damaged or defective">Damaged or defective</option>
              <option value="Wrong item received">Wrong item received</option>
              <option value="Doesn't match description">Doesn't match description</option>
              <option value="No longer needed">No longer needed</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Additional comments (optional)
            </label>
            <textarea
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              rows={3}
              placeholder="Tell us more about the issue…"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
