// 📗 Seznam naborov
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
  
  // If it's a combined dataset, fetch multiple files
  if (dataset.combined) {
    for (const url of dataset.combined) {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error("Napaka pri prenosu (" + resp.status + ")");
      const data = await resp.json();
      allData = allData.concat(data);
    }
  } else {
    // Single file fetch
    const resp = await fetch(dataset.url, { cache: "no-store" });
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
    // Check if speech synthesis is available
    if ('speechSynthesis' in window) {
      this.audioBtn.addEventListener('click', () => this.playAudio());
    } else {
      this.audioBtn.style.display = 'none'; // Hide if not supported
    }
  }

  playAudio(){
    const currentCard = this.cards[this.currentIndex];
    
    // Always speak the English text
    const textToSpeak = currentCard.english;
    
    if (textToSpeak && 'speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-US'; // Set to English
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1;
      
      window.speechSynthesis.speak(utterance);
    }
  }

  setupEventListeners(){
    this.cardElement.addEventListener('click', () => this.flipCard());
    this.prevBtn.addEventListener('click', () => this.previousCard());
    this.nextBtn.addEventListener('click', () => this.nextCard());
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      switch(e.code){
        case 'ArrowLeft': e.preventDefault(); this.previousCard(); break;
        case 'ArrowRight': e.preventDefault(); this.nextCard(); break;
        case 'Space': e.preventDefault(); this.flipCard(); break;
      }
    });

    // Touch/Swipe events for mobile
    this.cardElement.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    }, false);

    this.cardElement.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
    }, false);
  }

  handleSwipe(){
    const swipeThreshold = 50; // Minimum distance for swipe
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swiped left - next card
        this.nextCard();
      } else {
        // Swiped right - previous card
        this.previousCard();
      }
    }
  }

  flipCard(){
    this.isFlipped = !this.isFlipped;
    this.cardElement.classList.toggle('flipped', this.isFlipped);
  }

  previousCard(){
    if (this.cards.length === 0) return;
    this.currentIndex--;
    // Loop to end if at beginning
    if (this.currentIndex < 0) {
        this.currentIndex = this.cards.length - 1;
    }
    this.updateDisplay();
  }

  nextCard(){
    if (this.cards.length === 0) return;
    this.currentIndex++;
    // Loop to start if at end
    if (this.currentIndex >= this.cards.length) {
        this.currentIndex = 0;
    }
    this.updateDisplay();
  }

  updateDisplay(){
    // Update text
    const currentCard = this.cards[this.currentIndex];
    this.cardFront.textContent = currentCard.front;
    this.cardBack.textContent  = currentCard.back;

    // Reset flip state
    this.isFlipped = false;
    this.cardElement.classList.remove('flipped');

    // Update counter
    this.cardCounter.textContent = `Kartica ${this.currentIndex + 1} od ${this.cards.length}`;
    
    // Enable buttons
    this.prevBtn.disabled = false;
    this.nextBtn.disabled = false;
    this.audioBtn.disabled = false;
  }
}

// 🚀 Initialization
buildDatasetSelect();

const reloadBtn = document.getElementById("reloadBtn");
reloadBtn.addEventListener("click", async () => {
  const ds = currentDataset();
  localStorage.setItem(SELECT_KEY, ds.id);
  setLoadingUI(true);
  try {
    const cards = await fetchCards(ds);
    window.app = new FlashcardApp(cards);
  } catch (err){
    console.error(err);
    document.getElementById('cardFront').textContent = "Napaka pri nalaganju kartic 😢";
    document.getElementById('cardBack').textContent = "(preveri URL)";
  } finally {
    setLoadingUI(false);
  }
});

if (localStorage.getItem(SELECT_KEY)){
  reloadBtn.click();
}
