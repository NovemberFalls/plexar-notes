// Markdown helpers for Plexar Notes: prepare Markdown before marked renders it and post-process
// the HTML string marked produces. Pure string work, no DOM, so it runs in tests and the browser.
import { parseLinks, resolveLink } from "./links.js";

const FENCE = /```[\s\S]*?(```|$)/g;

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Replace every [[Target]] / [[Target|alias]] outside code with an anchor the app can click.
// Unresolved targets get the wikilink-missing class and an empty data-path.
export function wikiLinksToHtml(markdown, notePaths) {
  if (typeof markdown !== "string" || markdown.length === 0) return "";
  const paths = Array.isArray(notePaths) ? notePaths : [];
  let out = "";
  let last = 0;
  for (const link of parseLinks(markdown)) {
    const path = resolveLink(link.target, paths);
    const cls = path ? "wikilink" : "wikilink wikilink-missing";
    out += markdown.slice(last, link.index);
    out += `<a class="${cls}" data-target="${escapeHtml(link.target)}" data-path="${escapeHtml(path || "")}" href="#">${escapeHtml(link.alias || link.target)}</a>`;
    last = link.index + link.raw.length;
  }
  return out + markdown.slice(last);
}

// Callouts: a blockquote whose first paragraph opens with [!type] (title optional on the same
// line) becomes a titled box. Unknown types keep their name; CSS styles them like a note.
const OPEN = "<blockquote>";
const CLOSE = "</blockquote>";
const CALLOUT_HEAD = /^(\s*)<p>\[!([^\]\s]+)\]([^\n<]*)(\n|<br\s*\/?>\n?)?/;

function sentenceCase(type) {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

// Index of the </blockquote> that closes the <blockquote> at start, or -1.
function matchingClose(html, start) {
  let depth = 0;
  let i = start;
  while (i < html.length) {
    const o = html.indexOf(OPEN, i);
    const c = html.indexOf(CLOSE, i);
    if (c === -1) return -1;
    if (o !== -1 && o < c) {
      depth++;
      i = o + OPEN.length;
    } else {
      depth--;
      i = c + CLOSE.length;
      if (depth === 0) return c;
    }
  }
  return -1;
}

function renderCallout(inner) {
  const m = CALLOUT_HEAD.exec(inner);
  if (!m) return null;
  const type = m[2].toLowerCase();
  const title = m[3].trim() || sentenceCase(type);
  let rest = inner.slice(m[0].length);
  // The marker line was the whole paragraph: drop its now-empty <p>. Otherwise reopen it.
  if (rest.startsWith("</p>")) rest = rest.slice(4);
  else rest = "<p>" + rest;
  const body = calloutsToHtml(rest.trim());
  const t = escapeHtml(type);
  return `<div class="callout callout-${t}" data-type="${t}"><div class="callout-title">${title}</div><div class="callout-body">${body}</div></div>`;
}

export function calloutsToHtml(html) {
  if (typeof html !== "string") return "";
  let out = "";
  let pos = 0;
  for (;;) {
    const start = html.indexOf(OPEN, pos);
    if (start === -1) break;
    const end = matchingClose(html, start);
    if (end === -1) break;
    const inner = html.slice(start + OPEN.length, end);
    const callout = renderCallout(inner);
    out += html.slice(pos, start);
    out += callout === null ? OPEN + calloutsToHtml(inner) + CLOSE : callout;
    pos = end + CLOSE.length;
  }
  return out + html.slice(pos);
}

// Task list items: mark the <li>, and drop disabled so the app can toggle the checkbox.
const TASK_LI = /<li(\s[^>]*)?>(\s*<input\b[^>]*\btype="checkbox"[^>]*>)/g;

export function taskListsToHtml(html) {
  if (typeof html !== "string") return "";
  return html.replace(TASK_LI, (m, attrs, input) => {
    const done = /\bchecked\b/.test(input);
    const cls = done ? "task task-done" : "task";
    let a = attrs || "";
    if (/\bclass="/.test(a)) a = a.replace(/class="([^"]*)"/, (x, c) => `class="${c} ${cls}"`);
    else a += ` class="${cls}"`;
    const enabled = input.replace(/\s+disabled(?:="[^"]*")?(?=[\s>\/])/g, "");
    return `<li${a}>${enabled}`;
  });
}

// Fenced code: wrap each block so a Copy button can sit beside it. data-lang is the fence
// language ("" when none).
const CODE_BLOCK = /<pre><code(?:\s+class="([^"]*)")?>[\s\S]*?<\/code><\/pre>/g;

export function addCopyButtons(html) {
  if (typeof html !== "string") return "";
  return html.replace(CODE_BLOCK, (block, cls) => {
    const lm = /(?:^|\s)language-(\S+)/.exec(cls || "");
    const lang = lm ? lm[1] : "";
    return `<div class="codeblock" data-lang="${escapeHtml(lang)}"><button class="copy" type="button" aria-label="Copy code">Copy</button>${block}</div>`;
  });
}

// The note's title: its first level-1 heading, else the file name without .md.
const H1 = /^[ \t]{0,3}#[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/m;

export function titleFrom(markdown, path) {
  const text = typeof markdown === "string" ? markdown.replace(FENCE, "") : "";
  const m = H1.exec(text);
  if (m && m[1].trim()) return m[1].trim();
  const name = typeof path === "string" ? path.split(/[\\/]/).pop() : "";
  return name.replace(/\.md$/i, "");
}

// Flip the index-th task marker (0-based, counted outside code fences). done true writes [x],
// false writes [ ]; omitted flips the current state.
const TASK_MARK = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+\[)([ xX])(\])(?=\s|$)/gm;

export function toggleTask(markdown, index, done) {
  if (typeof markdown !== "string") return "";
  let i = -1;
  const swap = (seg) =>
    seg.replace(TASK_MARK, (m, pre, mark, post) => {
      i++;
      if (i !== index) return m;
      const next = done === undefined ? mark === " " : Boolean(done);
      return pre + (next ? "x" : " ") + post;
    });
  let out = "";
  let last = 0;
  for (const f of markdown.matchAll(FENCE)) {
    out += swap(markdown.slice(last, f.index)) + f[0];
    last = f.index + f[0].length;
  }
  return out + swap(markdown.slice(last));
}
