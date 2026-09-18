import { z } from 'zod';

export const syllabusKindSchema = z.enum(['unit', 'topic', 'subtopic']);

export const syllabusNodeSchema = z
  .object({
    kind: syllabusKindSchema,
    parent_id: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    name: z.string().trim().min(2, 'Give this a name.').max(120),
    code: z
      .string()
      .trim()
      .max(24)
      .optional()
      .transform((value) => (value === '' ? undefined : value)),
    description: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((value) => (value === '' ? undefined : value)),
  })
  .refine((value) => (value.kind === 'unit') === (value.parent_id === undefined), {
    message: 'Units sit at the top level; topics and subtopics need a parent.',
    path: ['parent_id'],
  });

export const updateSyllabusNodeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, 'Give this a name.').max(120),
  code: z
    .string()
    .trim()
    .max(24)
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
});

export const reorderSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(['up', 'down']),
});

export type SyllabusNodeInput = z.infer<typeof syllabusNodeSchema>;
