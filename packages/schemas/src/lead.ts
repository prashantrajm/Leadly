import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";

export const LeadSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		agentId: Cuid,
		email: z.string().email().nullable(),
		phone: z.string().nullable(),
		name: z.string().nullable(),
		customFields: z.record(z.string(), z.unknown()),
		createdAt: IsoDate,
		updatedAt: IsoDate,
	})
	.openapi("Lead");
export type Lead = z.infer<typeof LeadSchema>;

// What the agent's capture_contact tool emits. At least one of email/phone
// must be present — the route handler enforces this with .refine since Zod
// can't express "at least one" purely with field-level rules.
export const CaptureLeadSchema = z
	.object({
		email: z.string().email().optional(),
		phone: z.string().min(5).max(40).optional(),
		name: z.string().min(1).max(120).optional(),
		customFields: z.record(z.string(), z.unknown()).optional(),
	})
	.refine((d) => Boolean(d.email || d.phone), {
		message: "At least one of email or phone is required",
		path: ["email"],
	})
	.openapi("CaptureLead");
export type CaptureLead = z.infer<typeof CaptureLeadSchema>;

export const UpdateLeadSchema = z
	.object({
		email: z.string().email().nullable().optional(),
		phone: z.string().min(5).max(40).nullable().optional(),
		name: z.string().min(1).max(120).nullable().optional(),
		customFields: z.record(z.string(), z.unknown()).optional(),
	})
	.openapi("UpdateLead");
export type UpdateLead = z.infer<typeof UpdateLeadSchema>;
