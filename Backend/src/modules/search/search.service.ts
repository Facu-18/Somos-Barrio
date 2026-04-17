import { NewsStatus, MarketplaceStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type SearchType = "news" | "businesses" | "marketplace" | "forum";

type SearchOpts = {
  q: string;
  barrioSlug?: string;
  types: SearchType[];
  limit: number;
};

async function resolveBarrioId(slug?: string): Promise<string | undefined> {
  if (!slug) return undefined;
  const barrio = await prisma.barrio.findUnique({ where: { slug }, select: { id: true } });
  return barrio?.id;
}

export const searchService = {
  async search(opts: SearchOpts) {
    const { q, types, limit } = opts;
    const barrioId = await resolveBarrioId(opts.barrioSlug);
    const mode = "insensitive" as const;
    const results: Record<string, unknown[]> = {};

    const searches: Promise<void>[] = [];

    if (types.includes("news")) {
      searches.push(
        prisma.news
          .findMany({
            where: {
              status: NewsStatus.PUBLISHED,
              ...(barrioId ? { barrioId } : {}),
              OR: [
                { title: { contains: q, mode } },
                { excerpt: { contains: q, mode } },
                { content: { contains: q, mode } }
              ]
            },
            take: limit,
            orderBy: { publishedAt: "desc" },
            select: {
              id: true,
              title: true,
              slug: true,
              excerpt: true,
              category: true,
              publishedAt: true,
              barrio: { select: { name: true, slug: true } }
            }
          })
          .then((data) => { results.news = data; })
      );
    }

    if (types.includes("businesses")) {
      searches.push(
        prisma.business
          .findMany({
            where: {
              ...(barrioId ? { barrioId } : {}),
              OR: [
                { name: { contains: q, mode } },
                { description: { contains: q, mode } },
                { address: { contains: q, mode } }
              ]
            },
            take: limit,
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              slug: true,
              category: true,
              address: true,
              verified: true,
              barrio: { select: { name: true, slug: true } }
            }
          })
          .then((data) => { results.businesses = data; })
      );
    }

    if (types.includes("marketplace")) {
      searches.push(
        prisma.marketplacePost
          .findMany({
            where: {
              status: MarketplaceStatus.ACTIVE,
              ...(barrioId ? { barrioId } : {}),
              OR: [
                { title: { contains: q, mode } },
                { description: { contains: q, mode } }
              ]
            },
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              description: true,
              price: true,
              currency: true,
              category: true,
              barrio: { select: { name: true, slug: true } }
            }
          })
          .then((data) => { results.marketplace = data; })
      );
    }

    if (types.includes("forum")) {
      searches.push(
        prisma.forumThread
          .findMany({
            where: {
              ...(barrioId ? { barrioId } : {}),
              OR: [
                { title: { contains: q, mode } },
                { content: { contains: q, mode } }
              ]
            },
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              content: true,
              upVotes: true,
              downVotes: true,
              createdAt: true,
              barrio: { select: { name: true, slug: true } },
              subforum: { select: { name: true, slug: true } }
            }
          })
          .then((data) => { results.forum = data; })
      );
    }

    await Promise.all(searches);

    return { q, results };
  }
};
