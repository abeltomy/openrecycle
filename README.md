# Open Recycle

**An open recyclability record for your product.**
A draft specification and an interactive tool for describing what happens to every material in a product after its useful life — not one recycling rate, but one fate per material, at the quality it comes back at.

> Research prototype, draft 0.1. Not an official standard, not a certification, no mark.

## What's in the repo

| Path | What it is |
|---|---|
| `index.html` | Landing page — served at the site root |
| `app/index.html`, `src/` | The tool — served at `/app/` |
| `docs/STANDARD.md` | The specification, draft 0.1 |
| `schema/open-recycle.schema.json` | JSON Schema for records |
| `examples/fairphone-2.example.json` | Worked example — deliberately incomplete, see §10 of the spec |
| `examples/example-supplier-component.json` | Supplier component record, for testing import |
| `docs/BUILD-PROMPT.md` | Self-contained brief for rebuilding the tool with another AI builder |

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # production build into dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`:

| URL | Serves |
|---|---|
| `/` | Landing page |
| `/app/` | The tool |
| `/docs/STANDARD.md` | The specification |
| `/schema/`, `/examples/` | Schema and example records |

Enable it once under **Settings → Pages → Source: GitHub Actions**.

## How it works

| Step | Does |
|---|---|
| Inventory | Components, mass, composition in grams per material |
| Separation | Each component has a class D0–D6, setting how much of each material reaches its intended process |
| Process graph | Unit operations; each node splits every material across its output ports |
| Fate | Each sink has a quality class C0–C5; a material's fate is the mass it delivers into each class |
| Rating | Mass × class weight, summed, over feed → circularity index → grade A–E |

## The three scales

All proposed by this draft. None is an existing international standard.

| Scale | Range | Describes |
|---|---|---|
| Separation | D0–D6 | How a joint comes apart, automatic to inseparable |
| Circular quality | C0–C5 | What a recovered gram comes back as, closed loop to dissipative loss |
| Evidence | E0–E5 | What backs a number, self-declared to verified industrial data |

A record's evidence level is the **minimum** across itself and every component it imports.

## Data honesty

| Content | Status |
|---|---|
| Route aggregates (14/25/36, 19/28/31, 22/30/31) | Published — Reuter, van Schaik & Ballester, 2018 |
| Seeded smartphone composition | Demonstration dataset, evidence E0 |
| Split fractions and element-level results | Simulated by this prototype's simplified model |

No element-level figure in this repo is taken from any publication. No affiliation with or endorsement by Fairphone, the authors, or any manufacturer.

## Reference

Reuter, M. A., van Schaik, A. & Ballester, M. (2018). *Limits of the Circular Economy: Fairphone Modular Design Pushing the Limits.*

The carrier-wheel figure is inspired by the Metal Wheel concept of Reuter and van Schaik. It is an original per-product visualisation, not a reproduction.

## Licence

Code under MIT (`LICENSE`). Specification text in `docs/` under CC BY 4.0 (`LICENSE-SPEC`).
