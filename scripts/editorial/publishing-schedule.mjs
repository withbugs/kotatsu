import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export const WEEKLY_PUBLISH_LIMIT = 2;
export const MONTHLY_PUBLISH_LIMIT = 8;
export const PUBLISH_TIME_ZONE = 'Asia/Tokyo';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PUBLISH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function parseArgs(argv) {
  return Object.fromEntries(
    argv.map((arg) => {
      const [key, ...value] = arg.replace(/^--/, '').split('=');
      return [key, value.join('=') || true];
    })
  );
}

function listContentFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listContentFiles(fullPath);
    return /\.(md|mdx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function slugFromFile(file) {
  return path.basename(file).replace(/\.(md|mdx)$/, '');
}

function zonedDateParts(date) {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

function formatDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthKey(date) {
  const { year, month } = zonedDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function weekKey(date) {
  const { year, month, day } = zonedDateParts(date);
  const localDateAsUtc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = localDateAsUtc.getUTCDay();
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  const monday = new Date(Date.UTC(year, month - 1, day - isoDay + 1));
  return formatDateKey(monday);
}

export function parseNow(value) {
  const now = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid --now value: ${value}`);
  }
  return now;
}

export function loadArticles(root = process.cwd()) {
  const articleDir = path.join(root, 'src', 'content', 'articles');

  return listContentFiles(articleDir).map((file) => {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = matter(raw);
    const publishAt = parsed.data.publishAt ? new Date(parsed.data.publishAt) : null;

    return {
      file,
      relativePath: path.relative(root, file),
      slug: slugFromFile(file),
      raw,
      parsed,
      data: parsed.data,
      publishAt,
      publishAtIsValid: publishAt instanceof Date && !Number.isNaN(publishAt.getTime())
    };
  });
}

function addToMap(map, key, article) {
  const entries = map.get(key) ?? [];
  entries.push(article);
  map.set(key, entries);
}

export function validatePublishedSchedule(articles, options = {}) {
  const now = options.now ?? new Date();
  const errors = [];
  const warnings = [];
  const publishedByWeek = new Map();
  const publishedByMonth = new Map();

  for (const article of articles) {
    const { status, title } = article.data;

    if (!['draft', 'scheduled', 'published'].includes(status)) {
      errors.push(`${article.relativePath}: invalid status: ${status}`);
      continue;
    }

    if (!article.publishAtIsValid) {
      errors.push(`${article.relativePath}: publishAt must be a valid date string`);
      continue;
    }

    if (status === 'published') {
      if (article.publishAt > now) {
        errors.push(`${article.relativePath}: published article has future publishAt: ${article.data.publishAt}`);
      }

      addToMap(publishedByWeek, weekKey(article.publishAt), article);
      addToMap(publishedByMonth, monthKey(article.publishAt), article);
    }

    if (status === 'scheduled' && article.publishAt <= now) {
      warnings.push(`${article.relativePath}: scheduled article is due for publication: ${title}`);
    }
  }

  for (const [key, entries] of publishedByWeek.entries()) {
    if (entries.length > WEEKLY_PUBLISH_LIMIT) {
      errors.push(
        `week ${key}: ${entries.length} published articles exceeds weekly limit ${WEEKLY_PUBLISH_LIMIT}: ${entries
          .map((article) => article.slug)
          .join(', ')}`
      );
    }
  }

  for (const [key, entries] of publishedByMonth.entries()) {
    if (entries.length > MONTHLY_PUBLISH_LIMIT) {
      errors.push(
        `month ${key}: ${entries.length} published articles exceeds monthly limit ${MONTHLY_PUBLISH_LIMIT}: ${entries
          .map((article) => article.slug)
          .join(', ')}`
      );
    }
  }

  return { errors, warnings, publishedByWeek, publishedByMonth };
}

export function evaluatePublishCandidate(articles, slug, options = {}) {
  const now = options.now ?? new Date();
  const candidate = articles.find((article) => article.slug === slug);
  const baseline = validatePublishedSchedule(articles, { now });
  const errors = [...baseline.errors];
  const warnings = [...baseline.warnings];

  if (!candidate) {
    errors.push(`Article not found: ${slug}`);
    return { allowed: false, candidate: null, errors, warnings, weekPublishedCount: 0, monthPublishedCount: 0 };
  }

  if (!candidate.publishAtIsValid) {
    errors.push(`${candidate.relativePath}: publishAt must be a valid date string`);
    return { allowed: false, candidate, errors, warnings, weekPublishedCount: 0, monthPublishedCount: 0 };
  }

  if (candidate.data.status === 'published') {
    warnings.push(`${candidate.relativePath}: article is already published`);
    return { allowed: errors.length === 0, candidate, errors, warnings, weekPublishedCount: 0, monthPublishedCount: 0 };
  }

  if (candidate.data.status !== 'scheduled') {
    errors.push(`${candidate.relativePath}: article must be scheduled before publication; current status is ${candidate.data.status}`);
  }

  if (candidate.publishAt > now) {
    errors.push(`${candidate.relativePath}: publishAt is still in the future: ${candidate.data.publishAt}`);
  }

  const targetWeek = weekKey(candidate.publishAt);
  const targetMonth = monthKey(candidate.publishAt);
  const peerPublished = articles.filter(
    (article) => article.slug !== candidate.slug && article.data.status === 'published' && article.publishAtIsValid
  );
  const weekPublishedCount = peerPublished.filter((article) => weekKey(article.publishAt) === targetWeek).length;
  const monthPublishedCount = peerPublished.filter((article) => monthKey(article.publishAt) === targetMonth).length;

  if (weekPublishedCount >= WEEKLY_PUBLISH_LIMIT) {
    errors.push(
      `${candidate.relativePath}: publishing would exceed weekly limit ${WEEKLY_PUBLISH_LIMIT} for week ${targetWeek}`
    );
  }

  if (monthPublishedCount >= MONTHLY_PUBLISH_LIMIT) {
    errors.push(
      `${candidate.relativePath}: publishing would exceed monthly limit ${MONTHLY_PUBLISH_LIMIT} for month ${targetMonth}`
    );
  }

  return {
    allowed: errors.length === 0,
    candidate,
    errors,
    warnings,
    weekPublishedCount,
    monthPublishedCount,
    targetWeek,
    targetMonth
  };
}
