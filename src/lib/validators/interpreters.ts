import { z } from 'zod';

export const InterpreterStatusSchema = z.enum(['Activo', 'Training', 'Inactivo', 'Probation']);

export const UpdateInterpreterStatusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: InterpreterStatusSchema,
});

export type UpdateInterpreterStatusInput = z.infer<typeof UpdateInterpreterStatusSchema>;
