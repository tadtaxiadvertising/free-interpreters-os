# Documentación Corporativa - Free Interpreters

Este directorio contiene la documentación oficial, estandarizada y profesionalizada para la operación de **Free Interpreters**.

## Estructura de Carpetas

### [01_Administrative](./01_Administrative)

Documentos legales, contratos, políticas y formatos administrativos esenciales.

* Carta de Bienvenida, Contrato Freelance, Código de Conducta, Reglamento Interno, etc.

### [02_SOPs](./02_SOPs)

Procedimientos Operativos Estándar (Standard Operating Procedures) detallados paso a paso.

* Reclutamiento, Onboarding, Producción, QA, Pagos, Soporte, etc.

### [03_Templates](./03_Templates)

Plantillas y formatos listos para usar en el día a día.

* Evaluaciones, Encuestas, Reportes de Incidencias, Coaching, etc.

### [04_Strategic](./04_Strategic)

Documentos de alto nivel sobre la estrategia y estructura de la empresa.

* Modelo de Negocio, Manual Operativo Maestro, Plan de Crecimiento, etc.

### [05_Tools_Excel_Sheets](./05_Tools_Excel_Sheets)

Herramientas prácticas en formato CSV (compatibles con Excel y Google Sheets) para la gestión diaria.

* **Master Roster:** Base de datos de intérpretes.
* **Production Log:** Control de horas y minutos.
* **QA Scorecard:** Calculadora de calidad.
* **Payroll:** Calculadora de nómina.
* **Recruitment:** Pipeline de candidatos.
* **Schedule:** Plantilla de horarios.
* **Plantilla Tiempo Intérprete:** Hoja individual para logueo de horas.
* **Master Admin Pagos:** Dashboard centralizado conectado.
* *Incluye guías de configuración y conexión.*

### Mantenimiento Multi-Repositorio

A partir de la v3, el proyecto se divide en dos repositorios independientes:

| Repositorio | Servicio | Responsabilidad |
| :---------- | :------- | :-------------- |
| `free-interpreters-os` | Frontend (`interpreters`) | UI, autenticación SSR, assets estáticos |
| `interpreters-api` | Backend (`interpreters-api`) | API REST, lógica de negocio, base de datos |

**Protocolo de versionamiento:**

1. Cada repositorio mantiene su propio `CHANGELOG.md` y versión semántica en `package.json`.
2. Cambios en el schema de Prisma (`prisma/schema.prisma`) se gestionan **exclusivamente** desde `interpreters-api`.
3. El Frontend consume una copia de referencia del schema (solo lectura).
4. Los despliegues son independientes — un cambio de UI no requiere redesplegar el Backend.
5. Cambios que afecten el contrato API (nuevos endpoints, campos renombrados) requieren **coordinación entre ambos repos** y actualización de `docs/API_SPEC.md`.

---
**Instrucciones de Uso:**

1. **Lectura:** Se recomienda leer el `02_Manual_Operativo.md` en la carpeta Strategic para una visión general.
2. **Edición:** Estos documentos están en formato Markdown (.md), fácilmente convertibles a PDF o copiables a Google Docs.
3. **Herramientas:** Importa los archivos CSV a Google Sheets y sigue la `00_Guia_Configuracion_Sheets.md` y `09_Guia_Sistema_Conectado.md` para activar la automatización.
4. **Mantenimiento:** Cualquier actualización debe registrarse cambiando la versión del documento.

**Generado por Antigravity**
*Fecha: Diciembre 2025*
