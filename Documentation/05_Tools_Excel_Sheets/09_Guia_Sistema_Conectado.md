# Guía para Conectar Hojas de Intérpretes con el Master Admin

Para mantener la privacidad y el orden, recomendamos usar el sistema de **"Archivos Separados Conectados"**.
Esto significa que cada intérprete tiene su propia hoja (que solo él ve) y tú tienes una hoja maestra (que solo tú ves) que "chupa" los datos automáticamente.

## Paso 1: Configurar la Hoja del Intérprete
1.  Sube el archivo `07_Plantilla_Tiempo_Interprete.csv` a Google Drive y ábrelo como Google Sheet.
2.  Nómbralo: `Log_JuanPerez_2024`.
3.  Comparte este archivo SOLO con Juan Perez (permiso de Editor).
4.  **Fórmula de Horas Conectadas (Columna E):**
    *   En la celda E2 pon: `=(D2-C2)*24`
    *   Arrastra la fórmula hacia abajo.
5.  **Celda de Total Minutos:**
    *   Supongamos que el total de minutos de la semana está en la celda **F30**. (Asegúrate de sumar toda la columna F).

## Paso 2: Configurar el Master Admin
1.  Sube el archivo `08_Master_Admin_Pagos.csv` a Google Drive.
2.  Nómbralo: `MASTER_NOMINA_FREE_INTERPRETERS`.
3.  No compartas este archivo con nadie (o solo con Finanzas).

## Paso 3: Conectar las Hojas (La Magia de IMPORTRANGE)
En tu hoja Master Admin, vamos a traer el total de minutos de Juan Perez automáticamente.

1.  Copia el **URL** de la hoja de Juan Perez.
2.  En tu Master Admin, en la celda **E2** (Total Minutos de Juan), escribe esta fórmula:
    ```excel
    =IMPORTRANGE("URL_DE_LA_HOJA_DE_JUAN", "NombreHoja!F30")
    ```
    *   *Reemplaza `URL_DE_LA_HOJA_DE_JUAN` con el link real.*
    *   *Reemplaza `NombreHoja!F30` con el nombre de la pestaña y la celda donde está el total en la hoja de Juan.*

3.  **Autorizar:** Al dar Enter, aparecerá un error `#REF!`. Pasa el mouse por encima y haz clic en el botón azul **"Permitir acceso"**.
4.  ¡Listo! Ahora, cada vez que Juan anote minutos en su hoja, tu Master Admin se actualizará solo.

## Paso 4: Automatizar Pagos
En el Master Admin:
*   **Columna F (Total Bruto):** `=D2*E2` (Tarifa * Minutos Importados).
*   **Columna H (Total Neto):** `=F2-G2` (Bruto - Deducciones).

---
**Resumen del Flujo:**
1.  Intérprete llena su hoja personal.
2.  Google Sheets envía el dato a tu Master Admin.
3.  Tú ves cuánto debes pagar en tiempo real, sin perseguir a nadie por reportes.
