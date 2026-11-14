import { Routes, Route, Navigate, Link, NavLink, useNavigate } from 'react-router-dom';
import Portal from './pages/Portal';
import Seguimiento from './pages/Seguimiento';
import Login from './pages/Login';
import Panel from './pages/Panel';
import DetalleQueja from './pages/DetalleQueja';
import { getToken, cerrarSesion } from './api';

function Privada({ children }) {
  if (!getToken()) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const sesion = !!getToken();

  function salir() {
    cerrarSesion();
    navigate('/admin/login');
  }

  return (
    <>
      <header className="encabezado">
        <div className="encabezado-interno">
          <Link to="/" className="logo">
            <img src="/icono.svg" alt="" />
            <div>
              <strong>Voz Ciudadana</strong>
              <small>Atención de quejas y reportes municipales</small>
            </div>
          </Link>
          <nav className="menu">
            <NavLink to="/" end>Hacer un reporte</NavLink>
            <NavLink to="/seguimiento">Consultar mi reporte</NavLink>
            <NavLink to="/admin">Panel municipal</NavLink>
            {sesion && <button className="btn btn-borde btn-sm" onClick={salir}>Cerrar sesión</button>}
          </nav>
        </div>
      </header>

      <main className="contenedor">
        <Routes>
          <Route path="/" element={<Portal />} />
          <Route path="/seguimiento" element={<Seguimiento />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<Privada><Panel /></Privada>} />
          <Route path="/admin/queja/:id" element={<Privada><DetalleQueja /></Privada>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <footer className="pie">
        Voz Ciudadana · Proyecto de Desarrollo Web · Marjorie Samantha Giron Morales · 1890-22-19957
      </footer>
    </>
  );
}
