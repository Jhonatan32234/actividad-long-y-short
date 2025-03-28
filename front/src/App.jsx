import React, { useState, useEffect } from "react";
import axios from "axios";

const App = () => {
  const [cantidad, setCantidad] = useState(0);
  const [productos, setProductos] = useState([]); // Array para almacenar los productos
  const [loadingLong, setLoadingLong] = useState(true);
  const [loadingShort, setLoadingShort] = useState(true);
  const [longPollingActive, setLongPollingActive] = useState(true);

  // Estado para los datos del formulario
  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: "",
    precio: "",
    codigo: "",
    descuento: false,
  });

  // Recuperar la cantidad desde el localStorage al cargar la página
  useEffect(() => {
    const storedCantidad = JSON.parse(localStorage.getItem("cantidadDescuento"));
    if (storedCantidad) {
      setCantidad(storedCantidad);
    }

    const storedProductos = JSON.parse(localStorage.getItem("productos"));
    if (Array.isArray(storedProductos)) {
      setProductos(storedProductos);
    } else {
      setProductos([]); // En caso de que no sea un array válido, inicializa como array vacío
    }

    // Escuchar evento de antes de descargar o recargar la página
    const handleBeforeUnload = (event) => {
      // Borrar los datos de productos del localStorage
      localStorage.removeItem("productos");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup del event listener
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Función para manejar long polling
  useEffect(() => {
    let longPollingInterval;

    const longPolling = async () => {
      console.log("llamando long");

      try {
        // Realiza la solicitud long polling
        const response = await axios.get("http://localhost:8080/poll/long");

        // Verificar si la respuesta tiene productos con descuento
        const count = response.data.cantidad;
        console.log("productos con descuento:", count);

        if (count > 0) {
          // Acumula la cantidad
          setCantidad((prevCantidad) => {
            const nuevaCantidad = prevCantidad + count;
            localStorage.setItem("cantidadDescuento", JSON.stringify(nuevaCantidad));
            return nuevaCantidad;
          });
          console.log("Cantidad de productos con descuento:", localStorage.getItem("cantidadDescuento"));
        }

        setLoadingLong(false);
        longPollingInterval = setTimeout(longPolling, 0);
      } catch (error) {
        console.error("Error en Long Polling:", error);
        // Reintentar en caso de error
        setLoadingLong(true); // Mantener el loading activado
        longPollingInterval = setTimeout(longPolling, 2000); // Volver a intentar después de 2 segundos
      }
    };

    // Solo iniciamos el long polling si no está desactivado
    if (longPollingActive) {
      longPolling(); // Inicializa long polling al activarse
    }

    return () => {
      clearTimeout(longPollingInterval); // Limpiar el intervalo al desactivar long polling
    };
  }, [longPollingActive]); // Dependencia solo en longPollingActive

  // Función para manejar short polling
  useEffect(() => {
    const shortPolling = async () => {
      try {
        // Realiza la solicitud short polling solo si long polling está activo
        if (!longPollingActive) return;

        const response = await axios.get("http://localhost:8080/poll/short");

        if (response.status === 200) {
          const productosRecibidos = response.data;

          // Asegúrate de que productosRecibidos sea un array
          if (Array.isArray(productosRecibidos)) {
            // Filtrar los productos para evitar duplicados
            const productosFiltrados = productosRecibidos.filter(
              (producto) => !productos.some((prod) => prod.codigo === producto.codigo)
            );
          
            if (productosFiltrados.length > 0) {
              // Agregar los productos nuevos al array sin reemplazar el estado anterior
              setProductos((prevProductos) => [
                ...prevProductos,
                ...productosFiltrados,
              ]);
              console.log("Productos recibidos:", productosFiltrados);
            }
          } else {
            console.error("Los datos recibidos no son un array:", productosRecibidos);
          }
          
        }

        setLoadingShort(false);
      } catch (error) {
        console.error("Error en Short Polling:", error);
        setTimeout(shortPolling, 500); // Reintentar en caso de error
      }
    };

    shortPolling();

    // Hacer short polling cada 10 segundos solo si long polling está activo
    const interval = setInterval(shortPolling, 1000);

    return () => clearInterval(interval); // Limpiar intervalo cuando se desmonte el componente

  }, [longPollingActive]);

  // Función para pausar o continuar el long polling según el estado
  const handlePauseLongPolling = () => {
    setLongPollingActive(false); // Desactivar el long polling
  };

  const handleResumeLongPolling = () => {
    setLongPollingActive(true); // Reactivar el long polling
  };

  // Función para manejar el cambio de los valores del formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNuevoProducto({
      ...nuevoProducto,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Función para enviar el producto a la API
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Convertir el precio a un número flotante
    const precioFloat = parseFloat(nuevoProducto.precio);

    // Verificar si la conversión fue exitosa
    if (isNaN(precioFloat)) {
      alert("Por favor, ingrese un precio válido.");
      return;
    }

    // Crear el objeto del producto con el precio convertido a float
    const productoConPrecio = {
      ...nuevoProducto,
      precio: precioFloat,
    };

    try {
      // Enviar el nuevo producto a la ruta /insert
      const response = await axios.post("http://localhost:8080/insert", productoConPrecio);
      console.log("Producto insertado:", response.data);
      
      // Actualizar la lista de productos después de agregar uno nuevo
      setProductos((prevProductos) => {
        const nuevosProductos = [productoConPrecio, ...prevProductos];
        localStorage.setItem("productos", JSON.stringify(nuevosProductos));
        return nuevosProductos;
      });
      
      // Limpiar el formulario
      setNuevoProducto({
        nombre: "",
        precio: "",
        codigo: "",
        descuento: false,
      });
    } catch (error) {
      console.error("Error al insertar producto:", error);
    }
  };

  return (
    <div className="App">
      <h1>Productos con Descuento</h1>
      <div>
        <h2>Cantidad de productos con descuento: {cantidad}</h2>
      </div>

      <div>
        <button onClick={handlePauseLongPolling}>Pausar Long Polling</button>
        <button onClick={handleResumeLongPolling}>Reanudar Long Polling</button>
      </div>

      <div>
        <h2>Agregar Producto</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Nombre:
            <input
              type="text"
              name="nombre"
              value={nuevoProducto.nombre}
              onChange={handleInputChange}
              required
            />
          </label>
          <br />
          <label>
            Precio:
            <input
              type="number"
              name="precio"
              value={nuevoProducto.precio}
              onChange={handleInputChange}
              required
            />
          </label>
          <br />
          <label>
            Código:
            <input
              type="text"
              name="codigo"
              value={nuevoProducto.codigo}
              onChange={handleInputChange}
              required
            />
          </label>
          <br />
          <label>
            Descuento:
            <input
              type="checkbox"
              name="descuento"
              checked={nuevoProducto.descuento}
              onChange={handleInputChange}
            />
          </label>
          <br />
          <button type="submit">Agregar Producto</button>
        </form>
      </div>

      {/* Tabla para mostrar productos recibidos por short polling */}
      <div>
        <h2>Lista de Productos</h2>
        {loadingShort ? (
          <p>Cargando productos...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Precio</th>
                <th>Código</th>
                <th>Descuento</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(productos) ? productos : []).map((producto, index) => (
                <tr key={index}>
                  <td>{producto.nombre}</td>
                  <td>{producto.precio}</td>
                  <td>{producto.codigo}</td>
                  <td>{producto.descuento ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default App;
