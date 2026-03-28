import type { FastifyInstance } from "fastify";
import {
  createMovieHandler,
  listMoviesHandler,
  getMovieHandler,
  createSeriesHandler,
  listSeriesHandler,
  createEpisodeHandler,
  listEpisodesHandler,
  getEpisodeHandler,
  getSeriesHandler,
  getSeriesBySeasonHandler,
  getSeriesSeasonsHandler,
} from "../controllers/manage.controller";

export async function manageRoutes(app: FastifyInstance) {
  // Movies
  app.get("/movies", listMoviesHandler);
  app.get("/movies/:id", getMovieHandler);
  app.post("/movies", createMovieHandler);

  // Series
  app.get("/series", listSeriesHandler);
  app.post("/series", createSeriesHandler);
  app.get("/series/:id", getSeriesHandler);
  app.get("/series/:seriesId/:seasonNumber", getSeriesBySeasonHandler);
  app.get("/series/:seriesId/seasons", getSeriesSeasonsHandler);

  // Episodes
  app.get("/series/:seriesId/episodes", listEpisodesHandler);
  app.get("/episodes/:id", getEpisodeHandler);
  app.post("/episodes", createEpisodeHandler);
}
