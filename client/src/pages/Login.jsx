import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, guardarSesion } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const r = await api.login(correo, password);
      guardarSesion(r.token);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="tarjeta caja-login">
      <h1>Panel de administración</h1>
      <p className="nota">Acceso solo para personal municipal.</p>
      <form onSubmit={entrar}>
        <label>Correo
          <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} required />
        </label>
        <label>Contraseña
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <div className="alerta alerta-error">{error}</div>}
        <button className="btn btn-primario btn-bloque" disabled={cargando}>{cargando ? 'Ingresando...' : 'Ingresar'}</button>
      </form>
    </div>
  );
}
