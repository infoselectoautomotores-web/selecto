'use strict';

const express    = require('express');
const Database   = require('better-sqlite3');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

// ─────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────
const app  = express();
const PORT = 3000;
const DB_PATH      = path.join(__dirname, 'SelectoAutomotores.db');
const BACKUP_DIR   = path.join(__dirname, 'backups');
const PUBLIC_DIR   = __dirname;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '200mb' }));   // large because images are base64
app.use(express.static(PUBLIC_DIR));

// ─────────────────────────────────────────────
// DATABASE INIT
// ─────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');   // better concurrency
db.pragma('foreign_keys = ON');

db.exec(`
  -- ── VEHICULOS ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS vehiculos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fechaIngreso TEXT    NOT NULL DEFAULT (date('now')),
    estado       TEXT    NOT NULL DEFAULT 'Disponible'
                         CHECK(estado IN ('Disponible','Señado','Reparación','Vendido')),
    marca        TEXT    NOT NULL,
    modelo       TEXT    NOT NULL,
    anio         TEXT,
    km           TEXT,
    patente      TEXT,
    color        TEXT,
    valorVenta   REAL    DEFAULT 0,
    motor        TEXT,
    chasis       TEXT,
    distribucion TEXT    DEFAULT 'No',
    service      TEXT    DEFAULT 'No',
    detalles     TEXT,
    fbText       TEXT,
    coverIdx     INTEGER DEFAULT 0,
    creadoEn     TEXT    DEFAULT (datetime('now')),
    actualizadoEn TEXT   DEFAULT (datetime('now'))
  );

  -- ── IMAGENES ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS imagenes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    vehiculoId INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    nombre     TEXT,
    data       TEXT    NOT NULL,   -- base64
    orden      INTEGER DEFAULT 0,
    creadoEn   TEXT    DEFAULT (datetime('now'))
  );

  -- ── COMPRAS ─────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS compras (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    vehiculoId INTEGER UNIQUE NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    fecha      TEXT,
    valor      REAL    DEFAULT 0,
    info       REAL    DEFAULT 0,
    creadoEn   TEXT    DEFAULT (datetime('now')),
    actualizadoEn TEXT DEFAULT (datetime('now'))
  );

  -- ── SOCIOS ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS socios (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    compraId   INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    nombre     TEXT,
    capital    REAL    DEFAULT 0,
    orden      INTEGER DEFAULT 0
  );

  -- ── GASTOS ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS gastos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    vehiculoId INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    fecha      TEXT,
    concepto   TEXT    NOT NULL,
    monto      REAL    DEFAULT 0,
    pagador    TEXT    DEFAULT 'Agencia',
    obs        TEXT,
    creadoEn   TEXT    DEFAULT (datetime('now'))
  );

  -- ── VENTAS ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS ventas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    vehiculoId   INTEGER UNIQUE NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    valor        REAL    DEFAULT 0,
    fecha        TEXT,
    comision     REAL    DEFAULT 0,
    comisionPct  REAL    DEFAULT 0,
    permuta      TEXT    DEFAULT 'No',
    permValor    REAL    DEFAULT 0,
    permId       TEXT,
    permMarca    TEXT,
    permModelo   TEXT,
    permAnio     TEXT,
    permKm       TEXT,
    formaCobro   TEXT    DEFAULT 'Efectivo',
    entregaInit  REAL    DEFAULT 0,
    cuotas       TEXT,
    obs          TEXT,
    creadoEn     TEXT    DEFAULT (datetime('now')),
    actualizadoEn TEXT   DEFAULT (datetime('now'))
  );

  -- ── USUARIOS ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS usuarios (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre   TEXT    NOT NULL,
    apellido TEXT    DEFAULT '',
    usuario  TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    pass     TEXT    NOT NULL,
    rol      TEXT    NOT NULL DEFAULT 'marketing'
                     CHECK(rol IN ('admin','marketing')),
    estado   TEXT    NOT NULL DEFAULT 'activo'
                     CHECK(estado IN ('activo','inactivo')),
    creadoEn TEXT    DEFAULT (datetime('now'))
  );

  -- ── MKT EVENTOS ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS mkt_eventos (
    id         TEXT    PRIMARY KEY,
    fecha      TEXT    NOT NULL,
    plat       TEXT,
    tipo       TEXT,
    estado     TEXT    DEFAULT 'Pendiente',
    descripcion TEXT,
    vehiculoId INTEGER,
    obs        TEXT,
    creadoPor  TEXT,
    creadoEn   TEXT    DEFAULT (datetime('now'))
  );

  -- ── MKT KANBAN ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS mkt_kanban (
    id         TEXT    PRIMARY KEY,
    columna    TEXT    NOT NULL,
    titulo     TEXT    NOT NULL,
    plat       TEXT,
    descripcion TEXT,
    vehiculoId INTEGER,
    responsable TEXT,
    fechaLimite TEXT,
    orden      INTEGER DEFAULT 0,
    creadoEn   TEXT    DEFAULT (datetime('now'))
  );

  -- ── MKT MEDIA ───────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS mkt_media (
    id         TEXT    PRIMARY KEY,
    nombre     TEXT    NOT NULL,
    tipo       TEXT    DEFAULT 'imagen',
    vehiculoId INTEGER,
    tags       TEXT,
    data       TEXT,
    fecha      TEXT,
    cargadoPor TEXT,
    creadoEn   TEXT    DEFAULT (datetime('now'))
  );

  -- ── MKT TAREAS ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS mkt_tareas (
    id          TEXT    PRIMARY KEY,
    titulo      TEXT    NOT NULL,
    descripcion TEXT,
    prioridad   TEXT    DEFAULT 'Media',
    estado      TEXT    DEFAULT 'Pendiente',
    fechaLimite TEXT,
    responsable TEXT,
    creadoPor   TEXT,
    creadoEn    TEXT    DEFAULT (datetime('now'))
  );

  -- ── HISTORIAL ───────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS historial (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         TEXT    NOT NULL DEFAULT (datetime('now')),
    accion     TEXT    NOT NULL,
    vehiculo   TEXT,
    detalle    TEXT,
    usuario    TEXT    DEFAULT 'ADMIN'
  );

  -- ── CONFIGURACION ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS configuracion (
    clave  TEXT PRIMARY KEY,
    valor  TEXT,
    tipo   TEXT DEFAULT 'string'
  );

  -- ── INDICES ─────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_imagenes_vehiculo  ON imagenes(vehiculoId);
  CREATE INDEX IF NOT EXISTS idx_gastos_vehiculo    ON gastos(vehiculoId);
  CREATE INDEX IF NOT EXISTS idx_historial_ts       ON historial(ts DESC);
  CREATE INDEX IF NOT EXISTS idx_mkt_eventos_fecha  ON mkt_eventos(fecha);
  CREATE INDEX IF NOT EXISTS idx_mkt_kanban_columna ON mkt_kanban(columna);
`);

// Insert default users if table is empty
const userCount = db.prepare('SELECT COUNT(*) as n FROM usuarios').get().n;
if (userCount === 0) {
  db.prepare(`INSERT INTO usuarios (id,nombre,apellido,usuario,pass,rol,estado)
              VALUES (1,'Administrador','','ADMIN','tobiasm','admin','activo')`).run();
  db.prepare(`INSERT INTO usuarios (id,nombre,apellido,usuario,pass,rol,estado)
              VALUES (2,'Marketing','','MARKETING','market','marketing','activo')`).run();
  console.log('✅ Usuarios por defecto creados (ADMIN / MARKETING)');
}

console.log(`✅ Base de datos lista: ${DB_PATH}`);

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function ok(res, data)  { res.json({ ok: true,  data }); }
function err(res, msg, status = 500) {
  console.error('API Error:', msg);
  res.status(status).json({ ok: false, error: String(msg) });
}
function addHistorial(accion, vehiculo, detalle, usuario = 'ADMIN') {
  try {
    db.prepare(
      'INSERT INTO historial (accion, vehiculo, detalle, usuario) VALUES (?,?,?,?)'
    ).run(accion, vehiculo || null, detalle || null, usuario);
  } catch(e) { /* historial never throws */ }
}

// ─────────────────────────────────────────────
// ROUTES — VEHÍCULOS
// ─────────────────────────────────────────────
// GET all
app.get('/api/vehiculos', (req, res) => {
  try {
    const vehs = db.prepare('SELECT * FROM vehiculos ORDER BY id DESC').all();
    // Attach images to each vehicle
    const imgStmt = db.prepare(
      'SELECT id, nombre, data, orden FROM imagenes WHERE vehiculoId=? ORDER BY orden ASC'
    );
    const result = vehs.map(v => ({
      ...v,
      images: imgStmt.all(v.id).map(img => ({ id: img.id, data: img.data, name: img.nombre }))
    }));
    ok(res, result);
  } catch(e) { err(res, e.message); }
});

// GET one
app.get('/api/vehiculos/:id', (req, res) => {
  try {
    const v = db.prepare('SELECT * FROM vehiculos WHERE id=?').get(req.params.id);
    if (!v) return err(res, 'Vehículo no encontrado', 404);
    v.images = db.prepare(
      'SELECT id, nombre, data, orden FROM imagenes WHERE vehiculoId=? ORDER BY orden'
    ).all(v.id).map(img => ({ id: img.id, data: img.data, name: img.nombre }));
    ok(res, v);
  } catch(e) { err(res, e.message); }
});

// POST create
app.post('/api/vehiculos', (req, res) => {
  try {
    const { estado='Disponible', marca, modelo, anio='', km='', patente='',
            color='', valorVenta=0, motor='', chasis='', distribucion='No',
            service='No', detalles='', fbText='', coverIdx=0,
            images=[], fechaIngreso } = req.body;
    if (!marca || !modelo) return err(res, 'Marca y modelo requeridos', 400);

    const insert = db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO vehiculos
          (fechaIngreso,estado,marca,modelo,anio,km,patente,color,valorVenta,
           motor,chasis,distribucion,service,detalles,fbText,coverIdx,actualizadoEn)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
      `).run(fechaIngreso || new Date().toISOString().slice(0,10),
             estado, marca, modelo, anio, km, patente, color, valorVenta,
             motor, chasis, distribucion, service, detalles, fbText, coverIdx);
      const vid = r.lastInsertRowid;
      // Save images
      const imgStmt = db.prepare(
        'INSERT INTO imagenes (vehiculoId, nombre, data, orden) VALUES (?,?,?,?)'
      );
      images.forEach((img, i) => imgStmt.run(vid, img.name || `foto_${i+1}`, img.data, i));
      addHistorial('creó vehículo', `${marca} ${modelo} #${vid}`, `Estado:${estado}`);
      return vid;
    });

    const vid = insert();
    ok(res, { id: vid });
  } catch(e) { err(res, e.message); }
});

// PUT update
app.put('/api/vehiculos/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const old = db.prepare('SELECT * FROM vehiculos WHERE id=?').get(id);
    if (!old) return err(res, 'Vehículo no encontrado', 404);

    const { estado, marca, modelo, anio, km, patente, color, valorVenta,
            motor, chasis, distribucion, service, detalles, fbText,
            coverIdx=0, images, fechaIngreso } = req.body;

    const update = db.transaction(() => {
      db.prepare(`
        UPDATE vehiculos SET
          estado=COALESCE(?,estado), marca=COALESCE(?,marca),
          modelo=COALESCE(?,modelo), anio=COALESCE(?,anio),
          km=COALESCE(?,km), patente=COALESCE(?,patente),
          color=COALESCE(?,color), valorVenta=COALESCE(?,valorVenta),
          motor=COALESCE(?,motor), chasis=COALESCE(?,chasis),
          distribucion=COALESCE(?,distribucion), service=COALESCE(?,service),
          detalles=COALESCE(?,detalles), fbText=COALESCE(?,fbText),
          coverIdx=?, fechaIngreso=COALESCE(?,fechaIngreso),
          actualizadoEn=datetime('now')
        WHERE id=?
      `).run(estado,marca,modelo,anio,km,patente,color,valorVenta,
             motor,chasis,distribucion,service,detalles,fbText,
             coverIdx,fechaIngreso,id);

      // Replace images if provided
      if (Array.isArray(images)) {
        db.prepare('DELETE FROM imagenes WHERE vehiculoId=?').run(id);
        const imgStmt = db.prepare(
          'INSERT INTO imagenes (vehiculoId, nombre, data, orden) VALUES (?,?,?,?)'
        );
        images.forEach((img, i) => imgStmt.run(id, img.name || `foto_${i+1}`, img.data, i));
      }

      const det = [];
      if (estado && estado !== old.estado)           det.push(`Estado:${old.estado}→${estado}`);
      if (valorVenta && valorVenta !== old.valorVenta) det.push(`Precio:${old.valorVenta}→${valorVenta}`);
      addHistorial('editó vehículo', `${marca||old.marca} ${modelo||old.modelo} #${id}`, det.join(' | '));
    });
    update();
    ok(res, { id });
  } catch(e) { err(res, e.message); }
});

// DELETE
app.delete('/api/vehiculos/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const v = db.prepare('SELECT marca, modelo FROM vehiculos WHERE id=?').get(id);
    if (!v) return err(res, 'No encontrado', 404);
    db.prepare('DELETE FROM vehiculos WHERE id=?').run(id);
    addHistorial('eliminó vehículo', `${v.marca} ${v.modelo} #${id}`, 'Datos asociados eliminados');
    ok(res, { id });
  } catch(e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// ROUTES — COMPRAS
// ─────────────────────────────────────────────
app.get('/api/compras', (req, res) => {
  try {
    const compras = db.prepare('SELECT * FROM compras').all();
    const sociosStmt = db.prepare('SELECT * FROM socios WHERE compraId=? ORDER BY orden');
    const result = {};
    compras.forEach(c => {
      result[c.vehiculoId] = { ...c, socios: sociosStmt.all(c.id) };
    });
    ok(res, result);
  } catch(e) { err(res, e.message); }
});

app.put('/api/compras/:vehiculoId', (req, res) => {
  try {
    const vid = parseInt(req.params.vehiculoId);
    const { fecha, valor=0, info=0, socios=[] } = req.body;

    const upsert = db.transaction(() => {
      const existing = db.prepare('SELECT id FROM compras WHERE vehiculoId=?').get(vid);
      let compraId;
      if (existing) {
        db.prepare(`UPDATE compras SET fecha=?,valor=?,info=?,actualizadoEn=datetime('now')
                    WHERE vehiculoId=?`).run(fecha,valor,info,vid);
        compraId = existing.id;
        db.prepare('DELETE FROM socios WHERE compraId=?').run(compraId);
      } else {
        const r = db.prepare(
          'INSERT INTO compras (vehiculoId,fecha,valor,info) VALUES (?,?,?,?)'
        ).run(vid, fecha, valor, info);
        compraId = r.lastInsertRowid;
      }
      const socioStmt = db.prepare(
        'INSERT INTO socios (compraId, nombre, capital, orden) VALUES (?,?,?,?)'
      );
      socios.forEach((s, i) => socioStmt.run(compraId, s.nombre||'', s.capital||0, i));
      const v = db.prepare('SELECT marca, modelo FROM vehiculos WHERE id=?').get(vid);
      addHistorial('registró compra', `${v?.marca} ${v?.modelo} #${vid}`, `Valor:$${valor}`);
    });
    upsert();
    ok(res, { vehiculoId: vid });
  } catch(e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// ROUTES — GASTOS
// ─────────────────────────────────────────────
app.get('/api/gastos', (req, res) => {
  try {
    const gastos = db.prepare('SELECT * FROM gastos ORDER BY vehiculoId, fecha').all();
    const result = {};
    gastos.forEach(g => {
      if (!result[g.vehiculoId]) result[g.vehiculoId] = [];
      result[g.vehiculoId].push(g);
    });
    ok(res, result);
  } catch(e) { err(res, e.message); }
});

app.post('/api/gastos/:vehiculoId', (req, res) => {
  try {
    const vid = parseInt(req.params.vehiculoId);
    const { fecha, concepto, monto=0, pagador='Agencia', obs='' } = req.body;
    if (!concepto) return err(res, 'Concepto requerido', 400);
    if (monto < 0)  return err(res, 'Monto no puede ser negativo', 400);
    const r = db.prepare(
      'INSERT INTO gastos (vehiculoId,fecha,concepto,monto,pagador,obs) VALUES (?,?,?,?,?,?)'
    ).run(vid, fecha, concepto, monto, pagador, obs);
    const v = db.prepare('SELECT marca, modelo FROM vehiculos WHERE id=?').get(vid);
    addHistorial('agregó gasto', `${v?.marca} ${v?.modelo} #${vid}`, `${concepto}: $${monto}`);
    ok(res, { id: r.lastInsertRowid });
  } catch(e) { err(res, e.message); }
});

app.delete('/api/gastos/:id', (req, res) => {
  try {
    const g = db.prepare('SELECT * FROM gastos WHERE id=?').get(req.params.id);
    if (!g) return err(res, 'No encontrado', 404);
    db.prepare('DELETE FROM gastos WHERE id=?').run(req.params.id);
    const v = db.prepare('SELECT marca, modelo FROM vehiculos WHERE id=?').get(g.vehiculoId);
    addHistorial('eliminó gasto', `${v?.marca} ${v?.modelo} #${g.vehiculoId}`, `${g.concepto}: $${g.monto}`);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// ROUTES — VENTAS
// ─────────────────────────────────────────────
app.get('/api/ventas', (req, res) => {
  try {
    const ventas = db.prepare('SELECT * FROM ventas').all();
    const result = {};
    ventas.forEach(v => { result[v.vehiculoId] = v; });
    ok(res, result);
  } catch(e) { err(res, e.message); }
});

app.put('/api/ventas/:vehiculoId', (req, res) => {
  try {
    const vid = parseInt(req.params.vehiculoId);
    const {
      valor=0, fecha, comision=0, comisionPct=0,
      permuta='No', permValor=0, permId='', permMarca='', permModelo='',
      permAnio='', permKm='', formaCobro='Efectivo',
      entregaInit=0, cuotas='', obs=''
    } = req.body;

    const upsert = db.transaction(() => {
      const existing = db.prepare('SELECT id FROM ventas WHERE vehiculoId=?').get(vid);
      if (existing) {
        db.prepare(`UPDATE ventas SET valor=?,fecha=?,comision=?,comisionPct=?,
          permuta=?,permValor=?,permId=?,permMarca=?,permModelo=?,permAnio=?,permKm=?,
          formaCobro=?,entregaInit=?,cuotas=?,obs=?,actualizadoEn=datetime('now')
          WHERE vehiculoId=?`).run(
          valor,fecha,comision,comisionPct,
          permuta,permValor,permId,permMarca,permModelo,permAnio,permKm,
          formaCobro,entregaInit,cuotas,obs,vid
        );
      } else {
        db.prepare(`INSERT INTO ventas
          (vehiculoId,valor,fecha,comision,comisionPct,permuta,permValor,permId,
           permMarca,permModelo,permAnio,permKm,formaCobro,entregaInit,cuotas,obs)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          vid,valor,fecha,comision,comisionPct,
          permuta,permValor,permId,permMarca,permModelo,permAnio,permKm,
          formaCobro,entregaInit,cuotas,obs
        );
      }
      // Mark vehicle as Vendido
      db.prepare(`UPDATE vehiculos SET estado='Vendido', actualizadoEn=datetime('now')
                  WHERE id=?`).run(vid);
      const v = db.prepare('SELECT marca, modelo FROM vehiculos WHERE id=?').get(vid);
      addHistorial('registró venta', `${v?.marca} ${v?.modelo} #${vid}`,
        `Valor:$${valor} | Forma:${formaCobro} | Permuta:${permuta}`);
    });
    upsert();
    ok(res, { vehiculoId: vid });
  } catch(e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// ROUTES — USUARIOS
// ─────────────────────────────────────────────
app.get('/api/usuarios', (req, res) => {
  try {
    ok(res, db.prepare('SELECT id,nombre,apellido,usuario,rol,estado,creadoEn FROM usuarios').all());
  } catch(e) { err(res, e.message); }
});

app.post('/api/usuarios/login', (req, res) => {
  try {
    const { usuario, pass } = req.body;
    const u = db.prepare(
      "SELECT id,nombre,apellido,usuario,rol,estado FROM usuarios WHERE UPPER(usuario)=UPPER(?) AND pass=? AND estado='activo'"
    ).get(usuario, pass);
    if (!u) return err(res, 'Credenciales inválidas', 401);
    addHistorial('Inició sesión', null, `Usuario:${u.usuario} | Rol:${u.rol}`, u.usuario);
    ok(res, u);
  } catch(e) { err(res, e.message); }
});

app.post('/api/usuarios', (req, res) => {
  try {
    const { nombre, apellido='', usuario, pass, rol='marketing', estado='activo' } = req.body;
    if (!usuario || !pass) return err(res, 'Usuario y contraseña requeridos', 400);
    const exists = db.prepare('SELECT id FROM usuarios WHERE UPPER(usuario)=UPPER(?)').get(usuario);
    if (exists) return err(res, 'El usuario ya existe', 409);
    const r = db.prepare(
      'INSERT INTO usuarios (nombre,apellido,usuario,pass,rol,estado) VALUES (?,?,?,?,?,?)'
    ).run(nombre, apellido, usuario.toUpperCase(), pass, rol, estado);
    ok(res, { id: r.lastInsertRowid });
  } catch(e) { err(res, e.message); }
});

app.put('/api/usuarios/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nombre, apellido, usuario, pass, rol, estado } = req.body;
    db.prepare(`UPDATE usuarios SET nombre=COALESCE(?,nombre), apellido=COALESCE(?,apellido),
                usuario=COALESCE(UPPER(?),usuario), pass=COALESCE(?,pass),
                rol=COALESCE(?,rol), estado=COALESCE(?,estado) WHERE id=?`
    ).run(nombre,apellido,usuario,pass,rol,estado,id);
    ok(res, { id });
  } catch(e) { err(res, e.message); }
});

app.delete('/api/usuarios/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id <= 2) return err(res, 'No se pueden eliminar los usuarios base', 403);
    db.prepare('DELETE FROM usuarios WHERE id=?').run(id);
    ok(res, { id });
  } catch(e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// ROUTES — MARKETING
// ─────────────────────────────────────────────
// Eventos
app.get('/api/mkt/eventos', (req, res) => {
  try { ok(res, db.prepare('SELECT * FROM mkt_eventos ORDER BY fecha').all()); }
  catch(e) { err(res, e.message); }
});
app.post('/api/mkt/eventos', (req, res) => {
  try {
    const { id, fecha, plat, tipo, estado='Pendiente', descripcion, vehiculoId, obs, creadoPor } = req.body;
    if (!fecha) return err(res, 'Fecha requerida', 400);
    const evId = id || ('ev_' + Date.now());
    db.prepare(`INSERT OR REPLACE INTO mkt_eventos
      (id,fecha,plat,tipo,estado,descripcion,vehiculoId,obs,creadoPor)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(evId,fecha,plat,tipo,estado,descripcion,vehiculoId||null,obs,creadoPor);
    ok(res, { id: evId });
  } catch(e) { err(res, e.message); }
});
app.delete('/api/mkt/eventos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM mkt_eventos WHERE id=?').run(req.params.id);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// Kanban
app.get('/api/mkt/kanban', (req, res) => {
  try {
    const cols = ['ideas','diseño','revision','aprobado','programado','publicado'];
    const result = {};
    const stmt = db.prepare('SELECT * FROM mkt_kanban WHERE columna=? ORDER BY orden');
    cols.forEach(c => { result[c] = stmt.all(c); });
    ok(res, result);
  } catch(e) { err(res, e.message); }
});
app.post('/api/mkt/kanban', (req, res) => {
  try {
    const { id, columna, titulo, plat, descripcion, vehiculoId, responsable, fechaLimite, orden=0 } = req.body;
    if (!titulo) return err(res, 'Título requerido', 400);
    const kId = id || ('kc_' + Date.now());
    db.prepare(`INSERT OR REPLACE INTO mkt_kanban
      (id,columna,titulo,plat,descripcion,vehiculoId,responsable,fechaLimite,orden)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(kId,columna,titulo,plat,descripcion,vehiculoId||null,responsable,fechaLimite,orden);
    ok(res, { id: kId });
  } catch(e) { err(res, e.message); }
});
app.put('/api/mkt/kanban/:id/mover', (req, res) => {
  try {
    const { columna } = req.body;
    db.prepare('UPDATE mkt_kanban SET columna=? WHERE id=?').run(columna, req.params.id);
    ok(res, { id: req.params.id, columna });
  } catch(e) { err(res, e.message); }
});
app.delete('/api/mkt/kanban/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM mkt_kanban WHERE id=?').run(req.params.id);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// Media
app.get('/api/mkt/media', (req, res) => {
  try { ok(res, db.prepare('SELECT * FROM mkt_media ORDER BY creadoEn DESC').all()); }
  catch(e) { err(res, e.message); }
});
app.post('/api/mkt/media', (req, res) => {
  try {
    const { nombre, tipo='imagen', vehiculoId, tags, data, fecha, cargadoPor } = req.body;
    if (!nombre) return err(res, 'Nombre requerido', 400);
    const mId = 'med_' + Date.now();
    db.prepare(`INSERT INTO mkt_media (id,nombre,tipo,vehiculoId,tags,data,fecha,cargadoPor)
                VALUES (?,?,?,?,?,?,?,?)`).run(mId,nombre,tipo,vehiculoId||null,tags,data,fecha,cargadoPor);
    ok(res, { id: mId });
  } catch(e) { err(res, e.message); }
});
app.delete('/api/mkt/media/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM mkt_media WHERE id=?').run(req.params.id);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// Tareas
app.get('/api/mkt/tareas', (req, res) => {
  try { ok(res, db.prepare('SELECT * FROM mkt_tareas ORDER BY creadoEn DESC').all()); }
  catch(e) { err(res, e.message); }
});
app.post('/api/mkt/tareas', (req, res) => {
  try {
    const { id, titulo, descripcion, prioridad='Media', estado='Pendiente', fechaLimite, responsable, creadoPor } = req.body;
    if (!titulo) return err(res, 'Título requerido', 400);
    const tId = id || ('task_' + Date.now());
    db.prepare(`INSERT OR REPLACE INTO mkt_tareas
      (id,titulo,descripcion,prioridad,estado,fechaLimite,responsable,creadoPor)
      VALUES (?,?,?,?,?,?,?,?)`).run(tId,titulo,descripcion,prioridad,estado,fechaLimite,responsable,creadoPor);
    ok(res, { id: tId });
  } catch(e) { err(res, e.message); }
});
app.delete('/api/mkt/tareas/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM mkt_tareas WHERE id=?').run(req.params.id);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// ROUTES — HISTORIAL
// ─────────────────────────────────────────────
app.get('/api/historial', (req, res) => {
  try {
    ok(res, db.prepare('SELECT * FROM historial ORDER BY id DESC LIMIT 500').all());
  } catch(e) { err(res, e.message); }
});
app.delete('/api/historial', (req, res) => {
  try {
    db.prepare('DELETE FROM historial').run();
    ok(res, { cleared: true });
  } catch(e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// ROUTES — BACKUPS
// ─────────────────────────────────────────────
function buildFullBackup() {
  const vehiculos = db.prepare('SELECT * FROM vehiculos').all();
  const imgStmt   = db.prepare('SELECT * FROM imagenes WHERE vehiculoId=? ORDER BY orden');
  const vehsWithImgs = vehiculos.map(v => ({
    ...v, images: imgStmt.all(v.id).map(i => ({ data: i.data, name: i.nombre }))
  }));
  return {
    version:    2,
    exportedAt: new Date().toISOString(),
    vehiculos:  vehsWithImgs,
    compras:    (() => {
      const all = db.prepare('SELECT c.*, json_group_array(json_object(\'nombre\',s.nombre,\'capital\',s.capital)) as socios FROM compras c LEFT JOIN socios s ON s.compraId=c.id GROUP BY c.id').all();
      const r = {};
      all.forEach(c => {
        r[c.vehiculoId] = { ...c, socios: JSON.parse(c.socios||'[]') };
      });
      return r;
    })(),
    gastos: (() => {
      const r = {};
      db.prepare('SELECT * FROM gastos').all().forEach(g => {
        if (!r[g.vehiculoId]) r[g.vehiculoId] = [];
        r[g.vehiculoId].push(g);
      });
      return r;
    })(),
    ventas: (() => {
      const r = {};
      db.prepare('SELECT * FROM ventas').all().forEach(v => { r[v.vehiculoId] = v; });
      return r;
    })(),
    usuarios:    db.prepare('SELECT * FROM usuarios').all(),
    mktEventos:  db.prepare('SELECT * FROM mkt_eventos').all(),
    mktKanban:   db.prepare('SELECT * FROM mkt_kanban').all(),
    mktMedia:    db.prepare('SELECT * FROM mkt_media').all(),
    mktTareas:   db.prepare('SELECT * FROM mkt_tareas').all(),
    historial:   db.prepare('SELECT * FROM historial ORDER BY id DESC LIMIT 500').all(),
  };
}

// Download backup
app.get('/api/backup/download', (req, res) => {
  try {
    const data     = buildFullBackup();
    const filename = `backup_selecto_${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
    addHistorial('exportó backup JSON', null, `${data.vehiculos.length} vehículos`);
  } catch(e) { err(res, e.message); }
});

// Save backup to disk (auto backup)
function saveToDisk(label) {
  try {
    const data     = buildFullBackup();
    const filename = `backup_selecto_${label || new Date().toISOString().slice(0,10)}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    // Keep only last 30 backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_selecto_') && f.endsWith('.json'))
      .sort();
    if (files.length > 30) {
      files.slice(0, files.length - 30).forEach(f =>
        fs.unlinkSync(path.join(BACKUP_DIR, f))
      );
    }
    return filename;
  } catch(e) {
    console.error('Backup to disk failed:', e.message);
    return null;
  }
}

// List backups on disk
app.get('/api/backup/list', (req, res) => {
  try {
    const files = fs.existsSync(BACKUP_DIR)
      ? fs.readdirSync(BACKUP_DIR)
          .filter(f => f.startsWith('backup_selecto_') && f.endsWith('.json'))
          .sort().reverse()
          .map(f => {
            const stats = fs.statSync(path.join(BACKUP_DIR, f));
            return { name: f, size: stats.size, modified: stats.mtime };
          })
      : [];
    ok(res, files);
  } catch(e) { err(res, e.message); }
});

// Download specific backup file
app.get('/api/backup/download/:filename', (req, res) => {
  try {
    const filepath = path.join(BACKUP_DIR, path.basename(req.params.filename));
    if (!fs.existsSync(filepath)) return err(res, 'Archivo no encontrado', 404);
    res.download(filepath);
  } catch(e) { err(res, e.message); }
});

// Create backup now
app.post('/api/backup/crear', (req, res) => {
  try {
    const label    = new Date().toISOString().replace(/[:T]/g,'-').slice(0,19);
    const filename = saveToDisk(label);
    addHistorial('creó backup manual', null, filename);
    ok(res, { filename });
  } catch(e) { err(res, e.message); }
});

// Restore from upload
app.post('/api/backup/restaurar', (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.vehiculos) return err(res, 'Backup inválido', 400);

    // Save current state first
    saveToDisk('pre-restauracion-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'));

    const restore = db.transaction(() => {
      // Clear all
      ['imagenes','socios','gastos','ventas','compras','vehiculos',
       'mkt_eventos','mkt_kanban','mkt_media','mkt_tareas','historial'].forEach(t => {
        db.prepare(`DELETE FROM ${t}`).run();
      });

      // Restore vehiculos
      const vStmt = db.prepare(`INSERT INTO vehiculos
        (id,fechaIngreso,estado,marca,modelo,anio,km,patente,color,valorVenta,
         motor,chasis,distribucion,service,detalles,fbText,coverIdx)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const iStmt = db.prepare(
        'INSERT INTO imagenes (vehiculoId,nombre,data,orden) VALUES (?,?,?,?)'
      );
      (data.vehiculos || []).forEach(v => {
        vStmt.run(v.id,v.fechaIngreso,v.estado,v.marca,v.modelo,v.anio,v.km,
                  v.patente,v.color,v.valorVenta,v.motor,v.chasis,
                  v.distribucion,v.service,v.detalles,v.fbText,v.coverIdx||0);
        (v.images||[]).forEach((img,i) => iStmt.run(v.id, img.name||`foto_${i}`, img.data, i));
      });

      // Restore compras
      const cStmt = db.prepare(
        'INSERT OR IGNORE INTO compras (vehiculoId,fecha,valor,info) VALUES (?,?,?,?)'
      );
      const sStmt = db.prepare(
        'INSERT INTO socios (compraId,nombre,capital,orden) VALUES (?,?,?,?)'
      );
      Object.entries(data.compras||{}).forEach(([vid, c]) => {
        cStmt.run(parseInt(vid), c.fecha, c.valor, c.info);
        const compraId = db.prepare('SELECT id FROM compras WHERE vehiculoId=?').get(vid)?.id;
        if (compraId) {
          (c.socios||[]).forEach((s,i) => sStmt.run(compraId, s.nombre, s.capital||0, i));
        }
      });

      // Restore gastos
      const gStmt = db.prepare(
        'INSERT INTO gastos (vehiculoId,fecha,concepto,monto,pagador,obs) VALUES (?,?,?,?,?,?)'
      );
      Object.entries(data.gastos||{}).forEach(([vid, list]) => {
        (list||[]).forEach(g => gStmt.run(parseInt(vid),g.fecha,g.concepto,g.monto,g.pagador,g.obs));
      });

      // Restore ventas
      const vtStmt = db.prepare(`INSERT OR IGNORE INTO ventas
        (vehiculoId,valor,fecha,comision,comisionPct,permuta,permValor,permId,
         permMarca,permModelo,permAnio,permKm,formaCobro,entregaInit,cuotas,obs)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      Object.entries(data.ventas||{}).forEach(([vid, v]) => {
        vtStmt.run(parseInt(vid),v.valor,v.fecha,v.comision,v.comisionPct,
                   v.permuta,v.permValor,v.permId,v.permMarca,v.permModelo,
                   v.permAnio,v.permKm,v.formaCobro,v.entregaInit,v.cuotas,v.obs);
      });

      // Restore usuarios (keep defaults)
      if ((data.usuarios||[]).length > 2) {
        const uStmt = db.prepare(`INSERT OR IGNORE INTO usuarios
          (id,nombre,apellido,usuario,pass,rol,estado) VALUES (?,?,?,?,?,?,?)`);
        data.usuarios.forEach(u => uStmt.run(u.id,u.nombre,u.apellido||'',u.usuario,u.pass,u.rol,u.estado));
      }

      // Restore marketing
      const evStmt = db.prepare(`INSERT OR IGNORE INTO mkt_eventos
        (id,fecha,plat,tipo,estado,descripcion,vehiculoId,obs,creadoPor) VALUES (?,?,?,?,?,?,?,?,?)`);
      (data.mktEventos||[]).forEach(e => evStmt.run(e.id,e.fecha,e.plat,e.tipo,e.estado,e.descripcion,e.vehiculoId,e.obs,e.creadoPor));

      const kkStmt = db.prepare(`INSERT OR IGNORE INTO mkt_kanban
        (id,columna,titulo,plat,descripcion,vehiculoId,responsable,fechaLimite,orden) VALUES (?,?,?,?,?,?,?,?,?)`);
      (data.mktKanban||[]).forEach(k => kkStmt.run(k.id,k.columna,k.titulo,k.plat,k.descripcion,k.vehiculoId,k.responsable,k.fechaLimite,k.orden||0));

      const mmStmt = db.prepare(`INSERT OR IGNORE INTO mkt_media
        (id,nombre,tipo,vehiculoId,tags,data,fecha,cargadoPor) VALUES (?,?,?,?,?,?,?,?)`);
      (data.mktMedia||[]).forEach(m => mmStmt.run(m.id,m.nombre,m.tipo,m.vehiculoId,m.tags,m.data,m.fecha,m.cargadoPor));

      const ttStmt = db.prepare(`INSERT OR IGNORE INTO mkt_tareas
        (id,titulo,descripcion,prioridad,estado,fechaLimite,responsable,creadoPor) VALUES (?,?,?,?,?,?,?,?)`);
      (data.mktTareas||[]).forEach(t => ttStmt.run(t.id,t.titulo,t.descripcion,t.prioridad,t.estado,t.fechaLimite,t.responsable,t.creadoPor));

      addHistorial('restauró backup', null, `${(data.vehiculos||[]).length} vehículos`);
    });
    restore();
    ok(res, { restored: true, vehiculos: data.vehiculos?.length || 0 });
  } catch(e) { err(res, e.message); }
});

// ─────────────────────────────────────────────
// AUTO BACKUP — every 24h
// ─────────────────────────────────────────────
function checkDailyBackup() {
  const today     = new Date().toISOString().slice(0,10);
  const todayFile = path.join(BACKUP_DIR, `backup_selecto_${today}.json`);
  if (!fs.existsSync(todayFile)) {
    const name = saveToDisk(today);
    if (name) console.log(`📦 Backup automático creado: ${name}`);
  }
}
checkDailyBackup();
setInterval(checkDailyBackup, 60 * 60 * 1000); // check every hour

// ─────────────────────────────────────────────
// SERVE FRONTEND
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// 404 for unknown API routes
app.use('/api/*', (req, res) => err(res, `Ruta no encontrada: ${req.path}`, 404));

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║     SELECTO AUTOMOTORES — SERVIDOR        ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║  🌐 http://localhost:${PORT}                  ║`);
  console.log(`║  💾 Base: SelectoAutomotores.db            ║`);
  console.log(`║  📦 Backups: ./backups/                    ║`);
  console.log('╚═══════════════════════════════════════════╝\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  saveToDisk('shutdown-' + new Date().toISOString().slice(0,10));
  db.close();
  process.exit(0);
});
