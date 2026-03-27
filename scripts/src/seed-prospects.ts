import { db } from "@workspace/db";
import { prospectsTable } from "@workspace/db/schema";

const prospects = [
  // Spain
  { name: "Carlos García López", position: "Director General", department: "Dirección", company: "Telefónica S.A.", country: "España", city: "Madrid", email: "carlos.garcia@telefonica.com", linkedinUrl: "https://linkedin.com/in/carlosgarcia", seniority: "C-Level", industry: "Telecomunicaciones" },
  { name: "María Fernández Torres", position: "Directora de Marketing", department: "Marketing", company: "Telefónica S.A.", country: "España", city: "Madrid", email: "maria.fernandez@telefonica.com", linkedinUrl: "https://linkedin.com/in/mariafernandez", seniority: "Director", industry: "Telecomunicaciones" },
  { name: "Alejandro Martín Ruiz", position: "CTO", department: "Tecnología", company: "Banco Santander", country: "España", city: "Santander", email: "amartín@santander.com", seniority: "C-Level", industry: "Banca y Finanzas" },
  { name: "Laura Sánchez Pérez", position: "Directora de Recursos Humanos", department: "RRHH", company: "Banco Santander", country: "España", city: "Madrid", email: "lsanchez@santander.com", seniority: "Director", industry: "Banca y Finanzas" },
  { name: "Miguel Ángel González", position: "VP de Ventas", department: "Ventas", company: "Inditex", country: "España", city: "A Coruña", email: "mgonzalez@inditex.com", seniority: "VP", industry: "Retail y Moda" },
  { name: "Ana Belén Rodríguez", position: "Directora Financiera", department: "Finanzas", company: "Inditex", country: "España", city: "A Coruña", seniority: "Director", industry: "Retail y Moda" },
  { name: "Javier Moreno Díaz", position: "CEO", department: "Dirección", company: "Mapfre", country: "España", city: "Madrid", email: "jmoreno@mapfre.com", seniority: "C-Level", industry: "Seguros" },
  { name: "Patricia Jiménez Vega", position: "Head of Innovation", department: "Innovación", company: "BBVA", country: "España", city: "Bilbao", email: "pjimenez@bbva.com", seniority: "Head", industry: "Banca y Finanzas" },
  { name: "Roberto Castillo Romero", position: "Director de Operaciones", department: "Operaciones", company: "Repsol", country: "España", city: "Madrid", seniority: "Director", industry: "Energía" },
  { name: "Elena Herrero Santos", position: "Directora Comercial", department: "Comercial", company: "Endesa", country: "España", city: "Madrid", email: "eherrero@endesa.es", seniority: "Director", industry: "Energía" },

  // Mexico
  { name: "Diego Ramírez Flores", position: "Director de Estrategia", department: "Estrategia", company: "América Móvil", country: "México", city: "Ciudad de México", email: "dramirez@americamovil.com", seniority: "Director", industry: "Telecomunicaciones" },
  { name: "Sofía Torres Vargas", position: "CFO", department: "Finanzas", company: "Grupo Bimbo", country: "México", city: "Ciudad de México", seniority: "C-Level", industry: "Alimentación" },
  { name: "Andrés López Mendoza", position: "VP de Tecnología", department: "TI", company: "CEMEX", country: "México", city: "Monterrey", email: "alopez@cemex.com", seniority: "VP", industry: "Construcción" },
  { name: "Valentina Cruz Reyes", position: "Gerente de Marketing Digital", department: "Marketing", company: "Grupo Televisa", country: "México", city: "Ciudad de México", seniority: "Manager", industry: "Medios y Entretenimiento" },
  { name: "Fernando Morales Ávila", position: "Director General", department: "Dirección", company: "Banorte", country: "México", city: "Monterrey", seniority: "C-Level", industry: "Banca y Finanzas" },
  { name: "Isabella Gutiérrez Ramos", position: "Head of Product", department: "Producto", company: "MercadoLibre México", country: "México", city: "Ciudad de México", email: "igutierrez@mercadolibre.com", seniority: "Head", industry: "E-commerce" },

  // Colombia
  { name: "Santiago Ospina Hernández", position: "CEO", department: "Dirección", company: "Bancolombia", country: "Colombia", city: "Medellín", email: "sospina@bancolombia.com", seniority: "C-Level", industry: "Banca y Finanzas" },
  { name: "Camila Vargas Mejía", position: "Directora de Transformación Digital", department: "Digital", company: "Ecopetrol", country: "Colombia", city: "Bogotá", seniority: "Director", industry: "Energía" },
  { name: "Luis Miguel Pardo Gómez", position: "VP Comercial", department: "Comercial", company: "Claro Colombia", country: "Colombia", city: "Bogotá", email: "lpardo@claro.com.co", seniority: "VP", industry: "Telecomunicaciones" },
  { name: "Natalia Ríos Castañeda", position: "Directora de Innovación", department: "Innovación", company: "Grupo Éxito", country: "Colombia", city: "Medellín", seniority: "Director", industry: "Retail" },

  // Argentina
  { name: "Martín Rodríguez Peralta", position: "CTO", department: "Tecnología", company: "MercadoLibre", country: "Argentina", city: "Buenos Aires", email: "mrodriguez@mercadolibre.com", seniority: "C-Level", industry: "E-commerce" },
  { name: "Florencia Guzmán Molina", position: "Head of Sales", department: "Ventas", company: "Globant", country: "Argentina", city: "Buenos Aires", email: "fguzman@globant.com", seniority: "Head", industry: "Tecnología" },
  { name: "Nicolás Benitez Alvarez", position: "Director de Operaciones", department: "Operaciones", company: "Telecom Argentina", country: "Argentina", city: "Buenos Aires", seniority: "Director", industry: "Telecomunicaciones" },
  { name: "Agustina Fernández Villar", position: "Gerente de RRHH", department: "RRHH", company: "Grupo Clarín", country: "Argentina", city: "Buenos Aires", seniority: "Manager", industry: "Medios" },

  // Chile
  { name: "Rodrigo Contreras Silva", position: "CEO", department: "Dirección", company: "Falabella", country: "Chile", city: "Santiago", email: "rcontreras@falabella.com", seniority: "C-Level", industry: "Retail" },
  { name: "Javiera Muñoz Araya", position: "VP de Marketing", department: "Marketing", company: "Entel", country: "Chile", city: "Santiago", seniority: "VP", industry: "Telecomunicaciones" },
  { name: "Felipe Soto Díaz", position: "Director Financiero", department: "Finanzas", company: "Banco de Chile", country: "Chile", city: "Santiago", email: "fsoto@bancochile.cl", seniority: "Director", industry: "Banca y Finanzas" },

  // Peru
  { name: "César Quispe Mamani", position: "Gerente General", department: "Dirección", company: "Grupo Romero", country: "Perú", city: "Lima", seniority: "C-Level", industry: "Conglomerado" },
  { name: "Lucía Torres Mendívil", position: "Directora de TI", department: "TI", company: "Interbank", country: "Perú", city: "Lima", email: "ltorres@interbank.pe", seniority: "Director", industry: "Banca y Finanzas" },

  // USA Hispanic market
  { name: "Ricardo Villa Espinoza", position: "VP de Expansión Latam", department: "Expansión", company: "Google LLC", country: "Estados Unidos", city: "Miami", email: "rvilla@google.com", seniority: "VP", industry: "Tecnología" },
  { name: "Gabriela Herrera Montoya", position: "Senior Product Manager", department: "Producto", company: "Meta Platforms", country: "Estados Unidos", city: "Nueva York", seniority: "Manager", industry: "Tecnología" },

  // Additional Spain companies
  { name: "Daniel Castro Blanco", position: "Head of Data Analytics", department: "Datos", company: "Seat S.A.", country: "España", city: "Barcelona", email: "dcastro@seat.es", seniority: "Head", industry: "Automoción" },
  { name: "Marta Iglesias Pons", position: "Directora de Ventas", department: "Ventas", company: "Mango", country: "España", city: "Barcelona", seniority: "Director", industry: "Retail y Moda" },
  { name: "Sergio Navarro Campos", position: "CTO", department: "Tecnología", company: "Cellnex", country: "España", city: "Barcelona", email: "snavarro@cellnex.com", seniority: "C-Level", industry: "Infraestructura Digital" },
  { name: "Carmen López Pujol", position: "VP Operaciones", department: "Operaciones", company: "Naturgy", country: "España", city: "Madrid", seniority: "VP", industry: "Energía" },
  { name: "Ignacio Fuentes Herrero", position: "Director de Estrategia Corporativa", department: "Estrategia", company: "ACS Group", country: "España", city: "Madrid", email: "ifuentes@acs.es", seniority: "Director", industry: "Construcción e Infraestructura" },
  { name: "Pilar Domínguez Torres", position: "Chief Marketing Officer", department: "Marketing", company: "Solaria Energía", country: "España", city: "Madrid", seniority: "C-Level", industry: "Energía Renovable" },
];

async function seed() {
  console.log("Seeding prospects database...");
  try {
    await db.insert(prospectsTable).values(prospects).onConflictDoNothing();
    console.log(`Inserted ${prospects.length} prospects successfully.`);
  } catch (error) {
    console.error("Error seeding:", error);
    process.exit(1);
  }
  process.exit(0);
}

seed();
