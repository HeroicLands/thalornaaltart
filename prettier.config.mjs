/**
 * This repository's Prettier configuration — the shared one it already uses.
 *
 * `content-build format` applies the shared options directly, so the lint chain
 * is correct without this file. Nothing else is. Prettier's editor integrations
 * and a bare `npx prettier` run resolve a *config file*, and silently fall back
 * to Prettier's own defaults when they find none — `printWidth: 80` against a
 * project that formats at 100. The two tools then take turns rewriting the same
 * lines, each undoing the other.
 *
 * So this file exists to make every route to Prettier — the toolchain, the
 * editor, the command line — resolve the same options.
 *
 * @type {import("prettier").Config}
 */
export { default } from "@heroiclands/package-build/prettier";
