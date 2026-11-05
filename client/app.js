const { useState, useRef, useCallback, useEffect } = React;

const API_BASE = window.MEDSCAN_API_BASE || "http://localhost:5000";

/* ---------------------------------------------------------------- *
 *  API helpers
 * ---------------------------------------------------------------- */
async function scanPrescription({ file, demo }) {
  let res;
  if (demo) {
    res = await fetch(`${API_BASE}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demo: true }),
    });
  } else {
    const form = new FormData();
    form.append("prescription", file);
    res = await fetch(`${API_BASE}/api/scan`, { method: "POST", body: form });
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ---------------------------------------------------------------- *
 *  Small presentational helpers
 * ---------------------------------------------------------------- */
const SLOT_META = {
  morning: { label: "Morning", icon: "🌅", time: "8:00 AM" },
  afternoon: { label: "Afternoon", icon: "☀️", time: "1:00 PM" },
  evening: { label: "Evening", icon: "🌇", time: "6:00 PM" },
  night: { label: "Night", icon: "🌙", time: "9:00 PM" },
  anytime: { label: "Any time", icon: "⏰", time: "As needed" },
};

const SEVERITY_STYLE = {
  high: { chip: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", label: "High risk" },
  moderate: { chip: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", label: "Moderate" },
  low: { chip: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-500", label: "Note" },
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
        <span className="text-lg">🩺</span>
      </div>
      <div className="leading-tight">
        <div className="text-lg font-extrabold tracking-tight text-slate-900">
          MedScan<span className="text-brand-600"> AI</span>
        </div>
        <div className="text-[11px] font-medium text-slate-400">Prescription Decoder</div>
      </div>
    </div>
  );
}

function AiBadge({ source }) {
  const live = source === "ai";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        live
          ? "border-brand-200 bg-brand-50 text-brand-700"
          : "border-slate-200 bg-slate-100 text-slate-500"
      }`}
      title={live ? "Parsed by live AI vision model" : "Parsed by offline demo engine (add an API key for live AI)"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-brand-500" : "bg-slate-400"}`}></span>
      {live ? "Live AI" : "Demo engine"}
    </span>
  );
}

/* ---------------------------------------------------------------- *
 *  Upload / drop zone
 * ---------------------------------------------------------------- */
function UploadZone({ onFile, onDemo, loading }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleFiles = useCallback(
    (files) => {
      const file = files && files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        alert("Please choose an image file (JPG or PNG).");
        return;
      }
      setPreview(URL.createObjectURL(file));
      onFile(file);
    },
    [onFile]
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current && inputRef.current.click()}
        className={`group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed p-10 text-center transition-all ${
          dragging
            ? "border-brand-500 bg-brand-50 scale-[1.01]"
            : "border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40"
        }`}
      >
        {preview ? (
          <img
            src={preview}
            alt="Prescription preview"
            className="mx-auto max-h-56 rounded-xl object-contain shadow-md"
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-100 text-3xl transition-transform group-hover:scale-110">
              📸
            </div>
            <div>
              <p className="text-base font-semibold text-slate-700">
                Drop a prescription photo here
              </p>
              <p className="mt-1 text-sm text-slate-400">
                or <span className="font-medium text-brand-600">browse</span> — JPG / PNG, up to 8MB
              </p>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          disabled={loading}
          onClick={onDemo}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:opacity-50"
        >
          ✨ Try with a sample prescription
        </button>
        <span className="text-xs text-slate-400">
          No image handy? Use the sample to see the full flow.
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 *  Loading state
 * ---------------------------------------------------------------- */
const LOADING_STEPS = [
  "Reading the prescription…",
  "Decoding handwriting with AI…",
  "Extracting medicines & dosages…",
  "Building your schedule…",
  "Checking drug interactions…",
];

function LoadingView() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % LOADING_STEPS.length), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center">
      <div className="relative grid h-20 w-20 place-items-center">
        <span className="absolute h-20 w-20 rounded-full bg-brand-400 animate-pulse-ring"></span>
        <span className="absolute h-20 w-20 rounded-full bg-brand-400 animate-pulse-ring" style={{ animationDelay: "0.5s" }}></span>
        <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-2xl text-white shadow-xl">
          🧠
        </span>
      </div>
      <div>
        <p className="text-lg font-semibold text-slate-800">{LOADING_STEPS[step]}</p>
        <p className="mt-1 text-sm text-slate-400">This usually takes a few seconds.</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 *  Result sections
 * ---------------------------------------------------------------- */
function PatientBar({ patient, source, onReset }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Field label="Patient" value={patient.name || "—"} />
        <Field label="Doctor" value={patient.doctor || "—"} />
        <Field label="Date" value={patient.date || "—"} />
      </div>
      <div className="flex items-center gap-3">
        <AiBadge source={source} />
        <button
          onClick={onReset}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          ↺ New scan
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function InteractionAlerts({ interactions }) {
  if (!interactions || !interactions.length) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <span className="text-xl">✅</span>
        <p className="text-sm font-medium text-brand-800">
          No risky drug interactions detected among these medicines.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {interactions.map((w, i) => {
        const s = SEVERITY_STYLE[w.severity] || SEVERITY_STYLE.low;
        return (
          <div
            key={i}
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="mt-0.5 text-xl">⚠️</span>
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`}></span>
                  {s.label}
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {w.drugs.join("  +  ")}
                </span>
              </div>
              <p className="text-sm text-slate-600">{w.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MedicineCard({ med, lang, index }) {
  const foodLabel =
    med.food === "before" ? "Before food" : med.food === "after" ? "After food" : null;
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md animate-fade-up"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-bold text-slate-900">{med.name}</h4>
          <p className="text-sm text-slate-500">{med.dosage}</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-lg">💊</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {med.timing && med.timing.length ? (
          med.timing.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
            >
              {SLOT_META[t] ? SLOT_META[t].icon : "⏰"} {SLOT_META[t] ? SLOT_META[t].label : t}
            </span>
          ))
        ) : (
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500">As needed</span>
        )}
        {foodLabel && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
            🍽️ {foodLabel}
          </span>
        )}
        {med.duration && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
            📅 {med.duration} days
          </span>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <p className="text-sm text-slate-700">
          {med.instructionsByLang && med.instructionsByLang[lang]
            ? med.instructionsByLang[lang]
            : med.instructions}
        </p>
      </div>
    </div>
  );
}

function ScheduleTimeline({ schedule }) {
  const slots = ["morning", "afternoon", "evening", "night", "anytime"].filter(
    (s) => schedule[s] && schedule[s].length
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {slots.map((slot, i) => {
        const meta = SLOT_META[slot];
        return (
          <div
            key={slot}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-fade-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{meta.icon}</span>
                <span className="font-semibold text-slate-800">{meta.label}</span>
              </div>
              <span className="text-xs text-slate-400">{meta.time}</span>
            </div>
            <ul className="space-y-2">
              {schedule[slot].map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="text-brand-500">💊</span>
                  <span className="font-medium text-slate-700">{item.name}</span>
                  {item.food && (
                    <span className="ml-auto text-[11px] text-amber-600">
                      {item.food === "before" ? "before food" : "after food"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle, right }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <span>{icon}</span> {title}
        </h3>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function LanguageToggle({ languages, lang, setLang }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {languages.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            lang === l.code ? "bg-brand-500 text-white shadow" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function Results({ data, onReset }) {
  const [lang, setLang] = useState("en");
  const languages = data.languages || [{ code: "en", label: "English" }];

  return (
    <div className="space-y-8">
      <PatientBar patient={data.patient} source={data.source} onReset={onReset} />

      {/* Interactions first — safety is the headline */}
      <section>
        <SectionTitle
          icon="🛡️"
          title="Safety check"
          subtitle="Automatic drug-interaction and caution analysis"
        />
        <InteractionAlerts interactions={data.interactions} />
        {data.careNotes && data.careNotes.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.careNotes.map((n, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-sm">💡</span>
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">{n.drugs.join(", ")}: </span>
                  {n.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Schedule */}
      <section>
        <SectionTitle
          icon="🗓️"
          title="Your daily schedule"
          subtitle="When to take each medicine"
        />
        <ScheduleTimeline schedule={data.schedule} />
      </section>

      {/* Medicines */}
      <section>
        <SectionTitle
          icon="💊"
          title={`Medicines (${data.medicines.length})`}
          subtitle="Tap a language to read instructions in your language"
          right={<LanguageToggle languages={languages} lang={lang} setLang={setLang} />}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.medicines.map((med, i) => (
            <MedicineCard key={i} med={med} lang={lang} index={i} />
          ))}
        </div>
      </section>

      {data.doctorNotes && (
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-indigo-900">
            📝 Doctor's note
          </h3>
          <p className="text-sm text-indigo-800">{data.doctorNotes}</p>
        </section>
      )}

      <p className="pt-2 text-center text-xs text-slate-400">
        ⚕️ MedScan AI is a decision-support demo, not medical advice. Always confirm with a licensed pharmacist or doctor.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 *  Hero / landing content
 * ---------------------------------------------------------------- */
function Hero() {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
        🏥 HealthTech · Built for Vihaan X
      </span>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        Turn messy prescriptions into a
        <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
          {" "}clear plan
        </span>
      </h1>
      <p className="mt-3 text-base text-slate-500">
        Snap a photo of any prescription. MedScan AI reads it, builds your medication schedule,
        flags risky drug combinations, and explains everything in your language.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 *  Root App
 * ---------------------------------------------------------------- */
function App() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  const run = useCallback(async ({ file, demo }) => {
    setStatus("loading");
    setError(null);
    try {
      // small artificial floor so the nice loading animation is visible
      const [result] = await Promise.all([
        scanPrescription({ file, demo }),
        new Promise((r) => setTimeout(r, 1400)),
      ]);
      setData(result);
      setStatus("done");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }, []);

  const reset = () => {
    setStatus("idle");
    setData(null);
    setError(null);
    setPendingFile(null);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 glass">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              reset();
            }}
            className="text-sm font-medium text-slate-500 hover:text-brand-600"
          >
            Home
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-4 py-10">
        {status === "idle" && (
          <>
            <Hero />
            <UploadZone
              loading={false}
              onFile={(file) => {
                setPendingFile(file);
                run({ file });
              }}
              onDemo={() => run({ demo: true })}
            />
            <FeatureRow />
          </>
        )}

        {status === "loading" && <LoadingView />}

        {status === "error" && (
          <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-2xl">😕</p>
            <p className="mt-2 font-semibold text-red-800">Couldn't process that</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <p className="mt-2 text-xs text-red-500">
              Make sure the backend is running at <code>{API_BASE}</code>.
            </p>
            <button
              onClick={reset}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {status === "done" && data && <Results data={data} onReset={reset} />}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        MedScan AI · HealthTech demo for Vihaan X · Built with React + Node
      </footer>
    </div>
  );
}

function FeatureRow() {
  const items = [
    { icon: "🤖", title: "AI decoding", text: "Reads even messy handwriting." },
    { icon: "🗓️", title: "Auto schedule", text: "Morning to night, organized." },
    { icon: "⚠️", title: "Safety checks", text: "Flags risky combinations." },
    { icon: "🌐", title: "Multilingual", text: "English, Hindi & more." },
  ];
  return (
    <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"
        >
          <div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-xl">
            {it.icon}
          </div>
          <div className="text-sm font-bold text-slate-800">{it.title}</div>
          <div className="text-xs text-slate-400">{it.text}</div>
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
