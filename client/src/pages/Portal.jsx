import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { comprimirImagen, fechaHora } from '../utils';

const vacio = {
  anonimo: false, nombre: '', correo: '', telefono: '',
  categoria: '', zona: '', direccion: '', descripcion: ''
};

export default function Portal() {
  const [catalogos, setCatalogos] = useState(null);
  const [form, setForm] = useState(vacio);
  const [foto, setFoto] = useState(null);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);

  useEffect(() => {
    api.catalogos().then(setCatalogos).catch(e => setErrorGeneral(e.message));
  }, []);

  function cambiar(e) {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
    setErrores({ ...errores, [name]: '' });
  }

  async function elegirFoto(e) {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    setProcesandoFoto(true);
    setErrores({ ...errores, foto: '' });
    try {
      setFoto(await comprimirImagen(archivo));
    } catch (err) {
      setErrores({ ...errores, foto: err.message });
    } finally {
      setProcesandoFoto(false);
    }
  }

  // validacion en el navegador (el servidor vuelve a validar todo)
  function validar() {
    const e = {};
    if (!form.anonimo && form.nombre.trim().length < 3) e.nombre = 'Escribe tu nombre completo';
    if (form.correo && !/^\S+@\S+\.\S+$/.test(form.correo)) e.correo = 'Correo no válido';
    if (form.telefono && !/^[0-9]{8}$/.test(form.telefono.replace(/[\s-]/g, ''))) e.telefono = 'Debe tener 8 dígitos';
    if (!form.anonimo && !form.correo && !form.telefono) e.correo = 'Deja un correo o un teléfono';
    if (!form.categoria) e.categoria = 'Selecciona una categoría';
    if (!form.zona) e.zona = 'Selecciona la zona';
    if (form.direccion.trim().length < 5) e.direccion = 'Escribe la dirección o una referencia';
    if (form.descripcion.trim().length < 20) e.descripcion = 'Describe el problema (mínimo 20 caracteres)';
    if (!foto) e.foto = 'Adjunta una fotografía';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(e) {
    e.preventDefault();
    setErrorGeneral('');
    if (!validar()) return;
    setEnviando(true);
    try {
      const r = await api.enviarQueja({ ...form, foto });
      setConfirmacion(r);
      setForm(vacio);
      setFoto(null);
      window.scrollTo(0, 0);
    } catch (err) {
      setErrorGeneral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (confirmacion) {
    return (
      <div className="tarjeta confirmacion">
        <div className="check">✓</div>
        <h1>¡Reporte recibido!</h1>
        <p>{confirmacion.mensaje}. El personal municipal lo revisará pronto.</p>
        <div className="folio">
          <small>Tu número de folio es</small>
          <strong>{confirmacion.folio}</strong>
          <small>Registrado el {fechaHora(confirmacion.fecha)}</small>
        </div>
        <p className="nota">Guarda este número: con él puedes consultar el estado de tu reporte.</p>
        <div className="acciones">
          <Link to={'/seguimiento?folio=' + confirmacion.folio} className="btn btn-primario">Consultar mi reporte</Link>
          <button className="btn btn-borde" onClick={() => setConfirmacion(null)}>Hacer otro reporte</button>
        </div>
      </div>
    );
  }

  const largo = form.descripcion.trim().length;

  return (
    <div className="portal">
      <section className="portada">
        <h1>¿Viste un problema en tu colonia? Repórtalo.</h1>
        <p>Baches, basura, alumbrado, fugas de agua y más. Envía tu reporte con una fotografía y recibe un número de folio para darle seguimiento.</p>
        <ol className="pasos">
          <li><b>1</b> Describe el problema</li>
          <li><b>2</b> Adjunta una foto</li>
          <li><b>3</b> Recibe tu folio</li>
        </ol>
      </section>

      <form className="tarjeta formulario" onSubmit={enviar} noValidate>
        <h2>Datos del reporte</h2>

        <div className="fila">
          <label>Categoría *
            <select name="categoria" value={form.categoria} onChange={cambiar}>
              <option value="">Seleccione</option>
              {catalogos && catalogos.categorias.map(c => <option key={c}>{c}</option>)}
            </select>
            {errores.categoria && <span className="error">{errores.categoria}</span>}
          </label>
          <label>Zona *
            <select name="zona" value={form.zona} onChange={cambiar}>
              <option value="">Seleccione</option>
              {catalogos && catalogos.zonas.map(z => <option key={z}>{z}</option>)}
            </select>
            {errores.zona && <span className="error">{errores.zona}</span>}
          </label>
        </div>

        <label>Dirección o referencia *
          <input name="direccion" value={form.direccion} onChange={cambiar} placeholder="Ej: 5a avenida 3-20, frente a la escuela" maxLength={200} />
          {errores.direccion && <span className="error">{errores.direccion}</span>}
        </label>

        <label>Describe tu queja o reporte *
          <textarea name="descripcion" rows="5" value={form.descripcion} onChange={cambiar} maxLength={2000}
            placeholder="Cuéntanos qué pasa, desde cuándo y cómo te afecta." />
          <span className={'contador' + (largo < 20 ? ' falta' : '')}>{largo}/2000 {largo < 20 && `(faltan ${20 - largo})`}</span>
          {errores.descripcion && <span className="error">{errores.descripcion}</span>}
        </label>

        <div className="campo-foto">
          <span className="etiqueta">Fotografía del problema *</span>
          {foto ? (
            <div className="vista-foto">
              <img src={foto} alt="Foto adjunta" />
              <button type="button" className="btn btn-borde btn-sm" onClick={() => setFoto(null)}>Quitar foto</button>
            </div>
          ) : (
            <label className="subir">
              <input type="file" accept="image/*" onChange={elegirFoto} />
              {procesandoFoto ? 'Procesando foto...' : '📷 Tomar o seleccionar una fotografía'}
            </label>
          )}
          {errores.foto && <span className="error">{errores.foto}</span>}
        </div>

        <h2>Tus datos de contacto</h2>
        <label className="check-linea">
          <input type="checkbox" name="anonimo" checked={form.anonimo} onChange={cambiar} />
          Quiero hacer el reporte de forma anónima
        </label>

        {!form.anonimo && (
          <>
            <label>Nombre completo *
              <input name="nombre" value={form.nombre} onChange={cambiar} maxLength={100} />
              {errores.nombre && <span className="error">{errores.nombre}</span>}
            </label>
            <div className="fila">
              <label>Correo electrónico
                <input name="correo" type="email" value={form.correo} onChange={cambiar} />
                {errores.correo && <span className="error">{errores.correo}</span>}
              </label>
              <label>Teléfono
                <input name="telefono" value={form.telefono} onChange={cambiar} placeholder="5555-1234" />
                {errores.telefono && <span className="error">{errores.telefono}</span>}
              </label>
            </div>
            <p className="nota">Deja al menos un correo o teléfono por si necesitamos más información.</p>
          </>
        )}

        {errorGeneral && <div className="alerta alerta-error">{errorGeneral}</div>}

        <button className="btn btn-primario btn-grande" disabled={enviando || procesandoFoto}>
          {enviando ? 'Enviando reporte...' : 'Enviar reporte'}
        </button>
      </form>
    </div>
  );
}
