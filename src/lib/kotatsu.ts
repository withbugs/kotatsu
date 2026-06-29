import type { CollectionEntry } from 'astro:content';

export const categories = [
  { id: 'STYLE', slug: 'style', label: 'STYLE', description: '大人の服、定番、季節の装い。' },
  { id: 'LIFE', slug: 'life', label: 'LIFE', description: '暮らし、道具、部屋、習慣。' },
  { id: 'WEEKEND', slug: 'weekend', label: 'WEEKEND', description: '喫茶店、散歩、旅、街歩き。' },
  { id: 'CULTURE', slug: 'culture', label: 'CULTURE', description: '音楽、本、映画、車、クラフト。' },
  { id: 'PEOPLE', slug: 'people', label: 'PEOPLE', description: '持ち物、仕事服、偏愛、暮らし方。' },
  { id: 'SHOPPING', slug: 'shopping', label: 'SHOPPING', description: '長く使えるものの選び方。' }
] as const;

export type Article = CollectionEntry<'articles'>;
export type Issue = CollectionEntry<'issues'>;

export function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return path.startsWith('/') ? `${normalizedBase}${path.slice(1)}` : `${normalizedBase}${path}`;
}

export function categorySlug(category: string): string {
  return category.toLowerCase();
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo'
  }).format(new Date(value));
}

export function sortByPublishDate(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => {
    return new Date(b.data.publishAt).getTime() - new Date(a.data.publishAt).getTime();
  });
}

export function isArticlePublished(article: Article): boolean {
  return article.data.status === 'published';
}

export function visibleArticles(articles: Article[]): Article[] {
  return sortByPublishDate(articles.filter((article) => article.data.status !== 'draft'));
}



