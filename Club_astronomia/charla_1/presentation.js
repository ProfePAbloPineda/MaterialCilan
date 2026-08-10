// Global variables
let currentSlide = 1;
const totalSlides = 14;

// Audio Accessibility Variables
let synthContext = null;
let ambientGain = null;
let ambientLFO = null;
let ambientOsc1 = null;
let ambientOsc2 = null;
let isAmbientPlaying = false;

// Speech Synthesis Variable
let currentUtterance = null;
let isSpeaking = false;

// Orrery status
let orreryPaused = false;

// DOM elements
let prevBtn, nextBtn, progressSpan, ambientBtn;

// Initialize when DOM loaded
document.addEventListener("DOMContentLoaded", () => {
    prevBtn = document.getElementById("btn-prev");
    nextBtn = document.getElementById("btn-next");
    progressSpan = document.getElementById("slide-progress");
    ambientBtn = document.getElementById("btn-ambient");

    // Initialize slide state
    updateSlideView();

    // Keyboard controls
    document.addEventListener("keydown", handleKeyDown);

    // Touch controls (swipe)
    let touchStartX = 0;
    let touchEndX = 0;
    
    document.addEventListener("touchstart", e => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);
    
    document.addEventListener("touchend", e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe(touchStartX, touchEndX);
    }, false);

    // Setup planetary card hover/click listeners in Slide 5
    setupPlanetFamilyListeners();

    // Setup orrery node clicks
    setupOrreryListeners();
});

// Slide Navigation
function updateSlideView() {
    // Hide all slides
    document.querySelectorAll(".slide").forEach(slide => {
        slide.classList.remove("active");
    });

    // Stop speaking if active
    stopSpeaking();

    // Show active slide
    const activeSlide = document.getElementById(`slide-${currentSlide}`);
    if (activeSlide) {
        activeSlide.classList.add("active");
    }

    // Play slide transition sound chime
    playTransitionChime();

    // Update navigation controls
    if (progressSpan) {
        progressSpan.innerText = `${currentSlide} / ${totalSlides}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentSlide === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentSlide === totalSlides;
    }
}

function nextSlide() {
    if (currentSlide < totalSlides) {
        currentSlide++;
        updateSlideView();
    }
}

function prevSlide() {
    if (currentSlide > 1) {
        currentSlide--;
        updateSlideView();
    }
}

function goToSlide(index) {
    if (index >= 1 && index <= totalSlides) {
        currentSlide = index;
        updateSlideView();
    }
}

function handleKeyDown(event) {
    // Navigate on Right Arrow, Spacebar, Down Arrow
    if (event.key === "ArrowRight" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        nextSlide();
    }
    // Navigate on Left Arrow, Backspace, Up Arrow
    else if (event.key === "ArrowLeft" || event.key === "Backspace" || event.key === "ArrowUp") {
        event.preventDefault();
        prevSlide();
    }
    // L key for read aloud
    else if (event.key.toLowerCase() === "l") {
        speakCurrentSlide();
    }
    // M key for ambient music
    else if (event.key.toLowerCase() === "m") {
        toggleAmbientMusic();
    }
}

function handleSwipe(startX, endX) {
    const threshold = 50; // swipe offset threshold
    if (startX - endX > threshold) {
        nextSlide(); // Swiped left
    } else if (endX - startX > threshold) {
        prevSlide(); // Swiped right
    }
}

// Web Audio ambient music & chime synthesis
function initSynth() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        synthContext = new AudioContext();
        
        // Deep ambient synth drone
        ambientGain = synthContext.createGain();
        ambientGain.gain.setValueAtTime(0, synthContext.currentTime);
        
        // Low cutoff filter
        const lowpass = synthContext.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(100, synthContext.currentTime);
        lowpass.Q.setValueAtTime(1, synthContext.currentTime);

        // Sub base drone
        ambientOsc1 = synthContext.createOscillator();
        ambientOsc1.type = "sawtooth";
        ambientOsc1.frequency.setValueAtTime(55, synthContext.currentTime); // A1

        // Slightly detuned oscillator for beating/chorus
        ambientOsc2 = synthContext.createOscillator();
        ambientOsc2.type = "sawtooth";
        ambientOsc2.frequency.setValueAtTime(55.3, synthContext.currentTime); // Detuned A1
        
        // High pad harmonics (sine waves)
        const pad1 = synthContext.createOscillator();
        pad1.type = "sine";
        pad1.frequency.setValueAtTime(220, synthContext.currentTime); // A3
        
        const pad2 = synthContext.createOscillator();
        pad2.type = "sine";
        pad2.frequency.setValueAtTime(330, synthContext.currentTime); // E4

        // Modulator LFO for the filter cutoff sweep
        ambientLFO = synthContext.createOscillator();
        ambientLFO.frequency.setValueAtTime(0.08, synthContext.currentTime); // 0.08 Hz (very slow)
        
        const lfoGain = synthContext.createGain();
        lfoGain.gain.setValueAtTime(45, synthContext.currentTime); // Modulate cutoff by +- 45Hz
        
        // Connect nodes
        ambientLFO.connect(lfoGain);
        lfoGain.connect(lowpass.frequency);
        
        ambientOsc1.connect(lowpass);
        ambientOsc2.connect(lowpass);
        
        // Connect pad harmonics directly to gain (no lowpass)
        const padGain = synthContext.createGain();
        padGain.gain.setValueAtTime(0.06, synthContext.currentTime);
        pad1.connect(padGain);
        pad2.connect(padGain);
        
        lowpass.connect(ambientGain);
        padGain.connect(ambientGain);
        
        ambientGain.connect(synthContext.destination);

        // Start oscillators
        ambientOsc1.start();
        ambientOsc2.start();
        pad1.start();
        pad2.start();
        ambientLFO.start();
        
    } catch (e) {
        console.error("Web Audio API not supported in this browser.", e);
    }
}

function toggleAmbientMusic() {
    if (!synthContext) {
        initSynth();
    }
    
    if (synthContext.state === "suspended") {
        synthContext.resume();
    }

    if (!isAmbientPlaying) {
        // Fade in
        ambientGain.gain.linearRampToValueAtTime(0.35, synthContext.currentTime + 2);
        ambientBtn.classList.add("active");
        isAmbientPlaying = true;
    } else {
        // Fade out
        ambientGain.gain.linearRampToValueAtTime(0, synthContext.currentTime + 1);
        ambientBtn.classList.remove("active");
        isAmbientPlaying = false;
    }
}

function playTransitionChime() {
    if (!synthContext) return;
    if (synthContext.state === "suspended") return;
    
    // Quick cosmic sweep sound effect
    const osc = synthContext.createOscillator();
    const gain = synthContext.createGain();
    
    osc.type = "sine";
    // Set frequency starting point
    osc.frequency.setValueAtTime(300, synthContext.currentTime);
    // Sweep up
    osc.frequency.exponentialRampToValueAtTime(900, synthContext.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0, synthContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, synthContext.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, synthContext.currentTime + 0.45);
    
    osc.connect(gain);
    gain.connect(synthContext.destination);
    
    osc.start();
    osc.stop(synthContext.currentTime + 0.5);
}


// Speech Synthesis (TTS Lectura)
function speakCurrentSlide() {
    // If speaking, cancel
    if (isSpeaking) {
        stopSpeaking();
        return;
    }

    const currentSlideElem = document.getElementById(`slide-${currentSlide}`);
    if (!currentSlideElem) return;

    const ttsText = currentSlideElem.getAttribute("data-tts");
    if (!ttsText) return;

    // Stop ambient music volume slightly while speaking
    if (isAmbientPlaying && ambientGain) {
        ambientGain.gain.linearRampToValueAtTime(0.08, synthContext.currentTime + 0.5);
    }

    // Stop any current speaking
    window.speechSynthesis.cancel();

    currentUtterance = new SpeechSynthesisUtterance(ttsText);
    currentUtterance.lang = "es-ES";
    
    // Find a Spanish voice if available
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(voice => voice.lang.startsWith("es"));
    if (spanishVoice) {
        currentUtterance.voice = spanishVoice;
    }

    currentUtterance.onstart = () => {
        isSpeaking = true;
        // Update all TTS buttons in the active slide
        currentSlideElem.querySelectorAll(".btn-tts").forEach(btn => {
            btn.classList.add("speaking");
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                Detener
            `;
        });
    };

    currentUtterance.onend = currentUtterance.onerror = () => {
        isSpeaking = false;
        // Restore ambient music volume
        if (isAmbientPlaying && ambientGain) {
            ambientGain.gain.linearRampToValueAtTime(0.35, synthContext.currentTime + 1);
        }
        
        currentSlideElem.querySelectorAll(".btn-tts").forEach(btn => {
            btn.classList.remove("speaking");
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                Escuchar
            `;
        });
    };

    window.speechSynthesis.speak(currentUtterance);
}

function stopSpeaking() {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    
    document.querySelectorAll(".btn-tts").forEach(btn => {
        btn.classList.remove("speaking");
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            Escuchar
        `;
    });

    // Restore volume
    if (isAmbientPlaying && ambientGain) {
        ambientGain.gain.linearRampToValueAtTime(0.35, synthContext.currentTime + 0.5);
    }
}


// Slide 4: Orrery Speed Control
function toggleOrrerySpeed() {
    const btn = document.getElementById("btn-pause-orrery");
    const orbits = document.querySelectorAll(".orbit-line");
    
    if (!orreryPaused) {
        orbits.forEach(orbit => {
            orbit.style.animationPlayState = "paused";
        });
        btn.innerText = "Reanudar Órbitas";
        orreryPaused = true;
    } else {
        orbits.forEach(orbit => {
            orbit.style.animationPlayState = "running";
        });
        btn.innerText = "Pausar Órbitas";
        orreryPaused = false;
    }
}

function setupOrreryListeners() {
    const display = document.getElementById("orrery-info-display");
    document.querySelectorAll(".planet-node").forEach(node => {
        node.addEventListener("click", e => {
            e.stopPropagation();
            const name = node.getAttribute("data-name");
            const desc = node.getAttribute("data-desc");
            display.innerHTML = `<strong>${name}</strong>: ${desc}`;
        });
    });
}


// Slide 5: Planet Family descriptions
function setupPlanetFamilyListeners() {
    const infoDisplay = document.getElementById("planet-family-info");
    
    document.querySelectorAll(".family-planet-card").forEach(card => {
        // Hover
        card.addEventListener("mouseenter", () => {
            const name = card.getAttribute("data-pname");
            const desc = card.getAttribute("data-pdesc");
            infoDisplay.innerHTML = `<strong>${name}</strong> — ${desc}`;
            infoDisplay.style.borderColor = "var(--accent-blue)";
        });

        card.addEventListener("mouseleave", () => {
            infoDisplay.innerHTML = "Coloca el puntero o haz clic sobre un planeta para ver su escala e información comparativa.";
            infoDisplay.style.borderColor = "rgba(255, 255, 255, 0.06)";
        });
        
        // Mobile click
        card.addEventListener("click", () => {
            const name = card.getAttribute("data-pname");
            const desc = card.getAttribute("data-pdesc");
            infoDisplay.innerHTML = `<strong>${name}</strong> — ${desc}`;
            infoDisplay.style.borderColor = "var(--accent-blue)";
        });
    });
}


// Slide 6: Life Cycle timeline step selector
function activateStarStep(stepIndex) {
    // Deactivate all steps
    document.querySelectorAll(".timeline-step").forEach(step => {
        step.classList.remove("active");
    });
    
    // Activate clicked step
    const clickedStep = document.getElementById(`star-step-${stepIndex}`);
    if (clickedStep) {
        clickedStep.classList.add("active");
        
        // Retrieve info
        const title = clickedStep.getAttribute("data-title");
        const desc = clickedStep.getAttribute("data-desc");
        const img = clickedStep.getAttribute("data-img");
        const color = clickedStep.getAttribute("data-color");
        const credit = clickedStep.getAttribute("data-srcname");
        
        // Update DOM details
        const imgElem = document.getElementById("star-visual-img");
        const titleElem = document.getElementById("star-visual-title");
        const descElem = document.getElementById("star-visual-desc");
        const creditElem = document.getElementById("star-slide-credit");
        
        imgElem.src = img;
        imgElem.style.borderColor = color;
        imgElem.style.boxShadow = `0 0 25px ${color}`;
        titleElem.innerText = title;
        descElem.innerText = desc;
        creditElem.innerText = `Crédito de imagen: ${credit}`;
        
        // Update timeline badges styles dynamically
        document.querySelectorAll(".timeline-badge").forEach(badge => {
            badge.style.backgroundColor = "var(--accent-orange)";
            badge.style.boxShadow = "none";
        });
        
        const activeBadge = clickedStep.querySelector(".timeline-badge");
        activeBadge.style.backgroundColor = "#fff";
        activeBadge.style.boxShadow = "0 0 15px #fff";
    }
}


// Slide 9: SVG Night sky planets tooltip info
function showPlanetStatus(planetName) {
    let details = "";
    if (planetName === "Saturno") {
        details = "Saturno está en la constelación de Acuario. Espectacular con sus anillos abiertos a inclinación media, visible casi toda la noche.";
    } else if (planetName === "Marte") {
        details = "Marte se eleva después de la medianoche con su color rojizo característico, ubicado cerca de Tauro.";
    }
    
    alert(`[Objetivo esta noche]: ${details}`);
}


// Slide 10: Telescope hotspot details selector
function selectTelescopePart(partId) {
    const title = document.getElementById("part-title");
    const desc = document.getElementById("part-desc");
    
    let partTitle = "";
    let partDesc = "";
    
    switch (partId) {
        case "tubo":
            partTitle = "Tubo Óptico";
            partDesc = "El cilindro principal del telescopio. Aloja los lentes (objetivo) que captan la luz distante de los astros y la dirigen concentrada hacia el ocular en el extremo opuesto.";
            break;
        case "montura":
            partTitle = "Montura y Trípode";
            partDesc = "La estructura de soporte del telescopio. Absorbe vibraciones de la superficie y permite apuntar el telescopio suavemente en dos ejes cardinales (Altitud y Azimut).";
            break;
        case "buscador":
            partTitle = "Buscador";
            partDesc = "Una mira telescópica pequeña de poco aumento (~6x) y amplio campo de visión. Se alinea paralela al tubo principal y sirve para encuadrar y ubicar objetos en el cielo fácilmente.";
            break;
        case "ocular":
            partTitle = "Ocular";
            partDesc = "El cilindro de lentes intercambiable donde colocamos el ojo. Magnifica la imagen real proyectada por el tubo óptico. Cambiar de ocular (de 25mm a 10mm) varía la potencia de aumento.";
            break;
        case "enfocador":
            partTitle = "Enfocador";
            partDesc = "Un engranaje manual de perillas. Al girarlo, desplaza el ocular milimétricamente hacia adelante y hacia atrás hasta lograr que el punto focal coincida exactamente y la imagen sea nítida.";
            break;
    }
    
    title.innerText = partTitle;
    desc.innerText = partDesc;
}


// Slide 11: Saturn Focus simulator
function adjustFocusSim(val) {
    const saturnImg = document.getElementById("saturn-focus-img");
    const statusText = document.getElementById("focus-status");
    
    // Perfect focus point is at val = 15 (blur = 0)
    // Blur is the absolute distance from 15
    const distance = Math.abs(15 - val);
    
    saturnImg.style.filter = `blur(${distance}px)`;
    
    if (distance === 0) {
        statusText.innerText = "¡ Enfoque Perfecto ! (Saturno nítido)";
        statusText.className = "focus-status status-sharp";
    } else if (distance < 4) {
        statusText.innerText = "Casi enfocado...";
        statusText.className = "focus-status status-blur";
    } else {
        statusText.innerText = "Telescopio Desenfocado";
        statusText.className = "focus-status status-blur";
    }
}
