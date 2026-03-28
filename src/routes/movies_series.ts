import type { FastifyInstance } from "fastify";
import {
  streamMovieHandler,
  streamMovieHlsHandler,
  streamMovieSubsHandler,
  streamMovieAudiosHandler,
  streamEpisodeHandler,
  streamEpisodeHlsHandler,
  streamEpisodeSubsHandler,
  streamEpisodeAudiosHandler,
  type MediaIdParams,
  type MediaFileParams,
} from "../controllers/movies_series.controller";

export default function moviesSeriesRoutes(app: FastifyInstance) {
  app.get<{ Params: MediaIdParams }>("/:id", streamMovieHandler);
  app.get<{ Params: MediaFileParams }>("/:id/hls/:file", streamMovieHlsHandler);
  app.get<{ Params: MediaFileParams }>(
    "/subs/:id/:file",
    streamMovieSubsHandler,
  );
  app.get<{ Params: MediaFileParams }>(
    "/audios/:id/:file",
    streamMovieAudiosHandler,
  );
  app.get<{ Params: MediaIdParams }>("/episodes/:id", streamEpisodeHandler);
  app.get<{ Params: MediaFileParams }>(
    "/episodes/:id/hls/:file",
    streamEpisodeHlsHandler,
  );
  app.get<{ Params: MediaFileParams }>(
    "/episodes/subs/:id/:file",
    streamEpisodeSubsHandler,
  );
  app.get<{ Params: MediaFileParams }>(
    "/episodes/audios/:id/:file",
    streamEpisodeAudiosHandler,
  );
}
