import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.middleware';
import { NewsIngestionService } from '../services/news-ingestion.service';

const CreateSourceSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  feedUrl: z.string().url().optional(),
  scrapeEnabled: z.boolean().default(false),
  reliabilityScore: z.number().min(0).max(100).optional(),
  fetchFrequencyMinutes: z.number().min(5).max(1440).default(60),
  favicon: z.string().url().optional(),
});

const UpdateSourceSchema = CreateSourceSchema.partial();

export async function sourcesRoutes(fastify: FastifyInstance) {
  const ingestionService = new NewsIngestionService(fastify.db);

  // Get all sources
  fastify.get('/sources', async (request, reply) => {
    try {
      const result = await fastify.db.query(
        `
        SELECT
          id, name, url, feed_url, scrape_enabled, reliability_score,
          favicon, is_active, last_fetched_at, fetch_frequency_minutes,
          created_at, updated_at
        FROM sources
        ORDER BY name
        `
      );

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        feedUrl: row.feed_url,
        scrapeEnabled: row.scrape_enabled,
        reliabilityScore: row.reliability_score,
        favicon: row.favicon,
        isActive: row.is_active,
        lastFetchedAt: row.last_fetched_at,
        fetchFrequencyMinutes: row.fetch_frequency_minutes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch sources' });
    }
  });

  // Get source by ID
  fastify.get('/sources/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const result = await fastify.db.query(
        `
        SELECT
          id, name, url, feed_url, scrape_enabled, reliability_score,
          favicon, is_active, last_fetched_at, fetch_frequency_minutes,
          created_at, updated_at
        FROM sources
        WHERE id = $1
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Source not found' });
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        url: row.url,
        feedUrl: row.feed_url,
        scrapeEnabled: row.scrape_enabled,
        reliabilityScore: row.reliability_score,
        favicon: row.favicon,
        isActive: row.is_active,
        lastFetchedAt: row.last_fetched_at,
        fetchFrequencyMinutes: row.fetch_frequency_minutes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch source' });
    }
  });

  // Create a new source (admin only - for now, just authenticated)
  fastify.post('/sources', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const data = CreateSourceSchema.parse(request.body);
      const id = uuidv4();

      await fastify.db.query(
        `
        INSERT INTO sources (
          id, name, url, feed_url, scrape_enabled, reliability_score,
          favicon, fetch_frequency_minutes, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
        RETURNING *
        `,
        [
          id,
          data.name,
          data.url,
          data.feedUrl,
          data.scrapeEnabled,
          data.reliabilityScore,
          data.favicon,
          data.fetchFrequencyMinutes,
        ]
      );

      const result = await fastify.db.query('SELECT * FROM sources WHERE id = $1', [id]);
      const row = result.rows[0];

      return reply.status(201).send({
        id: row.id,
        name: row.name,
        url: row.url,
        feedUrl: row.feed_url,
        scrapeEnabled: row.scrape_enabled,
        reliabilityScore: row.reliability_score,
        favicon: row.favicon,
        isActive: row.is_active,
        lastFetchedAt: row.last_fetched_at,
        fetchFrequencyMinutes: row.fetch_frequency_minutes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to create source' });
    }
  });

  // Update a source
  fastify.patch('/sources/:id', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = UpdateSourceSchema.parse(request.body);

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.url !== undefined) {
        fields.push(`url = $${paramIndex++}`);
        values.push(data.url);
      }
      if (data.feedUrl !== undefined) {
        fields.push(`feed_url = $${paramIndex++}`);
        values.push(data.feedUrl);
      }
      if (data.scrapeEnabled !== undefined) {
        fields.push(`scrape_enabled = $${paramIndex++}`);
        values.push(data.scrapeEnabled);
      }
      if (data.reliabilityScore !== undefined) {
        fields.push(`reliability_score = $${paramIndex++}`);
        values.push(data.reliabilityScore);
      }
      if (data.favicon !== undefined) {
        fields.push(`favicon = $${paramIndex++}`);
        values.push(data.favicon);
      }
      if (data.fetchFrequencyMinutes !== undefined) {
        fields.push(`fetch_frequency_minutes = $${paramIndex++}`);
        values.push(data.fetchFrequencyMinutes);
      }

      if (fields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      await fastify.db.query(
        `UPDATE sources SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      const result = await fastify.db.query('SELECT * FROM sources WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Source not found' });
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        url: row.url,
        feedUrl: row.feed_url,
        scrapeEnabled: row.scrape_enabled,
        reliabilityScore: row.reliability_score,
        favicon: row.favicon,
        isActive: row.is_active,
        lastFetchedAt: row.last_fetched_at,
        fetchFrequencyMinutes: row.fetch_frequency_minutes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to update source' });
    }
  });

  // Delete a source
  fastify.delete('/sources/:id', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const result = await fastify.db.query('DELETE FROM sources WHERE id = $1 RETURNING id', [
        id,
      ]);

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Source not found' });
      }

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to delete source' });
    }
  });

  // Trigger ingestion for a specific source
  fastify.post('/sources/:id/ingest', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const result = await ingestionService.triggerIngestion(id);

      return {
        message: 'Ingestion triggered successfully',
        jobIds: result.jobIds,
      };
    } catch (error) {
      fastify.log.error(error);
      const message = error instanceof Error ? error.message : 'Failed to trigger ingestion';
      reply.status(500).send({ error: message });
    }
  });

  // Trigger ingestion for all sources
  fastify.post('/sources/ingest-all', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const result = await ingestionService.triggerAllSources();

      return {
        message: 'Ingestion triggered for all sources',
        totalJobs: result.totalJobs,
        jobIds: result.jobIds,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to trigger ingestion' });
    }
  });

  // Get ingestion statistics
  fastify.get('/sources/ingestion/stats', async (request, reply) => {
    try {
      const stats = await ingestionService.getIngestionStats();
      return stats;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch ingestion stats' });
    }
  });

  // Get ingestion logs
  fastify.get('/sources/ingestion/logs', async (request, reply) => {
    try {
      const { limit } = request.query as { limit?: string };
      const logs = await ingestionService.getIngestionLogs(
        limit ? parseInt(limit, 10) : 50
      );
      return logs;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch ingestion logs' });
    }
  });

  // Toggle source active status
  fastify.patch('/sources/:id/toggle', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const result = await fastify.db.query(
        `
        UPDATE sources
        SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = $1
        RETURNING is_active
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Source not found' });
      }

      return {
        id,
        isActive: result.rows[0].is_active,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to toggle source status' });
    }
  });
}
