// Word and character counts for Plexar Notes. Pure logic over Markdown text, no DOM.

// A fence line (``` or ~~~, with an optional info string). The line goes; the code inside stays.
const FENCE_LINE = /^[ \t]{0,3}(?:`{3,}|~{3,})[^\n]*$/gm;
// [[Target|alias]] renders as its alias, [[Target]] as its target.
const WIKI_LINK = /\[\[([^\[\]]*)\]\]/g;
// [text](url) and ![alt](url) render as their text; the URL is not words.
const MD_LINK = /!?\[([^\[\]]*)\]\([^()\s]*(?:\s+"[^"]*")?\)/g;
// A word: letters/digits, optionally joined to more by apostrophes or hyphens.
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const LINE_BREAK = /\r\n|\r|\n/g;

function wikiText(inner) {
  const bar = inner.indexOf("|");
  const text = bar === -1 ? inner : inner.slice(bar + 1);
  return " " + text.replace(/#/g, " ") + " ";
}

// The words a reader sees: fences, wiki-link brackets and link URLs are gone, code content kept.
// Marker characters (#, *, _, >, -, |, backticks) never match WORD, so they need no stripping.
function readable(markdown) {
  return markdown
    .replace(FENCE_LINE, " ")
    .replace(WIKI_LINK, (_, inner) => wikiText(inner))
    .replace(MD_LINK, (_, text) => " " + text + " ");
}

export function countWords(markdown) {
  if (typeof markdown !== "string" || markdown.length === 0) return 0;
  const matches = readable(markdown).match(WORD);
  return matches === null ? 0 : matches.length;
}

// Characters of the raw text, line breaks excluded, counted by code point.
export function countChars(markdown) {
  if (typeof markdown !== "string" || markdown.length === 0) return 0;
  return Array.from(markdown.replace(LINE_BREAK, "")).length;
}

const WORDS_PER_MINUTE = 200;

export function stats(markdown) {
  const words = countWords(markdown);
  const chars = countChars(markdown);
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  return { words, chars, readingMinutes };
}
