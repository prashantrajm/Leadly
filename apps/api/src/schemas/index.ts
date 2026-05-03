import { z } from "@hono/zod-openapi";

export const PaginationQuerySchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("20"),
});

export const ErrorSchema = z
  .object({
    error: z.string(),
    message: z.string().optional(),
  })
  .openapi("Error");

export const SuccessSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
  })
  .openapi("Success");
