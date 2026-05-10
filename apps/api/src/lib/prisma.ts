import { PrismaClient } from "../generated/client";
import { withAccelerate } from "@prisma/extension-accelerate";

function createPrisma(databaseUrl: string) {
	return new PrismaClient({
		accelerateUrl: databaseUrl,
	}).$extends(withAccelerate());
}

let cachedDatabaseUrl: string | undefined;
let cachedPrisma: ReturnType<typeof createPrisma> | undefined;

export const getPrisma = (databaseUrl: string) => {
	if (cachedPrisma && cachedDatabaseUrl === databaseUrl) {
		return cachedPrisma;
	}

	cachedDatabaseUrl = databaseUrl;
	cachedPrisma = createPrisma(databaseUrl);
	return cachedPrisma;
};

export type ExtendedPrismaClient = ReturnType<typeof getPrisma>;
