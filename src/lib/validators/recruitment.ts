import { z } from "zod";

export const ApplicantSchema = z.object({
  name: z.string().min(2, "El nombre completo es obligatorio."),
  email: z.string().email("Formato de correo inválido.").toLowerCase().trim(),
  phone: z.string().min(10, "El número de teléfono es obligatorio."),
  efsetLink: z.string().url("Debe ser un enlace válido a tu certificado EFSET."),
  cvUrl: z.string().url("Debes cargar tu currículum.").optional(),
});

export type ApplicantData = z.infer<typeof ApplicantSchema>;