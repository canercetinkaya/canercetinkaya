import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RSS_URL = 'https://canercetinkaya.com/rss.xml';
const README_PATH = resolve(process.cwd(), 'README.md');
const START_MARKER = '<!-- BLOG-POST-LIST:START -->';
const END_MARKER = '<!-- BLOG-POST-LIST:END -->';
const MAX_POSTS = 6;

function decodeXmlEntities(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXmlEntities(match[1]) : '';
}

function formatDateTr(pubDate) {
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

async function main() {
  const response = await fetch(RSS_URL, {
    headers: { 'User-Agent': 'canercetinkaya-profile-rss-sync/1.0' },
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);

  const trPosts = itemBlocks
    .map((block) => ({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      pubDate: extractTag(block, 'pubDate'),
    }))
    .filter((item) => item.title && item.link.includes('/tr/blog/'))
    .slice(0, MAX_POSTS);

  if (trPosts.length === 0) {
    throw new Error('No Turkish blog posts found in RSS feed.');
  }

  const rows = trPosts.map((post) => {
    const safeTitle = post.title.replace(/\|/g, '\\|');
    const dateLabel = formatDateTr(post.pubDate);
    return `| \`${dateLabel}\` | [${safeTitle}](${post.link}) |`;
  });

  const renderedBlock = [
    START_MARKER,
    '| Tarih | Makale |',
    '| :--- | :--- |',
    ...rows,
    END_MARKER,
  ].join('\n');

  const readme = readFileSync(README_PATH, 'utf8');
  const pattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`);

  if (!pattern.test(readme)) {
    throw new Error('Blog post markers not found in README.md');
  }

  const updated = readme.replace(pattern, renderedBlock);
  if (updated !== readme) {
    writeFileSync(README_PATH, updated, 'utf8');
    console.log(`Updated README.md with ${trPosts.length} latest posts from ${RSS_URL}.`);
  } else {
    console.log('README.md is already up to date.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
