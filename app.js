import { supabase } from './supabase.js'


const DOS_HORAS_EN_MS = 2 * 60 * 60 * 1000

async function login() {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value

  const { error, data } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error(error)
    alert(error.message)
    return
  }

  // Guardar hora del login en localStorage
  localStorage.setItem('loginTimestamp', Date.now())

  mostrarApp()
}

function mostrarApp() {
  document.getElementById('auth').style.display = 'none'
  document.getElementById('app').style.display = 'block'
  cargarListados()
}

function verificarSesion() {
  const loginTimestamp = localStorage.getItem('loginTimestamp')
  if (!loginTimestamp) {
    // No hay login previo
    return false
  }
  const tiempoPasado = Date.now() - Number(loginTimestamp)
  if (tiempoPasado > DOS_HORAS_EN_MS) {
    // Más de dos horas han pasado
    localStorage.removeItem('loginTimestamp')
    return false
  }
  return true
}

window.login = login

// Al cargar la página, verificar sesión
window.addEventListener('load', () => {
  if (verificarSesion()) {
    mostrarApp()
  } else {
    // Mostrar login
    document.getElementById('auth').style.display = 'block'
    document.getElementById('app').style.display = 'none'
  }
})




let ultimoClienteId = null // Para guardar el ID del cliente recién registrado

async function registrarCliente() {
  const fullNameRaw = document.getElementById('nombre').value
  const phoneRaw = document.getElementById('telefono').value
  const referrerRaw = document.getElementById('referidor').value

  const full_name = fullNameRaw.trim()
  const normalized_name = normalizeText(fullNameRaw)
  const phone = normalizePhone(phoneRaw)

  if (!full_name || !phone) {
    alert('Nombre y teléfono son obligatorios')
    return
  }

  // Validar teléfono duplicado
  const { data: phoneExists } = await supabase
    .from('clients')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (phoneExists) {
    alert('Ya existe un cliente con ese teléfono')
    return
  }

  // Validar nombre duplicado
  const { data: nameExists } = await supabase
    .from('clients')
    .select('id')
    .eq('normalized_name', normalized_name)
    .maybeSingle()

  if (nameExists) {
    alert('Ya existe un cliente con un nombre similar')
    return
  }

  let referrer = null
  let giftClaimedValue = null // Valor inicial para gift_claimed

  if (referrerRaw) {
    const normalizedReferrerName = normalizeText(referrerRaw)
    const normalizedReferrerPhone = normalizePhone(referrerRaw)

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .or(`phone.eq.${normalizedReferrerPhone},normalized_name.eq.${normalizedReferrerName}`)
      .maybeSingle()

    if (!data) {
      alert('Referidor no encontrado')
      return
    }

    referrer = data

    const newDiscount = Math.min(referrer.discount_percentage + 5, 25)

    await supabase
      .from('clients')
      .update({
        referral_count: referrer.referral_count + 1,
        discount_percentage: newDiscount
      })
      .eq('id', referrer.id)
  }

  // Insertar nuevo cliente sin gift_claimed (lo actualizaremos después si es necesario)
  const { data: newClient, error: insertError } = await supabase
    .from('clients')
    .insert({
      full_name,
      normalized_name,
      phone,
      gift_claimed: null,
      discount_percentage: 0,
      referral_count: 0,
      discount_redemption_count: 0
    })
    .select()
    .single()

  if (insertError) {
    alert('Error al registrar cliente: ' + insertError.message)
    return
  }

  alert('Cliente registrado correctamente')

  ultimoClienteId = newClient.id

  // Mostrar la pregunta sólo si tiene referidor válido
  if (referrer) {
    mostrarPreguntaRegalo()
  } else {
    ocultarPreguntaRegalo()
  }
}

function mostrarPreguntaRegalo() {
  const div = document.getElementById('pregunta-regalo')
  div.style.display = 'block'
}

function ocultarPreguntaRegalo() {
  const div = document.getElementById('pregunta-regalo')
  div.style.display = 'none'
}

async function actualizarGiftClaimed(valor) {
  if (!ultimoClienteId) {
    alert('No hay cliente para actualizar')
    return
  }

  const { error } = await supabase
    .from('clients')
    .update({ gift_claimed: valor })
    .eq('id', ultimoClienteId)

  if (error) {
    alert('Error al actualizar regalo: ' + error.message)
    return
  }

  alert('Estado del regalo actualizado correctamente')
  ocultarPreguntaRegalo()
  // Opcional: resetear campos o recargar listados si tienes esa función
}

// Asociar botones a funciones
document.getElementById('btn-regalo-si').onclick = () => actualizarGiftClaimed(true)
document.getElementById('btn-regalo-no').onclick = () => actualizarGiftClaimed(false)



window.registrarCliente = registrarCliente

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizePhone(phone) {
  let p = phone.replace(/\D/g, '').trim()

  // Si viene con indicativo Colombia
  if (p.startsWith('57') && p.length > 10) {
    p = p.slice(2)
  }

  return p
}


//---------------------------------------------------------------------------------------------


async function buscarCliente() {
  const queryRaw = document.getElementById('buscador-input').value.trim();
  if (!queryRaw) {
    alert('Por favor ingresa un nombre o teléfono para buscar.');
    return;
  }

  const query = normalizeText(queryRaw);
  const phoneQuery = normalizePhone(queryRaw);

  // Primero buscar por nombre con ilike (similar)
  let { data, error } = await supabase
    .from('clients')
    .select('id, full_name, phone, discount_percentage, gift_claimed')
    .ilike('normalized_name', `%${query}%`)
    .limit(1);

  if (error) {
    console.error(error);
    alert('Error al buscar por nombre');
    return;
  }

  if (!data || data.length === 0) {
    // Buscar por teléfono exacto
    const { data: dataPhone, error: errPhone } = await supabase
      .from('clients')
      .select('id, full_name, phone, discount_percentage, gift_claimed')
      .eq('phone', phoneQuery)
      .limit(1);

    if (errPhone) {
      console.error(errPhone);
      alert('Error al buscar por teléfono');
      return;
    }

    if (!dataPhone || dataPhone.length === 0) {
      document.getElementById('resultado-busqueda').innerHTML = '<p>No se encontró ningún cliente.</p>';
      return;
    }

    data = dataPhone;
  }

  const cliente = data[0];

  let html = `<p><strong>Nombre:</strong> ${cliente.full_name}</p>`;
  html += `<p><strong>Teléfono:</strong> ${cliente.phone}</p>`;
  html += `<p><strong>Descuento acumulado:</strong> ${cliente.discount_percentage || 0}%</p>`;
  html += `<p><strong>Regalo pendiente:</strong> ${cliente.gift_claimed === false ? 'Sí' : 'No'}</p>`;

  // Botones para reclamar
  if (cliente.discount_percentage > 0) {
    html += `<button id="btn-reclamar-descuento">Reclamar descuento</button>`;
  }
  if (cliente.gift_claimed === false) {
    html += `<button id="btn-reclamar-regalo">Reclamar regalo</button>`;
  }

  document.getElementById('resultado-busqueda').innerHTML = html;

  // Asignar eventos a los botones recién creados
  if (cliente.discount_percentage > 0) {
    document.getElementById('btn-reclamar-descuento').addEventListener('click', () => reclamarDescuento(cliente.id));
  }
  if (cliente.gift_claimed === false) {
    document.getElementById('btn-reclamar-regalo').addEventListener('click', () => reclamarRegalo(cliente.id));
  }
}

window.buscarCliente = buscarCliente;


async function reclamarDescuento(clientId) {
  // Primero obtener el valor actual
  const { data, error } = await supabase
    .from('clients')
    .select('discount_redemption_count')
    .eq('id', clientId)
    .single()

  if (error) {
    alert('Error al obtener datos: ' + error.message)
    return
  }

  const nuevoCount = (data.discount_redemption_count || 0) + 1

  // Actualizar con el nuevo valor
  const { error: updateError } = await supabase
    .from('clients')
    .update({ discount_percentage: 0, discount_redemption_count: nuevoCount })
    .eq('id', clientId)

  if (updateError) {
    alert('Error al reclamar descuento: ' + updateError.message)
    return
  }

  alert('Descuento reclamado correctamente.')
  buscarCliente()
}


async function reclamarRegalo(clientId) {
  const { error } = await supabase
    .from('clients')
    .update({ gift_claimed: true })
    .eq('id', clientId)

  if (error) {
    alert('Error al reclamar regalo: ' + error.message)
    return
  }

  alert('Regalo reclamado correctamente.')
  buscarCliente() // actualizar vista
}

//-----------------------------------------------------------------------------

// Variables para guardar datos y filtrar
let clientesReferidos = []
let clientesRegaloPendiente = []
let clientesDescuentoMax = []

async function cargarListados() {
  // Cargar clientes con referidos (>0)
  let { data: refData, error: refError } = await supabase
    .from('clients')
    .select('id, full_name, phone, referral_count, discount_percentage')
    .gt('referral_count', 0)
    .order('referral_count', { ascending: false })

  if (refError) return alert('Error al cargar clientes con referidos')

  clientesReferidos = refData
  mostrarListado('referidos', clientesReferidos)

  // Cargar clientes con regalo pendiente
  let { data: regData, error: regError } = await supabase
    .from('clients')
    .select('id, full_name, phone, gift_claimed')
    .eq('gift_claimed', false)

  if (regError) return alert('Error al cargar clientes con regalo pendiente')

  clientesRegaloPendiente = regData
  mostrarListado('regalo', clientesRegaloPendiente)

  // Cargar clientes con descuento máximo 25%
  let { data: descData, error: descError } = await supabase
    .from('clients')
    .select('id, full_name, phone, discount_percentage')
    .eq('discount_percentage', 25)

  if (descError) return alert('Error al cargar clientes con descuento máximo')

  clientesDescuentoMax = descData
  mostrarListado('descuento', clientesDescuentoMax)
}

function mostrarListado(tipo, datos) {
  let tbody
  switch (tipo) {
    case 'referidos':
      tbody = document.querySelector('#tabla-referidos tbody')
      break
    case 'regalo':
      tbody = document.querySelector('#tabla-regalo tbody')
      break
    case 'descuento':
      tbody = document.querySelector('#tabla-descuento tbody')
      break
    default:
      console.warn('mostrarListado: tipo desconocido', tipo)
      return
  }

  tbody.innerHTML = ''

  datos.forEach(cliente => {
    let fila = ''
    switch (tipo) {
      case 'referidos':
        fila = `<tr>
          <td>${cliente.full_name}</td>
          <td>${cliente.phone}</td>
          <td>${cliente.referral_count}</td>
          <td>${cliente.discount_percentage}%</td>
        </tr>`
        break
      case 'regalo':
        fila = `<tr>
          <td>${cliente.full_name}</td>
          <td>${cliente.phone}</td>
          <td>${cliente.gift_claimed === false ? 'Pendiente' : 'Reclamado'}</td>
        </tr>`
        break
      case 'descuento':
        fila = `<tr>
          <td>${cliente.full_name}</td>
          <td>${cliente.phone}</td>
          <td>${cliente.discount_percentage}%</td>
        </tr>`
        break
    }
    tbody.innerHTML += fila
  })
}

function filtrarListado(tipo) {
  let inputId = ''
  let resultadoId = ''
  let datosOriginales = []

  switch (tipo) {
    case 'referidos':
      inputId = 'buscar-referidos'
      resultadoId = 'resultado-busqueda-referidos'
      datosOriginales = Array.isArray(clientesReferidos) ? clientesReferidos : []
      break
    case 'regalo':
      inputId = 'buscar-regalo'
      resultadoId = 'resultado-busqueda-regalo'
      datosOriginales = Array.isArray(clientesRegaloPendiente) ? clientesRegaloPendiente : []
      break
    case 'descuento':
      inputId = 'buscar-descuento'
      resultadoId = 'resultado-busqueda-descuento'
      datosOriginales = Array.isArray(clientesDescuentoMax) ? clientesDescuentoMax : []
      break
    default:
      console.warn('filtrarListado: tipo desconocido', tipo)
      return
  }

  const inputElem = document.getElementById(inputId)
  const filtroRaw = inputElem ? inputElem.value : ''
  const filtro = filtroRaw.trim().toLowerCase()

  const resultadoDiv = document.getElementById(resultadoId)
  resultadoDiv.innerHTML = ''

  if (filtro === '') {
    mostrarListado(tipo, datosOriginales)
    return
  }

  const filtrados = datosOriginales.filter(cliente => {
    if (!cliente) return false
    const nombre = cliente.full_name ? cliente.full_name.toLowerCase() : ''
    const telefono = cliente.phone ? cliente.phone : ''
    return nombre.includes(filtro) || telefono.includes(filtro)
  })

  if (filtrados.length === 0) {
    resultadoDiv.innerHTML = '<p>No se encontró ningún cliente.</p>'
  } else {
    resultadoDiv.innerHTML = filtrados.map(cliente => {
      let detalle = ''
      switch (tipo) {
        case 'referidos':
          detalle = `Referidos: ${cliente.referral_count}, Descuento: ${cliente.discount_percentage}%`
          break
        case 'regalo':
          detalle = `Regalo: ${cliente.gift_claimed === false ? 'Pendiente' : 'Reclamado'}`
          break
        case 'descuento':
          detalle = `Descuento: ${cliente.discount_percentage}%`
          break
      }
      return `<div style="border-bottom:1px solid #ddd; padding:5px 0;"><strong>${cliente.full_name}</strong> - ${cliente.phone} - ${detalle}</div>`
    }).join('')
  }

  mostrarListado(tipo, datosOriginales)
}

function toggleListado(tipo) {
  const idMap = {
    'referidos': 'listado-referidos',
    'regalo': 'listado-regalo',
    'descuento': 'listado-descuento'
  }

  const elem = document.getElementById(idMap[tipo])
  if (!elem) return

  if (elem.style.display === 'none' || elem.style.display === '') {
    elem.style.display = 'block'
    // Actualizamos datos al mostrar el listado
    cargarListados()
  } else {
    elem.style.display = 'none'
  }
}

window.filtrarListado = filtrarListado
window.toggleListado = toggleListado

//-----------------------------------------------------------------------------------------

// Asegúrate que la variable 'supabase' ya está inicializada antes de este código

document.getElementById('btnExportar').addEventListener('click', exportarExcel)

async function exportarExcel() {
  try {
    const { data: clientes, error } = await supabase
      .from('clients')
      .select('full_name, phone, referral_count, discount_percentage, gift_claimed, discount_redemption_count')

    if (error) {
      alert('Error al obtener datos: ' + error.message)
      return
    }

    if (!clientes || clientes.length === 0) {
      alert('No hay datos para exportar.')
      return
    }

    const datosExcel = clientes.map(c => ({
      Nombre: c.full_name,
      Teléfono: c.phone,
      'Número de referidos': c.referral_count,
      'Descuento acumulado (%)': c.discount_percentage,
      'Regalo reclamado': c.gift_claimed === false ? 'Pendiente' : 'Reclamado',
      'Veces que ha cobrado descuento': c.discount_redemption_count
    }))

    const ws = XLSX.utils.json_to_sheet(datosExcel)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')

    XLSX.writeFile(wb, 'clientes_exportados.xlsx')
  } catch (err) {
    alert('Error inesperado: ' + err.message)
  }
}

//-------------------------------------------------------------------------------------------

// Variables globales para manejar los clientes y estado del listado
let clientesCompletos = [];
let listadoCompletoVisible = false;

// Función para mostrar u ocultar el listado completo y cargar datos si se muestra
async function toggleListadoCompleto() {
  const container = document.getElementById('listado-completo-container');
  listadoCompletoVisible = !listadoCompletoVisible;

  if (listadoCompletoVisible) {
    container.style.display = 'block';
    await cargarListadoCompleto();
  } else {
    container.style.display = 'none';
  }
}

// Carga los clientes desde Supabase
async function cargarListadoCompleto() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    alert('Error al cargar clientes: ' + error.message);
    return;
  }

  clientesCompletos = data || [];
  mostrarListadoCompleto(clientesCompletos);
}

// Muestra la tabla con los datos, cada fila editable y con botón guardar
function mostrarListadoCompleto(datos) {
  const tbody = document.querySelector('#tabla-listado-completo tbody');
  if (!tbody) return; // Evita error si el tbody no existe

  tbody.innerHTML = '';

  datos.forEach(cliente => {
    tbody.innerHTML += `
      <tr data-id="${cliente.id}">
        <td><input type="text" class="edit-nombre" value="${cliente.full_name || ''}" style="width: 180px;" /></td>
        <td><input type="text" class="edit-telefono" value="${cliente.phone || ''}" style="width: 180px;" /></td>
        <td><input type="number" min="0" class="edit-referidos" value="${cliente.referral_count || 0}" style="width: 80px;" /></td>
        <td><input type="number" min="0" max="25" class="edit-descuento" value="${cliente.discount_percentage || 0}" style="width: 80px;" /></td>
        <td>
          <select class="edit-regalo" style="width: 120px;">
            <option value="true" ${cliente.gift_claimed === true ? 'selected' : ''}>Reclamado</option>
            <option value="false" ${cliente.gift_claimed === false ? 'selected' : ''}>Pendiente</option>
          </select>
        </td>
        <td><input type="number" min="0" class="edit-descuento-cobrado" value="${cliente.discount_redemption_count || 0}" style="width: 80px;" /></td>
        <td><button onclick="guardarCambios('${cliente.id}', this)">Guardar</button></td>
      </tr>
    `;
  });
}

// Filtra el listado completo según texto en buscador
function filtrarListadoCompleto() {
  const filtroRaw = document.getElementById('buscar-listado-completo').value.trim().toLowerCase();

  if (filtroRaw === '') {
    mostrarListadoCompleto(clientesCompletos);
    return;
  }

  const filtrados = clientesCompletos.filter(cliente => {
    const nombre = cliente.full_name ? cliente.full_name.toLowerCase() : '';
    const telefono = cliente.phone ? cliente.phone : '';
    return nombre.includes(filtroRaw) || telefono.includes(filtroRaw);
  });

  mostrarListadoCompleto(filtrados);
}

// Guarda los cambios realizados en la fila editada
async function guardarCambios(clienteId, boton) {
  const fila = boton.closest('tr');
  if (!fila) {
    alert('Error: no se pudo encontrar la fila del cliente.');
    return;
  }

  const full_name = fila.querySelector('.edit-nombre').value.trim();
  const phone = fila.querySelector('.edit-telefono').value.trim();
  const referral_count = parseInt(fila.querySelector('.edit-referidos').value) || 0;
  const discount_percentage = parseInt(fila.querySelector('.edit-descuento').value) || 0;
  const gift_claimed = fila.querySelector('.edit-regalo').value === 'true';
  const discount_redemption_count = parseInt(fila.querySelector('.edit-descuento-cobrado').value) || 0;

  if (!full_name || !phone) {
    alert('Nombre y teléfono no pueden estar vacíos.');
    return;
  }
  if (discount_percentage < 0 || discount_percentage > 25) {
    alert('El descuento debe estar entre 0 y 25.');
    return;
  }
  if (referral_count < 0 || discount_redemption_count < 0) {
    alert('Los valores numéricos no pueden ser negativos.');
    return;
  }

  boton.disabled = true;
  boton.textContent = 'Guardando...';

  try {
    const { error } = await supabase
      .from('clients')
      .update({
        full_name,
        phone,
        referral_count,
        discount_percentage,
        gift_claimed,
        discount_redemption_count
      })
      .eq('id', clienteId);

    if (error) {
      alert('Error al guardar cambios: ' + error.message);
      console.error(error);
    } else {
      alert('Cambios guardados correctamente');
      const index = clientesCompletos.findIndex(c => c.id === clienteId);
      if (index !== -1) {
        clientesCompletos[index] = {
          ...clientesCompletos[index],
          full_name,
          phone,
          referral_count,
          discount_percentage,
          gift_claimed,
          discount_redemption_count
        };
      }
    }
  } catch (err) {
    alert('Error inesperado al guardar cambios.');
    console.error(err);
  }

  boton.disabled = false;
  boton.textContent = 'Guardar';
}

// Exportar funciones globales para que el HTML las pueda usar
window.toggleListadoCompleto = toggleListadoCompleto;
window.filtrarListadoCompleto = filtrarListadoCompleto;
window.guardarCambios = guardarCambios;
