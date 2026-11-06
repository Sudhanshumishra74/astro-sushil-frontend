import { motion } from "framer-motion";
import PageHero from "./HeroPage";
import { ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCurrency } from "../hooks/useCurrency";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut", delay: i * 0.15 },
  }),
};

function ThankYouPage({ type }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { convert } = useCurrency();

  // CheckoutPage2 passes `result.data` here under the `order` key, but
  // that shape differs by payment method: the COD path's result.data is
  // `{ order, razorpayConfig }` (order.controller.js's createOrder), while
  // the Razorpay path's is the order document itself (verifyPayment
  // returns it unwrapped) — resolve both shapes rather than assuming one.
  const order = location.state?.order?.order || location.state?.order;

  return (
    <>
      <PageHero
        title="Thankyou"
        subtitle="The extraordinary world of astrology, an ancient science that illuminates personality, purpose, and possibility. Every moment holds cosmic meaning"
      />

      <div className="max-w-7xl mx-auto px-5">
        <motion.div
          className="text-center my-10 lg:mb-14 flex flex-col items-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.p
            variants={fadeUp}
            custom={0}
            className="text-sm font-semibold uppercase tracking-[0.22em] text-primary block mb-3"
          >
            Thankyou
          </motion.p>

          <motion.h2
            variants={fadeUp}
            custom={1}
            className="text-primary text-[28px] sm:text-[36px] lg:text-[42px] font-bold leading-tight"
          >
            Your Cosmic <span className="text-gold">Journey Begins</span>
          </motion.h2>

          {type === "consultation" && (
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 text-primary text-xl max-w-5xl mx-auto "
            >
              Thank you for booking your astrology consultation with us. Your
              appointment has been successfully confirmed, and the universe is
              already aligning powerful insights for your path ahead. Whether
              you seek clarity in career, love, relationships, finances, or
              personal growth, this session is designed to guide you with
              ancient wisdom and meaningful direction. Stay positive — your
              stars have a story to tell.
            </motion.p>
          )}

          {type === "product" && (
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 text-primary text-xl max-w-5xl mx-auto "
            >
              Thank you for booking your product with us. Your order has been
              successfully confirmed, and the universe is already aligning
              powerful insights for your path ahead. Whether you seek clarity in
              career, love, relationships, finances, or personal growth, this
              session is designed to guide you with ancient wisdom and
              meaningful direction. Stay positive — your stars have a story to
              tell.
            </motion.p>
          )}

          {type === "report" && (
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 text-primary text-xl max-w-5xl mx-auto "
            >
              Thank you for choosing our Kundli Report service. We appreciate
              your trust in us. Your personalized Kundli report is currently
              being prepared based on your birth details. Our experts are
              carefully analyzing planetary positions, houses, and key
              astrological influences to create a detailed and accurate report
              for you. You will receive your complete Kundli report within the
              next 2 days. Once ready, it will be shared with you through your
              registered contact details.
            </motion.p>
          )}

          {type === "contact" && (
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 text-primary text-xl max-w-5xl mx-auto "
            >
              Thank you for reaching out to Astro Sushil. We've received your
              message and our team will get back to you within 24–48 hours.
              In the meantime, feel free to explore our consultations, courses,
              and personalized reports.
            </motion.p>
          )}

          <motion.button
            variants={fadeUp}
            onClick={() => navigate("/")}
            className="mt-8 flex items-center gap-2 text-sm md:text-lg bg-primary text-white px-6 py-3 rounded-xl cursor-pointer hover:bg-gold transition-all duration-700"
          >
            Back to Home <ChevronRight className="w-4 h-4" />
          </motion.button>
        </motion.div>
      </div>

      {type === "product" && order && (
        <div className="max-w-7xl mx-auto px-5 mb-14">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-black/10 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-heading font-bold text-primary">
                Order Summary
              </span>
              <span className="text-xs text-black/40 font-body">
                #{String(order._id || "").slice(-8).toUpperCase()}
              </span>
            </div>

            <div className="space-y-3">
              {[
                { label: "Subtotal", value: convert(order.subTotal ?? order.totalAmount) },
                order.discount > 0 && {
                  label: `Discount${order.coupon?.code ? ` (${order.coupon.code})` : ""}`,
                  value: `−${convert(order.discount)}`,
                  green: true,
                },
                order.shipping > 0 && { label: "Shipping", value: convert(order.shipping) },
                order.tax > 0 && { label: "Tax", value: convert(order.tax) },
              ]
                .filter(Boolean)
                .map(({ label, value, green }) => (
                  <div key={label} className="flex justify-between items-center gap-3 text-sm">
                    <span className="text-black/45 font-body">{label}</span>
                    <span
                      className={`font-body font-semibold shrink-0 ${green ? "text-green-600" : "text-primary"}`}
                    >
                      {value}
                    </span>
                  </div>
                ))}

              <div className="border-t border-dashed border-black/10 pt-3 flex justify-between items-baseline gap-3">
                <span className="font-heading font-bold text-primary">Total</span>
                <span className="text-xl font-heading font-bold text-primary shrink-0">
                  {convert(order.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ThankYouPage;
