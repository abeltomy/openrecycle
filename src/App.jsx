import React, { useState, useMemo, useEffect, useRef } from "react";

/* ============================================================
   OPEN RECYCLE — web app
   One document. Product edits drive the flow, the flow drives
   the rating, conformance is checked against the spec live.
   Components and elements are both user-extensible.
   ============================================================ */

const ELEMENT_BASE = {
  Fe: { name: "Iron", color: "#4a4a4a" },
  Al: { name: "Aluminium", color: "#5c7a99", critical: true },
  Cu: { name: "Copper", color: "#a0522d", critical: true },
  Au: { name: "Gold", color: "#b8860b" },
  Ag: { name: "Silver", color: "#9aa0a6" },
  Ni: { name: "Nickel", color: "#7a8b6f", critical: true },
  Co: { name: "Cobalt", color: "#2f6f4e", critical: true },
  Li: { name: "Lithium", color: "#3d8b8b", critical: true },
  Ta: { name: "Tantalum", color: "#a13d3d", critical: true },
  Sn: { name: "Tin", color: "#8a7a6d" },
  In: { name: "Indium", color: "#b06a8a", critical: true },
  C: { name: "Graphite", color: "#33363b", critical: true },
  POL: { name: "Polymers", color: "#8a8560" },
  GLS: { name: "Glass", color: "#6f8a94" },
};
const NEW_COLORS = ["#6b5b95", "#8a5a3c", "#3f6f8a", "#7a6a2e", "#5a7a5a", "#8a4a6a", "#4a5a7a", "#7a5a4a"];

const allElements = (doc) => ({ ...ELEMENT_BASE, ...(doc.elements || {}) });

const QUALITY = {
  C0: { label: "Closed loop", color: "#123f6d", w: 1.0 },
  C1: { label: "High-quality open loop", color: "#1d7a7a", w: 0.8 },
  C2: { label: "Downcycled", color: "#8a7f2a", w: 0.45 },
  C3: { label: "Feedstock recovery", color: "#a06a1f", w: 0.25 },
  C4: { label: "Energy recovery", color: "#b45309", w: 0.05 },
  C5: { label: "Dissipative loss", color: "#8a2b2b", w: 0.0 },
};
const QK = Object.keys(QUALITY);

const SEP = {
  D0: { label: "Automatic", eff: 0.99 }, D1: { label: "Tool-less", eff: 0.97 },
  D2: { label: "Hand tool", eff: 0.93 }, D3: { label: "Specialist tool", eff: 0.85 },
  D4: { label: "Thermal / chemical", eff: 0.7 }, D5: { label: "Destructive", eff: 0.55 },
  D6: { label: "Inseparable", eff: 0.25 },
};
const EVIDENCE = { E0: "Self-declared", E1: "Manufacturer doc", E2: "Engineering calc", E3: "Process simulation", E4: "Recycling trial", E5: "Verified industrial" };

/* ---------- seed ---------- */
const seedComponents = () => [
  { id: "display", name: "Display module", mass: 40, sep: "D2", tool: "Screwdriver", time: 95, comp: { GLS: 22, POL: 9, Al: 4, Cu: 1.5, In: 0.03, Fe: 0.8 } },
  { id: "battery", name: "Battery", mass: 40, sep: "D1", tool: "Hand", time: 8, hazard: "Stored energy", comp: { Li: 0.95, Co: 4.2, Ni: 2.1, Cu: 7, Al: 6.5, C: 7, POL: 4.5, Fe: 1.5 } },
  { id: "mainboard", name: "Mainboard / PCBA", mass: 25, sep: "D2", tool: "Screwdriver", time: 120, comp: { Cu: 6, Sn: 1.2, Au: 0.025, Ag: 0.3, Ta: 0.35, Ni: 0.4, Fe: 0.9, Al: 0.8, POL: 8, GLS: 4.5 } },
  { id: "frame", name: "Structural frame", mass: 25, sep: "D2", tool: "Screwdriver", time: 140, comp: { Al: 14, Fe: 3.2, POL: 4, Cu: 0.6 } },
  { id: "cover", name: "Back cover", mass: 25, sep: "D1", tool: "Hand", time: 6, comp: { POL: 23, Fe: 0.3 } },
  { id: "camera", name: "Camera module", mass: 5, sep: "D1", tool: "Hand", time: 20, comp: { POL: 2, Al: 0.7, Cu: 0.6, Fe: 0.6, GLS: 0.8 } },
  { id: "speaker", name: "Speaker module", mass: 5, sep: "D1", tool: "Hand", time: 25, comp: { Fe: 1.8, Cu: 0.9, POL: 1.5, Al: 0.2 } },
  { id: "usb", name: "USB / bottom module", mass: 3, sep: "D1", tool: "Hand", time: 20, comp: { Cu: 0.7, POL: 1.2, Fe: 0.4, Sn: 0.15, Au: 0.003 } },
];

/* ---------- node library ---------- */
const LIB = {
  feed: { kind: "source", label: "Product feed", ports: ["out"] },
  dismantle: {
    kind: "process", label: "Manual dismantling", ports: ["battery", "board", "housing", "rest"], usesConnections: true,
    splits: {
      _: { rest: 1 },
      Li: { battery: 1 }, Co: { battery: 1 }, C: { battery: 1 }, Ni: { battery: 0.85, board: 0.15 },
      Au: { board: 1 }, Ag: { board: 1 }, Ta: { board: 1 }, Sn: { board: 1 },
      Cu: { battery: 0.35, board: 0.35, rest: 0.3 },
      POL: { housing: 0.6, board: 0.2, rest: 0.2 }, GLS: { housing: 0.15, board: 0.15, rest: 0.7 },
      Al: { battery: 0.2, rest: 0.8 },
    },
  },
  shredder: { kind: "process", label: "Shredder", ports: ["coarse", "fines"], splits: { _: { coarse: 0.85, fines: 0.15 }, Au: { coarse: 0.72, fines: 0.28 }, Ta: { coarse: 0.6, fines: 0.4 } } },
  magnet: { kind: "process", label: "Magnetic separation", ports: ["magnetic", "non-magnetic"], splits: { _: { magnetic: 0.03, "non-magnetic": 0.97 }, Fe: { magnetic: 0.95, "non-magnetic": 0.05 }, Ni: { magnetic: 0.5, "non-magnetic": 0.5 } } },
  eddy: { kind: "process", label: "Eddy-current separation", ports: ["conductive", "residue"], splits: { _: { conductive: 0.05, residue: 0.95 }, Al: { conductive: 0.9, residue: 0.1 }, Cu: { conductive: 0.85, residue: 0.15 } } },
  sensorsort: { kind: "process", label: "Density / optical sorting", ports: ["polymer", "glass", "heavy"], splits: { _: { polymer: 0.05, glass: 0.05, heavy: 0.9 }, POL: { polymer: 0.8, glass: 0.02, heavy: 0.18 }, GLS: { polymer: 0.05, glass: 0.7, heavy: 0.25 } } },
  smelter: {
    kind: "process", label: "Cu-carrier smelting", ports: ["metal", "slag", "off-gas"],
    splits: {
      _: { slag: 1 }, Cu: { metal: 0.95, slag: 0.04, "off-gas": 0.01 }, Au: { metal: 0.98, slag: 0.02 },
      Ag: { metal: 0.97, slag: 0.03 }, Ni: { metal: 0.88, slag: 0.12 }, Co: { metal: 0.88, slag: 0.12 },
      Sn: { metal: 0.55, slag: 0.35, "off-gas": 0.1 }, Fe: { metal: 0.05, slag: 0.95 }, Al: { metal: 0.02, slag: 0.98 },
      POL: { "off-gas": 1 }, C: { "off-gas": 1 },
    },
  },
  batteryprep: { kind: "process", label: "Battery pre-treatment", ports: ["black mass", "casing"], splits: { _: { "black mass": 0.2, casing: 0.8 }, Li: { "black mass": 0.95, casing: 0.05 }, Co: { "black mass": 0.95, casing: 0.05 }, Ni: { "black mass": 0.9, casing: 0.1 }, C: { "black mass": 0.9, casing: 0.1 }, Cu: { "black mass": 0.3, casing: 0.7 }, Al: { "black mass": 0.1, casing: 0.9 } } },
  hydromet: { kind: "process", label: "Hydrometallurgical leach", ports: ["product", "residue"], splits: { _: { residue: 1 }, Li: { product: 0.6, residue: 0.4 }, Co: { product: 0.95, residue: 0.05 }, Ni: { product: 0.93, residue: 0.07 }, Cu: { product: 0.9, residue: 0.1 } } },
  polymerproc: { kind: "process", label: "Polymer regranulation", ports: ["regranulate", "reject"], splits: { _: { reject: 1 }, POL: { regranulate: 0.55, reject: 0.45 } } },
  glassproc: { kind: "process", label: "Glass processing", ports: ["cullet", "reject"], splits: { _: { reject: 1 }, GLS: { cullet: 0.65, reject: 0.35 } } },
  remelt: { kind: "process", label: "Light-metal remelting", ports: ["ingot", "dross"], splits: { _: { dross: 1 }, Al: { ingot: 0.92, dross: 0.08 }, Fe: { ingot: 0.1, dross: 0.9 } } },
  eaf: { kind: "process", label: "Steel EAF", ports: ["steel", "slag", "dust"], splits: { _: { slag: 0.8, dust: 0.2 }, Fe: { steel: 0.94, slag: 0.04, dust: 0.02 }, Ni: { steel: 0.9, slag: 0.1 }, Cu: { steel: 0.85, slag: 0.15 }, Al: { slag: 1 }, POL: { dust: 1 } } },
  splitter: { kind: "process", label: "Custom split", ports: ["A", "B", "C"], splits: { _: { A: 1 } } },
  sinkC0: { kind: "sink", label: "Closed-loop material", quality: "C0", ports: [] },
  sinkC1: { kind: "sink", label: "Open-loop material", quality: "C1", ports: [] },
  sinkC2: { kind: "sink", label: "Downcycled material", quality: "C2", ports: [] },
  sinkC3: { kind: "sink", label: "Feedstock recovery", quality: "C3", ports: [] },
  sinkEnergy: { kind: "sink", label: "Energy recovery", quality: "C4", ports: [] },
  sinkSlag: { kind: "sink", label: "Slag", quality: "C5", ports: [] },
  sinkLand: { kind: "sink", label: "Residue / landfill", quality: "C5", ports: [] },
};

let uid = 0;
const nid = () => `n${++uid}`;
function seedGraph() {
  uid = 0;
  const n = (type, x, y) => ({ id: nid(), type, x, y, label: LIB[type].label, splits: LIB[type].splits ? JSON.parse(JSON.stringify(LIB[type].splits)) : undefined, quality: LIB[type].quality });
  const f = n("feed", 20, 220), d = n("dismantle", 230, 180), b = n("batteryprep", 470, 30),
    h = n("hydromet", 690, 30), s = n("smelter", 470, 240), p = n("polymerproc", 470, 420),
    c0 = n("sinkC0", 920, 70), c2 = n("sinkC2", 920, 200), sl = n("sinkSlag", 920, 300),
    la = n("sinkLand", 920, 380), en = n("sinkEnergy", 920, 460);
  const e = (a, port, to) => ({ id: `${a}-${port}-${to}`, from: a, port, to });
  return {
    nodes: [f, d, b, h, s, p, c0, c2, sl, la, en],
    edges: [
      e(f.id, "out", d.id), e(d.id, "battery", b.id), e(d.id, "board", s.id),
      e(d.id, "housing", p.id), e(d.id, "rest", s.id), e(b.id, "black mass", h.id),
      e(b.id, "casing", s.id), e(h.id, "product", c0.id), e(h.id, "residue", la.id),
      e(s.id, "metal", c0.id), e(s.id, "slag", sl.id), e(s.id, "off-gas", en.id),
      e(p.id, "regranulate", c2.id), e(p.id, "reject", en.id),
    ],
  };
}

const seedDoc = () => ({
  product: { name: "Modular smartphone", category: "Smartphone", year: 2015, architecture: "modular", evidence: "E0", issuer: "" },
  elements: {},
  components: seedComponents(),
  graph: seedGraph(),
});

/* ---------- blank project ---------- */
function blankGraph() {
  uid = 0;
  const f = { id: nid(), type: "feed", x: 40, y: 200, label: LIB.feed.label, splits: undefined, quality: undefined };
  return { nodes: [f], edges: [] };
}
const blankDoc = () => ({
  product: { name: "Untitled product", category: "", year: new Date().getFullYear(), architecture: "", evidence: "E0", issuer: "" },
  elements: {},
  components: [],
  graph: blankGraph(),
});

/* ---------- project files (save/open on the user's own machine) ----------
   Distinct from exportJSON's published "record": this is the full editable
   document, round-tripped so work can be closed and resumed later. */
const PROJECT_KIND = "open-recycle-project";
const serializeProject = (doc) => JSON.stringify({ kind: PROJECT_KIND, version: 1, savedAt: new Date().toISOString(), doc }, null, 2);
const parseProject = (text) => {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { ok: false, error: "That file is not valid JSON." }; }
  const raw = parsed && parsed.kind === PROJECT_KIND && parsed.doc ? parsed.doc : parsed;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.components) || !raw.graph || !Array.isArray(raw.graph.nodes) || !Array.isArray(raw.graph.edges)) {
    return { ok: false, error: "That file doesn't look like an Open Recycle project." };
  }
  const blank = blankDoc();
  const components = raw.components.map((c, i) => ({
    id: c.id || `c${i}${Date.now().toString(36)}`, name: c.name || "Component", mass: c.mass || 0,
    sep: SEP[c.sep] ? c.sep : "D2", tool: c.tool || "", time: c.time || 0, hazard: c.hazard || "",
    comp: c.comp && typeof c.comp === "object" ? c.comp : {}, source: c.source || undefined,
  }));
  return { ok: true, doc: { product: { ...blank.product, ...(raw.product || {}) }, elements: raw.elements || {}, components, graph: raw.graph } };
};
const supportsFilePicker = typeof window !== "undefined" && "showSaveFilePicker" in window;

/* ---------- solver ---------- */
function solve(doc) {
  const def = allElements(doc);
  const els = Object.keys(def);
  const { graph, components } = doc;
  const empty = () => Object.fromEntries(els.map((k) => [k, 0]));

  const feed = empty();
  components.forEach((c) => els.forEach((el) => (feed[el] += c.comp[el] || 0)));

  const sepEff = {};
  els.forEach((el) => {
    let num = 0, den = 0;
    components.forEach((c) => { const m = c.comp[el] || 0; num += m * SEP[c.sep].eff; den += m; });
    sepEff[el] = den ? num / den : 1;
  });

  const nodeIn = {}, edgeFlow = {}, unacc = {};
  graph.nodes.forEach((n) => (nodeIn[n.id] = empty()));

  for (let pass = 0; pass < graph.nodes.length + 4; pass++) {
    const next = {};
    graph.nodes.forEach((n) => (next[n.id] = empty()));
    graph.nodes.forEach((n) => {
      const lib = LIB[n.type];
      const out = {};
      if (lib.kind === "source") {
        out.out = { ...feed };
      } else if (lib.kind === "process") {
        lib.ports.forEach((p) => (out[p] = empty()));
        const inp = nodeIn[n.id];
        let u = 0;
        els.forEach((el) => {
          let row = { ...((n.splits && (n.splits[el] || n.splits._)) || {}) };
          if (lib.usesConnections) {
            const k = sepEff[el];
            let spill = 0;
            lib.ports.filter((p) => p !== "rest").forEach((p) => {
              if (row[p]) { spill += row[p] * (1 - k); row[p] = row[p] * k; }
            });
            row.rest = (row.rest || 0) + spill;
          }
          let sent = 0;
          lib.ports.forEach((p) => { const f = row[p] || 0; out[p][el] += inp[el] * f; sent += f; });
          u += inp[el] * Math.max(0, 1 - sent);
        });
        unacc[n.id] = u;
      }
      graph.edges.filter((e) => e.from === n.id).forEach((e) => {
        const st = out[e.port];
        if (!st || !next[e.to]) return;
        edgeFlow[e.id] = st;
        els.forEach((el) => (next[e.to][el] += st[el]));
      });
    });
    graph.nodes.forEach((n) => (nodeIn[n.id] = next[n.id]));
  }

  const byQ = Object.fromEntries(els.map((el) => [el, Object.fromEntries(QK.map((q) => [q, 0]))]));
  graph.nodes.filter((n) => LIB[n.type].kind === "sink").forEach((n) => {
    const q = n.quality || LIB[n.type].quality || "C5";
    els.forEach((el) => (byQ[el][q] += nodeIn[n.id][el]));
  });
  els.forEach((el) => {
    const placed = QK.reduce((s, q) => s + byQ[el][q], 0);
    byQ[el].C5 += Math.max(0, feed[el] - placed);
  });

  const elem = {};
  els.forEach((el) => {
    const init = feed[el] || 0, q = byQ[el];
    const material = q.C0 + q.C1 + q.C2 + q.C3;
    elem[el] = {
      init, byQ: q, material, recovery: init ? material / init : 0,
      index: init ? QK.reduce((s, k) => s + q[k] * QUALITY[k].w, 0) / init : 0,
      lost: q.C5, energy: q.C4,
    };
  });

  const sum = (f) => els.reduce((s, el) => s + f(el), 0);
  const feedT = sum((el) => feed[el]);
  const matT = sum((el) => elem[el].material);
  const critI = sum((el) => (def[el].critical ? feed[el] : 0));
  const critM = sum((el) => (def[el].critical ? elem[el].material : 0));
  const present = els.filter((el) => feed[el] > 0);

  return {
    def, els, feed, elem, nodeIn, edgeFlow, unacc, sepEff, present,
    totals: {
      feed: feedT, material: matT, energy: sum((el) => elem[el].energy), lost: sum((el) => elem[el].lost),
      rate: feedT ? matT / feedT : 0,
      closed: feedT ? sum((el) => elem[el].byQ.C0) / feedT : 0,
      critical: critI ? critM / critI : 0,
      index: feedT ? sum((el) => QK.reduce((s, k) => s + byQ[el][k] * QUALITY[k].w, 0)) / feedT : 0,
      perElement: present.length ? present.reduce((s, el) => s + elem[el].index, 0) / present.length : 0,
      breadth: present.length ? present.filter((el) => elem[el].recovery >= 0.5).length / present.length : 0,
      weakest: present.length ? present.reduce((a, b) => (elem[b].index < elem[a].index ? b : a), present[0]) : null,
    },
  };
}

function grade(i) {
  if (i >= 0.78) return { g: "A", note: "Most mass returns at equivalent or high function" };
  if (i >= 0.62) return { g: "B", note: "Good recovery, quality lost in places" };
  if (i >= 0.45) return { g: "C", note: "Recovers mass, loses function" };
  if (i >= 0.28) return { g: "D", note: "Largely downcycled or burned" };
  return { g: "E", note: "Most material is dissipated" };
}

/* ---------- evidence floor ----------
   A record inherits the weakest evidence among itself and every component
   it imports. One self-declared supplier part sets the floor for the whole
   product. */
const EV_ORDER = ["E0", "E1", "E2", "E3", "E4", "E5"];
const minEvidence = (a, b) => (EV_ORDER.indexOf(a) <= EV_ORDER.indexOf(b) ? a : b);
const effectiveEvidence = (doc) =>
  doc.components.reduce((acc, c) => (c.source ? minEvidence(acc, c.source.evidence || "E0") : acc), doc.product.evidence);

/* ---------- conformance ---------- */
function conformance(doc, res) {
  const massSum = doc.components.reduce((s, c) => s + c.mass, 0);
  const compGap = doc.components.map((c) => {
    const m = Object.values(c.comp).reduce((a, b) => a + b, 0);
    return { id: c.id, name: c.name, declared: c.mass, modelled: m, gap: c.mass - m };
  });
  const worst = compGap.reduce((a, b) => (Math.abs(b.gap / (b.declared || 1)) > Math.abs(a.gap / (a.declared || 1)) ? b : a), compGap[0] || { gap: 0, declared: 1, name: "" });

  const terminalPorts = [];
  doc.graph.nodes.filter((n) => LIB[n.type].kind === "process").forEach((n) =>
    LIB[n.type].ports.forEach((p) => { if (!doc.graph.edges.some((e) => e.from === n.id && e.port === p)) terminalPorts.push(`${n.label} → ${p}`); })
  );
  const unaccTotal = Object.values(res.unacc).reduce((a, b) => a + b, 0);
  const sinks = doc.graph.nodes.filter((n) => LIB[n.type].kind === "sink");

  const checks = [
    { lvl: "L1", label: "At least one component declared", ok: doc.components.length > 0 },
    { lvl: "L1", label: "Every component has a mass", ok: doc.components.every((c) => c.mass > 0), detail: doc.components.filter((c) => !(c.mass > 0)).map((c) => c.name).join(", ") || null },
    { lvl: "L1", label: "Every component has a composition", ok: doc.components.every((c) => Object.keys(c.comp).length > 0), detail: doc.components.filter((c) => !Object.keys(c.comp).length).map((c) => c.name).join(", ") || null },
    { lvl: "L1", label: "Composition within 1% of declared mass", ok: compGap.every((c) => Math.abs(c.gap) / (c.declared || 1) <= 0.01), detail: worst && Math.abs(worst.gap) > 0.001 ? `${worst.name} is off by ${worst.gap.toFixed(2)} g` : null },
    { lvl: "L2", label: "Every component carries a separation class", ok: doc.components.every((c) => !!c.sep) },
    { lvl: "L2", label: "Disassembly time recorded for every component", ok: doc.components.every((c) => c.time > 0), detail: doc.components.filter((c) => !(c.time > 0)).map((c) => c.name).join(", ") || null },
    { lvl: "L3", label: "At least one route reaches a terminal sink", ok: sinks.length > 0 && res.totals.material > 0 },
    { lvl: "L3", label: "No process output port left unconnected", ok: terminalPorts.length === 0, detail: terminalPorts.length ? `${terminalPorts.length} open: ${terminalPorts.slice(0, 3).join(", ")}` : null },
    { lvl: "L3", label: "Split fractions leave nothing unaccounted", ok: unaccTotal < 0.01 * (res.totals.feed || 1), detail: unaccTotal > 0.005 ? `${unaccTotal.toFixed(2)} g unaccounted` : null },
    {
      lvl: "L4", label: "Composition evidence above E0", ok: effectiveEvidence(doc) !== "E0",
      detail: (() => {
        const weakImport = doc.components.find((c) => c.source && (c.source.evidence || "E0") === "E0");
        if (weakImport) return `${weakImport.name} was imported at E0 from ${weakImport.source.issuer}, which sets the floor for the whole record`;
        if (doc.product.evidence === "E0") return "Self-declared with no cited source";
        return `Floor is ${effectiveEvidence(doc)} across the product and its imported components`;
      })(),
    },
    { lvl: "L5", label: "Recovery values at E4 or E5", ok: false, detail: "Recovery here is simulated, not measured" },
  ];

  const levels = ["L1", "L2", "L3", "L4", "L5"];
  let reached = null;
  for (const l of levels) {
    const upTo = levels.slice(0, levels.indexOf(l) + 1);
    if (checks.filter((c) => upTo.includes(c.lvl)).every((c) => c.ok)) reached = l; else break;
  }
  return { checks, level: reached, massSum, compGap, unaccTotal };
}

/* ---------- helpers ---------- */
const NW = 176, HDR = 26, ROW = 19;
const portY = (i) => HDR + 10 + i * ROW;
const g1 = (x) => (x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x >= 0.01 ? x.toFixed(3) : x.toFixed(4));
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const pct0 = (x) => `${(x * 100).toFixed(0)}%`;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "component";

const NAV = [
  { k: "home", label: "Overview", hint: "What it is, method, ranking, sources" },
  { k: "product", label: "Product", hint: "Components, composition, connections" },
  { k: "flow", label: "Process flow", hint: "Wire up the recycling chain" },
  { k: "figures", label: "Figures", hint: "Carrier wheel and material fate" },
  { k: "rating", label: "Rating", hint: "Grade and per-element circularity" },
  { k: "record", label: "Record", hint: "Conformance and export" },
  { k: "examples", label: "Examples", hint: "Bundled sample records to explore" },
  { k: "spec", label: "Specification", hint: "The scales and the rules" },
];

const EXAMPLE_FILES = [
  {
    path: "../examples/fairphone-2.example.json",
    file: "fairphone-2.example.json",
    title: "Fairphone 2 — worked example",
    kind: "record",
    blurb: "Research reference case built around the Reuter, van Schaik & Ballester (2018) study. Deliberately incomplete: element-level composition and recovery are left as required-missing so the record shows its holes instead of inventing numbers. Only the published route aggregates carry real values.",
  },
  {
    path: "../examples/example-supplier-component.json",
    file: "example-supplier-component.json",
    title: "Supplier component record",
    kind: "component",
    blurb: "An illustrative component record of the kind a supplier could publish — a prismatic cell module at evidence E2. Use it to see how Product → Import supplier component locks composition to the issuer's declaration and pulls the record's evidence floor down with it.",
  },
];

/* ============================================================ */
export default function OpenRecycleApp() {
  const [doc, setDoc] = useState(seedDoc);
  const [view, setView] = useState("home");
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [fileMsg, setFileMsg] = useState(null);
  const savedSnapshot = useRef(JSON.stringify(seedDoc()));
  const openInputRef = useRef(null);
  const res = useMemo(() => solve(doc), [doc]);
  const conf = useMemo(() => conformance(doc, res), [doc, res]);
  const G = grade(res.totals.index);

  useEffect(() => { setDirty(JSON.stringify(doc) !== savedSnapshot.current); }, [doc]);
  useEffect(() => {
    const onLeave = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveProject(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const loadDoc = (nextDoc, handle, name) => {
    setDoc(nextDoc);
    setFileHandle(handle || null);
    setFileName(name || null);
    savedSnapshot.current = JSON.stringify(nextDoc);
    setDirty(false);
  };

  const confirmDiscard = (verb) => !dirty || window.confirm(`Discard unsaved changes and ${verb}?`);

  const newProject = () => {
    if (!confirmDiscard("start a new project")) return;
    loadDoc(blankDoc(), null, null);
  };

  const downloadProjectFile = (data) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = `${slug(doc.product.name)}.open-recycle-project.json`;
    a.click();
  };

  const saveProject = async (forceNewFile) => {
    const data = serializeProject(doc);
    if (supportsFilePicker) {
      try {
        let handle = forceNewFile ? null : fileHandle;
        if (!handle) {
          handle = await window.showSaveFilePicker({
            suggestedName: `${slug(doc.product.name)}.open-recycle-project.json`,
            types: [{ description: "Open Recycle project", accept: { "application/json": [".json"] } }],
          });
        }
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        setFileHandle(handle);
        setFileName(handle.name);
        savedSnapshot.current = JSON.stringify(doc);
        setDirty(false);
        setFileMsg({ ok: true, text: `Saved to ${handle.name}.` });
      } catch (err) {
        if (err.name !== "AbortError") setFileMsg({ ok: false, text: `Could not save: ${err.message}` });
      }
    } else {
      downloadProjectFile(data);
      savedSnapshot.current = JSON.stringify(doc);
      setDirty(false);
      setFileMsg({ ok: true, text: "Downloaded as a project file." });
    }
  };

  const openProject = async () => {
    if (!confirmDiscard("open another project")) return;
    if (supportsFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: "Open Recycle project", accept: { "application/json": [".json"] } }],
        });
        const file = await handle.getFile();
        const text = await file.text();
        const out = parseProject(text);
        if (!out.ok) { setFileMsg({ ok: false, text: out.error }); return; }
        loadDoc(out.doc, handle, file.name);
        setFileMsg({ ok: true, text: `Opened ${file.name}.` });
      } catch (err) {
        if (err.name !== "AbortError") setFileMsg({ ok: false, text: `Could not open: ${err.message}` });
      }
    } else {
      openInputRef.current?.click();
    }
  };

  const onOpenInputChange = (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const out = parseProject(String(r.result));
      if (!out.ok) { setFileMsg({ ok: false, text: out.error }); return; }
      loadDoc(out.doc, null, f.name);
      setFileMsg({ ok: true, text: `Opened ${f.name}.` });
    };
    r.readAsText(f);
  };

  const setProduct = (p) => setDoc((d) => ({ ...d, product: { ...d.product, ...p } }));
  const setComponent = (id, patch) => setDoc((d) => ({ ...d, components: d.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const setGraph = (fn) => setDoc((d) => ({ ...d, graph: typeof fn === "function" ? fn(d.graph) : fn }));

  const addComponent = () => {
    const id = `c${Date.now().toString(36)}`;
    setDoc((d) => ({ ...d, components: [...d.components, { id, name: "New component", mass: 0, sep: "D2", tool: "", time: 0, comp: {} }] }));
    return id;
  };
  const removeComponent = (id) => setDoc((d) => ({ ...d, components: d.components.filter((c) => c.id !== id) }));
  const duplicateComponent = (id) => {
    const src = doc.components.find((c) => c.id === id);
    if (!src) return;
    setDoc((d) => ({ ...d, components: [...d.components, { ...src, id: `c${Date.now().toString(36)}`, name: `${src.name} copy`, comp: { ...src.comp } }] }));
  };
  const addElement = (symbol, name, critical) => {
    const sym = symbol.trim();
    if (!sym || allElements(doc)[sym]) return false;
    const used = Object.keys(doc.elements || {}).length;
    setDoc((d) => ({ ...d, elements: { ...(d.elements || {}), [sym]: { name: name.trim() || sym, color: NEW_COLORS[used % NEW_COLORS.length], critical: !!critical } } }));
    return true;
  };
  /* Import a component record published by another organisation.
     Composition is kept read-only and tagged with its issuer, so the
     product record never silently absorbs someone else's claim. */
  const importComponent = (text) => {
    let obj;
    try { obj = JSON.parse(text); } catch { return { ok: false, error: "That file is not valid JSON." }; }
    const rec = obj.component || (obj.recordType === "component" ? obj : null);
    if (!rec || !rec.name || !Array.isArray(rec.materials)) {
      return { ok: false, error: "No component found. Expected an Open Recycle record with recordType 'component', a name, and a materials array." };
    }
    const registry = obj.materialRegistry || {};
    const comp = {};
    rec.materials.forEach((m) => {
      const v = typeof m.mass === "object" ? m.mass?.value : m.mass;
      if (v > 0) comp[m.materialId] = v;
    });
    if (!Object.keys(comp).length) return { ok: false, error: "The component declares no material masses." };

    const known = allElements(doc);
    const unknown = Object.keys(comp).filter((k) => !known[k]);
    const undeclared = unknown.filter((k) => !registry[k]);
    const id = `imp${Date.now().toString(36)}`;
    const declared = typeof rec.mass === "object" ? rec.mass?.value : rec.mass;

    setDoc((d) => {
      const nextEls = { ...(d.elements || {}) };
      unknown.forEach((k) => {
        const meta = registry[k] || {};
        nextEls[k] = { name: meta.name || k, color: NEW_COLORS[Object.keys(nextEls).length % NEW_COLORS.length], critical: !!meta.critical };
      });
      return {
        ...d, elements: nextEls,
        components: [...d.components, {
          id, name: rec.name,
          mass: declared > 0 ? declared : Object.values(comp).reduce((a, b) => a + b, 0),
          sep: rec.separationClass || "D2",
          tool: rec.disassembly?.tool || "", time: rec.disassembly?.timeSeconds || 0,
          hazard: rec.hazard || "", comp,
          source: {
            issuer: obj.issuer?.organisation || "Unnamed issuer",
            published: obj.issuer?.published || null,
            evidence: obj.evidence || rec.evidence || "E0",
            integrity: obj.integrity?.value || null,
          },
        }],
      };
    });
    return { ok: true, id, issuer: obj.issuer?.organisation || "Unnamed issuer", evidence: obj.evidence || rec.evidence || "E0", unknown, undeclared };
  };

  /* Publish one component as a standalone record another organisation can import. */
  const exportComponent = (id) => {
    const c = doc.components.find((x) => x.id === id);
    if (!c) return;
    const payload = {
      $schema: "https://open-recycle.org/schema/0.1/open-recycle.schema.json",
      standard: "Open Recycle", version: "0.1-draft", recordType: "component",
      issuer: { organisation: doc.product.issuer || "Unnamed issuer", published: new Date().toISOString().slice(0, 10) },
      evidence: c.source ? c.source.evidence : doc.product.evidence,
      component: {
        id: c.id, name: c.name, mass: { value: c.mass, unit: "g" },
        separationClass: c.sep, hazard: c.hazard || null,
        disassembly: { tool: c.tool, timeSeconds: c.time },
        materials: Object.entries(c.comp).map(([m, v]) => ({ materialId: m, mass: { value: v, unit: "g" } })),
      },
      materialRegistry: Object.fromEntries(Object.keys(c.comp).map((k) => [k, { name: res.def[k].name, critical: !!res.def[k].critical }])),
      provenance: c.source
        ? { relayed: true, originalIssuer: c.source.issuer, note: "Relayed unchanged from the original issuer." }
        : { relayed: false, note: "Declared by the issuer named above." },
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    a.download = `${slug(c.name)}.component.json`; a.click();
  };

  const unlinkComponent = (id) => setComponent(id, { source: null });

  const removeElement = (sym) => {
    const inUse = doc.components.filter((c) => (c.comp[sym] || 0) > 0);
    if (inUse.length && !window.confirm(`${res.def[sym]?.name || sym} has mass declared in ${inUse.length} component${inUse.length > 1 ? "s" : ""}. Remove it from the registry and clear that composition everywhere?`)) return;
    setDoc((d) => ({
      ...d,
      elements: Object.fromEntries(Object.entries(d.elements || {}).filter(([k]) => k !== sym)),
      components: d.components.map((c) => { const n = { ...c.comp }; delete n[sym]; return { ...c, comp: n }; }),
    }));
  };

  const exportJSON = () => {
    const payload = {
      $schema: "https://open-recycle.org/schema/0.1/open-recycle.schema.json",
      standard: "Open Recycle", version: "0.1-draft", conformance: conf.level || "below-L1",
      product: { ...doc.product, totalMass: { value: conf.massSum, unit: "g", evidence: doc.product.evidence, provenance: "estimated" } },
      materialRegistry: Object.fromEntries(res.els.map((k) => [k, { name: res.def[k].name, critical: !!res.def[k].critical, custom: !!(doc.elements || {})[k] }])),
      evidenceFloor: effectiveEvidence(doc),
      components: doc.components.map((c) => ({
        id: c.id, name: c.name,
        mass: { value: c.mass, unit: "g", evidence: c.source ? c.source.evidence : doc.product.evidence },
        separationClass: c.sep, disassembly: { tool: c.tool, timeSeconds: c.time }, hazard: c.hazard,
        origin: c.source
          ? { imported: true, issuer: c.source.issuer, published: c.source.published, evidence: c.source.evidence, integrity: c.source.integrity }
          : { imported: false },
        materials: Object.entries(c.comp).map(([m, v]) => ({ materialId: m, mass: { value: v, unit: "g", evidence: c.source ? c.source.evidence : doc.product.evidence } })),
      })),
      graph: doc.graph,
      indexWeights: Object.fromEntries(QK.map((q) => [q, QUALITY[q].w])),
      rating: { grade: G.g, ...res.totals },
      outcomes: res.present.map((el) => ({
        materialId: el, initialMass: { value: res.feed[el], unit: "g" },
        recoveredMass: { value: res.elem[el].material, unit: "g" },
        recoveryRate: res.elem[el].recovery, circularityIndex: res.elem[el].index,
        qualityDistribution: res.elem[el].byQ, evidence: "E3", provenance: "simulated",
      })),
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    a.download = `${slug(doc.product.name)}.open-recycle.json`; a.click();
  };

  return (
    <div className="w-full h-screen flex flex-col" style={{ background: "#faf9f7", color: "#1a1a18", fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: 13 }}>
      <div className="flex items-center gap-4 px-4 h-12 border-b border-neutral-300 shrink-0">
        <a href="../" style={{ fontWeight: 600, letterSpacing: "-0.02em", textDecoration: "none", color: "inherit" }}>OPEN RECYCLE</a>
        <span className="font-mono text-neutral-400 hidden lg:inline" style={{ fontSize: 10 }}>draft 0.1 · research prototype</span>
        <div className="h-5 w-px bg-neutral-300 hidden md:block" />
        <input value={doc.product.name} onChange={(e) => setProduct({ name: e.target.value })}
          className="bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-neutral-900 outline-none px-1" style={{ fontSize: 13, minWidth: 140 }} />
        <div className="h-5 w-px bg-neutral-300 hidden md:block" />
        <div className="flex items-center gap-1.5">
          <button onClick={newProject} className="px-2 py-1 border border-neutral-300 hover:border-neutral-900" style={{ fontSize: 11 }}>New</button>
          <button onClick={openProject} className="px-2 py-1 border border-neutral-300 hover:border-neutral-900" style={{ fontSize: 11 }}>Open…</button>
          <button onClick={() => saveProject(false)} className="px-2 py-1 border border-neutral-300 hover:border-neutral-900" style={{ fontSize: 11 }}>
            Save{dirty ? " ●" : ""}
          </button>
          <input ref={openInputRef} type="file" accept=".json,application/json" className="hidden" onChange={onOpenInputChange} />
          {fileName && (
            <span className="font-mono text-neutral-400 hidden lg:inline" style={{ fontSize: 10 }} title={fileHandle ? "Saves write back to this file" : "Downloads a new copy on Save"}>
              · {fileName}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono px-2 py-1 border" style={{ fontSize: 10, borderColor: conf.level ? "#1a1a18" : "#c9c6bf", color: conf.level ? "#1a1a18" : "#9ca3af" }}>{conf.level || "below L1"}</span>
          <span className="flex items-center gap-2">
            <span style={{ width: 22, height: 22, background: "#1a1a18", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{G.g}</span>
            <span className="font-mono" style={{ fontSize: 12 }}>{pct(res.totals.index)}</span>
          </span>
          <button onClick={exportJSON} className="px-3 py-1 bg-neutral-900 text-white" style={{ fontSize: 12 }}>Export record</button>
        </div>
      </div>
      {fileMsg && (
        <div className="flex items-center gap-3 px-4 py-1.5 border-b border-neutral-300 shrink-0"
          style={{ background: fileMsg.ok ? "#f1f4f8" : "#fdf2f2", fontSize: 11 }}>
          <span style={{ flex: 1 }}>{fileMsg.text}</span>
          <button onClick={() => setFileMsg(null)} className="text-neutral-500" style={{ fontSize: 13, lineHeight: 1 }}>×</button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <nav className="w-48 border-r border-neutral-300 shrink-0 py-2 flex flex-col">
          {NAV.map((n) => (
            <button key={n.k} onClick={() => setView(n.k)}
              className={`text-left px-3 py-2 border-l-2 ${view === n.k ? "border-neutral-900 bg-white" : "border-transparent hover:bg-white/60"}`}>
              <div style={{ fontSize: 13, fontWeight: view === n.k ? 500 : 400 }}>{n.label}</div>
              <div className="text-neutral-500" style={{ fontSize: 10, lineHeight: 1.3 }}>{n.hint}</div>
            </button>
          ))}
          <div className="mt-auto px-3 py-3 border-t border-neutral-200">
            <Head>MASS BALANCE</Head>
            <div style={{ fontSize: 20, fontWeight: 300 }}>{pct(res.totals.rate)}</div>
            <QualityBar res={res} />
            <div className="text-neutral-500 mt-2" style={{ fontSize: 10, lineHeight: 1.4 }}>
              {g1(res.totals.material)} g material of {g1(res.totals.feed)} g
            </div>
            <button onClick={() => { if (!confirmDiscard("load the demo product")) return; loadDoc(seedDoc(), null, null); }} className="mt-3 w-full px-2 py-1 border border-neutral-300" style={{ fontSize: 11 }}>Reset document</button>
          </div>
        </nav>

        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {view === "home" && <HomeView doc={doc} res={res} conf={conf} G={G} go={setView} />}
          {view === "product" && <ProductView {...{ doc, res, conf, setComponent, setProduct, addComponent, removeComponent, duplicateComponent, addElement, removeElement, importComponent, exportComponent, unlinkComponent }} />}
          {view === "flow" && <FlowView doc={doc} res={res} setGraph={setGraph} />}
          {view === "figures" && <FiguresView doc={doc} res={res} G={G} />}
          {view === "rating" && <RatingView res={res} G={G} />}
          {view === "record" && <RecordView doc={doc} res={res} conf={conf} exportJSON={exportJSON} setProduct={setProduct} />}
          {view === "examples" && <ExamplesView importComponent={importComponent} go={setView} />}
          {view === "spec" && <SpecView />}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ PRODUCT */
function ProductView({ doc, res, conf, setComponent, setProduct, addComponent, removeComponent, duplicateComponent, addElement, removeElement, importComponent, exportComponent, unlinkComponent }) {
  const [sel, setSel] = useState(doc.components[0]?.id);
  const [newEl, setNewEl] = useState({ sym: "", name: "", crit: false });
  const [showAdder, setShowAdder] = useState(false);
  const [imp, setImp] = useState(null);
  const c = doc.components.find((x) => x.id === sel) || doc.components[0];
  const gap = c ? conf.compGap.find((x) => x.id === c.id) : null;
  const custom = doc.elements || {};

  const submitEl = () => {
    if (addElement(newEl.sym, newEl.name, newEl.crit)) {
      setNewEl({ sym: "", name: "", crit: false });
      setShowAdder(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <Head>PRODUCT MODEL</Head>
            <h1 style={{ fontSize: 26, fontWeight: 300 }}>{doc.product.name}</h1>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Stat label="Total mass" value={`${conf.massSum.toFixed(0)} g`} />
            <Stat label="Components" value={doc.components.length} />
            <Stat label="Materials" value={`${res.present.length} / ${res.els.length}`} />
            <Stat label="Architecture" value={doc.product.architecture} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <Head>COMPONENTS</Head>
          <div className="flex gap-2">
            <label className="px-3 py-1 border border-neutral-400 cursor-pointer hover:border-neutral-900" style={{ fontSize: 11 }}>
              Import supplier component
              <input type="file" accept=".json,application/json" className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  ev.target.value = "";
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => {
                    const out = importComponent(String(r.result));
                    setImp(out);
                    if (out.ok) setSel(out.id);
                  };
                  r.readAsText(f);
                }} />
            </label>
            <button onClick={() => setSel(addComponent())} className="px-3 py-1 bg-neutral-900 text-white" style={{ fontSize: 11 }}>Add component</button>
          </div>
        </div>

        {imp && (
          <div className="mt-2 border-l-2 px-3 py-2 flex items-start gap-3"
            style={{ borderColor: imp.ok ? "#1d3557" : "#991b1b", background: imp.ok ? "#f1f4f8" : "#fdf2f2" }}>
            <div className="flex-1" style={{ fontSize: 11, lineHeight: 1.5 }}>
              {imp.ok ? (
                <>
                  Imported from <strong>{imp.issuer}</strong> at evidence {imp.evidence}. Its composition is locked to
                  the issuer's declaration.
                  {imp.unknown?.length > 0 && <> New materials added to the registry: {imp.unknown.join(", ")}.</>}
                  {imp.undeclared?.length > 0 && (
                    <span style={{ color: "#991b1b" }}> {imp.undeclared.join(", ")} arrived with no registry entry, so only the symbol is known.</span>
                  )}
                </>
              ) : imp.error}
            </div>
            <button onClick={() => setImp(null)} className="text-neutral-500" style={{ fontSize: 14, lineHeight: 1 }}>×</button>
          </div>
        )}

        <table className="w-full mt-2" style={{ fontSize: 12 }}>
          <thead>
            <tr className="border-b border-neutral-900 text-neutral-500" style={{ fontSize: 10 }}>
              <th className="text-left py-2 font-normal">Component</th>
              <th className="text-right py-2 font-normal">Mass g</th>
              <th className="text-right py-2 font-normal">Assigned</th>
              <th className="text-left py-2 pl-4 font-normal">Separation</th>
              <th className="text-right py-2 font-normal">Time s</th>
              <th className="text-left py-2 pl-4 font-normal">Composition</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {doc.components.map((cc) => {
              const g = conf.compGap.find((x) => x.id === cc.id);
              const bad = Math.abs(g.gap) / (cc.mass || 1) > 0.01;
              return (
                <tr key={cc.id} onClick={() => setSel(cc.id)} className="border-b border-neutral-100 cursor-pointer"
                  style={{ background: sel === cc.id ? "#fff" : "transparent" }}>
                  <td className="py-1.5">
                    {cc.name}
                    {cc.hazard && <span className="ml-2 font-mono" style={{ fontSize: 9, color: "#991b1b" }}>HAZARD</span>}
                    {cc.source && (
                      <span className="block font-mono text-neutral-500" style={{ fontSize: 9 }}>
                        {cc.source.issuer} · {cc.source.evidence}{cc.source.integrity ? " · signed" : " · unsigned"}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    <input type="number" step="0.5" value={cc.mass} disabled={!!cc.source} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setComponent(cc.id, { mass: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-16 border border-neutral-200 px-1 py-0.5 font-mono text-right disabled:bg-neutral-100 disabled:text-neutral-500" style={{ fontSize: 11 }} />
                  </td>
                  <td className="py-1.5 text-right font-mono" style={{ color: bad ? "#991b1b" : "#9ca3af" }}>{g.modelled.toFixed(2)}</td>
                  <td className="py-1.5 pl-4">
                    <select value={cc.sep} onClick={(e) => e.stopPropagation()} onChange={(e) => setComponent(cc.id, { sep: e.target.value })}
                      className="border border-neutral-200 px-1 py-0.5 bg-white font-mono" style={{ fontSize: 11 }}>
                      {Object.keys(SEP).map((k) => <option key={k} value={k}>{k} {SEP[k].label}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 text-right">
                    <input type="number" step="1" value={cc.time} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setComponent(cc.id, { time: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-14 border border-neutral-200 px-1 py-0.5 font-mono text-right" style={{ fontSize: 11 }} />
                  </td>
                  <td className="py-1.5 pl-4" style={{ width: 140 }}>
                    <div className="flex h-2.5">
                      {Object.entries(cc.comp).sort((a, b) => b[1] - a[1]).map(([el, m]) => (
                        <div key={el} title={`${el} ${m} g`} style={{ width: `${(m / (cc.mass || 1)) * 100}%`, background: res.def[el]?.color || "#999" }} />
                      ))}
                      <div style={{ flex: 1, background: "repeating-linear-gradient(45deg,#e5e2dc,#e5e2dc 3px,#f2efe9 3px,#f2efe9 6px)" }} />
                    </div>
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button onClick={(e) => { e.stopPropagation(); exportComponent(cc.id); }} className="text-neutral-400 hover:text-neutral-900 px-1" title="Publish as a component record">↧</button>
                    <button onClick={(e) => { e.stopPropagation(); duplicateComponent(cc.id); }} className="text-neutral-400 hover:text-neutral-900 px-1" title="Duplicate">⧉</button>
                    <button onClick={(e) => { e.stopPropagation(); removeComponent(cc.id); }} className="text-neutral-400 hover:text-red-700 px-1" title="Delete">×</button>
                  </td>
                </tr>
              );
            })}
            {doc.components.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-neutral-500" style={{ fontSize: 12 }}>
                No components yet. Add one to start the inventory.
              </td></tr>
            )}
          </tbody>
        </table>
        <p className="text-neutral-500 mt-2" style={{ fontSize: 11 }}>
          The hatched tail is mass declared but not assigned to any material. It is reported, never renormalised away.
        </p>

        <div className="mt-8 border-l-2 border-neutral-900 pl-4" style={{ maxWidth: "44em" }}>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            Separation class feeds the dismantling node directly. Change the battery from D1 to D5 and the share of
            lithium reaching battery pre-treatment falls with it — the rest goes to the smelter and becomes slag.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
            {res.present.map((el) => (
              <span key={el} className="font-mono" style={{ fontSize: 10, color: res.sepEff[el] < 0.8 ? "#991b1b" : "#6b7280" }}>
                {el} {pct0(res.sepEff[el])}
              </span>
            ))}
          </div>
          <Head>EFFECTIVE SEPARATION EFFICIENCY PER MATERIAL</Head>
        </div>
      </div>

      <aside className="w-80 border-l border-neutral-300 overflow-y-auto shrink-0 p-4">
        {c ? (
          <>
            <Head>COMPONENT</Head>
            <input value={c.name} onChange={(e) => setComponent(c.id, { name: e.target.value })}
              className="w-full border-b border-neutral-300 py-1 bg-transparent mb-1 outline-none" style={{ fontSize: 15 }} />
            <div className="font-mono text-neutral-500" style={{ fontSize: 10 }}>
              {c.mass} g · {((c.mass / (conf.massSum || 1)) * 100).toFixed(1)}% of product · {c.sep}
            </div>

            {c.source && (
              <div className="mt-3 border border-neutral-300 bg-white p-2">
                <Head>IMPORTED RECORD</Head>
                <div style={{ fontSize: 12 }}>{c.source.issuer}</div>
                <div className="font-mono text-neutral-500" style={{ fontSize: 10 }}>
                  {c.source.published || "no publication date"} · evidence {c.source.evidence} · {c.source.integrity ? "integrity hash present" : "no integrity hash"}
                </div>
                <p className="text-neutral-600 mt-2" style={{ fontSize: 10, lineHeight: 1.45 }}>
                  Mass and composition are the issuer's declaration and stay read-only. The interface joint below is
                  yours to set, because you built the assembly, not them.
                </p>
                <button onClick={() => unlinkComponent(c.id)} className="w-full mt-2 px-2 py-1 border border-neutral-400" style={{ fontSize: 10 }}>
                  Unlink and take ownership
                </button>
                <p className="text-neutral-500 mt-1" style={{ fontSize: 9, lineHeight: 1.4 }}>
                  Unlinking makes the numbers editable and yours to defend. The issuer's evidence level no longer
                  applies.
                </p>
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block">
                <Head>TOOL</Head>
                <input value={c.tool || ""} onChange={(e) => setComponent(c.id, { tool: e.target.value })}
                  className="w-full border border-neutral-200 px-1 py-0.5 mt-0.5" style={{ fontSize: 11 }} />
              </label>
              <label className="block">
                <Head>HAZARD</Head>
                <input value={c.hazard || ""} onChange={(e) => setComponent(c.id, { hazard: e.target.value })}
                  placeholder="none" className="w-full border border-neutral-200 px-1 py-0.5 mt-0.5" style={{ fontSize: 11 }} />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Head>{c.source ? "COMPOSITION, GRAMS — LOCKED" : "COMPOSITION, GRAMS"}</Head>
              {!c.source && (
                <button onClick={() => setShowAdder(!showAdder)} className="text-neutral-600 border border-neutral-300 px-2 py-0.5" style={{ fontSize: 10 }}>
                  {showAdder ? "Cancel" : "New material"}
                </button>
              )}
            </div>

            {showAdder && (
              <div className="border border-neutral-400 p-2 mt-2">
                <div className="flex gap-1">
                  <input value={newEl.sym} onChange={(e) => setNewEl({ ...newEl, sym: e.target.value })}
                    placeholder="Symbol" className="w-20 border border-neutral-300 px-1 py-0.5 font-mono" style={{ fontSize: 11 }} />
                  <input value={newEl.name} onChange={(e) => setNewEl({ ...newEl, name: e.target.value })}
                    placeholder="Name" className="flex-1 border border-neutral-300 px-1 py-0.5" style={{ fontSize: 11 }} />
                </div>
                <label className="flex items-center gap-2 mt-2" style={{ fontSize: 11 }}>
                  <input type="checkbox" checked={newEl.crit} onChange={(e) => setNewEl({ ...newEl, crit: e.target.checked })} />
                  Critical raw material
                </label>
                <button onClick={submitEl} className="w-full mt-2 px-2 py-1 bg-neutral-900 text-white" style={{ fontSize: 11 }}>Add to registry</button>
                <p className="text-neutral-500 mt-2" style={{ fontSize: 10, lineHeight: 1.4 }}>
                  New materials inherit each process node's fallback split row until you give them their own.
                </p>
              </div>
            )}

            <div className="mt-2">
              {res.els.map((el) => {
                const inUse = (c.comp[el] ?? 0) > 0;
                return (
                  <div key={el} className="flex items-center gap-2 mt-1">
                    <span style={{ width: 7, height: 7, background: res.def[el].color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, flex: 1, color: inUse ? "#1a1a18" : "#9ca3af" }}>
                      {res.def[el].name}
                      {res.def[el].critical && <span className="ml-1 font-mono" style={{ fontSize: 8, color: "#7a3b2e" }}>CRM</span>}
                    </span>
                    <input type="number" step="0.01" value={c.comp[el] ?? 0} disabled={!!c.source}
                      onChange={(e) => {
                        const v = Math.max(0, parseFloat(e.target.value) || 0);
                        const next = { ...c.comp };
                        if (v === 0) delete next[el]; else next[el] = v;
                        setComponent(c.id, { comp: next });
                      }}
                      className="w-20 border border-neutral-200 px-1 py-0.5 font-mono text-right disabled:bg-neutral-100 disabled:text-neutral-500" style={{ fontSize: 11 }} />
                    {custom[el] && !c.source && (
                      <button onClick={() => removeElement(el)} className="text-neutral-400 hover:text-red-700" style={{ fontSize: 12 }} title="Remove from registry">×</button>
                    )}
                  </div>
                );
              })}
            </div>

            {gap && (
              <div className="mt-3 pt-3 border-t border-neutral-200 flex justify-between" style={{ fontSize: 11 }}>
                <span className="text-neutral-500">Unassigned</span>
                <span className="font-mono" style={{ color: Math.abs(gap.gap) / (c.mass || 1) > 0.01 ? "#991b1b" : "#6b7280" }}>{gap.gap.toFixed(2)} g</span>
              </div>
            )}
            {!c.source && (
              <button onClick={() => setComponent(c.id, { mass: Object.values(c.comp).reduce((a, b) => a + b, 0) })}
                className="w-full mt-2 px-2 py-1 border border-neutral-300" style={{ fontSize: 11 }}>
                Set mass from composition
              </button>
            )}
          </>
        ) : (
          <p className="text-neutral-500" style={{ fontSize: 11, lineHeight: 1.6 }}>
            No component selected. Add one from the table to start entering composition.
          </p>
        )}
      </aside>
    </div>
  );
}

/* ============================================================ FLOW */
function FlowView({ doc, res, setGraph }) {
  const graph = doc.graph;
  const [sel, setSel] = useState(null);
  const [pending, setPending] = useState(null);
  const [drag, setDrag] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panDrag, setPanDrag] = useState(null);
  const [showEl, setShowEl] = useState("all");
  const byId = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  useEffect(() => {
    const move = (ev) => {
      if (drag) setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === drag.id ? { ...n, x: ev.clientX - drag.dx - pan.x, y: ev.clientY - drag.dy - pan.y } : n)) }));
      else if (panDrag) setPan({ x: ev.clientX - panDrag.dx, y: ev.clientY - panDrag.dy });
    };
    const up = () => { setDrag(null); setPanDrag(null); };
    if (drag || panDrag) {
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    }
  }, [drag, panDrag, pan, setGraph]);

  const addNode = (type) => {
    const n = { id: nid(), type, x: 140 - pan.x + (graph.nodes.length % 5) * 22, y: 100 - pan.y + (graph.nodes.length % 7) * 24, label: LIB[type].label, splits: LIB[type].splits ? JSON.parse(JSON.stringify(LIB[type].splits)) : undefined, quality: LIB[type].quality };
    setGraph((g) => ({ ...g, nodes: [...g.nodes, n] }));
    setSel(n.id);
  };
  const clickPort = (nodeId, port) => {
    if (pending) {
      if (pending.node !== nodeId) setGraph((g) => ({ ...g, edges: [...g.edges.filter((e) => !(e.from === pending.node && e.port === pending.port)), { id: `${pending.node}-${pending.port}-${nodeId}-${Date.now()}`, from: pending.node, port: pending.port, to: nodeId }] }));
      setPending(null);
    } else setPending({ node: nodeId, port });
  };
  const patch = (id, o) => setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...o } : n)) }));
  const selNode = sel ? byId[sel] : null;

  return (
    <div className="flex flex-1 min-h-0">
      <div className="w-44 border-r border-neutral-200 overflow-y-auto shrink-0 p-2">
        <Head>PROCESSES</Head>
        {Object.entries(LIB).filter(([, v]) => v.kind === "process").map(([k, v]) => (
          <PalBtn key={k} onClick={() => addNode(k)}>{v.label}</PalBtn>
        ))}
        <div className="mt-3"><Head>OUTPUTS</Head></div>
        {Object.entries(LIB).filter(([, v]) => v.kind === "sink").map(([k, v]) => (
          <PalBtn key={k} onClick={() => addNode(k)} dot={QUALITY[v.quality].color}>
            <span className="font-mono" style={{ fontSize: 9, opacity: 0.55 }}>{v.quality}</span> {v.label}
          </PalBtn>
        ))}
        <div className="mt-3">
          <Head>VIEW</Head>
          <select value={showEl} onChange={(e) => setShowEl(e.target.value)} className="w-full border border-neutral-300 px-2 py-1 bg-white mt-1" style={{ fontSize: 11 }}>
            <option value="all">All mass</option>
            {res.present.map((el) => <option key={el} value={el}>{el} only</option>)}
          </select>
        </div>
        <p className="text-neutral-500 px-1 mt-3" style={{ fontSize: 10, lineHeight: 1.5 }}>
          Click an output port, then a target node, to wire them. Click a wire to remove it.
        </p>
        <p className="text-neutral-500 px-1 mt-2" style={{ fontSize: 10, lineHeight: 1.5 }}>
          {showEl === "all"
            ? "Pick a material above to edit its split mass directly on each node's ports."
            : `Editing ${showEl} ports directly on the canvas — this sets the split fraction for ${showEl} at that node.`}
        </p>
      </div>

      <div className="flex-1 relative overflow-hidden"
        onMouseDown={(e) => { setPanDrag({ dx: e.clientX - pan.x, dy: e.clientY - pan.y }); setSel(null); setPending(null); }}
        style={{ cursor: panDrag ? "grabbing" : "default", backgroundImage: "radial-gradient(#e0ded8 1px, transparent 1px)", backgroundSize: "22px 22px", backgroundPosition: `${pan.x}px ${pan.y}px` }}>
        <div style={{ position: "absolute", left: pan.x, top: pan.y }}>
          <svg style={{ position: "absolute", overflow: "visible", pointerEvents: "none", width: 1, height: 1 }}>
            {graph.edges.map((e) => {
              const a = byId[e.from], b = byId[e.to];
              if (!a || !b) return null;
              const pi = LIB[a.type].ports.indexOf(e.port);
              const x1 = a.x + NW, y1 = a.y + portY(pi), x2 = b.x, y2 = b.y + HDR / 2 + 6;
              const dx = Math.max(40, Math.abs(x2 - x1) * 0.45);
              const fl = res.edgeFlow[e.id] || {};
              const m = showEl === "all" ? res.els.reduce((s, k) => s + (fl[k] || 0), 0) : (fl[showEl] || 0);
              const ref = showEl === "all" ? res.totals.feed : res.feed[showEl] || 1;
              const w = Math.max(1, Math.min(9, (m / (ref || 1)) * 16));
              const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
              return (
                <g key={e.id} style={{ pointerEvents: "auto" }}>
                  <path d={d} fill="none" stroke={m > 0.0001 ? "#5b6670" : "#d6d3cc"} strokeWidth={w} opacity={0.75} />
                  <path d={d} fill="none" stroke="transparent" strokeWidth={12} style={{ cursor: "pointer" }}
                    onClick={(ev) => { ev.stopPropagation(); setGraph((g) => ({ ...g, edges: g.edges.filter((x) => x.id !== e.id) })); }} />
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="#6b7280">{g1(m)} g</text>
                </g>
              );
            })}
          </svg>

          {graph.nodes.map((n) => {
            const lib = LIB[n.type];
            const inMass = showEl === "all" ? res.els.reduce((s, k) => s + res.nodeIn[n.id][k], 0) : res.nodeIn[n.id][showEl];
            const isSel = sel === n.id;
            const q = n.quality || lib.quality;
            const accent = lib.kind === "sink" ? QUALITY[q].color : lib.kind === "source" ? "#1d3557" : "#3f3f3c";
            return (
              <div key={n.id} onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); if (pending) clickPort(n.id, null); else setSel(n.id); }}
                style={{ position: "absolute", left: n.x, top: n.y, width: NW, background: "#fff", border: `1px solid ${isSel ? "#1a1a18" : "#c9c6bf"}`, boxShadow: isSel ? "0 2px 10px rgba(0,0,0,.12)" : "0 1px 2px rgba(0,0,0,.05)", cursor: pending ? "crosshair" : "default" }}>
                <div onMouseDown={(e) => { e.stopPropagation(); setDrag({ id: n.id, dx: e.clientX - (n.x + pan.x), dy: e.clientY - (n.y + pan.y) }); setSel(n.id); }}
                  style={{ height: HDR, background: accent, color: "#fff", display: "flex", alignItems: "center", padding: "0 8px", cursor: "grab", fontSize: 11, gap: 6 }}>
                  {lib.kind === "sink" && <span className="font-mono" style={{ fontSize: 9, opacity: 0.75 }}>{q}</span>}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</span>
                  {lib.kind !== "source" && (
                    <button onClick={(e) => { e.stopPropagation(); setGraph((g) => ({ nodes: g.nodes.filter((x) => x.id !== n.id), edges: g.edges.filter((x) => x.from !== n.id && x.to !== n.id) })); setSel(null); }}
                      style={{ opacity: 0.7, fontSize: 13, lineHeight: 1 }}>×</button>
                  )}
                </div>
                {lib.kind !== "source" && <div style={{ position: "absolute", left: -5, top: HDR / 2 + 1, width: 10, height: 10, borderRadius: 5, background: "#fff", border: "1.5px solid #6b7280" }} />}
                <div style={{ padding: "6px 8px" }}>
                  {lib.kind === "source"
                    ? <div className="font-mono text-neutral-500" style={{ fontSize: 9 }}>from product model · {g1(showEl === "all" ? res.totals.feed : res.feed[showEl])} g</div>
                    : <div className="font-mono text-neutral-500" style={{ fontSize: 9, marginBottom: 4 }}>in {g1(inMass)} g</div>}
                  {lib.ports.map((p) => {
                    const out = res.edgeFlow[graph.edges.find((e) => e.from === n.id && e.port === p)?.id];
                    const m = out ? (showEl === "all" ? res.els.reduce((s, k) => s + out[k], 0) : out[showEl]) : null;
                    const editable = lib.kind === "process" && showEl !== "all" && m != null && !(lib.usesConnections && p === "rest");
                    return (
                      <div key={p} style={{ height: ROW, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, position: "relative" }}>
                        <span style={{ fontSize: 10, color: "#4b5563" }}>{p}</span>
                        {editable ? (
                          <span className="flex items-center gap-0.5">
                            <input type="number" step="0.01" min="0" value={g1(m)}
                              onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const denom = res.nodeIn[n.id][showEl] || 0;
                                const k = lib.usesConnections ? (res.sepEff[showEl] ?? 1) : 1;
                                const capacity = denom * k;
                                const v = Math.max(0, Math.min(capacity, parseFloat(e.target.value) || 0));
                                const frac = capacity ? v / capacity : 0;
                                setGraph((g) => ({ ...g, nodes: g.nodes.map((x) => x.id === n.id ? { ...x, splits: { ...x.splits, [showEl]: { ...(x.splits[showEl] || x.splits._), [p]: frac } } } : x) }));
                              }}
                              className="w-12 border border-neutral-300 px-0.5 font-mono text-right" style={{ fontSize: 9 }} />
                            <span className="font-mono text-neutral-400" style={{ fontSize: 9 }}>g</span>
                          </span>
                        ) : (
                          <span className="font-mono" style={{ fontSize: 9, color: m == null ? "#c2410c" : "#9ca3af", minWidth: 32, textAlign: "right" }}>{m == null ? "open" : `${g1(m)} g`}</span>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); clickPort(n.id, p); }}
                          style={{ position: "absolute", right: -13, width: 10, height: 10, borderRadius: 5, background: pending && pending.node === n.id && pending.port === p ? "#1a1a18" : "#fff", border: "1.5px solid #6b7280", cursor: "crosshair" }} />
                      </div>
                    );
                  })}
                  {lib.kind === "sink" && <div className="font-mono" style={{ fontSize: 15, color: accent }}>{g1(inMass)} g</div>}
                  {lib.kind === "process" && res.unacc[n.id] > 0.005 && <div style={{ fontSize: 9, color: "#991b1b", marginTop: 3 }}>{g1(res.unacc[n.id])} g unaccounted</div>}
                  {lib.usesConnections && <div style={{ fontSize: 9, color: "#1d3557", marginTop: 3 }}>linked to separation classes</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="w-72 border-l border-neutral-300 overflow-y-auto shrink-0 p-4">
        {selNode ? <NodeInspector n={selNode} res={res} patch={patch} setGraph={setGraph} /> : (
          <>
            <Head>MATERIALS</Head>
            <div className="mt-2">
              {res.present.map((el) => (
                <button key={el} onClick={() => setShowEl(showEl === el ? "all" : el)} className="w-full text-left mb-2">
                  <div className="flex justify-between items-baseline" style={{ fontSize: 11 }}>
                    <span className="flex items-center gap-1.5">
                      <span style={{ width: 7, height: 7, background: res.def[el].color }} />
                      <span style={{ fontWeight: showEl === el ? 600 : 400 }}>{el}</span>
                      {res.def[el].critical && <span className="font-mono" style={{ fontSize: 8, color: "#7a3b2e" }}>CRM</span>}
                    </span>
                    <span className="font-mono">{pct0(res.elem[el].index)}</span>
                  </div>
                  <QualityBar res={res} el={el} thin />
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function NodeInspector({ n, res, patch, setGraph }) {
  const lib = LIB[n.type];
  return (
    <>
      <Head>NODE</Head>
      <input value={n.label} onChange={(e) => patch(n.id, { label: e.target.value })}
        className="w-full border-b border-neutral-300 py-1 bg-transparent mb-3 outline-none" style={{ fontSize: 14 }} />

      {lib.kind === "source" && (
        <p className="text-neutral-600" style={{ fontSize: 11, lineHeight: 1.5 }}>
          The feed is generated from the product model. Edit composition under Product, not here.
        </p>
      )}

      {lib.kind === "sink" && (
        <>
          <Head>QUALITY CLASS</Head>
          <select value={n.quality} onChange={(e) => patch(n.id, { quality: e.target.value })}
            className="w-full border border-neutral-400 px-2 py-1 bg-white mt-1 mb-3" style={{ fontSize: 12 }}>
            {QK.map((q) => <option key={q} value={q}>{q} — {QUALITY[q].label} (w {QUALITY[q].w})</option>)}
          </select>
          <Head>ARRIVING</Head>
          {res.els.filter((el) => res.nodeIn[n.id][el] > 0.0001).map((el) => (
            <div key={el} className="flex justify-between border-b border-neutral-100 py-0.5" style={{ fontSize: 11 }}>
              <span className="flex items-center gap-1.5"><span style={{ width: 7, height: 7, background: res.def[el].color }} />{res.def[el].name}</span>
              <span className="font-mono">{g1(res.nodeIn[n.id][el])} g</span>
            </div>
          ))}
        </>
      )}

      {lib.kind === "process" && (
        <>
          <Head>SPLIT FRACTIONS</Head>
          {lib.usesConnections && (
            <p className="text-neutral-600 mb-2 mt-1" style={{ fontSize: 10, lineHeight: 1.45 }}>
              These rows are scaled by each material's separation efficiency before use.
            </p>
          )}
          <div className="overflow-x-auto mt-1">
            <table style={{ fontSize: 10 }}>
              <thead>
                <tr className="text-neutral-500">
                  <th className="text-left font-normal pr-2"> </th>
                  {lib.ports.map((p) => <th key={p} className="font-normal px-1" style={{ writingMode: "vertical-rl", height: 56, transform: "rotate(180deg)" }}>{p}</th>)}
                </tr>
              </thead>
              <tbody>
                {res.present.map((el) => {
                  const row = n.splits[el] || n.splits._ || {};
                  const inh = !n.splits[el];
                  return (
                    <tr key={el} className="border-b border-neutral-100">
                      <td className="pr-2 font-mono" style={{ color: inh ? "#9ca3af" : "#1a1a18" }}>{el}</td>
                      {lib.ports.map((p) => (
                        <td key={p} className="px-0.5">
                          <input type="number" step="0.05" min="0" max="1" value={(row[p] || 0).toFixed(2)}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
                              setGraph((g) => ({ ...g, nodes: g.nodes.map((x) => x.id === n.id ? { ...x, splits: { ...x.splits, [el]: { ...(x.splits[el] || x.splits._), [p]: v } } } : x) }));
                            }}
                            className="w-11 border border-neutral-200 px-0.5 py-0.5 font-mono text-right" style={{ fontSize: 10 }} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-neutral-500 mt-2" style={{ fontSize: 10, lineHeight: 1.5 }}>
            Grey rows inherit the fallback. Materials you add to the registry start on the fallback until you give
            them their own row here.
          </p>
        </>
      )}
    </>
  );
}

/* ============================================================ RATING */
function RatingView({ res, G }) {
  const t = res.totals;
  const [hover, setHover] = useState(null);
  const present = res.present;
  const S = 420, cx = S / 2, cy = S / 2, r0 = 68, r1 = 172;
  const step = present.length ? (Math.PI * 2) / present.length : 0;

  const bars = [
    ["Material recovery", t.rate, "leaves as material, not slag, dust or heat"],
    ["Closed-loop share", t.closed, "returns at equivalent function"],
    ["Critical materials", t.critical, "recovery across flagged materials"],
    ["Material breadth", t.breadth, "materials recovered above half their input"],
    ["Per-material index", t.perElement, "each material counted once"],
  ];

  if (!present.length) return <div className="flex-1 p-6 text-neutral-500" style={{ fontSize: 13 }}>Nothing to rate yet — enter some composition under Product.</div>;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex items-center gap-5">
          <div style={{ width: 88, height: 88, background: "#1a1a18", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, fontWeight: 200 }}>{G.g}</div>
          <div>
            <Head>CIRCULARITY INDEX</Head>
            <div style={{ fontSize: 42, fontWeight: 200, lineHeight: 1 }}>{pct(t.index)}</div>
            <div className="text-neutral-600 mt-1" style={{ fontSize: 13 }}>{G.note}</div>
          </div>
        </div>
        <div className="flex-1" style={{ minWidth: 260 }}>
          <p className="text-neutral-600" style={{ fontSize: 12, lineHeight: 1.6, maxWidth: "40em" }}>
            Each gram is weighted by the quality class of the sink it reaches, then divided by the feed. Material
            recovery is {pct0(t.rate)} while the index is {pct0(t.index)} — that gap is the function being lost while
            it is still counted as recycling.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-3 mt-7">
        {bars.map(([l, v, note]) => (
          <div key={l} className="border border-neutral-200 bg-white p-3">
            <div className="text-neutral-600" style={{ fontSize: 11, minHeight: 26 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 300 }}>{pct0(v)}</div>
            <div className="h-1 bg-neutral-200 mt-1"><div style={{ width: pct0(v), height: "100%", background: "#1a1a18" }} /></div>
            <div className="text-neutral-500 mt-2" style={{ fontSize: 10, lineHeight: 1.4 }}>{note}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-8 mt-8">
        <div className="lg:col-span-5">
          <Head>EVERY MATERIAL, FULL FATE</Head>
          <svg viewBox={`0 0 ${S} ${S}`} className="w-full" style={{ maxHeight: 420 }}>
            {[0.25, 0.5, 0.75, 1].map((f) => <circle key={f} cx={cx} cy={cy} r={r0 + (r1 - r0) * f} fill="none" stroke="#e6e4df" strokeWidth="0.7" />)}
            {present.map((el, i) => {
              const e = res.elem[el];
              const a0 = i * step - Math.PI / 2 + step * 0.12, a1 = (i + 1) * step - Math.PI / 2 - step * 0.12;
              const am = (a0 + a1) / 2;
              let acc = 0;
              const active = hover === el;
              return (
                <g key={el} onMouseEnter={() => setHover(el)} onMouseLeave={() => setHover(null)}>
                  {QK.map((q) => {
                    const frac = e.init ? e.byQ[q] / e.init : 0;
                    if (frac <= 0.0005) return null;
                    const ra = r0 + (r1 - r0) * acc, rb = r0 + (r1 - r0) * (acc + frac);
                    acc += frac;
                    const p = (rad, s, tt) => `${cx + rad * Math.cos(s)} ${cy + rad * Math.sin(s)} A ${rad} ${rad} 0 0 1 ${cx + rad * Math.cos(tt)} ${cy + rad * Math.sin(tt)}`;
                    return <path key={q} d={`M ${p(ra, a0, a1)} L ${cx + rb * Math.cos(a1)} ${cy + rb * Math.sin(a1)} A ${rb} ${rb} 0 0 0 ${cx + rb * Math.cos(a0)} ${cy + rb * Math.sin(a0)} Z`} fill={QUALITY[q].color} opacity={active ? 1 : 0.88} />;
                  })}
                  <text x={cx + (r1 + 18) * Math.cos(am)} y={cy + (r1 + 18) * Math.sin(am) + 4} textAnchor="middle" fontSize="11"
                    fontWeight={active ? 700 : 400} fill={res.def[el].critical ? "#7a3b2e" : "#3a3a38"}>{el}</text>
                </g>
              );
            })}
            <text x={cx} y={cy - 3} textAnchor="middle" fontSize="26" fill="#1a1a18" fontWeight="300">{pct0(t.index)}</text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#8c8a84" fontFamily="ui-monospace, monospace">index</text>
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {QK.map((q) => (
              <span key={q} className="flex items-center gap-1.5" style={{ fontSize: 10 }}>
                <span style={{ width: 9, height: 9, background: QUALITY[q].color }} />
                <span className="font-mono">{q}</span><span className="text-neutral-500">{QUALITY[q].label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          <Head>SCORECARD</Head>
          <table className="w-full mt-2" style={{ fontSize: 12 }}>
            <thead>
              <tr className="border-b border-neutral-900 text-neutral-500" style={{ fontSize: 10 }}>
                <th className="text-left py-2 font-normal">Material</th>
                <th className="text-right py-2 font-normal">Input</th>
                <th className="text-right py-2 font-normal">Recovery</th>
                <th className="text-right py-2 font-normal">Index</th>
                <th className="text-left py-2 pl-3 font-normal">Fate</th>
              </tr>
            </thead>
            <tbody>
              {present.slice().sort((a, b) => res.elem[a].index - res.elem[b].index).map((el) => {
                const e = res.elem[el];
                return (
                  <tr key={el} className="border-b border-neutral-100" onMouseEnter={() => setHover(el)} onMouseLeave={() => setHover(null)}
                    style={{ background: hover === el ? "#fff" : "transparent" }}>
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5">
                        <span style={{ width: 7, height: 7, background: res.def[el].color }} />{res.def[el].name}
                        {res.def[el].critical && <span className="font-mono" style={{ fontSize: 8, color: "#7a3b2e" }}>CRM</span>}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono text-neutral-500">{g1(e.init)} g</td>
                    <td className="py-1.5 text-right font-mono">{pct0(e.recovery)}</td>
                    <td className="py-1.5 text-right font-mono" style={{ color: QUALITY[e.index > 0.7 ? "C0" : e.index > 0.4 ? "C2" : "C5"].color }}>{pct0(e.index)}</td>
                    <td className="py-1.5 pl-3" style={{ width: 110 }}><QualityBar res={res} el={el} thin /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {t.weakest && (
            <div className="border border-neutral-900 bg-white p-4 mt-5">
              <Head>WEAKEST LINK</Head>
              <div style={{ fontSize: 17 }}>{res.def[t.weakest].name}</div>
              <div className="text-neutral-600 mt-1" style={{ fontSize: 12, lineHeight: 1.5 }}>
                {g1(res.feed[t.weakest])} g in, index {pct0(res.elem[t.weakest].index)},
                {" "}{pct0(res.elem[t.weakest].lost / (res.feed[t.weakest] || 1))} to a C5 sink. Follow it in the flow
                view with the material filter on.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ RECORD */
function RecordView({ doc, res, conf, exportJSON, setProduct }) {
  const levels = ["L1", "L2", "L3", "L4", "L5"];
  const custom = Object.keys(doc.elements || {});
  const imported = doc.components.filter((c) => c.source);
  const floor = effectiveEvidence(doc);
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <Head>CONFORMANCE</Head>
          <h1 style={{ fontSize: 26, fontWeight: 300 }}>{conf.level || "Below L1"}</h1>
        </div>
        <button onClick={exportJSON} className="px-4 py-2 bg-neutral-900 text-white" style={{ fontSize: 13 }}>Export record</button>
      </div>

      <div className="flex gap-1 mt-4" style={{ maxWidth: 520 }}>
        {levels.map((l, i) => {
          const reached = conf.level && levels.indexOf(conf.level) >= i;
          return (
            <div key={l} className="flex-1 border px-2 py-2" style={{ borderColor: reached ? "#1a1a18" : "#d6d3cc", background: reached ? "#1a1a18" : "transparent", color: reached ? "#fff" : "#9ca3af" }}>
              <div className="font-mono" style={{ fontSize: 12 }}>{l}</div>
              <div style={{ fontSize: 9 }}>{["Inventory", "Architecture", "Route", "Evidence", "Verified"][i]}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-6" style={{ maxWidth: "50em" }}>
        <Head>CHECKS</Head>
        <div className="mt-2">
          {conf.checks.map((c, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-neutral-100 py-2">
              <span className="font-mono text-neutral-400 shrink-0" style={{ fontSize: 10, width: 18 }}>{c.lvl}</span>
              <span className="shrink-0" style={{ width: 14, color: c.ok ? "#1d7a7a" : "#991b1b", fontSize: 13, lineHeight: 1.2 }}>{c.ok ? "✓" : "✕"}</span>
              <span className="flex-1" style={{ fontSize: 12 }}>
                {c.label}
                {c.detail && <span className="block text-neutral-500" style={{ fontSize: 11 }}>{c.detail}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-8" style={{ maxWidth: "60em" }}>
        <div>
          <Head>EVIDENCE LEVEL FOR COMPOSITION</Head>
          <select value={doc.product.evidence} onChange={(e) => setProduct({ evidence: e.target.value })}
            className="w-full border border-neutral-400 px-2 py-1 bg-white mt-1" style={{ fontSize: 12 }}>
            {Object.entries(EVIDENCE).map(([k, v]) => <option key={k} value={k}>{k} — {v}</option>)}
          </select>
          <p className="text-neutral-600 mt-2" style={{ fontSize: 11, lineHeight: 1.55 }}>
            The seeded composition is a demonstration dataset built for this prototype, so E0 is the honest setting.
            Raise it only when the numbers are ones you can cite.
          </p>
        </div>
        <div>
          <Head>ISSUING ORGANISATION</Head>
          <input value={doc.product.issuer || ""} onChange={(e) => setProduct({ issuer: e.target.value })}
            placeholder="Who is publishing this record" className="w-full border border-neutral-400 px-2 py-1 bg-white mt-1" style={{ fontSize: 12 }} />
          <p className="text-neutral-600 mt-2" style={{ fontSize: 11, lineHeight: 1.55 }}>
            {res.els.length} materials defined, {res.present.length} present
            {custom.length ? `, ${custom.length} added here (${custom.join(", ")})` : ""}. The registry travels with the
            record so a reader knows what each symbol means.
          </p>
        </div>
      </div>

      <div className="mt-8" style={{ maxWidth: "60em" }}>
        <Head>SUPPLY CHAIN</Head>
        {imported.length === 0 ? (
          <p className="text-neutral-600 mt-1" style={{ fontSize: 12, lineHeight: 1.6, maxWidth: "44em" }}>
            Every component here is declared by you. If a supplier publishes an Open Recycle component record, import it
            under Product and it arrives with their name and evidence level attached instead of being retyped as yours.
          </p>
        ) : (
          <table className="w-full mt-2" style={{ fontSize: 12 }}>
            <thead>
              <tr className="border-b border-neutral-900 text-neutral-500" style={{ fontSize: 10 }}>
                <th className="text-left py-2 font-normal">Component</th>
                <th className="text-left py-2 font-normal">Issuer</th>
                <th className="text-left py-2 font-normal">Published</th>
                <th className="text-center py-2 font-normal">Evidence</th>
                <th className="text-center py-2 font-normal">Integrity</th>
                <th className="text-right py-2 font-normal">Mass</th>
              </tr>
            </thead>
            <tbody>
              {imported.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100">
                  <td className="py-1.5">{c.name}</td>
                  <td className="py-1.5">{c.source.issuer}</td>
                  <td className="py-1.5 font-mono text-neutral-500">{c.source.published || "—"}</td>
                  <td className="py-1.5 text-center font-mono">{c.source.evidence}</td>
                  <td className="py-1.5 text-center" style={{ color: c.source.integrity ? "#1d7a7a" : "#b45309" }}>
                    {c.source.integrity ? "hash" : "none"}
                  </td>
                  <td className="py-1.5 text-right font-mono">{c.mass} g</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-neutral-500 mt-2" style={{ fontSize: 11, lineHeight: 1.5, maxWidth: "44em" }}>
          The record's evidence floor is <span className="font-mono">{floor}</span> — the weakest level among this
          product and everything it imports. One self-declared supplier part caps the whole record, which is the
          intended behaviour rather than a bug.
        </p>
      </div>

      <div className="border-l-2 border-neutral-900 pl-4 mt-8" style={{ maxWidth: "46em" }}>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Data completeness and recyclability stay separate. This record can reach L4 while grading E, and it can grade
          A while sitting below L1. A high conformance level means the claim is checkable, not that it is good.
        </p>
      </div>
    </div>
  );
}

/* ============================================================ EXAMPLES */
function ExamplesView({ importComponent, go }) {
  const [texts, setTexts] = useState({});
  const [open, setOpen] = useState(null);
  const [imp, setImp] = useState(null);

  useEffect(() => {
    EXAMPLE_FILES.forEach((ex) => {
      fetch(ex.path).then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
        .then((t) => setTexts((s) => ({ ...s, [ex.file]: t })))
        .catch(() => setTexts((s) => ({ ...s, [ex.file]: null })));
    });
  }, []);

  const download = (ex) => {
    const text = texts[ex.file];
    if (!text) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = ex.file; a.click();
  };

  const tryImport = (ex) => {
    const text = texts[ex.file];
    if (!text) return;
    const out = importComponent(text);
    setImp(out);
    if (out.ok) go("product");
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <Head>BUNDLED SAMPLES</Head>
      <h1 style={{ fontSize: 26, fontWeight: 300 }}>Examples</h1>
      <p className="text-neutral-600 mt-2" style={{ fontSize: 13, lineHeight: 1.6, maxWidth: "46em" }}>
        Two records shipped with this repository, kept under <code>examples/</code>. Neither is fiction dressed up as
        data: the worked example marks every unpublished figure as missing rather than inventing one, and the
        supplier record is explicitly illustrative.
      </p>

      {imp && (
        <div className="mt-4 border-l-2 px-3 py-2 flex items-start gap-3"
          style={{ borderColor: imp.ok ? "#1d3557" : "#991b1b", background: imp.ok ? "#f1f4f8" : "#fdf2f2", maxWidth: "46em" }}>
          <div className="flex-1" style={{ fontSize: 11, lineHeight: 1.5 }}>
            {imp.ok ? <>Imported into Product as a new component from <strong>{imp.issuer}</strong>.</> : imp.error}
          </div>
          <button onClick={() => setImp(null)} className="text-neutral-500" style={{ fontSize: 14, lineHeight: 1 }}>×</button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4" style={{ maxWidth: "46em" }}>
        {EXAMPLE_FILES.map((ex) => {
          const text = texts[ex.file];
          const failed = text === null;
          return (
            <div key={ex.file} className="border border-neutral-300 bg-white p-4">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div>
                  <div style={{ fontSize: 15 }}>{ex.title}</div>
                  <div className="font-mono text-neutral-500" style={{ fontSize: 10 }}>{ex.file}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {ex.kind === "component" && (
                    <button onClick={() => tryImport(ex)} disabled={!text} className="px-2 py-1 bg-neutral-900 text-white disabled:opacity-40" style={{ fontSize: 11 }}>
                      Import into Product
                    </button>
                  )}
                  <button onClick={() => setOpen(open === ex.file ? null : ex.file)} disabled={!text} className="px-2 py-1 border border-neutral-300 disabled:opacity-40" style={{ fontSize: 11 }}>
                    {open === ex.file ? "Hide JSON" : "View JSON"}
                  </button>
                  <button onClick={() => download(ex)} disabled={!text} className="px-2 py-1 border border-neutral-300 disabled:opacity-40" style={{ fontSize: 11 }}>
                    Download
                  </button>
                </div>
              </div>
              <p className="text-neutral-600 mt-2" style={{ fontSize: 12, lineHeight: 1.55 }}>{ex.blurb}</p>
              {failed && <p className="mt-2" style={{ fontSize: 11, color: "#991b1b" }}>Could not load this file.</p>}
              {open === ex.file && text && (
                <pre className="mt-3 p-2 bg-neutral-50 border border-neutral-200 overflow-auto" style={{ fontSize: 10, maxHeight: 360 }}>{text}</pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ SPEC */
function SpecView() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <Head>DRAFT 0.1 · RESEARCH PROTOTYPE, NOT AN OFFICIAL STANDARD</Head>
      <h1 style={{ fontSize: 26, fontWeight: 300 }}>Open Recyclability Specification</h1>

      <div className="grid lg:grid-cols-3 gap-8 mt-6">
        {[
          ["Separation classes", SEP, (v) => `${v.label} · efficiency ${v.eff}`, "Describes the joint, not the part. Proposed here; no equivalent international scale exists."],
          ["Circular quality classes", QUALITY, (v) => `${v.label} · weight ${v.w}`, "Energy recovery is C4 and is never summed into a material recycling rate."],
          ["Evidence levels", EVIDENCE, (v) => v, "A record's headline level is the lowest among the values that materially affect it, not the average."],
        ].map(([title, obj, fmt, note]) => (
          <div key={title}>
            <div style={{ fontSize: 15 }}>{title}</div>
            <table className="w-full mt-2" style={{ fontSize: 12 }}>
              <tbody>
                {Object.entries(obj).map(([k, v]) => (
                  <tr key={k} className="border-b border-neutral-100">
                    <td className="py-1.5 font-mono w-9">{k}</td>
                    <td className="py-1.5 text-neutral-700">{fmt(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-neutral-500 mt-2" style={{ fontSize: 11, lineHeight: 1.5 }}>{note}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-10" style={{ maxWidth: "68em" }}>
        <div>
          <Head>RULES THE APP ENFORCES</Head>
          <ol className="mt-2 space-y-2 text-neutral-700" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {[
              "Mass declared but not assigned to a material is shown, never renormalised away.",
              "Split fractions summing below 1 leave an unaccounted remainder, flagged on the node and counted as C5.",
              "An unconnected output port is a conformance failure, not a silent zero.",
              "Energy recovery is reported on its own line and excluded from material recovery.",
              "Data completeness never combines with any recovery or circularity figure.",
              "A recovery figure with no route named cannot be exported alone.",
              "Every exported outcome is tagged simulated at E3, because that is what it is.",
            ].map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-neutral-400 shrink-0" style={{ fontSize: 11 }}>{String(i + 1).padStart(2, "0")}</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <Head>REFERENCE CASE</Head>
          <p className="text-neutral-700 mt-2" style={{ fontSize: 12, lineHeight: 1.6 }}>
            The 2018 study by Reuter, van Schaik and Ballester modelled the Fairphone 2 through three processing routes.
            Whole-product smelting reached 14% metal and 25% total material recycling; dismantling with selective
            processing 19% and 28%; shredding 22% and 30%.
          </p>
          <p className="text-neutral-700 mt-3" style={{ fontSize: 12, lineHeight: 1.6 }}>
            Shredding produced the highest mass-based rates, yet the authors judged dismantling the better option once
            the range of recovered materials was weighed alongside recovered mass. That finding is why this app reports
            a profile and a per-material fate rather than one rate.
          </p>
          <p className="text-neutral-500 mt-3" style={{ fontSize: 11, lineHeight: 1.5 }}>
            No affiliation with or endorsement by Fairphone. The composition seeded here is a demonstration dataset
            built for the prototype and is not drawn from that study or any other publication.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ HOME
   Landing screen inside the app: what it is, how the result is
   produced, how it is ranked (with this product's live numbers),
   and where the ideas and published figures come from.
   ============================================================ */
const PAPER_URL = "https://www.researchgate.net/publication/323855448_Limits_of_the_Circular_Economy_Fairphone_Modular_Design_Pushing_the_Limits";
const GRADE_BANDS = [
  { g: "A", min: 0.78, note: "Most mass returns at equivalent or high function" },
  { g: "B", min: 0.62, note: "Good recovery, quality lost in places" },
  { g: "C", min: 0.45, note: "Recovers mass, loses function" },
  { g: "D", min: 0.28, note: "Largely downcycled or burned" },
  { g: "E", min: 0, note: "Most material is dissipated" },
];

function HomeView({ doc, res, conf, G, go }) {
  const t = res.totals;
  const byClass = Object.fromEntries(QK.map((q) => [q, res.els.reduce((s, el) => s + res.elem[el].byQ[q], 0)]));
  const contrib = QK.map((q) => ({ q, m: byClass[q], w: QUALITY[q].w, c: byClass[q] * QUALITY[q].w }));
  const weighted = contrib.reduce((s, x) => s + x.c, 0);

  const steps = [
    { n: "01", t: "Inventory", d: "Components, their mass, and composition in grams per material. Mass not assigned to any material is kept as a visible remainder.", v: "product" },
    { n: "02", t: "Separation", d: "Each component carries a separation class, D0 to D6. It sets how much of each material reaches the process it was meant for.", v: "product" },
    { n: "03", t: "Process graph", d: "A chain of unit operations — dismantling, shredding, sorting, smelting, leaching. Each node splits every material across its output ports.", v: "flow" },
    { n: "04", t: "Fate and quality", d: "Every terminal sink has a quality class, C0 to C5. A material's fate is the mass it delivers into each class. Anything that reaches no sink is a loss.", v: "figures" },
    { n: "05", t: "Rating", d: "Mass in each class is weighted and summed into a circularity index, then banded into a grade. Five sub-metrics are always shown beside it.", v: "rating" },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ---------- intro ---------- */}
      <div className="px-8 pt-10 pb-10 border-b border-neutral-300">
        <div className="grid lg:grid-cols-12 gap-10 items-start" style={{ maxWidth: 1180 }}>
          <div className="lg:col-span-7">
            <Head>OPEN RECYCLE · DRAFT 0.1 · RESEARCH PROTOTYPE</Head>
            <h1 style={{ fontSize: 44, fontWeight: 300, lineHeight: 1.05, letterSpacing: "-0.03em", marginTop: 10 }}>
              An open recyclability record for your product.
            </h1>
            <p className="text-neutral-600 mt-5" style={{ fontSize: 16, lineHeight: 1.6, maxWidth: "40em" }}>
              Describe a product once — its parts, what they are made of, how they are joined — then wire up the
              recycling route it would actually go through. The result is not one recycling rate. It is the fate of
              every material, at the quality it comes back at.
            </p>
            <div className="flex gap-3 mt-6 flex-wrap">
              <button onClick={() => go("product")} className="px-4 py-2 bg-neutral-900 text-white" style={{ fontSize: 13 }}>Start with the product</button>
              <button onClick={() => go("figures")} className="px-4 py-2 border border-neutral-400 hover:border-neutral-900" style={{ fontSize: 13 }}>See the figures</button>
            </div>
          </div>

          <div className="lg:col-span-5 border border-neutral-300 bg-white p-5">
            <Head>THIS DOCUMENT, RIGHT NOW</Head>
            <div className="flex items-center gap-4 mt-3">
              <div style={{ width: 64, height: 64, background: "#1a1a18", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 200 }}>{G.g}</div>
              <div>
                <div style={{ fontSize: 15 }}>{doc.product.name}</div>
                <div className="font-mono text-neutral-500" style={{ fontSize: 11 }}>
                  {conf.massSum.toFixed(0)} g · {doc.components.length} components · {res.present.length} materials
                </div>
              </div>
            </div>
            <table className="w-full mt-4" style={{ fontSize: 12 }}>
              <tbody>
                {[
                  ["Circularity index", pct(t.index)],
                  ["Material recovery", pct(t.rate)],
                  ["Closed-loop share", pct(t.closed)],
                  ["Critical materials", pct(t.critical)],
                  ["Conformance", conf.level || "below L1"],
                  ["Evidence floor", effectiveEvidence(doc)],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-neutral-100">
                    <td className="py-1.5 text-neutral-600">{k}</td>
                    <td className="py-1.5 text-right font-mono">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-neutral-500 mt-3" style={{ fontSize: 10.5, lineHeight: 1.5 }}>
              The seeded product is a demonstration dataset at E0. Its numbers illustrate the method; they are not
              measurements of any real phone.
            </p>
          </div>
        </div>
      </div>

      {/* ---------- method ---------- */}
      <div className="px-8 py-10 border-b border-neutral-300">
        <div style={{ maxWidth: 1180 }}>
          <Head>HOW IT IS DONE</Head>
          <h2 style={{ fontSize: 26, fontWeight: 300, marginTop: 6 }}>Five steps, one document underneath.</h2>
          <div className="grid md:grid-cols-5 gap-3 mt-6">
            {steps.map((s, i) => (
              <button key={s.n} onClick={() => go(s.v)} className="text-left border border-neutral-300 bg-white p-4 hover:border-neutral-900 relative">
                <div className="font-mono text-neutral-400" style={{ fontSize: 11 }}>{s.n}</div>
                <div style={{ fontSize: 15, marginTop: 2 }}>{s.t}</div>
                <p className="text-neutral-600 mt-2" style={{ fontSize: 12, lineHeight: 1.5 }}>{s.d}</p>
                {i < steps.length - 1 && (
                  <span className="hidden md:block absolute font-mono text-neutral-400" style={{ right: -11, top: 18, fontSize: 13, background: "#faf9f7", padding: "0 1px" }}>→</span>
                )}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-10 mt-10">
            <div>
              <Head>THE CALCULATION, PER MATERIAL</Head>
              <div className="font-mono border border-neutral-200 bg-white p-4 mt-2 overflow-x-auto" style={{ fontSize: 12, lineHeight: 1.9 }}>
                <div>feed(m) = Σ components · grams of m</div>
                <div>eff(m) &nbsp;= mass-weighted separation efficiency of m</div>
                <div>stream &nbsp;= feed · split(node, m, port) … through the graph</div>
                <div>fate(m, C) = mass of m arriving in sinks of class C</div>
                <div className="border-t border-neutral-200 mt-2 pt-2">recovery(m) = (C0 + C1 + C2 + C3) / feed(m)</div>
                <div>index(m) &nbsp;&nbsp;&nbsp;= Σ fate(m, C) · w(C) / feed(m)</div>
              </div>
              <p className="text-neutral-600 mt-3" style={{ fontSize: 12, lineHeight: 1.6 }}>
                The only link between design and outcome is the separation efficiency. A glued battery (D5) has
                efficiency 0.55 against 0.97 for a tool-less one (D1), so less of its lithium reaches battery
                treatment and more follows the rest of the phone into the smelter, where it goes to slag.
              </p>
            </div>
            <div>
              <Head>WHAT THE MODEL IS AND IS NOT</Head>
              <table className="w-full mt-2" style={{ fontSize: 12 }}>
                <tbody>
                  {[
                    ["Is", "A transparent mass-balance model. Every number that produces a result is visible and editable."],
                    ["Is", "Product-centric: the same material has a different fate depending on which part it sits in and where that part goes."],
                    ["Is not", "Thermodynamic process simulation. Split fractions are declared inputs, not derived from phase chemistry."],
                    ["Is not", "A reproduction of any published model or its results."],
                    ["Is not", "A certification, a mark, or an official standard."],
                  ].map(([k, v], i) => (
                    <tr key={i} className="border-b border-neutral-100">
                      <td className="py-2 pr-4 font-mono align-top" style={{ fontSize: 11, color: k === "Is" ? "#1d7a7a" : "#8a2b2b", width: 56 }}>{k}</td>
                      <td className="py-2 text-neutral-700">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- ranking ---------- */}
      <div className="px-8 py-10 border-b border-neutral-300">
        <div style={{ maxWidth: 1180 }}>
          <Head>HOW IT IS RANKED</Head>
          <h2 style={{ fontSize: 26, fontWeight: 300, marginTop: 6 }}>Every gram is weighted by the quality it comes back at.</h2>
          <p className="text-neutral-600 mt-3" style={{ fontSize: 14, lineHeight: 1.6, maxWidth: "46em" }}>
            Below is the ranking computed live for the product in this document. Change anything in the app and
            these numbers change with it.
          </p>

          <div className="grid lg:grid-cols-12 gap-10 mt-6">
            <div className="lg:col-span-7">
              <Head>WORKED EXAMPLE — THIS PRODUCT</Head>
              <table className="w-full mt-2" style={{ fontSize: 12 }}>
                <thead>
                  <tr className="border-b border-neutral-900 text-neutral-500" style={{ fontSize: 10 }}>
                    <th className="text-left py-2 font-normal">Class</th>
                    <th className="text-left py-2 font-normal">Meaning</th>
                    <th className="text-right py-2 font-normal">Mass g</th>
                    <th className="text-right py-2 font-normal">× weight</th>
                    <th className="text-right py-2 font-normal">= weighted g</th>
                  </tr>
                </thead>
                <tbody>
                  {contrib.map((x) => (
                    <tr key={x.q} className="border-b border-neutral-100">
                      <td className="py-1.5 font-mono" style={{ color: QUALITY[x.q].color }}>{x.q}</td>
                      <td className="py-1.5 text-neutral-700">{QUALITY[x.q].label}</td>
                      <td className="py-1.5 text-right font-mono">{x.m.toFixed(1)}</td>
                      <td className="py-1.5 text-right font-mono text-neutral-500">{x.w.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-mono">{x.c.toFixed(1)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-neutral-900">
                    <td className="py-2" colSpan={2}>Total</td>
                    <td className="py-2 text-right font-mono">{t.feed.toFixed(1)}</td>
                    <td />
                    <td className="py-2 text-right font-mono">{weighted.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="font-mono mt-3 border border-neutral-200 bg-white px-4 py-3" style={{ fontSize: 13 }}>
                index = {weighted.toFixed(1)} / {t.feed.toFixed(1)} = <strong>{pct(t.index)}</strong> → grade <strong>{G.g}</strong>
              </div>
              <p className="text-neutral-500 mt-3" style={{ fontSize: 11, lineHeight: 1.55 }}>
                The weights are a convention of this draft, not a physical constant. They are exported with every
                record so anyone can recompute the index with weights they prefer.
              </p>
            </div>

            <div className="lg:col-span-5">
              <Head>GRADE BANDS</Head>
              <table className="w-full mt-2" style={{ fontSize: 12 }}>
                <tbody>
                  {GRADE_BANDS.map((b, i) => {
                    const hi = i === 0 ? null : GRADE_BANDS[i - 1].min;
                    const on = b.g === G.g;
                    return (
                      <tr key={b.g} className="border-b border-neutral-100" style={{ background: on ? "#fff" : "transparent" }}>
                        <td className="py-1.5 pr-3" style={{ width: 30 }}>
                          <span style={{ display: "inline-flex", width: 22, height: 22, alignItems: "center", justifyContent: "center", background: on ? "#1a1a18" : "transparent", color: on ? "#fff" : "#1a1a18", border: "1px solid #1a1a18", fontSize: 12 }}>{b.g}</span>
                        </td>
                        <td className="py-1.5 font-mono text-neutral-600" style={{ fontSize: 11, width: 92 }}>
                          {hi == null ? `≥ ${pct0(b.min)}` : b.min === 0 ? `< ${pct0(hi)}` : `${pct0(b.min)}–${pct0(hi)}`}
                        </td>
                        <td className="py-1.5 text-neutral-700">{b.note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-6"><Head>ALWAYS SHOWN BESIDE THE GRADE</Head></div>
              <table className="w-full mt-2" style={{ fontSize: 12 }}>
                <tbody>
                  {[
                    ["Material recovery", t.rate, "Share of mass reaching C0–C3. Energy recovery excluded."],
                    ["Closed-loop share", t.closed, "Share of mass returning at equivalent function."],
                    ["Critical materials", t.critical, "Recovery across materials flagged critical."],
                    ["Material breadth", t.breadth, "Share of materials recovered above half their input."],
                    ["Per-material index", t.perElement, "Every material counted once, however little of it there is."],
                  ].map(([k, v, d]) => (
                    <tr key={k} className="border-b border-neutral-100">
                      <td className="py-1.5 pr-3 align-top">{k}<div className="text-neutral-500" style={{ fontSize: 10.5 }}>{d}</div></td>
                      <td className="py-1.5 text-right font-mono align-top">{pct0(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-l-2 border-neutral-900 pl-4 mt-8" style={{ maxWidth: "50em" }}>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              Why the breakdown matters more than the grade: the index is mass-weighted, so a few grams of tantalum
              barely move it. Per-material index counts every material equally, which is where scarce elements show
              up. Read the two together — a product can grade well on bulk plastics and aluminium while losing every
              critical metal it contains.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {[
              ["Never combined", "Data completeness and recyclability are separate measurements. A record can be fully documented and badly recyclable."],
              ["Never folded in", "Energy recovery is C4 at weight 0.05. It is shown on its own line and never counted as material recycling."],
              ["Never hidden", "Mass that reaches no sink, or that a split row fails to account for, is counted as C5 loss rather than dropped."],
            ].map(([k, v]) => (
              <div key={k} className="border border-neutral-200 bg-white p-4">
                <div style={{ fontSize: 14 }}>{k}</div>
                <p className="text-neutral-600 mt-1" style={{ fontSize: 12, lineHeight: 1.5 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- reference ---------- */}
      <div className="px-8 py-10 border-b border-neutral-300">
        <div style={{ maxWidth: 1180 }}>
          <Head>REFERENCE CASE AND SOURCES</Head>
          <h2 style={{ fontSize: 26, fontWeight: 300, marginTop: 6 }}>The finding this is built around.</h2>

          <div className="grid lg:grid-cols-12 gap-10 mt-6">
            <div className="lg:col-span-7">
              <div className="border border-neutral-300 bg-white p-5">
                <div className="font-mono text-neutral-500" style={{ fontSize: 10 }}>PRIMARY REFERENCE</div>
                <div style={{ fontSize: 15, marginTop: 4, lineHeight: 1.4 }}>
                  Reuter, M. A., van Schaik, A. &amp; Ballester, M. (2018). <em>Limits of the Circular Economy:
                  Fairphone Modular Design Pushing the Limits.</em>
                </div>
                <a href={PAPER_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-2 underline text-neutral-600" style={{ fontSize: 12 }}>
                  Open the paper
                </a>

                <table className="w-full mt-5" style={{ fontSize: 12 }}>
                  <thead>
                    <tr className="border-b border-neutral-900 text-neutral-500" style={{ fontSize: 10 }}>
                      <th className="text-left py-2 font-normal">Route</th>
                      <th className="text-right py-2 font-normal">Metal</th>
                      <th className="text-right py-2 font-normal">Material</th>
                      <th className="text-right py-2 font-normal">+ energy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Whole-product smelting", 14, 25, 36],
                      ["Dismantling, selective processing", 19, 28, 31],
                      ["Shredding, physical separation", 22, 30, 31],
                    ].map(([r, a, b, c]) => (
                      <tr key={r} className="border-b border-neutral-100">
                        <td className="py-1.5">{r}</td>
                        <td className="py-1.5 text-right font-mono">{a}%</td>
                        <td className="py-1.5 text-right font-mono">{b}%</td>
                        <td className="py-1.5 text-right font-mono">{c}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-neutral-500 mt-2" style={{ fontSize: 10.5 }}>Published aggregates, percentages of product mass.</p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <p className="text-neutral-700" style={{ fontSize: 14, lineHeight: 1.6 }}>
                The study modelled a modular smartphone through three routes. Shredding produced the highest mass-based
                rates, yet the authors judged dismantling the better option once the range of recovered materials was
                weighed alongside the recovered mass.
              </p>
              <p className="text-neutral-700 mt-3" style={{ fontSize: 14, lineHeight: 1.6 }}>
                Smelting leads the last column only because combustion is counted. That is why energy recovery is kept
                on its own line in this app.
              </p>
              <p className="text-neutral-500 mt-4" style={{ fontSize: 11.5, lineHeight: 1.55 }}>
                The route aggregates above are the only published figures in this app. The seeded composition, split
                fractions and element-level results are a demonstration dataset built for the prototype and are not
                taken from the paper.
              </p>
            </div>
          </div>

          <table className="w-full mt-10" style={{ fontSize: 12, maxWidth: 980 }}>
            <thead>
              <tr className="border-b border-neutral-900 text-neutral-500" style={{ fontSize: 10 }}>
                <th className="text-left py-2 font-normal">Idea in this app</th>
                <th className="text-left py-2 font-normal">Where it comes from</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Product-centric recycling — a material's fate depends on the product and route, not on the material alone", "Reuter and co-workers; the Fairphone study above"],
                ["The carrier wheel figure", "Inspired by the Metal Wheel concept of Reuter and van Schaik, which maps elements to carrier-metal infrastructures. The figure here is an original, per-product result, not a reproduction."],
                ["Route aggregates and the dismantling-versus-shredding finding", "Reuter, van Schaik & Ballester, 2018"],
                ["D, C and E scales; conformance levels; evidence floor; grade bands", "Proposed by this draft. Not drawn from any source and not an existing standard."],
              ].map(([a, b], i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-2 pr-6 align-top">{a}</td>
                  <td className="py-2 text-neutral-600 align-top">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-neutral-500 mt-6" style={{ fontSize: 11, lineHeight: 1.55, maxWidth: "56em" }}>
            No affiliation with or endorsement by Fairphone, the authors, or any manufacturer. Open Recycle is a research
            prototype.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ FIGURES
   Carrier wheel — one sector per processing infrastructure that feeds a
   terminal sink, concentric rings for circular quality class, a dot for
   every material that actually reported there.

   This is computed from the user's own graph. It is not the published
   Metal Wheel, which is a fixed knowledge map of element-to-carrier
   compatibility rather than a result for one product.
   ============================================================ */
function carrierSectors(doc, res) {
  const sinks = {};
  doc.graph.nodes.filter((n) => LIB[n.type].kind === "sink").forEach((n) => (sinks[n.id] = n));
  const nodeById = Object.fromEntries(doc.graph.nodes.map((n) => [n.id, n]));
  const sectors = {};

  doc.graph.edges.forEach((e) => {
    const sink = sinks[e.to];
    const src = nodeById[e.from];
    if (!sink || !src) return;
    const q = sink.quality || LIB[sink.type].quality || "C5";
    const flow = res.edgeFlow[e.id] || {};
    res.els.forEach((el) => {
      const m = flow[el] || 0;
      if (m <= 0.0005) return;
      if (!sectors[src.id]) sectors[src.id] = { id: src.id, label: src.label, cells: {}, total: 0 };
      const key = el + "|" + q;
      sectors[src.id].cells[key] = (sectors[src.id].cells[key] || 0) + m;
      sectors[src.id].total += m;
    });
  });

  // material that never reached any sink
  const placed = {};
  Object.values(sectors).forEach((s) => Object.entries(s.cells).forEach(([k, v]) => {
    const el = k.split("|")[0];
    placed[el] = (placed[el] || 0) + v;
  }));
  const stranded = {};
  let strandedTotal = 0;
  res.els.forEach((el) => {
    const left = (res.feed[el] || 0) - (placed[el] || 0);
    if (left > 0.0005) { stranded[el + "|C5"] = left; strandedTotal += left; }
  });
  const list = Object.values(sectors).sort((a, b) => b.total - a.total);
  if (strandedTotal > 0.0005) list.push({ id: "__stranded", label: "Never reached a sink", cells: stranded, total: strandedTotal });
  return list;
}

function FiguresView({ doc, res, G }) {
  const [hover, setHover] = useState(null);
  const sectors = useMemo(() => carrierSectors(doc, res), [doc, res]);
  const present = res.present;

  const S = 660, cx = S / 2, cy = S / 2;
  const r0 = 86, r1 = 258;
  const band = (r1 - r0) / QK.length;
  const step = sectors.length ? (Math.PI * 2) / sectors.length : 0;
  const maxCell = Math.max(0.001, ...sectors.flatMap((s) => Object.values(s.cells)));
  const dotR = (m) => 3 + 9 * Math.sqrt(m / maxCell);

  const arc = (rad, a, b) =>
    `M ${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)} A ${rad} ${rad} 0 ${b - a > Math.PI ? 1 : 0} 1 ${cx + rad * Math.cos(b)} ${cy + rad * Math.sin(b)}`;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <Head>FIGURES</Head>
      <h1 style={{ fontSize: 26, fontWeight: 300 }}>Where the material reported</h1>
      <p className="text-neutral-600 mt-2" style={{ fontSize: 14, lineHeight: 1.6, maxWidth: "52em" }}>
        Two circular views of the same result. The carrier wheel is process-centric: each sector is one
        processing infrastructure in your graph, and a material's fate depends on which sector it entered. The
        fate wheel is material-centric: each wedge is the whole of one material, whatever route it took.
      </p>

      {sectors.length === 0 ? (
        <p className="text-neutral-500 mt-8" style={{ fontSize: 13 }}>
          Nothing has reached a terminal sink yet. Wire the process flow first.
        </p>
      ) : (
        <div className="grid xl:grid-cols-12 gap-10 mt-8">
          {/* ---------- carrier wheel ---------- */}
          <div className="xl:col-span-7">
            <Head>CARRIER WHEEL — ONE SECTOR PER PROCESSING INFRASTRUCTURE</Head>
            <div className="relative">
              <svg viewBox={`0 0 ${S} ${S}`} className="w-full" style={{ maxHeight: 660 }}>
                {/* ring bands */}
                {QK.map((q, i) => (
                  <circle key={q} cx={cx} cy={cy} r={r0 + band * (i + 1)} fill="none"
                    stroke={i === QK.length - 1 ? "#c9c6bf" : "#e8e5df"} strokeWidth="1" />
                ))}
                <circle cx={cx} cy={cy} r={r0} fill="none" stroke="#c9c6bf" strokeWidth="1" />

                {/* ring shading, innermost = best */}
                {QK.map((q, i) => (
                  <circle key={"sh" + q} cx={cx} cy={cy} r={r0 + band * i + band / 2} fill="none"
                    stroke={QUALITY[q].color} strokeOpacity="0.07" strokeWidth={band} />
                ))}

                {/* sector dividers and labels */}
                {sectors.map((s, si) => {
                  const a0 = si * step - Math.PI / 2;
                  const am = a0 + step / 2;
                  const lr = r1 + 16;
                  const lx = cx + lr * Math.cos(am), ly = cy + lr * Math.sin(am);
                  const right = Math.cos(am) > -0.05;
                  const dim = hover && hover.sector !== s.id;
                  return (
                    <g key={s.id} opacity={dim ? 0.25 : 1}>
                      <line x1={cx + r0 * Math.cos(a0)} y1={cy + r0 * Math.sin(a0)}
                        x2={cx + (r1 + 6) * Math.cos(a0)} y2={cy + (r1 + 6) * Math.sin(a0)}
                        stroke="#c9c6bf" strokeWidth="1" />
                      <text x={lx} y={ly} textAnchor={right ? "start" : "end"} fontSize="12" fill="#1a1a18"
                        dominantBaseline="middle">
                        {s.label.length > 26 ? s.label.slice(0, 25) + "…" : s.label}
                      </text>
                      <text x={lx} y={ly + 13} textAnchor={right ? "start" : "end"} fontSize="9.5"
                        fill="#8c8a84" fontFamily="ui-monospace, monospace" dominantBaseline="middle">
                        {g1(s.total)} g
                      </text>
                    </g>
                  );
                })}

                {/* dots */}
                {sectors.map((s, si) => {
                  const a0 = si * step - Math.PI / 2;
                  return QK.map((q, qi) => {
                    const inRing = Object.entries(s.cells)
                      .filter(([k]) => k.split("|")[1] === q)
                      .sort((a, b) => b[1] - a[1]);
                    if (!inRing.length) return null;
                    const rMid = r0 + band * qi + band / 2;
                    return inRing.map(([k, m], di) => {
                      const el = k.split("|")[0];
                      const a = a0 + (step * (di + 1)) / (inRing.length + 1);
                      const x = cx + rMid * Math.cos(a), y = cy + rMid * Math.sin(a);
                      const active = hover && hover.el === el;
                      const dim = hover && hover.el !== el;
                      const r = dotR(m);
                      return (
                        <g key={s.id + k} opacity={dim ? 0.18 : 1}
                          onMouseEnter={() => setHover({ el, q, m, sector: s.id, label: s.label })}
                          onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
                          <circle cx={x} cy={y} r={r} fill={QUALITY[q].color}
                            stroke={active ? "#1a1a18" : "none"} strokeWidth="1.5" />
                          {r >= 6.5 && (
                            <text x={x} y={y + 3} textAnchor="middle" fontSize="8.5" fill="#fff"
                              fontFamily="ui-monospace, monospace">{el}</text>
                          )}
                          {r < 6.5 && (
                            <text x={x} y={y - r - 3} textAnchor="middle" fontSize="8.5"
                              fill={res.def[el].critical ? "#7a3b2e" : "#6b7280"}
                              fontFamily="ui-monospace, monospace">{el}</text>
                          )}
                        </g>
                      );
                    });
                  });
                })}

                {/* ring keys along the top spoke */}
                {QK.map((q, i) => (
                  <text key={"rk" + q} x={cx + 4} y={cy - (r0 + band * i + band / 2) + 3} fontSize="9"
                    fill={QUALITY[q].color} fontFamily="ui-monospace, monospace">{q}</text>
                ))}

                <text x={cx} y={cy - 6} textAnchor="middle" fontSize="30" fill="#1a1a18" fontWeight="300">{G.g}</text>
                <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="#8c8a84"
                  fontFamily="ui-monospace, monospace">{pct0(res.totals.index)} index</text>
              </svg>

              {hover && (
                <div className="absolute left-0 top-0 bg-white border border-neutral-400 px-3 py-2" style={{ minWidth: 190 }}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span style={{ fontSize: 13 }}>{res.def[hover.el].name}</span>
                    <span className="font-mono text-neutral-500" style={{ fontSize: 10 }}>{hover.el}</span>
                  </div>
                  <div className="mt-1" style={{ fontSize: 11 }}>
                    <div className="flex justify-between gap-6"><span className="text-neutral-500">Via</span><span>{hover.label}</span></div>
                    <div className="flex justify-between gap-6"><span className="text-neutral-500">Mass</span><span className="font-mono">{g1(hover.m)} g</span></div>
                    <div className="flex justify-between gap-6">
                      <span className="text-neutral-500">Fate</span>
                      <span className="font-mono" style={{ color: QUALITY[hover.q].color }}>{hover.q} {QUALITY[hover.q].label}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {QK.map((q) => (
                <span key={q} className="flex items-center gap-1.5" style={{ fontSize: 10 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 5, background: QUALITY[q].color }} />
                  <span className="font-mono">{q}</span><span className="text-neutral-500">{QUALITY[q].label}</span>
                </span>
              ))}
            </div>

            <p className="text-neutral-600 mt-4" style={{ fontSize: 12, lineHeight: 1.6, maxWidth: "46em" }}>
              Read it outward. A dot near the middle came back at full function; the same material appearing in an
              outer ring of another sector is the share of it that was lost there. Dot area is mass, so a large
              outer dot is where the tonnage is going. A material scattered across several sectors is one whose
              fate was decided by sorting, not by chemistry.
            </p>
            <p className="text-neutral-500 mt-3" style={{ fontSize: 11, lineHeight: 1.55, maxWidth: "46em" }}>
              This figure is generated from your own graph and is specific to this product. It is not the published
              Metal Wheel, which maps which elements are thermodynamically compatible with which carrier metal
              industry in general, and is a different thing.
            </p>
          </div>

          {/* ---------- fate wheel ---------- */}
          <div className="xl:col-span-5">
            <Head>FATE WHEEL — ONE WEDGE PER MATERIAL</Head>
            <FateWheel res={res} hover={hover} setHover={setHover} />
            <table className="w-full mt-4" style={{ fontSize: 12 }}>
              <thead>
                <tr className="border-b border-neutral-900 text-neutral-500" style={{ fontSize: 10 }}>
                  <th className="text-left py-2 font-normal">Material</th>
                  <th className="text-right py-2 font-normal">Input</th>
                  <th className="text-right py-2 font-normal">Index</th>
                  <th className="text-left py-2 pl-3 font-normal">Fate</th>
                </tr>
              </thead>
              <tbody>
                {present.slice().sort((a, b) => res.elem[a].index - res.elem[b].index).map((el) => (
                  <tr key={el} className="border-b border-neutral-100"
                    onMouseEnter={() => setHover({ el })} onMouseLeave={() => setHover(null)}
                    style={{ background: hover && hover.el === el ? "#fff" : "transparent" }}>
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5">
                        <span style={{ width: 7, height: 7, background: res.def[el].color }} />{res.def[el].name}
                        {res.def[el].critical && <span className="font-mono" style={{ fontSize: 8, color: "#7a3b2e" }}>CRM</span>}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono text-neutral-500">{g1(res.elem[el].init)} g</td>
                    <td className="py-1.5 text-right font-mono">{pct0(res.elem[el].index)}</td>
                    <td className="py-1.5 pl-3" style={{ width: 96 }}><QualityBar res={res} el={el} thin /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FateWheel({ res, hover, setHover }) {
  const present = res.present;
  const S = 420, cx = S / 2, cy = S / 2, r0 = 66, r1 = 170;
  const step = present.length ? (Math.PI * 2) / present.length : 0;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full" style={{ maxHeight: 420 }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <circle key={f} cx={cx} cy={cy} r={r0 + (r1 - r0) * f} fill="none" stroke="#e6e4df" strokeWidth="0.7" />
      ))}
      {present.map((el, i) => {
        const e = res.elem[el];
        const a0 = i * step - Math.PI / 2 + step * 0.12, a1 = (i + 1) * step - Math.PI / 2 - step * 0.12;
        const am = (a0 + a1) / 2;
        let acc = 0;
        const active = hover && hover.el === el;
        return (
          <g key={el} onMouseEnter={() => setHover({ el })} onMouseLeave={() => setHover(null)}
            opacity={hover && hover.el !== el ? 0.3 : 1}>
            {QK.map((q) => {
              const frac = e.init ? e.byQ[q] / e.init : 0;
              if (frac <= 0.0005) return null;
              const ra = r0 + (r1 - r0) * acc, rb = r0 + (r1 - r0) * (acc + frac);
              acc += frac;
              const p = (rad, s, t) => `${cx + rad * Math.cos(s)} ${cy + rad * Math.sin(s)} A ${rad} ${rad} 0 0 1 ${cx + rad * Math.cos(t)} ${cy + rad * Math.sin(t)}`;
              return <path key={q} d={`M ${p(ra, a0, a1)} L ${cx + rb * Math.cos(a1)} ${cy + rb * Math.sin(a1)} A ${rb} ${rb} 0 0 0 ${cx + rb * Math.cos(a0)} ${cy + rb * Math.sin(a0)} Z`}
                fill={QUALITY[q].color} opacity={active ? 1 : 0.88} />;
            })}
            <text x={cx + (r1 + 17) * Math.cos(am)} y={cy + (r1 + 17) * Math.sin(am) + 4} textAnchor="middle"
              fontSize="11" fontWeight={active ? 700 : 400}
              fill={res.def[el].critical ? "#7a3b2e" : "#3a3a38"}>{el}</text>
          </g>
        );
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="24" fill="#1a1a18" fontWeight="300">{pct0(res.totals.index)}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#8c8a84" fontFamily="ui-monospace, monospace">index</text>
    </svg>
  );
}

/* ---------- atoms ---------- */
function Head({ children }) {
  return <div className="font-mono text-neutral-500" style={{ fontSize: 9, letterSpacing: "0.06em" }}>{children}</div>;
}
function Stat({ label, value }) {
  return (
    <div className="border border-neutral-200 bg-white px-3 py-2">
      <Head>{label.toUpperCase()}</Head>
      <div style={{ fontSize: 18, fontWeight: 300 }}>{value}</div>
    </div>
  );
}
function QualityBar({ res, el, thin }) {
  const src = el ? res.elem[el].byQ : Object.fromEntries(QK.map((q) => [q, res.els.reduce((s, e) => s + res.elem[e].byQ[q], 0)]));
  const tot = QK.reduce((s, q) => s + src[q], 0) || 1;
  return (
    <div className="flex mt-1" style={{ height: thin ? 4 : 10 }}>
      {QK.map((q) => (src[q] / tot > 0.0005 ? (
        <div key={q} title={`${q} ${QUALITY[q].label} · ${g1(src[q])} g`} style={{ width: `${(src[q] / tot) * 100}%`, background: QUALITY[q].color, transition: "width 300ms" }} />
      ) : null))}
    </div>
  );
}
function PalBtn({ children, onClick, dot }) {
  return (
    <button onClick={onClick} className="w-full text-left px-2 py-1.5 border border-neutral-200 bg-white hover:border-neutral-500 mb-1 flex items-center gap-2" style={{ fontSize: 11 }}>
      {dot && <span style={{ width: 7, height: 7, background: dot, flexShrink: 0 }} />}
      <span style={{ flex: 1 }}>{children}</span>
    </button>
  );
}
