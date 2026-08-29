import { defineCollection, z } from 'astro:content';

const visualSchema = z.object({
  source: z.literal('ai-generated'),
  mode: z.enum(['pending', 'photorealistic', 'illustration', 'collage', 'still-life']),
  promptSummary: z.string().min(20),
  intent: z.string().min(10),
  avoid: z.array(z.string()).default([]),
  seasonalContext: z.string().min(10).optional(),
  seasonalCues: z.array(z.string()).min(2).optional(),
  seasonalAvoid: z.array(z.string()).min(2).optional(),
  seasonalityReviewedBy: z.string().min(3).optional()
});

const crossVolumeReviewSchema = z.object({
  references: z.array(z.object({
    volume: z.string().regex(/^vol-\d{3}$/),
    planEntryTitle: z.string().min(4)
  })).min(1),
  allowedTopics: z.array(z.string().min(3)).min(1),
  excludedTopics: z.array(z.string().min(3)).min(1),
  managingEditorApproval: z.object({
    status: z.enum(['pending', 'approved', 'rejected']),
    reviewedBy: z.string().optional(),
    reviewedAt: z.string().optional(),
    rationale: z.string().optional()
  })
});

const editorialIntegritySchema = z.object({
  issueNumber: z.number().int().positive(),
  approvedPlan: z.string(),
  planEntryTitle: z.string(),
  briefVolume: z.string(),
  publicationDate: z.string(),
  briefReviewedAt: z.string(),
  sourceVolumes: z.array(z.string()).min(1),
  crossVolumeRationale: z.string().optional(),
  crossVolumeReview: crossVolumeReviewSchema.optional(),
  scheduleRecovery: z.object({
    originalPublishAt: z.string(),
    previousPublishAt: z.string(),
    rescheduledPublishAt: z.string(),
    rescheduledAt: z.string(),
    reason: z.string().min(10),
    approvedBy: z.enum(['agent:managing-editor', 'agent:publisher']),
    attempt: z.number().int().positive(),
    mode: z.enum(['editorial', 'delivery']).optional(),
    resumedFromUnmergedPublication: z.boolean().optional(),
    qualityGatesPreserved: z.boolean().optional(),
    automatedDateFieldsUpdated: z.boolean().optional(),
    editorialRevalidatedAt: z.string().optional(),
    visualRecheckRequired: z.boolean(),
    visualRevalidatedAt: z.string().optional()
  }).optional(),
  integrityReview: z.object({
    status: z.enum(['pending', 'passed']),
    reviewedBy: z.string().optional(),
    reviewedAt: z.string().optional(),
    planAlignment: z.string().optional(),
    timingAlignment: z.string().optional(),
    crossVolumeDecision: z.enum(['pending', 'not-applicable', 'accepted', 'removed'])
  })
});

const volumes = defineCollection({
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
    volume: z.string(),
    kind: z.enum(['cover-story', 'feature', 'essay', 'interview', 'shopping-guide', 'column']),
    template: z.enum(['cover-story', 'feature', 'photo-essay', 'interview', 'shopping-guide', 'column']),
    status: z.enum(['draft', 'scheduled', 'published']),
    publishAt: z.string(),
    heroImage: z.string(),
    heroAlt: z.string(),
    editorial: editorialIntegritySchema.optional(),
    visual: visualSchema,
    tags: z.array(z.string()).default([])
  })
});

export const collections = { volumes, articles };
