import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const movies = sqliteTable("movies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status", { enum: ["pending", "processing", "ready"] }).default("pending").notNull(),
  audios: text("audios", { mode: "json" }).$type<string[]>(),
  subtitles: text("subtitles", { mode: "json" }).$type<string[]>(),
});

export const series = sqliteTable("series", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
});

export const episodes = sqliteTable("episodes", {
  id: text("id").primaryKey(),
  seriesId: text("series_id").references(() => series.id).notNull(),
  seasonNumber: integer("season_number").notNull(),
  episodeNumber: integer("episode_number").notNull(),
  status: text("status", { enum: ["pending", "processing", "ready"] }).default("pending").notNull(),
  audios: text("audios", { mode: "json" }).$type<string[]>(),
  subtitles: text("subtitles", { mode: "json" }).$type<string[]>(),
});

export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(),
  referenceId: text("reference_id").notNull(),
  referenceType: text("reference_type", { enum: ["movie", "episode"] }).notNull(),
  filename: text("filename").notNull(),
  totalChunks: integer("total_chunks").notNull(),
  receivedChunks: integer("received_chunks").default(0).notNull(),
  status: text("status", { enum: ["uploading", "completed", "failed"] }).default("uploading").notNull(),
});
