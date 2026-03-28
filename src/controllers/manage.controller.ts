import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index";
import { movies, series, episodes } from "../db/schema";
import { and, count, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// ── Movies ────────────────────────────────────────────────────────────────────

export async function createMovieHandler(
  req: FastifyRequest<{ Body: { title: string; coverImage: string } }>,
  reply: FastifyReply,
) {
  const { title, coverImage } = req.body;
  if (!title || !coverImage) {
    return reply.code(400).send({ error: "title and coverImage are required" });
  }
  const id = uuidv4();
  await db.insert(movies).values({ id, title, coverImage, status: "pending" });
  return reply.code(201).send({ id, title, coverImage, status: "pending" });
}

export async function listMoviesHandler(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const all = await db.select().from(movies);
  return reply.send(all);
}

export async function getMovieHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = req.params;
  const [movie] = await db
    .select()
    .from(movies)
    .where(eq(movies.id, id))
    .limit(1);
  if (!movie) {
    return reply.code(404).send({ error: "Movie not found" });
  }
  return reply.send(movie);
}

// ── Series ────────────────────────────────────────────────────────────────────

export async function createSeriesHandler(
  req: FastifyRequest<{
    Body: { title: string; description?: string; coverImage: string };
  }>,
  reply: FastifyReply,
) {
  const { title, description, coverImage } = req.body;
  if (!title || !coverImage) {
    return reply.code(400).send({ error: "title and coverImage are required" });
  }
  const id = uuidv4();
  await db.insert(series).values({ id, title, description, coverImage });
  return reply.code(201).send({ id, title, description, coverImage });
}

export async function listSeriesHandler(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const all = await db.select().from(series);
  return reply.send(all);
}

export async function getSeriesHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = req.params;
  const [s] = await db.select().from(series).where(eq(series.id, id)).limit(1);
  if (!s) {
    return reply.code(404).send({ error: "Series not found" });
  }
  return reply.send(s);
}

export async function getSeriesBySeasonHandler(
  req: FastifyRequest<{
    Params: { seriesId: string; seasonNumber: number };
  }>,
  reply: FastifyReply,
) {
  const { seriesId, seasonNumber } = req.params;
  const all = await db
    .select()
    .from(episodes)
    .where(
      and(
        eq(episodes.seriesId, seriesId),
        eq(episodes.seasonNumber, seasonNumber),
      ),
    );
  return reply.send(all);
}

export async function getSeriesSeasonsHandler(
  req: FastifyRequest<{ Params: { seriesId: string } }>,
  reply: FastifyReply,
) {
  const { seriesId } = req.params;
  const seasons = db
    .select({
      seasonNumber: episodes.seasonNumber,
      episodeCount: count(episodes.id),
    })
    .from(episodes)
    .where(eq(episodes.seriesId, seriesId))
    .groupBy(episodes.seasonNumber)
    .all();
  return reply.send(seasons);
}

// ── Episodes ──────────────────────────────────────────────────────────────────

export async function createEpisodeHandler(
  req: FastifyRequest<{
    Body: {
      seriesId: string;
      seasonNumber: number;
      episodeNumber: number;
    };
  }>,
  reply: FastifyReply,
) {
  const { seriesId, seasonNumber, episodeNumber } = req.body;
  if (!seriesId || seasonNumber == null || episodeNumber == null) {
    return reply
      .code(400)
      .send({ error: "seriesId, seasonNumber and episodeNumber are required" });
  }

  // validate series exists
  const [existing] = await db
    .select()
    .from(series)
    .where(eq(series.id, seriesId))
    .limit(1);
  if (!existing) {
    return reply.code(404).send({ error: "Series not found" });
  }

  const id = uuidv4();
  await db
    .insert(episodes)
    .values({ id, seriesId, seasonNumber, episodeNumber, status: "pending" });
  return reply
    .code(201)
    .send({ id, seriesId, seasonNumber, episodeNumber, status: "pending" });
}

export async function listEpisodesHandler(
  req: FastifyRequest<{ Params: { seriesId: string } }>,
  reply: FastifyReply,
) {
  const { seriesId } = req.params;
  const all = await db
    .select()
    .from(episodes)
    .where(eq(episodes.seriesId, seriesId));
  return reply.send(all);
}

export async function getEpisodeHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = req.params;
  const [episode] = await db
    .select()
    .from(episodes)
    .where(eq(episodes.id, id))
    .limit(1);
  if (!episode) {
    return reply.code(404).send({ error: "Episode not found" });
  }
  return reply.send(episode);
}
