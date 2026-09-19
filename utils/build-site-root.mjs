/*
 * This file is part of the Song of Heroic Lands (SoHL) system for Foundry VTT.
 * Copyright (c) 2024-2026 Tom Rodriguez ("Toasty") — <toasty@heroiclands.org>
 *
 * This work is licensed under the GNU General Public License v3.0 (GPLv3).
 * You may copy, modify, and distribute it under the terms of that license.
 *
 * For full terms, see the LICENSE.md file in the project root or visit:
 * https://www.gnu.org/licenses/gpl-3.0.html
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Write the files that belong to the deployment's **root** rather than to the
 * rendered site (`HeroicLands/Song-of-Heroic-Lands-FoundryVTT#1469`).
 *
 * Hugo renders into `build/site/thalornaaltart/`, because the deployment carries the
 * `/thalornaaltart/` prefix physically and the routing layer is a path-preserving
 * pass-through. The directory that is *uploaded* is its parent, `build/site/`,
 * and Cloudflare Pages reads `_headers` from there and nowhere else — a copy
 * inside `thalornaaltart/` would be published as a text file and never applied. Hugo
 * owns everything under the prefix, so this step owns what sits beside it.
 *
 * Usage: node utils/build-site-root.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The directory that is deployed. Its root is the site's origin. */
export const SITE_OUT = "build/site";

/** Where the package is mounted inside the deployment. Matches `baseURL`. */
export const PACKAGE_DIR = "thalornaaltart";

/**
 * The namespace the routing layer derives this package's origin in: `/thalornaaltart/`
 * on `www.heroiclands.org` is proxied to
 * `https://thalornaaltart.pkg.heroiclands.org/thalornaaltart/`.
 *
 * A **dedicated** namespace, and {@link HEADERS} depends on it being one — see
 * the third rule there. Changing it would have to be matched in
 * `heroiclands-site`'s router, which derives the same address from the package
 * prefix, and in the `domain-suffix` input of the shared deploy workflow in
 * `HeroicLands/.github`.
 */
export const ORIGIN_SUFFIX = "pkg.heroiclands.org";

/**
 * The deployment root's `_headers`, marking the hosting project's own
 * addresses `noindex`.
 *
 * A Cloudflare Pages project answers at **three** families of host-assigned
 * address besides the path it serves on `www.heroiclands.org`:
 * `<project>.pages.dev`, one `<deployment>.<project>.pages.dev` per deployment,
 * and `<package>.{@link ORIGIN_SUFFIX}` — the custom domain the project carries
 * so the routing layer has an origin to fetch. None is advertised, all answer
 * with the same pages, and left alone they are indexed and compete with the
 * canonical URL in search results.
 *
 * The third rule covers the custom domain, and it is the one that matters most:
 * it is the address the routing layer fetches, so it is the host-assigned
 * address a reader is most plausibly handed. Without a rule of its own it
 * answers 200 with no `X-Robots-Tag` at all, and competes with the canonical
 * URL for the same pages.
 *
 * The rules are **scoped to those hostnames**, which is what keeps this correct
 * for anyone who takes the repository elsewhere: deployed under its own domain
 * the site is indexable, and only the host-assigned addresses are not.
 * `:project`, `:version` and `:package` are Cloudflare's own placeholders — a
 * named wildcard matching exactly **one label**, since the delimiter inside a
 * host is the period.
 *
 * That single-label rule is also what keeps the canonical address out of the
 * third rule: `:package.pkg.heroiclands.org` requires four labels and a literal
 * `pkg` third from the end, so the three-label `www.heroiclands.org` cannot
 * match it under any binding. This holds only while {@link ORIGIN_SUFFIX} names
 * a dedicated namespace rather than the domain the canonical site is served
 * from — a consumer whose site is `www.example.net` must not set it to
 * `example.net`, which would match `www` here and equally hand the router
 * `/www/` as a package prefix.
 *
 * The hosting cannot tell the routing layer's request apart from a reader's —
 * it is the same URL at the same address — so this header reaches
 * `www.heroiclands.org` too, and the router (`heroiclands-site`, `worker/`,
 * `canonicalHeaders`) removes it there. That is the only place the two
 * addresses are distinguishable, and it is why the third rule carries a risk the
 * first two did not: until heroiclands-site#26 the router's origin *was*
 * `<project>.pages.dev`, so the first rule already set `noindex` on every
 * response it fetched and `www` never carried it. #26 moved the origin to the
 * custom domain, which in one change opened this hole and left the strip with
 * nothing to strip; the third rule restores an arrangement that ran in
 * production.
 *
 * A page that needs `noindex` at *every* address must say so in the document
 * (`<meta name="robots">`), which is body content and is passed through
 * untouched.
 *
 * Asserted, not merely written: `build-site-root.test.mjs` models Cloudflare's
 * single-label placeholder semantics, so "every host-assigned address is
 * covered by exactly one rule" and "the canonical host is covered by none" are
 * assertions rather than claims.
 */
export const NOINDEX_HEADERS = [
    "https://:project.pages.dev/*",
    "  X-Robots-Tag: noindex",
    "",
    "https://:version.:project.pages.dev/*",
    "  X-Robots-Tag: noindex",
    "",
    `https://:package.${ORIGIN_SUFFIX}/*`,
    "  X-Robots-Tag: noindex",
    "",
];

/**
 * Where `/thalornaaltart/` sends a reader, now that the landing is an addressed page.
 *
 * A homepage used to be the one note whose destination was fixed — it wrote the
 * site root's `_index.md` and was served at `/thalornaaltart/`. Since
 * package-build#182 it is an ordinary addressed note: it declares
 * `shortcode: root` and publishes at its address like every other page, so the
 * package prefix serves nothing of its own and the landing has to be pointed
 * at. That is a routing fact rather than content, which is why it is authored
 * here.
 *
 * Both forms, because Cloudflare Pages matches the raw path: redirect matching
 * runs before any trailing-slash or `index.html` handling, so `/thalornaaltart` and
 * `/thalornaaltart/` are distinct keys and a rule on one does not catch the other.
 */
export const REDIRECTS = [
    `/${PACKAGE_DIR}/   /${PACKAGE_DIR}/homepage-root/   301`,
    `/${PACKAGE_DIR}    /${PACKAGE_DIR}/homepage-root/   301`,
    "",
].join("\n");

/**
 * The lifetime pinned on that 301, and why it is pinned at all.
 *
 * Cloudflare Pages sets **no** `Cache-Control` on a redirect it generates — its
 * redirect responses carry `location` and nothing else — and a 301 with no
 * `Cache-Control` is cacheable indefinitely by default under RFC 9111. A
 * browser persists one to disk and stops asking, so an addressing scheme that
 * moved again would strand every returning reader on this package's
 * most-linked URL. An hour keeps the 301's canonical signal without the
 * permanence.
 *
 * These rules are **path-scoped**, unlike {@link NOINDEX_HEADERS}: they are
 * about one address on every host this deployment answers on, not about which
 * hosts are host-assigned.
 */
export const CACHE_HEADERS = [
    `/${PACKAGE_DIR}/`,
    "  Cache-Control: max-age=3600",
    "",
    `/${PACKAGE_DIR}`,
    "  Cache-Control: max-age=3600",
    "",
];

/** The full `_headers` payload: the `noindex` rules, then the cache rules. */
export const HEADERS = [...NOINDEX_HEADERS, ...CACHE_HEADERS].join("\n");

function main() {
    const root = path.resolve(SITE_OUT);
    const rendered = path.join(root, PACKAGE_DIR);

    if (!fs.existsSync(path.join(rendered, "index.html"))) {
        console.error(
            `build-site-root: ${SITE_OUT}/${PACKAGE_DIR}/ holds no rendered ` +
                `site — run \`npm run build:site\` first.`,
        );
        process.exit(1);
    }

    fs.writeFileSync(path.join(root, "_headers"), HEADERS);
    console.log(`build-site-root: wrote ${SITE_OUT}/_headers.`);

    fs.writeFileSync(path.join(root, "_redirects"), REDIRECTS);
    console.log(`build-site-root: wrote ${SITE_OUT}/_redirects.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
