# Guía de Configuración de Herramientas en Google Sheets

Este documento explica cómo transformar los archivos CSV generados en herramientas poderosas y automatizadas dentro de Google Sheets.

## 1. Master Roster (Base de Datos Maestra)
**Archivo:** `01_Master_Roster.csv`

### Mejoras Sugeridas:
*   **Validación de Datos (Columna C - Estado):**
    *   Selecciona la columna C (sin el encabezado).
    *   Ve a `Datos > Validación de datos`.
    *   Criterio: Lista de elementos.
    *   Valores: `Activo, Inactivo, Training, Probation, On Leave`.
    *   *Beneficio:* Evita errores de escritura en los estados.
*   **Formato Condicional (Columna C):**
    *   Si texto contiene "Activo" -> Fondo Verde.
    *   Si texto contiene "Inactivo" -> Fondo Rojo.
    *   Si texto contiene "Training" -> Fondo Amarillo.

## 2. Production Log (Control de Producción)
**Archivo:** `02_Production_Log.csv`

### Fórmulas Clave:
*   **Columna H (Horas Conectadas):**
    *   Fórmula: `=(G2-F2)*24` (Asumiendo formato de hora en F y G).
    *   *Nota:* Asegúrate de formatear la celda como "Número".
*   **Columna K (Adherencia %):**
    *   Fórmula: `=SI(H2=0, 0, (H2/Horas_Programadas))`
*   **Tabla Dinámica (Pivot Table):**
    *   Crea una hoja nueva.
    *   Inserta Tabla Dinámica usando los datos del Log.
    *   Filas: `Nombre`. Valores: `Suma de Minutos Interpretados`, `Promedio de QA Score`.
    *   *Beneficio:* Verás el rendimiento semanal por intérprete automáticamente.

## 3. QA Scorecard (Calculadora de Calidad)
**Archivo:** `03_QA_Scorecard.csv`

### Automatización:
*   **Columna M (TOTAL SCORE %):**
    *   Fórmula: `=SUMA(H2:L2)`
    *   *Importante:* Asegúrate de que las columnas H, I, J, K, L solo permitan números hasta su máximo (ej. 20, 40, etc.).
*   **Columna N (Error Crítico):**
    *   Validación de datos: Checkbox o Lista `SI, NO`.
*   **Formato Condicional (Columna M):**
    *   Si valor < 85 -> Fondo Rojo (Alerta).
    *   Si valor >= 90 -> Fondo Verde (Excelente).
    *   Si Columna N = "SI" -> Columna M debe ponerse en 0 automáticamente (requiere fórmula compleja o script, o hacerlo manual).

## 4. Payroll Calculator (Nómina)
**Archivo:** `04_Payroll_Calculator.csv`

### Fórmulas de Dinero:
*   **Columna H (Total Bruto):**
    *   Fórmula: `=F2*G2` (Tarifa * Minutos).
*   **Columna L (Total Neto):**
    *   Fórmula: `=H2+I2-J2-K2` (Bruto + Bono - Penalidad - Deducción).
*   **Protección:**
    *   Bloquea las celdas con fórmulas para que no se borren accidentalmente (`Ver > Proteger hojas e intervalos`).

## 5. Recruitment Pipeline (Flujo de Reclutamiento)
**Archivo:** `05_Recruitment_Pipeline.csv`

### Visualización:
*   **Filtros:** Activa los filtros (`Datos > Crear filtro`) para ver solo candidatos "Pendientes" o "Contratados".
*   **Cálculo de Días:**
    *   Nueva Columna "Días en Proceso": `=HOY() - A2` (Fecha Postulación).
    *   Ayuda a identificar candidatos olvidados.

## 6. Weekly Schedule (Horario Semanal)
**Archivo:** `06_Weekly_Schedule.csv`

### Tips de Uso:
*   **Lista Desplegable de Intérpretes:**
    *   Crea una hoja "Data" con la lista de nombres del Master Roster.
    *   En el Schedule, usa Validación de Datos para que las celdas de los días (Lunes-Domingo) sean una lista desplegable de esa hoja "Data".
    *   *Beneficio:* Asignar turnos seleccionando nombres, sin escribir.

---
**Instrucciones Generales:**
1.  Abre Google Sheets (sheets.new).
2.  Ve a `Archivo > Importar > Subir` y selecciona los archivos CSV generados.
3.  Aplica las fórmulas y formatos sugeridos arriba.
4.  Guarda los archivos como "Google Sheets" para habilitar la colaboración en tiempo real.
