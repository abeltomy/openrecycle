# Build prompt — Open Recycle

You are a senior front-end engineer and data-visualisation specialist with a background in process
metallurgy. Build a working web application, not a landing page and not a mockup.

## What it is

**Open Recycle** — a draft open specification and an interactive tool for describing what happens to every
material in a product after its useful life. The thesis the whole app exists to make visible:

> A product does not have one recycling rate. It has one fate per material, per route, at a quality.

A product can report 90% recycling by mass while losing every gram of its scarcest metals. The app must make
that impossible to hide.

## Stack

React + Tailwind, single page, no backend. All state in memory, JSON import/export for persistence.
Hand-rolled SVG for visualisation — do not pull in a chart library. Must run from one file.

## Design language

Scientific instrument, not sustainability brochure. Off-white `#faf9f7`, near-black ink `#1a1a18`, hairline
rules `#d6d3cc`, white panels. Monospace for all numbers and metadata, sans for prose. Zero border radius.
Large light-weight numerals. Colour is **only** used to encode data — the quality classes below are the entire
palette. No green, no leaves, no gradients, no ESG dashboard.

## The three scales

All three are proposed by this specification. Label them as proposed; none is an existing international standard.

**Separation classes** — describes the joint, not the part:

| | | efficiency |
|---|---|---|
| D0 | Automatic | 0.99 |
| D1 | Tool-less | 0.97 |
| D2 | Common hand tool | 0.93 |
| D3 | Specialist tool | 0.85 |
| D4 | Thermal / chemical | 0.70 |
| D5 | Destructive | 0.55 |
| D6 | Practically inseparable | 0.25 |

**Circular quality classes** — what a recovered gram comes back as:

| | | weight | colour |
|---|---|---|---|
| C0 | Closed loop, equivalent function | 1.00 | `#123f6d` |
| C1 | High-quality open loop | 0.80 | `#1d7a7a` |
| C2 | Downcycled | 0.45 | `#8a7f2a` |
| C3 | Feedstock recovery | 0.25 | `#a06a1f` |
| C4 | Energy recovery | 0.05 | `#b45309` |
| C5 | Dissipative loss | 0.00 | `#8a2b2b` |

**Evidence levels** — E0 self-declared, E1 manufacturer doc, E2 engineering calculation, E3 process simulation,
E4 experimental recycling trial, E5 independently verified industrial data.

## Data model

One document drives everything:

```
doc = {
  product:    { name, category, year, architecture, evidence, issuer }
  elements:   { SYM: { name, color, critical } }        // user-extensible registry
  components: [ { id, name, mass, sep, tool, time, hazard, comp: {SYM: grams}, source? } ]
  graph:      { nodes: [...], edges: [...] }
}
```

`source` is present only on imported components: `{ issuer, published, evidence, integrity }`.

Graph nodes are one of three kinds:

| kind | behaviour |
|---|---|
| `source` | Emits the product's summed composition. Not editable on the canvas — it reads from the product model. |
| `process` | Named output ports plus a **split matrix**: per material, the fraction leaving by each port. |
| `sink` | Terminal. Carries a circular quality class. |

The split matrix is the only process abstraction — it covers shredding, magnetic separation, smelting,
leaching, polymer regranulation, everything. A `_` row is the fallback for materials without their own row.

## Solver

Iterate the graph (`nodes.length + 4` passes, which settles loops), summing streams into each node and
splitting them out by port. Then:

1. Sum each sink's arriving stream into its quality class, per material.
2. Any material mass that never reaches a sink counts as **C5**.
3. Per material: `recovery = (C0+C1+C2+C3) / input`, `index = Σ(mass_class × weight_class) / input`.
4. Product index = the same, mass-weighted across all materials. Grade A ≥ 0.78, B ≥ 0.62, C ≥ 0.45, D ≥ 0.28, else E.

**The one clever link.** Compute a mass-weighted separation efficiency per material from the D-classes of the
components holding it. The dismantling node scales its targeted split rows by that factor and spills the
remainder into its `rest` port. Result: moving a battery from D1 to D5 in the product table drops the lithium
reaching battery pre-treatment, sends it to the smelter, turns it to slag, and lowers the grade — visible
across four screens from one dropdown. Build this; it is the point of the app.

## Screens

| Screen | Contains |
|---|---|
| **Product** | Component table with editable mass, separation class, disassembly time. Add / duplicate / delete. Composition editor in grams per material, with an "add new material to registry" form. Import and publish supplier component records. |
| **Process flow** | Node canvas. Drag headers to move, drag background to pan, click an output port then a target node to wire, click a wire to delete. Edge thickness and gram labels show flow. Filter the whole canvas to a single material. Split matrix editor in the inspector. |
| **Rating** | Grade, circularity index, five sub-metrics, a radial wheel where each wedge is the whole of one material stacked inside-out by quality class, a scorecard table sorted worst-first, and the weakest link named. |
| **Record** | Live conformance checks, evidence floor, supply-chain provenance table, JSON export. |
| **Specification** | The three scales and the enforced rules, as reference. |

## Conformance

Five levels, computed live from the document, each shown passing or failing with the reason:

| | | requires |
|---|---|---|
| L1 | Inventory | Components have mass and composition; composition within 1% of declared mass |
| L2 | Architecture | Separation class and disassembly time on every component |
| L3 | Route | A route reaching terminal sinks; no unconnected output port; nothing unaccounted |
| L4 | Evidence | Evidence floor above E0 |
| L5 | Verified | Recovery values at E4 or E5 |

**Below L3 the app must not let a recovery rate be exported at all.** It may export composition.

## Supply chain

A component record is the same document with `recordType: "component"`, published by whoever made the part,
carrying its own `issuer`, `evidence`, `materialRegistry` and `integrity` hash. Importing one:

- adds any unknown materials to the registry from the file's own `materialRegistry`
- locks mass and composition read-only, shown greyed and attributed to the issuer
- leaves the interface joint and disassembly position editable, because the integrator owns those
- offers "unlink and take ownership", which makes the numbers editable and drops the issuer's evidence level

**Evidence takes the minimum**, not the average:
`effective = min(product.evidence, min over imported components)`. A product with E4 trial data on everything
except one E0 connector is an E0 record. Show this in the UI as the reason, naming the offending component.

## Rules the app must enforce

1. Mass declared but not assigned to a material is shown as a hatched remainder, never renormalised away.
2. Split fractions summing below 1 leave an unaccounted remainder, flagged red on the node and counted as C5.
3. An unconnected output port is a conformance failure, not a silent zero.
4. Energy recovery is C4, reported on its own line, never summed into a material recycling rate.
5. Data completeness and recyclability are separate measurements and are never combined into one score.
6. Every exported outcome is tagged `simulated` at E3, because that is what it is.
7. Material recovery and circularity index are shown side by side. The gap between them is the downcycling.

## Reference case

Seed the app with a modular smartphone, roughly 168 g across eight modules. **The seeded composition is a
demonstration dataset you generate for the prototype.** It must be set to evidence E0 and must not be presented
as coming from any publication.

The only published figures to include, cited to Reuter, van Schaik & Ballester (2018), are the route aggregates
for a modular smartphone: smelting 14% metal / 25% material / 36% with energy recovery; dismantling 19 / 28 / 31;
shredding 22 / 30 / 31. The finding that matters: shredding produced the highest mass-based rates, but the
authors judged dismantling the better route once the range of recovered materials was weighed alongside the mass.

## Do not

- Do not fabricate element-level recovery figures and attribute them to any study or manufacturer.
- Do not imply affiliation with or endorsement by any manufacturer.
- Do not claim the scales are established standards or that a certification exists.
- Do not collapse the profile into one opaque green score.
- Do not build static pages. Every interaction listed above must actually work.

## Done when

Someone can open it, change one dropdown, and say *"I can finally see why this product is or isn't
recyclable"* — rather than *"this product scored 72."*
