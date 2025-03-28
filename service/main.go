package main

import (
    "log"
    "sync"
    "github.com/gin-gonic/gin"
    "github.com/gin-contrib/cors"
)

type Producto struct {
    Nombre    string  `json:"nombre"`
    Precio    float64 `json:"precio"`
    Codigo    string  `json:"codigo"`
    Descuento bool    `json:"descuento"`
}

var (
    productos []Producto
    mu        sync.Mutex
    cond      = sync.NewCond(&mu)
)

// Long polling handler
func longPollingHandler(c *gin.Context) {
    mu.Lock()
    cond.Wait()

    // Contamos los productos que tienen descuento
    count := 0
    for _, p := range productos {
        if p.Descuento {
            count++
        }
    }

    // Si no hay productos con descuento, no enviar nada
    if count > 0 {
        log.Println("Productos con descuento encontrados:", count)
        c.JSON(200, gin.H{"cantidad": count})
    }

    mu.Unlock()
}

// Short polling handler
func shortPollingHandler(c *gin.Context) {
    mu.Lock()
    if len(productos) > 0 {
        // Enviar todos los productos como JSON
        c.JSON(200, productos)

        // Limpiar la lista de productos después de enviarlo
        productos = []Producto{}
        log.Println("Productos consumidos y eliminados del almacenamiento")
    } else {
        c.String(204, "No hay productos nuevos")
    }
    mu.Unlock()
}

// Insert data handler
func insertDataHandler(c *gin.Context) {
    var nuevoProducto Producto
    if err := c.ShouldBindJSON(&nuevoProducto); err != nil {
        c.String(400, "Error al leer el producto: %v", err)
        return
    }

    mu.Lock()
    productos = append(productos, nuevoProducto)
    cond.Broadcast()
    mu.Unlock()

    log.Println("Nuevo producto insertado:", nuevoProducto)
    c.String(200, "Producto insertado correctamente")
}

func main() {
    r := gin.Default()

    // Habilitar CORS para permitir solicitudes desde otros dominios
    r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"http://localhost:5173"}, // Permitir solicitudes solo desde este dominio
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}, // Agregar OPTIONS aquí
        AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
        AllowCredentials: true,
    }))

    // Manejo de OPTIONS manual
    r.OPTIONS("/*any", func(c *gin.Context) {
        c.Status(200) // Responde con código 200 a las solicitudes OPTIONS
    })

    // Definir las rutas
    r.POST("/insert", insertDataHandler)
    r.GET("/poll/long", longPollingHandler)
    r.GET("/poll/short", shortPollingHandler)

    log.Println("Servidor escuchando en :8080")
    r.Run(":8080")
}
