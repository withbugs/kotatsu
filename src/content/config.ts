import { defineCollection, z } from 'astro:content';

const visualSchema = z.object({
  source: z.literal('ai-generated'),
  mode: z.enum(['photorealistic', 'illustration', 'collage', 'still-life']),
  promptSummary: z.string().min(20),
  intent: z.string().min(10),
  avoid: z.array(z.string()).default([])
});

const issues = defineCollection({
  type: 'content',
  schema: z.object({
    number: z.number(),
    title: z.string(),
    subtitle: z.string(),
    month: z.string(),
    status: z.enum(['planning', 'active', 'complete']),
    coverImage: z.string(),
    coverAlt: z.string(),
    visual: visualSchema,
    categories: z.array(z.string())
  })
});

const articles = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['STYLE', 'LIFE', 'WEEKEND', 'CULTURE', 'PEOPLE', 'SHOPPING', 'COLUMN']),
    issue: z.string(),
    kind: z.enum(['cover-story', 'feature', 'essay', 'interview', 'shopping-guide', 'column']),
    template: z.enum(['cover-story', 'feature', 'photo-essay', 'interview', 'shopping-guide', 'column']),
    status: z.enum(['draft', 'scheduled', 'published']),
    publishAt: z.string(),
    heroImage: z.string(),
    heroAlt: z.string(),
    visual: visualSchema,
    tags: z.array(z.string()).default([])
  })
});

export const collections = { issues, articles };


