
/* =========================================================
   🧠 GLOBAL JET LAG PLANNER — 1/3
   CORE ENGINE + TIMEZONE + AUTOCOMPLETE FIX (ADDED ONLY)
========================================================= */


/* -------------------------
   GLOBAL LOCK
------------------------- */

let __isRunning = false;


/* -------------------------
   UNIVERSAL TIMEZONE ENGINE
------------------------- */

function getUTCOffset(timeZone) {

    try {

        const now = new Date();
        const utc = now.getTime();

        const tzString = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }).format(now);

        const [datePart, timePart] = tzString.split(", ");

        const [month, day, year] = datePart.split("/").map(Number);
        const [hour, minute, second] = timePart.split(":").map(Number);

        const tzTime = Date.UTC(
            year,
            month - 1,
            day,
            hour,
            minute,
            second
        );

        return (tzTime - utc) / 3600000;

    } catch (e) {
        console.warn("Timezone error:", timeZone);
        return 0;
    }
}


/* -------------------------
   GLOBAL DIFF ENGINE
------------------------- */

function diffHours(from, to) {
    return getUTCOffset(to) - getUTCOffset(from);
}


/* -------------------------
   ALIAS SYSTEM (kept as-is)
------------------------- */

const ALIAS = {
    "hong kong": "Asia/Hong_Kong",
    "hk": "Asia/Hong_Kong",
    "los angeles": "America/Los_Angeles",
    "la": "America/Los_Angeles",
    "new york": "America/New_York",
    "ny": "America/New_York",
    "london": "Europe/London",
    "tokyo": "Asia/Tokyo",
    "sydney": "Australia/Sydney"
};

const TIMEZONES = Intl.supportedValuesOf("timeZone");


/* -------------------------
   FUZZY RESOLVER (unchanged logic)
------------------------- */

function scoreMatch(input, target) {

    input = input.toLowerCase();
    target = target.toLowerCase();

    if (target.includes(input)) return 2;

    let score = 0;

    for (let i = 0; i < input.length; i++) {
        if (target[i] === input[i]) score++;
    }

    return score / target.length;
}

function resolveTimezone(input) {

    const key = input.trim().toLowerCase();

    if (ALIAS[key]) return ALIAS[key];

    let best = null;
    let bestScore = 0;

    for (const tz of TIMEZONES) {

        const s = scoreMatch(key, tz);

        if (s > bestScore) {
            bestScore = s;
            best = tz;
        }
    }

    return best || "UTC";
}


/* =========================================================
   🔥 ADDED FIX: AUTOCOMPLETE UI (THIS WAS MISSING)
   (DO NOT REMOVE ANY OF YOUR LOGIC ABOVE)
========================================================= */

function setupAutocomplete(inputId, listId) {

    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);

    if (!input || !list) return;

    input.addEventListener("input", () => {

        const val = input.value.trim().toLowerCase();
        list.innerHTML = "";

        if (!val) {
            list.style.display = "none";
            return;
        }

        const matches = TIMEZONES
            .filter(tz => tz.toLowerCase().includes(val))
            .slice(0, 8);

        if (matches.length === 0) {
            list.style.display = "none";
            return;
        }

        matches.forEach(tz => {

            const div = document.createElement("div");
            div.textContent = tz;

            div.onclick = () => {
                input.value = tz;
                list.style.display = "none";
            };

            list.appendChild(div);
        });

        list.style.display = "block";
    });

    document.addEventListener("click", (e) => {
        if (!input.contains(e.target)) {
            list.style.display = "none";
        }
    });
}


/* -------------------------
   INIT AUTOCOMPLETE (IMPORTANT)
------------------------- */

setupAutocomplete("fromInput", "fromList");
setupAutocomplete("toInput", "toList");


/* -------------------------
   MODEL FUNCTIONS (unchanged)
------------------------- */

function flightFactor(h) {
    if (h < 3) return 0.85;
    if (h < 6) return 1;
    if (h < 10) return 1.2;
    return 1.4;
}

function chronotypeFactor(type) {
    if (type === "morning") return 0.9;
    if (type === "night") return 1.2;
    return 1;
}

function recovery(diff) {
    const abs = Math.abs(diff);
    const base = abs * 0.6;

    return {
        min: Math.max(1, Math.round(base * 0.7)),
        max: Math.round(base * 1.3)
    };
}

function curve(i, n) {
    const x = i / (n - 1 || 1);
    return 1 - Math.exp(-2.5 * x);
}


/* -------------------------
   TIME FORMAT
------------------------- */

function format(mins) {

    mins = ((mins % 1440) + 1440) % 1440;

    let h = Math.floor(mins / 60);
    let m = mins % 60;

    let ampm = h >= 12 ? "PM" : "AM";

    h = h % 12 || 12;

    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* =========================================================
   🧠 GLOBAL JET LAG PLANNER — 2/3
   CALCULATION ENGINE (CONNECTED VERSION)
========================================================= */


/* -------------------------
   MAIN FUNCTION
------------------------- */

function calculate() {

    console.log("Generate clicked");

    if (__isRunning) return;
    __isRunning = true;

    try {

        /* -------------------------
           UI ELEMENTS
        ------------------------- */

        const schedule = document.getElementById("schedule");
        const tips = document.getElementById("tips");
        const timeline = document.getElementById("timeline");

        if (!schedule || !tips || !timeline) {
            alert("Missing UI containers");
            return;
        }

        schedule.innerHTML = "";
        tips.innerHTML = "";
        timeline.innerHTML = "";

        /* -------------------------
           INPUTS
        ------------------------- */

        const fromRaw = document.getElementById("fromInput")?.value || "";
        const toRaw = document.getElementById("toInput")?.value || "";

        let days = Number(document.getElementById("days")?.value);
        if (!Number.isFinite(days) || days < 1) days = 3;
        if (days > 14) days = 14;

        const flightTime = document.getElementById("flightTime")?.value;

        const chronotype =
            document.getElementById("chronotype")?.value || "neutral";

        if (!fromRaw || !toRaw) {
            alert("Please enter origin and destination");
            return;
        }

        /* -------------------------
           RESOLVE TIMEZONES (USING YOUR ALGORITHM)
        ------------------------- */

        const from = resolveTimezone(fromRaw);
        const to = resolveTimezone(toRaw);

        /* -------------------------
           CORE TIME DIFFERENCE
        ------------------------- */

        const baseDiff = diffHours(from, to);
        const absDiff = Math.abs(baseDiff);

        /* DO NOT distort raw diff — only model adjustment */
        const adjustedDiff =
            baseDiff *
            flightFactor(absDiff) *
            chronotypeFactor(chronotype);

        const diff = Math.round(adjustedDiff);

        /* -------------------------
           OUTPUT STATS
        ------------------------- */

        document.getElementById("timeDifference").innerText =
            diff + " hrs";

        document.getElementById("risk").innerText =
            absDiff > 10 ? "Very High" :
            absDiff > 6 ? "High" :
            absDiff > 3 ? "Medium" : "Low";

        const rec = recovery(diff);

        document.getElementById("recovery").innerText =
            `${rec.min}–${rec.max} days`;

        /* -------------------------
           PREP SCORE
        ------------------------- */

        const prep = Math.min(100, Math.round((days / 7) * 100));

        document.getElementById("prep").innerText = prep + "%";

        const fill = document.getElementById("adjustmentFill");
        const fillText = document.getElementById("adjustmentText");

        if (fill) fill.style.width = prep + "%";
        if (fillText) fillText.innerText = prep + "%";

        /* -------------------------
           SCHEDULE GENERATION
        ------------------------- */

        let baseSleep = 23 * 60;
        let baseWake = 7 * 60;

        for (let i = 0; i < days; i++) {

            const shift = diff * curve(i, days);

            let sleep = (baseSleep + shift * 60 + 1440) % 1440;
            let wake = (baseWake + shift * 60 + 1440) % 1440;

            schedule.innerHTML += `
                <div class="day-card">
                    <h3>Day ${i + 1}</h3>
                    <p>😴 Sleep: ${format(sleep)}</p>
                    <p>⏰ Wake: ${format(wake)}</p>
                    <p>☀️ Light: ${format(wake + 60)}</p>
                    <p>☕ No caffeine after ${format(sleep - 300)}</p>
                </div>
            `;
        }

        /* -------------------------
           FLIGHT INFO
        ------------------------- */

        document.getElementById("departureTime").innerText =
            flightTime || "--";

        document.getElementById("planeSleep").innerText =
            diff > 0 ? "Sleep early on plane" : "Sleep mid-flight";

        document.getElementById("flightCoffee").innerText =
            "No caffeine 6–8h before flight";

        document.getElementById("hydration").innerText =
            "Drink water hourly";

        /* -------------------------
           ARRIVAL PLAN
        ------------------------- */

        document.getElementById("arrivalCard").innerHTML = `
            <p>☀ Get sunlight immediately</p>
            <p>🚶 Walk 20–40 min</p>
            <p>😴 Stay awake until local night</p>
            <p>🚫 Avoid long naps</p>
        `;

        /* -------------------------
           TIPS
        ------------------------- */

        tips.innerHTML = `
            <li>Shift sleep gradually</li>
            <li>Use light exposure strategically</li>
            <li>Avoid caffeine late in day</li>
        `;

        /* -------------------------
           TIMELINE
        ------------------------- */

        ["Reset", "Shift", "Adapt", "Stable"].forEach(t => {
            timeline.innerHTML += `
                <div class="timeline-item">
                    <h4>${t}</h4>
                </div>
            `;
        });

    } catch (err) {
        console.warn("Calculation error:", err);
    } finally {
        __isRunning = false;
    }
}

/* =========================================================
   🧠 GLOBAL JET LAG PLANNER — 3/3
   FINAL STABILITY + UI + ANIMATION FIX LAYER
========================================================= */


/* -------------------------
   SAFE BUTTON BINDING
   (prevents missing event issues)
------------------------- */

window.addEventListener("DOMContentLoaded", () => {

    const btn = document.getElementById("generateBtn");

    if (btn && !btn.dataset.bound) {
        btn.addEventListener("click", calculate);
        btn.dataset.bound = "true";
    }
});


/* -------------------------
   GLOBAL EXECUTION LOCK (extra safety)
------------------------- */

window.__lock = false;


/* -------------------------
   UI RESET SAFETY
   (prevents stacking / duplicate render bugs)
------------------------- */

function resetUI() {

    const schedule = document.getElementById("schedule");
    const tips = document.getElementById("tips");
    const timeline = document.getElementById("timeline");

    if (schedule) schedule.innerHTML = "";
    if (tips) tips.innerHTML = "";
    if (timeline) timeline.innerHTML = "";

    restartAnimation(schedule);
}


/* -------------------------
   ANIMATION RESTART FIX
   (fixes “only works once” issue)
------------------------- */

function restartAnimation(el) {

    if (!el) return;

    el.style.animation = "none";
    el.offsetHeight; // force reflow
    el.style.animation = "";
}


/* -------------------------
   INPUT SANITIZER
   (prevents NaN / broken calculations)
------------------------- */

function sanitizeInputs() {

    const daysEl = document.getElementById("days");

    if (!daysEl) return;

    let v = Number(daysEl.value);

    if (!Number.isFinite(v) || v < 1) v = 3;
    if (v > 14) v = 14;

    daysEl.value = v;
}


/* -------------------------
   GLOBAL ERROR HANDLER
------------------------- */

window.addEventListener("error", (e) => {
    console.warn("JetLag runtime error:", e.message);
});


/* -------------------------
   FINAL WRAPPER AROUND calculate()
   (DO NOT REMOVE — THIS IS WHAT MAKES IT STABLE)
------------------------- */

const __originalCalculate = calculate;

calculate = function () {

    console.log("Generate clicked (stable wrapper)");

    if (window.__lock) return;
    window.__lock = true;

    try {

        sanitizeInputs();
        resetUI();

        return __originalCalculate();

    } catch (err) {

        console.warn("Safe catch:", err);

    } finally {

        window.__lock = false;
    }
};