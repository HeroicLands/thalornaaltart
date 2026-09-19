# Thalorna Module for Song of Heroic Lands

This module provides the necessary items, actors, and assets needed to play in the Thalorna setting for Song of Heroic Lands

## Building

```sh
npm install
npm run build:compiledb      # assets/content/ → build/stage/packs/{items,journals}
npm run build:link-manifest  # assets/content/ → build/manifests/thalorna.json
npm run build:site-content   # assets/content/ → site/content/
npm run build:site           # the above, then Hugo → build/site/thalorna/
```

A plain checkout is all that is needed. There is no sibling repository to clone
and no `HEROICLANDS_VAULT` to set — as of #1441 this repository owns its content
outright, and everything it ships is generated from it.

## Content

Thalorna's 1,740 notes are **source**, in [`assets/content/`](assets/content/README.md).
That README is the one to read before adding or editing a note: it covers the
frontmatter fields that carry identity, what makes a note compile into an item
rather than a journal, and how to write a link into another package.

Everything built from those notes — the compendium packs, the link manifest, and
the website — is generated output: the packs and the manifest land under
`build/`, the site under `site/content/` and `build/site/thalorna/`. All of it is
gitignored, and no compiled output is committed.

The pack compiler is [`@heroiclands/package-build`](https://www.npmjs.com/package/@heroiclands/package-build),
the shared toolchain every HeroicLands content package builds with. This
repository declares what is its own — the content package it compiles, the
Foundry package it ships, its pack list — in `package-build.config.yaml`, and
holds no copy of the compilers.

## Publishing to the website

This repository owns exactly one path on heroiclands.org — **`/thalorna`** — and
builds, renders and deploys the whole of it. Nothing else writes to that prefix,
and no other repository is in the path between these pages and their readers.

```sh
npm run build:site   # assets/content/ → site/content/ → build/site/thalorna/
npm run serve:site   # the same, then `hugo server` for a local preview
```

`site/` is the Hugo project: its configuration, this site's own home-page
layout, and the shared `heroiclands-hugo-theme` as a submodule (so clone with
`--recurse-submodules`, or run `git submodule update --init`). The pages
themselves are generated beneath it and are not committed.
`.github/workflows/deploy-site.yml` builds the site on every push that touches
the content or the build deriving it, and deploys it to this package's own
Cloudflare Pages project. That project and the routing that puts it at
`www.heroiclands.org/thalorna` are #1468; until its credentials are set here the
workflow builds and verifies the site, and skips the upload.

### The address is written down once

`baseURL` in [`site/hugo.toml`](site/hugo.toml) is where Hugo is told the site's
address, and `contentPackage` in
[`package-build.config.yaml`](package-build.config.yaml) is where the site build
is: a page publishes at `/<contentPackage>/<type>-<shortcode>/`, and `site.base`
overrides that if the package ever moves. Pointing both at another prefix — or
at an origin of this package's own — moves the whole site.

That is what the arrangement is for. A successor inheriting this repository and
nothing else can publish Thalorna wherever they like, without inheriting the rest
of the project to do it.

### The emitter is the toolchain's, entirely

`npm run build:site-content` is `content-build site`, and there is no local site
code at all — no walk, no filter, no page writer, no wikilink resolver, and no
seam for one (#85). This repository used to carry its own emitter, a 907-line
copy of the engine's plus a 281-line copy of its wikilink resolver, and that copy
missed four upstream fixes in as many months: one emitted a site with zero pages,
one left generated tables empty, one broke every breadcrumb, and one silently
stripped `foundryPackage` and all 2,585 `uuid`s out of the published link
manifest whenever the site built after it. A gap here is now fixed in
`@heroiclands/package-build`, where every package gets the fix — never here.

What the build does to a note:

- **Addresses** it as `type-shortcode`, and writes it flat: a page publishes at
  `/thalorna/<type>-<shortcode>/` whatever directory the note is filed in.
  Sections are Hugo directories the note format does not carry, so the ones this
  site publishes are declared in `site.sections` and nothing else creates one.
- **Expands** its fenced `sql` table directives — SQL run by DuckDB over the
  content index — against every published note.
- **Resolves** its wikilinks to site-local hrefs — the same authored links the
  pack compiler turns into Foundry `@UUID` enrichers.

This build emits **no redirects**. It used to carry a record of the addresses
each page had published at before, and turn them into Hugo `aliases`; that record
is gone and the old addresses no longer answer. A note's own `aliases` was never
published either — the key means alternative _names_ in Obsidian and _URL
redirects_ in Hugo, and only one of those is a page.
