import Fastify from "fastify";
import { uploadRoutes } from "./src/routes/upload";
import moviesSeriesRoutes from "./src/routes/movies_series";

const app = Fastify({
  logger: true,
});

app.register(uploadRoutes, { prefix: "/api/upload" });
app.register(moviesSeriesRoutes, { prefix: "/api/media" });

app.get("/", async (request, reply) => {
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
