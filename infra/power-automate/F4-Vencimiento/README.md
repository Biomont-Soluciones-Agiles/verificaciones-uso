# F4 · Vencimiento

**Propósito.** Cada semana recuerda al responsable de cada solución que su verificación de uso vence en los próximos 30 días, o que ya venció, cuando la solución no tiene ninguna verificación activa. Si ya venció, además pone `vu_estadovu = Pendiente` (§2.5).

| | |
|---|---|
| Nombre sugerido | `VU · F4 Vencimiento` |
| Disparador | Recurrencia semanal, lunes a las 07:00, zona `SA Pacific Standard Time` (Lima) |
| Tablas | `vu_solucion` (L/E `vu_estadovu`), `vu_verificacion` (lectura), `systemuser` (lectura), `vu_notificacion` (alta) |
| Conexiones | `vu_dataverse`, `vu_office365` |
| Variables de entorno | Ninguna |

## Pasos

```mermaid
flowchart TD
    T[Lunes 07:00 Lima] --> H["Hoy_Lima · Limite_30_dias (yyyy-MM-dd)"]
    H --> L["List rows vu_solucions<br/>statecode eq 0 and vu_proximavu ne null and vu_proximavu le hoy+30"]
    L --> B{{Para cada solución · 5 en paralelo}}
    B --> A["Buscar_verificacion_activa<br/>_vu_solucionid_value eq id and vu_estado ne 100000007 and vu_estado ne 100000008"]
    A --> K{¿Ninguna activa?}
    K -- no --> Fin[Nada]
    K -- sí --> D[Dias_para_vencer]
    D --> V{¿Vencida y vu_estadovu ≠ Pendiente?}
    V -- sí --> P["Update a row: vu_estadovu = Pendiente 100000000"]
    V --> Q{¿Tiene responsable?}
    P --> Q
    Q -- no --> Fin2[Sin aviso]
    Q -- sí --> R[Leer_responsable systemusers]
    R --> M[Send an email V2: por vencer / vencida]
    M -- Succeeded --> N1["vu_notificacion · Recordatorio de vencimiento · Enviada<br/>vu_SolucionId@odata.bind, sin vu_verificacionid"]
    M -- Failed / TimedOut --> N2["vu_notificacion · … · Error"]
```

- "Activa" = cualquier verificación que no esté *Aprobada* ni *Cancelada* (incluye *Borrador*: si ya hay un borrador, no se insiste).
- La fila de `vu_notificacion` lleva `vu_solucionid` y deja `vu_verificacionid` vacía (§2.3: opcional).
- Solo se recuerdan las soluciones activas (`statecode eq 0`) que tienen `vu_proximavu`. Las que nunca se han verificado (sin fecha) no se recuerdan.
- El recordatorio se repite cada lunes mientras siga sin haber una verificación activa.
- Las soluciones sin responsable (el catálogo importado llega así) se marcan *Pendiente* igual, pero no generan correo ni fila en `vu_notificacion`: no hay destinatario (`vu_destinatarioid` apunta a `systemuser`).
