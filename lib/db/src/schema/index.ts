import { pgTable, text, serial, timestamp, integer, index, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// --- PROSPECTS ---
export const prospectsTable = pgTable("prospects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position"),
  department: text("department"),
  company: text("company").notNull(),
  country: text("country"),
  city: text("city"),
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  seniority: text("seniority"),
  industry: text("industry"),
  whatsappNumber: text("whatsapp_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("prospects_name_idx").on(table.name),
  companyIdx: index("prospects_company_idx").on(table.company),
  countryIdx: index("prospects_country_idx").on(table.country),
  positionIdx: index("prospects_position_idx").on(table.position),
  departmentIdx: index("prospects_department_idx").on(table.department),
}));

export const prospects = prospectsTable; // Alias for compatibility
export const insertProspectSchema = createInsertSchema(prospectsTable).omit({ id: true, createdAt: true });
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospectsTable.$inferSelect;

export const savedProspectsTable = pgTable("saved_prospects", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").notNull().references(() => prospectsTable.id, { onDelete: "cascade" }),
  listName: text("list_name").default("default"),
  notes: text("notes"),
  pipelineStage: text("pipeline_stage").default("new"),
  lastContactedAt: timestamp("last_contacted_at"),
  nextActionAt: timestamp("next_action_at"),
  pipelineNotes: text("pipeline_notes"),
  cadenceStep: integer("cadence_step").default(0),
  savedAt: timestamp("saved_at").defaultNow().notNull(),
});

export const savedProspects = savedProspectsTable; // Alias for compatibility
export const insertSavedProspectSchema = createInsertSchema(savedProspectsTable).omit({ id: true, savedAt: true });
export type InsertSavedProspect = z.infer<typeof insertSavedProspectSchema>;
export type SavedProspect = typeof savedProspectsTable.$inferSelect;

// --- ENRICHMENTS ---
export const prospectEnrichmentsTable = pgTable("prospect_enrichments", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").notNull().unique().references(() => prospectsTable.id, { onDelete: "cascade" }),
  email: text("email"),
  alternativeEmails: jsonb("alternative_emails").$type<string[]>().default([]),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  socialProfiles: jsonb("social_profiles").$type<Array<{ platform: string; url: string; username?: string }>>().default([]),
  pressItems: jsonb("press_items").$type<Array<{ title: string; url: string; source?: string; date?: string; snippet?: string }>>().default([]),
  summary: text("summary"),
  confidence: text("confidence"),
  sources: jsonb("sources").$type<string[]>().default([]),
  salesApproach: text("sales_approach"),
  companyPhone: text("company_phone"),
  triggerEvents: jsonb("trigger_events").$type<Array<{ type: string; title: string; description: string; date?: string; source?: string; impact: "high" | "medium" | "low" }>>().default([]),
  enrichedAt: timestamp("enriched_at").defaultNow().notNull(),
});

export const prospectEnrichments = prospectEnrichmentsTable; // Alias for compatibility
export const insertProspectEnrichmentSchema = createInsertSchema(prospectEnrichmentsTable).omit({ id: true, enrichedAt: true });
export type InsertProspectEnrichment = z.infer<typeof insertProspectEnrichmentSchema>;
export type ProspectEnrichment = typeof prospectEnrichmentsTable.$inferSelect;

// --- CONVERSATIONS ---
export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospectsTable.id, { onDelete: "cascade" }),
  platform: text("platform"),
  platformConversationId: text("platform_conversation_id"),
  title: text("title"),
  externalId: text("external_id"),
  status: text("status").default("active"),
  isAutoAgentEnabled: text("is_auto_agent_enabled").default("false"),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  platformConvIdx: index("conversations_platform_conv_idx").on(table.platform, table.platformConversationId),
  externalIdIdx: index("conversations_external_id_idx").on(table.externalId),
}));

export const conversations = conversationsTable; // Alias for compatibility
export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;

// --- MESSAGES ---
export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  platformMessageId: text("platform_message_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = messagesTable; // Alias for compatibility
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

// --- CACHE ---
export const searchCacheTable = pgTable("search_cache", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull().$type<any>(),
  engine: text("engine"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const searchCache = searchCacheTable; // Alias for compatibility
export const insertSearchCacheSchema = createInsertSchema(searchCacheTable).omit({ id: true, createdAt: true });
export type InsertSearchCache = z.infer<typeof insertSearchCacheSchema>;
export type SearchCache = typeof searchCacheTable.$inferSelect;

// --- SETTINGS ---
export const aiConfigurations = pgTable("ai_configurations", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), 
  apiKey: text("api_key").notNull(),
  baseUrl: text("base_url"),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whatsappConfigurations = pgTable("whatsapp_configurations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  apiToken: text("api_token").notNull(),
  phoneNumberId: text("phone_number_id").notNull(),
  verifyToken: text("verify_token").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
