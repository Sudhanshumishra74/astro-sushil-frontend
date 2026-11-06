import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAstrologyStore } from "../../store/useAstrologyStore";

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

const captureEl = (el) =>
  window.html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const formatBirthDate = (bd) => {
  if (!bd?.day || !bd?.month || !bd?.year) return "-";
  return `${bd.day} ${MONTH_NAMES[bd.month - 1] || ""} ${bd.year}`.trim();
};

const ashtakootRows = [
  "varna",
  "vashya",
  "tara",
  "yoni",
  "maitri",
  "gan",
  "bhakut",
  "nadi",
];
const dashakootRows = [
  "dina",
  "gana",
  "yoni",
  "rashi",
  "rasyadhipati",
  "rajju",
  "vedha",
  "vashya",
  "mahendra",
  "streeDeergha",
];
const planetIcons = {
  Sun: "☀",
  Moon: "☽",
  Mars: "♂",
  Mercury: "☿",
  Jupiter: "♃",
  Venus: "♀",
  Saturn: "♄",
  Rahu: "☊",
  Ketu: "☋",
};

function ScoreBar({ received, total }) {
  const pct = total > 0 ? Math.round((received / total) * 100) : 0;
  const good = pct >= 50;
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${good ? "bg-primary" : "bg-[#D4AF37]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-['Outfit'] text-[10px] text-primary/50 w-8 text-right">
        {received}/{total}
      </span>
    </div>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-xl bg-primarylex items-center justify-center text-white text-sm shrink-0">
        {icon}
      </div>
      <h2 className="font-['Philosopher'] text-[13px] uppercase tracking-[0.12em] text-primary">
        {title}
      </h2>
      <div className="flex-1 h-px bg-secondary" />
    </div>
  );
}

function StatusPill({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-['Philosopher'] tracking-wider border ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function RingChart({ pct = 0, gold }) {
  const circumference = 283;
  const offset = circumference - (circumference * pct) / 100;
  return (
    <div className="relative w-14 h-14 mx-auto mb-2">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#d9d6e8"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={gold ? "#D4AF37" : "#424874"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="283"
          strokeDashoffset={offset}
        />
      </svg>
      <span className="font-['Philosopher'] text-primary text-sm absolute inset-0 flex items-center justify-center">
        {pct}%
      </span>
    </div>
  );
}

export default function KundliMatchReport() {
  const [saving, setSaving] = useState(false);
  const reportRef = useRef(null);
  const navigate = useNavigate();
  const { matchMaking, formData } = useAstrologyStore();

  if (!matchMaking) {
    return (
      <div className="min-h-screen bg-[#eceaf4] font-['Outfit'] flex items-center justify-center px-6">
        <div className="max-w-md text-center bg-white rounded-2xl border border-secondary shadow-sm p-8">
          <p className="font-['Philosopher'] text-primary text-lg mb-2">
            No match report yet
          </p>
          <p className="font-['Outfit'] text-sm text-primary/55 mb-6">
            Enter both birth details on the Kundli Matching page to generate a
            report.
          </p>
          <button
            type="button"
            onClick={() => navigate("/kundli-matching/")}
            className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-['Philosopher'] tracking-wide hover:bg-gold transition-colors"
          >
            Go to Kundli Matching
          </button>
        </div>
      </div>
    );
  }

  const {
    match_birth_details = {},
    match_ashtakoot_points = {},
    match_astro_details = {},
    match_percentage: mp = {},
    match_making_report = {},
    match_obstructions = {},
    match_dashakoot_points = {},
    match_manglik_report = {},
    match_planet_details = {},
  } = matchMaking;

  const maleName = formData?.male_name || "Male";
  const femaleName = formData?.female_name || "Female";
  const maleBirthDate = formatBirthDate(match_birth_details.male_astro_details);
  const femaleBirthDate = formatBirthDate(
    match_birth_details.female_astro_details,
  );

  const ashtakootTotal =
    match_ashtakoot_points.total || {
      total_points: 36,
      received_points: 0,
      minimum_required: 18,
    };
  const dashakootTotal =
    match_dashakoot_points.total || {
      total_points: 36,
      received_points: 0,
      minimum_required: 18,
    };

  const handleSavePDF = async () => {
    setSaving(true);
    try {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      );
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      );

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageW = 210,
        pageH = 297;

      // Capture entire report as one tall canvas
      const canvas = await captureEl(reportRef.current);

      // How many canvas-px fit in one A4 page (maintaining aspect ratio)
      const pxPerPage = Math.floor((pageH / pageW) * canvas.width);
      const totalPages = Math.ceil(canvas.height / pxPerPage);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();

        const srcY = i * pxPerPage;
        const srcH = Math.min(pxPerPage, canvas.height - srcY);

        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = srcH;
        slice
          .getContext("2d")
          .drawImage(
            canvas,
            0,
            srcY,
            canvas.width,
            srcH,
            0,
            0,
            canvas.width,
            srcH,
          );

        const sliceH = (srcH / canvas.width) * pageW;
        pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageW, sliceH);
      }

      pdf.save("Kundli_Match_Report.pdf");
    } catch (err) {
      console.error(err);
      alert("PDF generation failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eceaf4] font-['Outfit']">
      {/* Save PDF Button */}
      {/* <button
        onClick={handleSavePDF}
        disabled={saving}
        className="fixed top-4 right-4 z-50 px-5 py-2 rounded-full text-white text-sm font-['Philosopher'] tracking-widest bg-primary shadow-lg hover:bg-[#3b3f63] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? "⏳ Saving..." : "⬇ Save as PDF"}
      </button> */}

      {/* Report Container */}
      <div
        ref={reportRef}
        className="max-w-3xl mx-auto bg-white min-h-screen shadow-2xl overflow-hidden"
      >
        {/* HEADER */}
        <div className="relative overflow-hidden px-10 pt-12 pb-10 bg-primary">
          {/* Gold top bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#D4AF37]" />

          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full border border-white/5 pointer-events-none" />
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full border border-white/4 pointer-events-none" />
          <div className="absolute -bottom-10 left-20 w-40 h-40 rounded-full bg-white/2.5 pointer-events-none" />

          <div className="relative flex items-center justify-between gap-6">
            {/* Male */}
            <div className="shrink-0 text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-3xl mx-auto shadow-lg text-white">
                ♂
              </div>
              <p className="font-['Philosopher'] text-white/90 text-xs tracking-widest uppercase mt-2">
                {maleName}
              </p>
              <p className="font-['Outfit'] text-white/50 text-[10px] mt-0.5">
                {maleBirthDate}
              </p>
            </div>

            {/* Center */}
            <div className="flex-1 text-center">
              <p className="font-['Outfit'] text-[10px] tracking-[0.42em] text-amber-200/70 uppercase mb-1">
                Vedic Kundli
              </p>
              <h1 className="font-['Philosopher'] text-4xl text-white uppercase tracking-widest leading-none drop-shadow-lg">
                Match Report
              </h1>
              <p className="font-['Outfit'] text-[11px] text-purple-200/55 tracking-[0.14em] mt-2">
                Ashtakoota · Dashakoot · Manglik · Doshas
              </p>
              <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 rounded-full bg-white/10 border border-white/15">
                <span className="text-[#D4AF37] text-sm">★</span>
                <span className="font-['Philosopher'] text-white text-sm tracking-wider">
                  {mp.match_percentage}% Overall Match
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-['Philosopher'] tracking-wider ${mp.is_match_good ? "bg-emerald-400/20 text-emerald-300" : "bg-red-400/20 text-red-300"}`}
                >
                  {mp.is_match_good ? "GOOD" : "POOR"}
                </span>
              </div>
            </div>

            {/* Female */}
            <div className="shrink-0 text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-3xl mx-auto shadow-lg text-white">
                ♀
              </div>
              <p className="font-['Philosopher'] text-white/90 text-xs tracking-widest uppercase mt-2">
                {femaleName}
              </p>
              <p className="font-['Outfit'] text-white/50 text-[10px] mt-0.5">
                {femaleBirthDate}
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-4 mt-7">
            <div className="flex-1 h-px bg-white/10" />
            <span className="font-['Outfit'] text-[9.5px] text-amber-200/50 tracking-[0.45em] uppercase">
              ✦ Celestial Compatibility ✦
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </div>

        {/* BODY */}
        <div className="px-8 pt-7 pb-10 space-y-6">
          {/* SCORE OVERVIEW */}
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: "Ashtakoota",
                pct: mp.ashtakoota_percentage,
                gold: false,
              },
              {
                label: "Manglik",
                pct: mp.manglik_match_percentage,
                gold: false,
              },
              { label: "Rajju", pct: mp.rajju_match_percentage, gold: true },
              { label: "Vedha", pct: mp.vedha_match_percentage, gold: true },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-2xl border border-secondary shadow-sm overflow-hidden text-center"
              >
                <div
                  className={`h-1 ${s.gold ? "bg-[#D4AF37]" : "bg-primary"}`}
                />
                <div className="p-4">
                  <RingChart pct={s.pct} gold={s.gold} />
                  <p className="font-['Philosopher'] text-[10.5px] text-primary tracking-wide uppercase">
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* BIRTH DETAILS */}
          <div className="bg-white rounded-2xl border border-secondary shadow-sm overflow-hidden">
            <div className="h-1 bg-primary" />
            <div className="p-5">
              <SectionHeader icon="☽" title="Birth Details" />
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    gender: "male",
                    label: maleName,
                    d: match_astro_details.male_astro_details || {},
                    bd: match_birth_details.male_astro_details || {},
                  },
                  {
                    gender: "female",
                    label: femaleName,
                    d: match_astro_details.female_astro_details || {},
                    bd: match_birth_details.female_astro_details || {},
                  },
                ].map(({ gender, label, d, bd }) => (
                  <div
                    key={gender}
                    className="bg-[#f4eeff]/60 rounded-xl p-4 border border-secondary"
                  >
                    <p className="font-['Philosopher'] text-[11px] uppercase tracking-[0.15em] text-primary mb-3 flex items-center gap-2">
                      <span>{gender === "male" ? "♂" : "♀"}</span> {label}
                    </p>
                    <div className="space-y-1.5">
                      {[
                        ["Ascendant", d.ascendant],
                        ["Sign", d.sign],
                        ["Sign Lord", d.SignLord],
                        ["Nakshatra", d.Naksahtra],
                        ["Nakshatra Lord", d.NaksahtraLord],
                        ["Tithi", d.Tithi],
                        ["Yog", d.Yog],
                        ["Karan", d.Karan],
                        ["Element", d.tatva],
                        ["Paya", d.paya],
                        ["Sunrise", bd.sunrise],
                        ["Sunset", bd.sunset],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          className="flex justify-between items-baseline"
                        >
                          <span className="font-['Outfit'] text-[11px] text-primary/55">
                            {k}
                          </span>
                          <span className="font-['Outfit'] text-[11px] text-[#3c3c52] font-medium">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ASHTAKOOTA TABLE */}
          <div className="bg-white rounded-2xl border border-secondary shadow-sm overflow-hidden">
            <div className="h-1 bg-primary" />
            <div className="p-5">
              <SectionHeader icon="⚖" title="Ashtakoota Points" />
              <div className="flex items-center justify-between mb-4 px-1">
                <div>
                  <span className="font-['Philosopher'] text-3xl text-primary">
                    {ashtakootTotal.received_points}
                  </span>
                  <span className="font-['Outfit'] text-primary/40 text-sm">
                    /{ashtakootTotal.total_points}
                  </span>
                </div>
                <StatusPill
                  ok={
                    ashtakootTotal.received_points >=
                    ashtakootTotal.minimum_required
                  }
                  label={
                    ashtakootTotal.received_points >=
                    ashtakootTotal.minimum_required
                      ? "Passed"
                      : "Below Minimum (18)"
                  }
                />
              </div>
              <div className="rounded-xl overflow-hidden border border-secondary">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-primary">
                      {[
                        "Koot",
                        "Description",
                        "Male",
                        "Female",
                        "Score",
                        "Max",
                      ].map((h) => (
                        <th
                          key={h}
                          className="font-['Philosopher'] text-[10px] tracking-widest text-white/80 uppercase px-3 py-2.5"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ashtakootRows.map((key, i) => {
                      const row = match_ashtakoot_points[key] || {
                        description: "-",
                        male_koot_attribute: "-",
                        female_koot_attribute: "-",
                        total_points: 0,
                        received_points: 0,
                      };
                      const good = row.received_points >= row.total_points / 2;
                      return (
                        <tr
                          key={key}
                          className={`border-b border-secondary/60 ${i % 2 === 0 ? "bg-white" : "bg-[#faf9fd]"}`}
                        >
                          <td className="font-['Philosopher'] text-[11px] text-primary capitalize px-3 py-2.5">
                            {key}
                          </td>
                          <td className="font-['Outfit'] text-[10.5px] text-primary/55x-3 py-2.5 max-w-25">
                            {row.description}
                          </td>
                          <td className="font-['Outfit'] text-[11px] text-[#3c3c52] px-3 py-2.5">
                            {row.male_koot_attribute}
                          </td>
                          <td className="font-['Outfit'] text-[11px] text-[#3c3c52] px-3 py-2.5">
                            {row.female_koot_attribute}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`font-['Philosopher'] text-[12px] ${good ? "text-primary" : "text-[#D4AF37]"}`}
                            >
                              {row.received_points}
                            </span>
                          </td>
                          <td className="font-['Outfit'] text-[11px] text-primary/40 px-3 py-2.5">
                            {row.total_points}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-[#f4eeff]/60">
                      <td
                        colSpan={4}
                        className="font-['Philosopher'] text-[11px] text-primary uppercase tracking-wider px-3 py-2.5"
                      >
                        Total
                      </td>
                      <td className="font-['Philosopher'] text-[13px] text-primary px-3 py-2.5">
                        {ashtakootTotal.received_points}
                      </td>
                      <td className="font-['Philosopher'] text-[11px] text-primary/60 px-3 py-2.5">
                        {ashtakootTotal.total_points}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 px-1">
                <ScoreBar
                  received={ashtakootTotal.received_points}
                  total={ashtakootTotal.total_points}
                />
                <p className="font-['Outfit'] text-[11px] text-primary/55 italic mt-2 leading-relaxed">
                  {match_ashtakoot_points.conclusion?.report}
                </p>
              </div>
            </div>
          </div>

          {/* DASHAKOOT TABLE */}
          <div className="bg-white rounded-2xl border border-secondary shadow-sm overflow-hidden">
            <div className="h-1 bg-[#D4AF37]" />
            <div className="p-5">
              <SectionHeader icon="◎" title="Dashakoot Points" />
              <div className="flex items-center justify-between mb-4 px-1">
                <div>
                  <span className="font-['Philosopher'] text-3xl text-primary">
                    {dashakootTotal.received_points}
                  </span>
                  <span className="font-['Outfit'] text-primary/40 text-sm">
                    /{dashakootTotal.total_points}
                  </span>
                </div>
                <StatusPill
                  ok={dashakootTotal.received_points >= dashakootTotal.minimum_required}
                  label={
                    dashakootTotal.received_points >= dashakootTotal.minimum_required
                      ? "Passed"
                      : "Below Minimum (18)"
                  }
                />
              </div>
              <div className="rounded-xl overflow-hidden border border-secondary">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#D4AF37]">
                      {["Koot", "Male", "Female", "Score", "Max"].map((h) => (
                        <th
                          key={h}
                          className="font-['Philosopher'] text-[10px] tracking-widest text-white/90 uppercase px-3 py-2.5"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dashakootRows.map((key, i) => {
                      const row = match_dashakoot_points[key] || {
                        male_koot_attribute: "-",
                        female_koot_attribute: "-",
                        total_points: 0,
                        received_points: 0,
                      };
                      const good = row.received_points >= row.total_points / 2;
                      return (
                        <tr
                          key={key}
                          className={`border-b border-secondary/60 ${i % 2 === 0 ? "bg-white" : "bg-[#faf9fd]"}`}
                        >
                          <td className="font-['Philosopher'] text-[11px] text-primary capitalize px-3 py-2.5">
                            {key}
                          </td>
                          <td className="font-['Outfit'] text-[11px] text-[#3c3c52] px-3 py-2.5">
                            {row.male_koot_attribute}
                          </td>
                          <td className="font-['Outfit'] text-[11px] text-[#3c3c52] px-3 py-2.5">
                            {row.female_koot_attribute}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`font-['Philosopher'] text-[12px] ${good ? "text-primary" : "text-[#D4AF37]"}`}
                            >
                              {row.received_points}
                            </span>
                          </td>
                          <td className="font-['Outfit'] text-[11px] text-primary/40 px-3 py-2.5">
                            {row.total_points}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-[#f4eeff]/60">
                      <td
                        colSpan={3}
                        className="font-['Philosopher'] text-[11px] text-primary uppercase tracking-wider px-3 py-2.5"
                      >
                        Total
                      </td>
                      <td className="font-['Philosopher'] text-[13px] text-primary px-3 py-2.5">
                        {dashakootTotal.received_points}
                      </td>
                      <td className="font-['Philosopher'] text-[11px] text-primary/60 px-3 py-2.5">
                        {dashakootTotal.total_points}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 px-1">
                <ScoreBar
                  received={dashakootTotal.received_points}
                  total={dashakootTotal.total_points}
                />
              </div>
            </div>
          </div>

          {/* MANGLIK + DOSHA */}
          <div className="grid grid-cols-2 gap-4">
            {/* Manglik */}
            <div className="bg-white rounded-2xl border border-secondary shadow-sm overflow-hidden">
              <div className="h-1 bg-primary" />
              <div className="p-5">
                <SectionHeader icon="♂" title="Manglik Report" />
                <div className="space-y-3">
                  {[
                    { gender: "male", label: maleName, d: match_manglik_report.male || {} },
                    { gender: "female", label: femaleName, d: match_manglik_report.female || {} },
                  ].map(({ gender, label, d: md }) => (
                    <div
                      key={gender}
                      className="rounded-xl bg-[#f4eeff]/60 border border-secondary p-3"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-['Philosopher'] text-[11px] text-primary uppercase tracking-wider">
                          {label}
                        </span>
                        <StatusPill
                          ok={!md.is_present}
                          label={md.manglik_status}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${md.percentage_manglik_present}%`,
                            }}
                          />
                        </div>
                        <span className="font-['Outfit'] text-[10px] text-primary/50">
                          {md.percentage_manglik_present}%
                        </span>
                      </div>
                      {md.is_mars_manglik_cancelled && (
                        <p className="font-['Outfit'] text-[10px] text-emerald-600 mt-1.5">
                          ✓ Mars Manglik cancelled
                        </p>
                      )}
                      <p className="font-['Outfit'] text-[10.5px] text-primary/55talic mt-1.5 leading-relaxed">
                        {md.manglik_report}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                    <p className="font-['Outfit'] text-[11px] text-emerald-700 leading-relaxed">
                      {match_manglik_report.conclusion?.report}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dosha */}
            <div className="bg-white rounded-2xl border border-secondary shadow-sm overflow-hidden">
              <div className="h-1 bg-[#D4AF37]" />
              <div className="p-5">
                <SectionHeader icon="◈" title="Dosha Report" />
                <div className="space-y-3">
                  {[
                    {
                      label: "Rajju Dosha",
                      ok: !match_making_report.rajju_dosha?.status,
                      desc: match_making_report.rajju_dosha?.status
                        ? "Rajju dosha is present between these Nakshatras — consult an astrologer for remedies."
                        : "No Rajju dosha present. Compatible Nakshatra groups.",
                    },
                    {
                      label: "Vedha Dosha",
                      ok: !match_making_report.vedha_dosha?.status,
                      desc: match_obstructions.vedha_report,
                    },
                  ].map(({ label, ok, desc }) => (
                    <div
                      key={label}
                      className={`rounded-xl border p-3 ${ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-['Philosopher'] text-[11px] text-primary uppercase tracking-wider">
                          {label}
                        </span>
                        <StatusPill ok={ok} label={ok ? "Clear" : "Present"} />
                      </div>
                      <p className="font-['Outfit'] text-[10.5px] text-primary/55 italic leading-relaxed">
                        {desc}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-xl bg-[#f4eeff]/60 border border-secondary p-3 mt-1">
                    <p className="font-['Philosopher'] text-[10.5px] text-primary uppercase tracking-wider mb-1.5">
                      Overall Factors
                    </p>
                    <div className="space-y-1">
                      {[
                        {
                          k: "Ashtakoota",
                          v: `${match_making_report.ashtakoota?.received_points ?? ashtakootTotal.received_points}/36`,
                          ok: false,
                        },
                        {
                          k: "Manglik Match",
                          v: `${mp.manglik_match_percentage}%`,
                          ok: true,
                        },
                        {
                          k: "Rajju Match",
                          v: `${mp.rajju_match_percentage}%`,
                          ok: true,
                        },
                        {
                          k: "Vedha Match",
                          v: `${mp.vedha_match_percentage}%`,
                          ok: true,
                        },
                      ].map(({ k, v, ok }) => (
                        <div key={k} className="flex justify-between">
                          <span className="font-['Outfit'] text-[10.5px] text-primary/55">
                            {k}
                          </span>
                          <span
                            className={`font-['Philosopher'] text-[11px] ${ok ? "text-emerald-600" : "text-[#D4AF37]"}`}
                          >
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PLANET POSITIONS */}
          <div className="bg-white rounded-2xl border border-secondary shadow-sm overflow-hidden">
            <div className="h-1 bg-primary" />
            <div className="p-5">
              <SectionHeader icon="✦" title="Planet Positions" />
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    gender: "male",
                    label: maleName,
                    planets: match_planet_details.male_planet_details || [],
                  },
                  {
                    gender: "female",
                    label: femaleName,
                    planets: match_planet_details.female_planet_details || [],
                  },
                ].map(({ gender, label, planets }) => (
                  <div key={gender}>
                    <p className="font-['Philosopher'] text-[11px] text-primary uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                      <span>{gender === "male" ? "♂" : "♀"}</span> {label}
                    </p>
                    <div className="rounded-xl overflow-hidden border border-secondary">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-primary">
                            {["Planet", "Sign", "House", "Status"].map((h) => (
                              <th
                                key={h}
                                className="font-['Philosopher'] text-[9px] tracking-widest text-white/80 uppercase px-2 py-2"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {planets.map((p, i) => (
                            <tr
                              key={p.name}
                              className={`border-b border-secondary/60 ${i % 2 === 0 ? "bg-white" : "bg-[#faf9fd]"}`}
                            >
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[#D4AF37] text-xs">
                                    {planetIcons[p.name] || "◦"}
                                  </span>
                                  <span className="font-['Outfit'] text-[10.5px] text-[#3c3c52]">
                                    {p.name}
                                  </span>
                                </div>
                              </td>
                              <td className="font-['Outfit'] text-[10px] text-primary/60 px-2 py-1.5">
                                {p.sign}
                              </td>
                              <td className="font-['Philosopher'] text-[11px] text-primary px-2 py-1.5">
                                {p.house}
                              </td>
                              <td className="px-2 py-1.5">
                                <span
                                  className={`text-[9px] font-['Philosopher'] tracking-wider px-1.5 py-0.5 rounded-full ${p.isRetro === "true" ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-secondary/50 text-primary/60"}`}
                                >
                                  {p.isRetro === "true"
                                    ? "℞"
                                    : p.planet_awastha}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CONCLUSION */}
          <div className="bg-white rounded-2xl border border-secondary shadow-sm overflow-hidden">
            <div className="h-1 bg-[#D4AF37]" />
            <div className="p-5">
              <SectionHeader icon="★" title="Final Conclusion" />
              <div className="bg-[#f4eeff]/60 rounded-xl border border-secondary p-5 text-center">
                <div className="inline-flex items-center gap-2 mb-3">
                  <span className="font-['Philosopher'] text-4xl text-[#D4AF37]">
                    {mp.match_percentage}%
                  </span>
                  <div className="text-left">
                    <p className="font-['Philosopher'] text-[10px] text-primary/50 uppercase tracking-widest">
                      Overall
                    </p>
                    <p className="font-['Philosopher'] text-[10px] text-primary/50 uppercase tracking-widest">
                      Compatibility
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${mp.match_percentage}%` }}
                    />
                  </div>
                </div>
                <p className="font-['Outfit'] text-sm text-[#3c3c52] leading-relaxed italic mb-4">
                  {match_making_report.conclusion?.match_report}
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {[
                    {
                      label: "Ashtakoota",
                      ok: ashtakootTotal.received_points >= ashtakootTotal.minimum_required,
                    },
                    {
                      label: "Manglik",
                      ok: match_manglik_report.conclusion?.match ?? true,
                    },
                    { label: "Rajju", ok: !match_making_report.rajju_dosha?.status },
                    { label: "Vedha", ok: !match_making_report.vedha_dosha?.status },
                  ].map(({ label, ok }) => (
                    <StatusPill key={label} ok={ok} label={label} />
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-secondary" />
                <span className="font-['Outfit'] text-[9.5px] text-primary/40 tracking-[0.3em] uppercase">
                  ✦ Consult an Astrologer for Complete Guidance ✦
                </span>
                <div className="flex-1 h-px bg-secondary" />
              </div>
            </div>
          </div>
        </div>

        {/* Gold footer bar */}
        <div className="h-1 bg-[#D4AF37]" />
      </div>
    </div>
  );
}
