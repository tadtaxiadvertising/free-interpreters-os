import { z } from 'zod';

export const MonitoringFilterSchema = z.object({
  search: z.string().optional(),
  campaign: z.string().optional(),
});

export type MonitoringFilterInput = z.infer<typeof MonitoringFilterSchema>;

export interface MonitoredInterpreter {
  id: number;
  name: string;
  externalId: string;
  campaign: string | null;
  status: string;
}
