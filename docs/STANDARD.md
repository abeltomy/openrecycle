# Open Recyclability Specification

**Draft 0.1** · Status: research prototype, not an official standard, not a certification scheme

---

## 0. Why this exists

A recyclability claim on a product today is usually a single percentage with no way to check it. That number
hides three things that decide whether recycling actually works:

1. **Which element.** A product can report 90% recycling by mass while losing every gram of its scarcest metals.
2. **Which route.** The same product sent to a smelter, a dismantling line or a shredder produces different
   element-level outcomes. There is no single "the recycling rate" of a product.
3. **What quality.** Aluminium recovered as a cast alloy and aluminium recovered as slag aggregate are both
   "recovered". Only one of them can go back into the part it came from.

This specification defines the minimum record a product must carry before any recyclability claim about it can
be evaluated. It does not define a passing grade. It defines what has to be on the table.

**Scope.** Any product assembled from separable parts made of more than one material: electronics, batteries,
appliances, vehicle components, machines, industrial equipment.

---

## 1. Conformance levels

| Level | Name | Requires |
|---|---|---|
| **L1** | Inventory | Sections 01–04. Product identity, architecture, components, composition. Mass balance closes. |
| **L2** | Architecture | L1 plus 05–06. Connections and disassembly described for every component. |
| **L3** | Route | L2 plus 07–10. At least one full recycling route, its outputs, and a quality class on every output. |
| **L4** | Evidence | L3 plus 13–14. Every declared value carries an evidence level and a source. |
| **L5** | Verified | L4 with every recovery value at evidence level E4 or E5. |

A record states its own level. A record that claims a level it does not meet is non-conformant.

Below L3, a record may not publish a recovery rate at all. It may publish composition.

---

## 2. Entities

```
Product
 ├── Component[]           physical parts
 │    └── MaterialEntry[]  what each part is made of
 ├── Connection[]          how components are joined
 ├── Route[]               a full processing chain
 │    └── ProcessStep[]    one unit operation
 ├── Outcome[]             per material, per route: where it ended up
 └── Evidence[]            what backs each value
```

Every entity carries `id`. Every declared numeric value carries `evidence` (§5) and `provenance` (§6).

### 2.1 Product

| Field | Req | Type | Note |
|---|---|---|---|
| `id` | ● | string | Stable identifier |
| `category` | ● | string | Smartphone, cell module, pump, etc. |
| `manufacturer` | ○ | string | |
| `model` | ○ | string | |
| `year` | ○ | integer | Year of placing on market |
| `totalMass` | ● | number, g | Must equal Σ component mass within 1% |
| `architecture` | ● | enum | `modular` · `partially-modular` · `integrated` |

### 2.2 Component

| Field | Req | Type | Note |
|---|---|---|---|
| `id` | ● | string | |
| `name` | ● | string | |
| `mass` | ● | number, g | |
| `parentId` | ○ | string | For nested assemblies |
| `materials` | ● | MaterialEntry[] | |
| `hazard` | ○ | string | Stored energy, pressure, toxicity |

### 2.3 MaterialEntry

| Field | Req | Type | Note |
|---|---|---|---|
| `materialId` | ● | string | Element symbol, or an alloy/polymer identifier |
| `mass` | ● | number, g | |
| `recycledContent` | ○ | number, 0–1 | |
| `critical` | ○ | boolean | Against a named criticality list, given in `criticalityList` |

**Unmodelled remainder.** If Σ material mass is less than component mass, the difference is declared explicitly
as `unmodelled`. A record may not silently drop mass. This is a required field once the gap exceeds 1%.

### 2.4 Connection

| Field | Req | Type |
|---|---|---|
| `from`, `to` | ● | component id |
| `type` | ● | string — screw, clip, adhesive, weld, solder, press-fit, connector |
| `separationClass` | ● | D0–D6 (§3) |
| `reversible` | ● | boolean |
| `tool` | ○ | string |
| `fastenerCount` | ○ | integer |
| `separationTime` | ○ | number, s |
| `destructive` | ● | boolean |
| `automationPotential` | ○ | 0–1 |

### 2.5 Route and ProcessStep

A route is an ordered graph of unit operations from product intake to terminal outputs.

| ProcessStep field | Req | Note |
|---|---|---|
| `id`, `operation` | ● | Shredding, magnetic separation, smelting, leaching |
| `inputs`, `outputs` | ● | Named ports |
| `split` | ● | Per material, fraction to each output port |
| `energy` | ○ | MJ per functional unit |
| `emissions` | ○ | kg CO₂e per functional unit |

Split fractions per material must sum to ≤ 1. Any remainder is declared as `unaccounted` and is treated as C5
(§4) in every calculation. Silent remainders are non-conformant.

### 2.6 Outcome

Per material, per route:

| Field | Req |
|---|---|
| `materialId`, `routeId` | ● |
| `initialMass` | ● |
| `recoveredMass` | ● |
| `recoveryRate` | ● |
| `qualityDistribution` | ● — mass split across C0–C5 |
| `destination` | ● — the terminal sink |
| `evidence` | ● |

---

## 3. Separation classes (D-scale)

**Proposed by this specification.** No equivalent international scale exists. Do not cite as an established standard.

| Class | Definition |
|---|---|
| D0 | Separates automatically during normal processing, no dedicated step |
| D1 | Tool-less — hand separable |
| D2 | Common hand tool — screwdriver, spudger, pliers |
| D3 | Specialist tool — proprietary bit, jig, heated stage |
| D4 | Thermal or chemical process required |
| D5 | Destructive — the part or its neighbour is damaged beyond reuse |
| D6 | Practically inseparable at industrial scale |

The class describes the **joint**, not the part. A battery held by one clip and one adhesive strip is classed by
the harder of the two.

---

## 4. Circular quality classes (C-scale)

**Proposed by this specification.**

| Class | Definition | Example |
|---|---|---|
| C0 | Closed loop, equivalent functional quality | Cathode copper back into wire |
| C1 | High-quality open loop | Cast aluminium into a lower-spec but structural alloy |
| C2 | Lower-quality recycling, downcycling | Mixed polymer into filler-grade regranulate |
| C3 | Feedstock recovery | Polymer to pyrolysis oil, monomer |
| C4 | Energy recovery | Combustion with heat recovery |
| C5 | Dissipative loss or disposal | Slag, dust, off-gas, landfill |

### Declaration rules

1. **C4 is not recycling.** Energy recovery is reported on its own line and is never summed into a material
   recycling rate. A combined figure must be labelled "recycling and recovery" and must show its parts.
2. **Every recovered gram carries a class.** An outcome without a quality class is non-conformant.
3. **Quantity and quality are reported together.** `90% recovered` is incomplete. `90% recovered — 55% C0,
   25% C1, 10% C2` is a declaration.

---

## 5. Evidence levels (E-scale)

**Proposed by this specification.**

| Level | Basis |
|---|---|
| E0 | Self-declared, no supporting dataset |
| E1 | Manufacturer documentation |
| E2 | Engineering calculation |
| E3 | Process simulation |
| E4 | Experimental recycling trial |
| E5 | Independently verified industrial data |

Every numeric value in a published record carries a level. A record's headline evidence level is the **lowest**
level among the values that materially affect it, not the average and not the highest.

An E0 value is publishable. Hiding that it is E0 is not.

---

## 6. Provenance tags

Separate from evidence. Answers "where did this number come from", not "how good is it".

| Tag | Meaning |
|---|---|
| `published` | Taken from a cited external publication |
| `measured` | From the declarant's own trial or measurement |
| `simulated` | Output of a named model, with the model identified |
| `estimated` | Engineering judgement |
| `proposed` | A definition introduced by this specification |
| `user` | Entered by a tool user in a what-if scenario |

Interfaces built on this specification must display the tag next to the value. A simulated number shown in the
same typeface as a measured one is a defect.

---

## 7. Calculation rules

### 7.1 Recovery

```
recoveryRate(material, route) = Σ mass reaching C0–C3 sinks / initialMass
```

C4 and C5 masses are excluded from the numerator. They are reported separately.

### 7.2 Circularity index

```
index(material) = Σ (mass_in_class × weight_class) / initialMass
```

Reference weights: C0 = 1.0, C1 = 0.8, C2 = 0.45, C3 = 0.25, C4 = 0.05, C5 = 0.

The weights are a convention of this draft, not a physical constant. A record that uses different weights must
state them. Any tool that publishes an index must publish its weight vector alongside.

### 7.3 What may not be aggregated

- **Data completeness and recyclability.** They are different measurements and may never be combined into one
  score. A fully documented product can be badly recyclable.
- **Mass recovery across materials of different criticality**, unless the per-material breakdown is shown in
  the same view.
- **Routes.** A product has one outcome per route. A product-level "recycling rate" with no route named is
  non-conformant.

### 7.4 Mass balance

For every route: `feed = Σ material outputs + Σ energy recovery + Σ losses + unaccounted`.
The record states `unaccounted` explicitly. It does not renormalise it away.

---

## 8. Specification sections

| # | Section | Level |
|---|---|---|
| 01 | Product identity | L1 |
| 02 | Product architecture | L1 |
| 03 | Components | L1 |
| 04 | Material composition | L1 |
| 05 | Material connections | L2 |
| 06 | Disassembly | L2 |
| 07 | Recycling processes | L3 |
| 08 | Recycling routes | L3 |
| 09 | Material outputs | L3 |
| 10 | Recovery quality | L3 |
| 11 | Environmental data | optional |
| 12 | Economic data | optional |
| 13 | Evidence | L4 |
| 14 | Data provenance | L4 |

---

## 9. Component records and supply chains

No manufacturer knows its own product to element level. The battery comes from a cell supplier, the display from a
panel maker, the board from an EMS. If the format cannot absorb their records, every OEM has to guess, and a guessed
composition published at E4 alongside real trial data is worse than no record at all.

### 9.1 A component record is the same document

A component record uses this schema with `recordType: "component"`. It carries one component, its composition, its
internal joints, and its issuer. It is publishable on its own, at its own conformance level, by whoever actually
knows the part.

```json
{
  "standard": "Open Recycle", "version": "0.1-draft", "recordType": "component",
  "issuer": { "organisation": "Cell supplier AB", "published": "2026-04-11" },
  "evidence": "E4",
  "component": {
    "name": "18650 cell module", "mass": { "value": 42.0, "unit": "g" },
    "separationClass": "D1",
    "materials": [{ "materialId": "Li", "mass": { "value": 0.95, "unit": "g" } }]
  },
  "materialRegistry": { "Li": { "name": "Lithium", "critical": true } },
  "integrity": { "algorithm": "sha256", "value": "…" }
}
```

`materialRegistry` is required on component records. Without it a receiving system knows the symbol but not what the
issuer meant by it, and two organisations will use the same symbol for different things.

### 9.2 Who owns which fields

| Field | Owner | Why |
|---|---|---|
| Composition, mass, internal joints | The component issuer | They made it. Only they can measure it. |
| Interface joint to the parent assembly | The integrator | The OEM chose the screw, the clip, or the adhesive. |
| Position in the disassembly sequence | The integrator | It depends on the surrounding assembly, not the part. |
| Recycling route and outcomes | Whoever runs the route | Usually neither of the above. |

An integrator that edits an imported component's composition has stopped importing and started asserting. The record
must show that: **unlinking transfers ownership**, and the issuer's evidence level no longer travels with the numbers.

### 9.3 Evidence inherits downward, and takes the minimum

```
effectiveEvidence(product) = min( product.evidence, min over imported components of component.evidence )
```

A product with E4 trial data on everything except one E0 self-declared connector is an E0 record. This is the rule
that makes the format worth anything: it removes the incentive to source the weakest link quietly, because the weakest
link becomes the headline.

### 9.4 Reference or embed

Two import modes, both conformant:

- **Embedded.** The component's data is copied into the product record, tagged with `origin.issuer`, `origin.evidence`
  and `origin.integrity`. The record is self-contained and works offline. It goes stale silently when the supplier
  revises the part.
- **Referenced.** The product record holds `{ uri, hash, version }` and resolves it at read time. Always current, but
  it fails when the supplier's endpoint moves, and it leaks who is reading.

Embedded is the default for draft 0.1 because a recyclability record has to survive the company that issued it.
A referenced record must cache an embedded snapshot alongside the reference.

### 9.5 The confidentiality problem

This is the real obstacle, not the file format. A cell supplier will not publish an exact cathode recipe, and a
board maker will not publish a full BOM. Three ways out, in increasing order of usefulness and difficulty:

1. **Declare at element level only.** Grams of nickel, not the NMC ratio. Loses formulation, keeps everything the
   recycler actually needs. Sufficient for most of this specification.
2. **Declare bands.** `{ "value": null, "range": [3.8, 4.6], "unit": "g" }`. Preserves commercial distance and still
   bounds the recovery calculation. Draft 0.2 should define how ranges propagate through a route.
3. **Third-party attestation.** A named lab issues the record at E4 or E5 against the supplier's part without the
   supplier disclosing to the OEM. The issuer field carries the lab, not the supplier. This is the only route that
   gets a full supply chain to L5.

Option 1 is what draft 0.1 supports. A record that redacts anything must say so; a missing material and a withheld
material are not the same claim, and `status: "withheld"` is distinct from `status: "required-missing"`.

### 9.6 Integrity

`integrity.value` is a hash over the canonical serialisation of the `component` object. Draft 0.1 defines the field
and does not define a signature scheme, so an unsigned record is conformant but should be displayed as unsigned.
Anything that presents an unverified supplier claim with the same weight as a verified one has defeated the point.

---

## 10. Worked example — Fairphone 2

Fairphone 2 is used here as a **research reference case**, because its recycling has been studied across
multiple processing routes in published literature. This specification and this example have no affiliation
with, and no endorsement from, Fairphone.

The example file is `fairphone-2.example.json`.

### 10.1 What is genuinely published

The 2018 study by Reuter, van Schaik and Ballester modelled the Fairphone 2 through three processing routes and
reported these aggregates:

| Route | Metal recycling | Total material recycling | Recycling + recovery |
|---|---|---|---|
| R1 — whole-product smelting | 14% | 25% | 36% |
| R2 — dismantling and selective processing | 19% | 28% | 31% |
| R3 — shredding and physical separation | 22% | 30% | 31% |

Provenance `published`, evidence E4.

The study's conclusion is the reason this specification exists: Route 3 produces the highest mass-based rates,
but Route 2 recovered the widest range of materials, and the authors judged Route 2 the better option once both
recovered mass and range of recovered materials were weighed. **Highest mass recovery is not the same as best
circularity outcome.**

### 10.2 What this example does not contain

The example record carries **no element-level composition or recovery figures attributed to Fairphone or to any
published study**, because those datasets are not reproduced here. Those fields are present but flagged:

```json
{ "materialId": "Co", "mass": null, "evidence": "E0", "provenance": "estimated", "status": "required-missing" }
```

This is deliberate. A conformant record is allowed to be incomplete. It is not allowed to be incomplete
silently. The example is therefore an **L1-partial** record with published L3 aggregates attached: it shows the
specification doing its actual job, which is making the holes visible.

To raise it to L3, fill the composition from a source you can cite, and record which source, in which field.

### 10.3 How to extend it

- **Fairphone 3.** The 2022 MARAS assessment reports overall recycling rates roughly between 50% and 60% across
  three modelled cases, attributing improvement to cleaner modules, better design for recycling, recovery of
  glass and some plastics, and routing modules to appropriate metallurgical infrastructure. Add these as
  route-level aggregates at `published` / E4. Do not invent the element-level figures underneath them.
- **A conventional smartphone.** Same category, adhesive-bonded architecture. The interesting comparison is not
  the headline rate — it is which connections change class from D1/D2 to D5.

---

## 11. Non-goals of draft 0.1

- No single 0–100 recyclability score. The record produces a profile. Whether aggregation into one number is
  ever justified is left to later drafts and to evidence.
- No thermodynamic process modelling. Split fractions are declared inputs, not derived from phase chemistry.
  A future draft may define an import path from process simulation output.
- No certification, no conformity assessment body, no mark.

---

## 12. Sources

1. Reuter, van Schaik & Ballester — *Limits of the Circular Economy: Fairphone Modular Design Pushing the
   Limits*, 2018. Source of the three-route aggregates in §9.1.
2. Fairphone — *Fairphone's Report on Recyclability* (Fairphone 2), 2017.
3. MARAS — *Recycling and recovery assessment of the Fairphone 3 based on a modular approach to recycling*, 2022.
4. Fairphone — resources and policies library.

The D, C and E scales in §3–§5 are proposed by this document and are not drawn from these sources.
