// =====================================================
// Juego 2D con colisiones - Lizbeth Huaman
// =====================================================

// Referencia al lienzo y su contexto de dibujo 2D
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Nombre del jugador (aparece en la portada y en el mensaje final)
const NOMBRE_JUGADOR = 'Lizbeth Huaman';

// Estados del juego: 'portada', 'jugando', 'fin'
let estado = 'portada';

// Puntaje
let score = 0;
const PUNTOS_MONEDA = 10;
const PUNTOS_NIVEL = 50;

// =====================================================
// SONIDOS (generados con Web Audio API, no necesitan archivos)
// =====================================================
let audioCtx = null;
let sonidoActivo = true;
let musicaIntervalo = null;
let ultimoChoque = 0;

// Crea el contexto de audio (los navegadores exigen una tecla o clic antes)
function iniciarAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Reproduce un tono simple
function tono(frecuencia, duracion, tipo = 'square', volumen = 0.15) {
  if (!audioCtx || !sonidoActivo) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = tipo;
  osc.frequency.value = frecuencia;
  gain.gain.setValueAtTime(volumen, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracion);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duracion);
}

// Sonido de colisión (con pausa mínima para que no suene en cada frame)
function sonidoColision() {
  const ahora = performance.now();
  if (ahora - ultimoChoque < 250) return;
  ultimoChoque = ahora;
  tono(110, 0.15, 'sawtooth', 0.2);
}

// Sonido al recoger una moneda
function sonidoMoneda() {
  tono(880, 0.08, 'square', 0.12);
  setTimeout(() => tono(1320, 0.12, 'square', 0.12), 80);
}

// Sonido al pasar de nivel
function sonidoNivel() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tono(f, 0.15, 'triangle', 0.18), i * 120));
}

// Música de fondo: una melodía corta que se repite
const melodia = [262, 330, 392, 330, 294, 349, 440, 349, 262, 330, 392, 523, 392, 330, 294, 247];
let notaActual = 0;

function iniciarMusica() {
  if (musicaIntervalo) return;
  musicaIntervalo = setInterval(() => {
    tono(melodia[notaActual], 0.22, 'triangle', 0.05);
    notaActual = (notaActual + 1) % melodia.length;
  }, 250);
}

function detenerMusica() {
  clearInterval(musicaIntervalo);
  musicaIntervalo = null;
}

// =====================================================
// TECLADO
// =====================================================
let keys = {};
document.addEventListener('keydown', (e) => {
  keys[e.key] = true;

  // Evita que las flechas muevan la página
  if (e.key.startsWith('Arrow')) e.preventDefault();

  // ENTER: empezar desde la portada o volver a la portada al final
  if (e.key === 'Enter') {
    iniciarAudio();
    if (estado === 'portada') empezarJuego();
    else if (estado === 'fin') estado = 'portada';
  }

  // M: silenciar o activar sonido
  if (e.key === 'm' || e.key === 'M') {
    sonidoActivo = !sonidoActivo;
  }
});
document.addEventListener('keyup', (e) => keys[e.key] = false);

// Definición del jugador
const player = { x: 50, y: 50, w: 30, h: 30, color: 'red', speed: 3 };

// =====================================================
// NIVELES con obstáculos y monedas
// =====================================================
const levels = [
  {
    obstacles: [
      { x: 100, y: 150, w: 400, h: 20 },
      { x: 300, y: 250, w: 20, h: 100 }
    ],
    coins: [
      { x: 500, y: 50, collected: false },
      { x: 50, y: 300, collected: false }
    ]
  },
  {
    obstacles: [
      { x: 200, y: 100, w: 200, h: 20 },
      { x: 200, y: 200, w: 20, h: 100 },
      { x: 400, y: 200, w: 20, h: 100 }
    ],
    coins: [
      { x: 50, y: 50, collected: false },
      { x: 550, y: 350, collected: false },
      { x: 300, y: 180, collected: false }
    ]
  },
  {
    // NIVEL 3: laberinto en zigzag
    obstacles: [
      { x: 120, y: 0, w: 20, h: 280 },
      { x: 260, y: 120, w: 20, h: 280 },
      { x: 400, y: 0, w: 20, h: 280 },
      { x: 480, y: 200, w: 120, h: 20 }
    ],
    coins: [
      { x: 180, y: 340, collected: false },
      { x: 330, y: 60, collected: false },
      { x: 450, y: 350, collected: false },
      { x: 540, y: 50, collected: false }
    ]
  }
];

// Índice del nivel actual
let currentLevel = 0;

// =====================================================
// HISTORIAL DE PUNTUACIÓN (se guarda en el navegador)
// =====================================================
const CLAVE_HISTORIAL = 'historialJuego2D';

function leerHistorial() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_HISTORIAL)) || [];
  } catch (e) {
    return [];
  }
}

function guardarPartida(puntos) {
  const historial = leerHistorial();
  const fecha = new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  historial.unshift({ puntos, fecha });
  try {
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(historial.slice(0, 10)));
  } catch (e) { /* si el navegador no permite guardar, se ignora */ }
  mostrarHistorial();
}

function mejorPuntaje() {
  return leerHistorial().reduce((max, p) => Math.max(max, p.puntos), 0);
}

function mostrarHistorial() {
  const lista = document.getElementById('historial');
  const historial = leerHistorial();
  lista.innerHTML = historial.length
    ? historial.map(p => `<li>${p.puntos} pts &middot; ${p.fecha}</li>`).join('')
    : '<li>Aún no hay partidas</li>';
  document.getElementById('mejorPuntaje').textContent = mejorPuntaje();
}

document.getElementById('borrarHistorial').addEventListener('click', () => {
  try { localStorage.removeItem(CLAVE_HISTORIAL); } catch (e) {}
  mostrarHistorial();
});

function actualizarPuntajeHTML() {
  document.getElementById('puntajeActual').textContent = score;
}

// =====================================================
// LÓGICA DEL JUEGO
// =====================================================

// Función para detectar colisiones entre dos rectángulos
function rectsCollide(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Función para dibujar un rectángulo (jugador u obstáculo)
function drawRect(obj) {
  ctx.fillStyle = obj.color || 'white';
  ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
}

function empezarJuego() {
  score = 0;
  currentLevel = 0;
  actualizarPuntajeHTML();
  resetLevel();
  estado = 'jugando';
  iniciarMusica();
}

// Función que actualiza la lógica del juego
function update() {
  if (estado !== 'jugando') return;

  const level = levels[currentLevel];

  // Movimiento del jugador según las teclas presionadas
  if (keys['ArrowUp']) player.y -= player.speed;
  if (keys['ArrowDown']) player.y += player.speed;
  if (keys['ArrowLeft']) player.x -= player.speed;
  if (keys['ArrowRight']) player.x += player.speed;

  // Límites del escenario: el jugador choca con los bordes y no sale
  if (player.x < 0) { player.x = 0; sonidoColision(); }
  if (player.y < 0) { player.y = 0; sonidoColision(); }
  if (player.x + player.w > canvas.width) { player.x = canvas.width - player.w; sonidoColision(); }
  if (player.y + player.h > canvas.height) { player.y = canvas.height - player.h; sonidoColision(); }

  // Comprobación de colisión con obstáculos y retroceso del movimiento
  for (let obs of level.obstacles) {
    if (rectsCollide(player, obs)) {
      if (keys['ArrowUp']) player.y += player.speed;
      if (keys['ArrowDown']) player.y -= player.speed;
      if (keys['ArrowLeft']) player.x += player.speed;
      if (keys['ArrowRight']) player.x -= player.speed;
      sonidoColision();
    }
  }

  // Comprobación de colisión con monedas y recolección
  for (let coin of level.coins) {
    if (!coin.collected) {
      if (
        player.x < coin.x + 15 &&
        player.x + player.w > coin.x &&
        player.y < coin.y + 15 &&
        player.y + player.h > coin.y
      ) {
        coin.collected = true;   // Marca la moneda como recogida
        score += PUNTOS_MONEDA;  // Suma puntos
        actualizarPuntajeHTML();
        sonidoMoneda();
      }
    }
  }

  // Verifica si todas las monedas del nivel han sido recogidas
  const allCollected = level.coins.every(c => c.collected);
  if (allCollected) {
    score += PUNTOS_NIVEL; // Bono por completar el nivel
    actualizarPuntajeHTML();
    sonidoNivel();

    if (currentLevel < levels.length - 1) {
      currentLevel++; // Avanza al siguiente nivel
      resetLevel();   // Reinicia la posición del jugador y monedas
    } else {
      // Fin del juego: guarda el puntaje y muestra la pantalla final
      estado = 'fin';
      detenerMusica();
      guardarPartida(score);
      keys = {};
    }
  }
}

// Función para reiniciar la posición del jugador y el estado de las monedas
function resetLevel() {
  player.x = 50;
  player.y = 50;
  levels[currentLevel].coins.forEach(c => c.collected = false);
}

// =====================================================
// DIBUJO
// =====================================================

// Texto centrado en el lienzo
function textoCentrado(texto, y, tamano, color = 'white', negrita = false) {
  ctx.fillStyle = color;
  ctx.font = `${negrita ? 'bold ' : ''}${tamano}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(texto, canvas.width / 2, y);
  ctx.textAlign = 'left';
}

// Portada del juego
function drawPortada() {
  // Fondo decorativo con monedas
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.beginPath();
    ctx.arc(50 + i * 47, 60 + (i % 3) * 120, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Jugador de muestra
  drawRect({ x: canvas.width / 2 - 20, y: 70, w: 40, h: 40, color: 'red' });

  textoCentrado('LABERINTO DE MONEDAS', 160, 34, 'gold', true);
  textoCentrado('Recoge todas las monedas de los 3 niveles', 195, 16, '#ccc');
  textoCentrado('Usa las flechas para moverte', 220, 16, '#ccc');

  // Texto parpadeante
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    textoCentrado('Presiona ENTER para jugar', 280, 22, 'white', true);
  }

  textoCentrado(`Mejor puntaje: ${mejorPuntaje()}`, 330, 16, 'gold');
  textoCentrado(`Jugador: ${NOMBRE_JUGADOR}`, 370, 14, '#aaa');
}

// Pantalla final
function drawFin() {
  textoCentrado('¡Felicitaciones!', 140, 40, 'gold', true);
  textoCentrado(NOMBRE_JUGADOR, 185, 26, 'white', true);
  textoCentrado('Completaste los 3 niveles', 225, 18, '#ccc');
  textoCentrado(`Puntaje final: ${score}`, 270, 24, 'gold', true);
  textoCentrado('Presiona ENTER para volver a la portada', 340, 16, '#aaa');
}

// Función que dibuja todos los elementos del juego
function draw() {
  // Limpia el lienzo
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (estado === 'portada') { drawPortada(); return; }
  if (estado === 'fin') { drawFin(); return; }

  // Dibuja al jugador
  drawRect(player);

  const level = levels[currentLevel];

  // Dibuja los obstáculos
  for (let obs of level.obstacles) {
    drawRect({ ...obs, color: 'gray' });
  }

  // Dibuja las monedas no recogidas
  for (let coin of level.coins) {
    if (!coin.collected) {
      ctx.fillStyle = 'gold';
      ctx.beginPath();
      ctx.arc(coin.x + 7.5, coin.y + 7.5, 7.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Muestra el nivel, el puntaje y el estado del sonido
  ctx.fillStyle = 'white';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Nivel: ${currentLevel + 1} / ${levels.length}`, 10, 20);
  ctx.fillText(`Puntaje: ${score}`, 10, 40);
  ctx.fillText(sonidoActivo ? 'Sonido: ON (M)' : 'Sonido: OFF (M)', canvas.width - 120, 20);
}

// Bucle principal del juego (actualiza y dibuja en cada frame)
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop); // Ejecuta de nuevo en el siguiente frame
}

// Inicializa el juego
mostrarHistorial();
resetLevel();
gameLoop();
