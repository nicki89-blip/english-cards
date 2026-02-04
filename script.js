// 📗 Seznam naborov (List of datasets)
const DATASETS = [
  { id: "all",   name: "Vse besede", url: "english_words.json" },
  { id: "combined", name: "Vse enote skupaj (Unit 1 + Unit 2)", url: null, combined: ["unit1.json", "unit2.json"] },
  { id: "unit1", name: "Unit 1",     url: "unit1.json" },
  { id: "unit2", name: "Unit 2",     url: "unit2.json" }
];
const SELECT_KEY = "anki_dataset_id";

function buildDatasetSelect(){
  const sel = document.getElementById("dataset");
  sel.innerHTML = "";
  DATASETS.forEach(ds => {
    const opt = document.createElement("option");
    opt.value = ds.id;
    opt.textContent = ds.name;
    sel.appendChild(opt);
  });
  const saved = localStorage.getItem(SELECT_KEY);
  if (saved && DATASETS.find(d => d.id === saved)){
    sel.value = saved;
  }
}

function currentDataset(){
  const sel = document.getElementById("dataset");
  const id = sel.value;
  return DATASETS.find(d => d.id === id) || DATASETS[0];
}

// 🔀 Shuffle function
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchCards(dataset){
  let allData = [];
  const timestamp = Date.now(); // Cache busting
  
  // If it's a combined dataset, fetch multiple files
  if (dataset.combined) {
    for (const url of dataset.combined) {
      try {
        const resp = await fetch(url + '?t=' + timestamp);
        if (!resp.ok) throw new Error("Napaka pri prenosu " + url + " (" + resp.status + ")");
        const data = await resp.json();
        allData = allData.concat(data);
      } catch (error) {
        console.error("Error fetching " + url + ":", error);
        throw error;
      }
    }
  } else {
    // Single file fetch
    const resp = await fetch(dataset.url + '?t=' + timestamp);
    if (!resp.ok) throw new Error("Napaka pri prenosu (" + resp.status + ")");
    allData = await resp.json();
  }

  // Randomize order on load
  const shuffled = shuffle([...allData]);

  return shuffled.map((item, index) => {
    const valSlo = item.question ?? item.slovenian ?? "";
    const valEng = item.answer   ?? item.english   ?? "";

    // 50/50 chance for direction
    const isSloToEng = Math.random() < 0.5;

    return {
      id: index,
      front: isSloToEng ? valSlo : valEng,
      back:  isSloToEng ? valEng : valSlo,
      english: valEng,  // Always store English for audio
      isSloToEng: isSloToEng
    };
  });
}

function setLoadingUI(loading){
  const front = document.getElementById("cardFront");
  const back  = document.getElementById("cardBack");
  const buttons = ["prevBtn","nextBtn","audioBtn"].map(id => document.getElementById(id));
  
  buttons.forEach(b => b.disabled = loading);

  if (loading){
    front.textContent = "Nalagam kartice…";
    back.textContent  = "Prosim počakaj 🙂";
  }
}

class FlashcardApp {
  constructor(cards){
    this.cards = cards;
    this.currentIndex = 0;
    this.isFlipped = false;
    this.touchStartX = 0;
    this.touchEndX = 0;

    // IMPORTANT: Bind handleKey so we can remove it later
    this.handleKey = this.handleKey.bind(this);

    this.initializeElements();
    this.setupEventListeners();
    this.updateDisplay();
    this.setupAudio();
  }

  initializeElements(){
    this.cardElement = document.getElementById('flashcard');
    this.cardFront = document.getElementById('cardFront');
    this.cardBack = document.getElementById('cardBack');
    this.cardCounter = document.getElementById('cardCounter');
    
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    this.audioBtn = document.getElementById('audioBtn');
  }

  setupAudio(){
    if ('speechSynthesis' in window) {
      this.audioBtn.style.display = 'inline-block';
      this.audioBtn.onclick = () => this.playAudio();
    } else {
      this.audioBtn.style.display = 'none';
    }
  }

  playAudio(){
    const currentCard = this.cards[this.currentIndex];
    const textToSpeak = currentCard.english;
    
    if (textToSpeak && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-US';
      utterance.rate = 0.9; 
      window.speechSynthesis.speak(utterance);
    }
  }

  setupEventListeners(){
    // Button clicks
    this.cardElement.onclick = () => this.flipCard();
    this.prevBtn.onclick = () => this.previousCard();
    this.nextBtn.onclick = () => this.nextCard();
    
    // Keyboard navigation (Global Listener)
    document.addEventListener('keydown', this.handleKey);

    // Touch/Swipe events
    this.cardElement.ontouchstart = (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    };

    this.cardElement.ontouchend = (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
    };
  }

  // CRITICAL FIX: Method to clean up the keyboard listener
  destroy() {
    document.removeEventListener('keydown', this.handleKey);
  }

  handleKey(e) {
    switch(e.code){
      case 'ArrowLeft': e.preventDefault(); this.previousCard(); break;
      case 'ArrowRight': e.preventDefault(); this.nextCard(); break;
      case 'Space': e.preventDefault(); this.flipCard(); break;
    }
  }

  handleSwipe(){
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) this.nextCard();
      else this.previousCard();
    }
  }

  flipCard(){
    this.isFlipped = !this.isFlipped;
    this.cardElement.classList.toggle('flipped', this.isFlipped);
  }

  previousCard(){
    if (this.cards.length === 0) return;
    this.currentIndex--;
    if (this.currentIndex < 0) {
        this.currentIndex = this.cards.length - 1;
    }
    this.updateDisplay();
  }

  nextCard(){
    if (this.cards.length === 0) return;
    this.currentIndex++;
    if (this.currentIndex >= this.cards.length) {
        this.currentIndex = 0;
    }
    this.updateDisplay();
  }

  updateDisplay(){
    const currentCard = this.cards[this.currentIndex];
    this.cardFront.textContent = currentCard.front;
    this.cardBack.textContent  = currentCard.back;

    this.isFlipped = false;
    this.cardElement.classList.remove('flipped');

    this.cardCounter.textContent = `Kartica ${this.currentIndex + 1} od ${this.cards.length}`;
    
    this.prevBtn.disabled = false;
    this.nextBtn.disabled = false;
    this.audioBtn.disabled = false;
  }
}

// 🚀 Initialization Logic
buildDatasetSelect();

const reloadBtn = document.getElementById("reloadBtn");

// Helper to clear old button listeners
function clearDomListeners() {
  ['prevBtn', 'nextBtn', 'audioBtn', 'flashcard'].forEach(id => {
    const el = document.getElementById(id);
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);
  });
}

reloadBtn.addEventListener("click", async () => {
  const ds = currentDataset();
  localStorage.setItem(SELECT_KEY, ds.id);
  
  // 1. Clean up previous app instance (Keyboard)
  if (window.app) {
    window.app.destroy();
  }

  // 2. Clean up DOM buttons (Clicks)
  clearDomListeners();

  setLoadingUI(true);
  
  try {
    const cards = await fetchCards(ds);
    if (cards.length === 0) throw new Error("No cards loaded");
    
    // 3. Create new app instance
    window.app = new FlashcardApp(cards);
  } catch (err){
    console.error(err);
    document.getElementById('cardFront').textContent = "Napaka pri nalaganju kartic 😢";
    document.getElementById('cardBack').textContent = "(preveri JSON datoteke)";
  } finally {
    setLoadingUI(false);
  }
});

// Load immediately on start
if (localStorage.getItem(SELECT_KEY)){
  reloadBtn.click();
} else {
  reloadBtn.click();
}
