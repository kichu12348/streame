import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { uploadRoutes } from "./src/routes/upload";
import moviesSeriesRoutes from "./src/routes/movies_series";
import { manageRoutes } from "./src/routes/manage";

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: true,
});

app.register(fastifyStatic, {
  root: path.join(process.cwd(), "uploads", "covers"),
  prefix: "/covers/",
  maxAge: "30d",
  immutable: true,
  cacheControl: true,
});

app.register(uploadRoutes, { prefix: "/api/upload" });
app.register(moviesSeriesRoutes, { prefix: "/api/media" });
app.register(manageRoutes, { prefix: "/api/manage" });

app.get("/", async () => {
  return { hello: "world" };
});

const start = async () => {
  try {
    const address = await app.listen({ port: 3000 });
    console.log(`Server listening at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
