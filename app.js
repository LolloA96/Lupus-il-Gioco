// app.js (versione aggiornata con gestione host/player, fix Inizia Partita, ruolo nascosto, header logo e UI ruoli a due card)

let currentRoomId = null;
let currentPlayerName = null;
let isHost = false;
let roomUnsubscribe = null;

// ELEMENTI DOM
const viewHome = document.getElementById("viewHome");
const viewRoom = document.getElementById("viewRoom");
const viewRoles = document.getElementById("viewRoles");
const viewRoleCard = document.getElementById("viewRoleCard");

const btnCreate = document.getElementById("btnCreate");
const btnJoin = document.getElementById("btnJoin");
const btnStartGame = document.getElementById("btnStartGame");
const playerList = document.getElementById("playerList");

// --- FUNZIONE: cambio schermata ---
function showView(view) {
  [viewHome, viewRoom, viewRoles, viewRoleCard].forEach(v =>
    v.classList.add("hidden")
  );
  view.classList.remove("hidden");
}

// helper per disiscrivere onSnapshot
function unsubscribeRoom() {
  if (typeof roomUnsubscribe === "function") {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }
  isHost = false;
}

// --- CREA STANZA ---
btnCreate.addEventListener("click", async () => {
  const roomName = document.getElementById("inputRoomNameCreate").value.trim();
  const playerName = document.getElementById("inputNameCreate").value.trim();

  if (!roomName || !playerName) {
    alert("Inserisci sia il nome della stanza che il tuo nome!");
    return;
  }

  try {
    const roomRef = db.collection("rooms").doc(roomName);
    const roomDoc = await roomRef.get();

    if (roomDoc.exists) {
      alert("⚠️ Esiste già una stanza con questo nome. Scegli un altro nome.");
      return;
    }

    await roomRef.set({
      createdAt: Date.now(),
      roomName: roomName,
      players: [playerName],
      host: playerName,
      ended: false
    });

    currentRoomId = roomName;
    currentPlayerName = playerName;
    isHost = true;

    document.getElementById("roomTitle").innerText = `${roomName}`;
    showView(viewRoom);
    subscribeToRoom(currentRoomId);
  } catch (err) {
    console.error("Errore creazione stanza:", err);
    alert("Errore durante la creazione della stanza");
  }
});

// --- ENTRA IN STANZA ---
btnJoin.addEventListener("click", async () => {
  const name = document.getElementById("inputNameJoin").value.trim();
  const roomName = document.getElementById("inputRoomId").value.trim();

  if (!name || !roomName) {
    alert("Inserisci nome e nome della stanza!");
    return;
  }

  try {
    const roomRef = db.collection("rooms").doc(roomName);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      alert("⚠️ Stanza non trovata");
      return;
    }

    await roomRef.update({
      players: firebase.firestore.FieldValue.arrayUnion(name)
    });

    currentRoomId = roomName;
    currentPlayerName = name;
    isHost = false;

    document.getElementById("roomTitle").innerText = `${roomName}`;
    showView(viewRoom);

    subscribeToRoom(currentRoomId);
  } catch (err) {
    console.error("Errore ingresso stanza:", err);
    alert("Impossibile entrare nella stanza");
  }
});

// --- ASCOLTA I GIOCATORI IN STANZA ---
function subscribeToRoom(roomId) {
  unsubscribeRoom();

  roomUnsubscribe = db.collection("rooms").doc(roomId).onSnapshot(doc => {
    if (!doc.exists) {
      alert("La stanza è stata chiusa.");
      unsubscribeRoom();
      showView(viewHome);
      return;
    }

    const data = doc.data();
    if (!data) return;

    if (data.host && currentPlayerName) {
      isHost = (data.host === currentPlayerName);
    } else {
      isHost = false;
    }

    if (data.ended) {
      alert("La partita è terminata.");
      unsubscribeRoom();
      showView(viewHome);
      return;
    }

    playerList.innerHTML = "";
    (data.players || []).forEach(p => {
      const li = document.createElement("li");
      li.dataset.name = p;

      const avatar = document.createElement("div");
      avatar.className = "player-avatar";
      const initials = p.split(" ").map(w => w[0].toUpperCase()).join("").slice(0, 2);
      avatar.textContent = initials;

      const nameSpan = document.createElement("span");
      nameSpan.className = "player-name";
      nameSpan.textContent = p;

      li.appendChild(avatar);
      li.appendChild(nameSpan);

      if (isHost && p !== currentPlayerName) {
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-player";
        removeBtn.type = "button";
        removeBtn.innerHTML = "🗑️";
        removeBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await db.collection("rooms").doc(currentRoomId).update({
              players: firebase.firestore.FieldValue.arrayRemove(p)
            });
          } catch (err) {
            console.error("Errore nel rimuovere il giocatore:", err);
          }
        });
        li.appendChild(removeBtn);
      }

      playerList.appendChild(li);
    });

    if (data.assignments && currentPlayerName) {
      const myRoleId = data.assignments[currentPlayerName];
      if (myRoleId) {
        console.log("Snapshot: ho un ruolo, mostro la mia carta:", myRoleId);
        showMyRoleById(myRoleId);
      }
    }
  });
}

// --- INIZIA PARTITA ---
btnStartGame.addEventListener("click", () => {
  if (!isHost) {
    alert("Solo l'host può iniziare la partita");
    return;
  }
  renderRolesUI();
  showView(viewRoles);
});

// --- RUOLI DISPONIBILI ---
const ROLES = [
  { id: "lupo", label: "Lupo", description: "Mangia tutti gli altri giocatori per vincere!", img: "img/lupo.png" },
  { id: "contadino", label: "Contadino", description: "Scova tutti i lupi all’interno del villaggio!", img: "img/contadino.png" },
  { id: "comandante", label: "Comandante", description: "Proteggi una persona a tua scelta ogni notte.", img: "img/comandante.png" },
  { id: "veggente", label: "Veggente", description: "Scopri i lupi per aiutare il villaggio.", img: "img/veggente.png" },
  { id: "mitomane", label: "Mitomane", description: "Indica un giocatore e ne prende i poteri.", img: "img/mitomane.png" },
  { id: "strega", label: "Strega", description: "Scopri chi è il lupo e resuscita una persona.", img: "img/strega.png" }
];

const selectedCounts = {};
ROLES.forEach(r => selectedCounts[r.id] = 0);

// --- RENDER CARD RUOLI ---
function renderRolesUI() {
  const container = document.getElementById("rolesContainer");
  if (!container) return;
  container.innerHTML = "";

  ROLES.forEach(role => {
    const card = document.createElement("div");
    card.className = `role-card role-${role.id}`;

    const img = document.createElement("img");
    img.src = role.img;
    img.alt = role.label;
    card.appendChild(img);

    const name = document.createElement("span");
    name.className = "role-name";
    name.innerText = role.label.toUpperCase();
    card.appendChild(name);

    const controls = document.createElement("div");
    controls.className = "role-controls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.innerText = "−";
    minus.addEventListener("click", (e) => {
      e.stopPropagation();
      if (selectedCounts[role.id] > 0) {
        selectedCounts[role.id]--;
        updateCount(role.id);
      }
    });

    const count = document.createElement("span");
    count.id = `count-${role.id}`;
    count.innerText = selectedCounts[role.id];

    const plus = document.createElement("button");
    plus.type = "button";
    plus.innerText = "+";
    plus.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedCounts[role.id]++;
      updateCount(role.id);
    });

    controls.appendChild(minus);
    controls.appendChild(count);
    controls.appendChild(plus);

    card.appendChild(controls);
    container.appendChild(card);
  });
}

function updateCount(roleId) {
  const el = document.getElementById(`count-${roleId}`);
  if (el) el.innerText = selectedCounts[roleId];
}

// --- ASSEGNA RUOLI ---
document.getElementById("btnAssignRoles").addEventListener("click", async () => {
  try {
    const players = Array.from(document.querySelectorAll("#playerList li"))
      .map(li => (li.dataset.name || "").trim())
      .filter(n => n.length > 0);

    const playersCount = players.length;
    let totalSelected = Object.values(selectedCounts).reduce((a, b) => a + b, 0);

    if (playersCount === 0) {
      alert("Non ci sono giocatori in stanza.");
      return;
    }
    if (totalSelected !== playersCount) {
      alert(`Devi scegliere esattamente ${playersCount} ruoli. Hai scelto ${totalSelected}.`);
      return;
    }

    let pool = [];
    Object.keys(selectedCounts).forEach(roleId => {
      for (let i = 0; i < selectedCounts[roleId]; i++) pool.push(roleId);
    });
    pool = shuffleArray(pool);

    const assignments = {};
    for (let i = 0; i < playersCount; i++) {
      assignments[players[i]] = pool[i];
    }

    await db.collection("rooms").doc(currentRoomId).update({ assignments });

    const myRoleId = assignments[currentPlayerName];
    if (myRoleId) showMyRoleById(myRoleId);
  } catch (err) {
    console.error("Errore assegnazione ruoli:", err);
  }
});

// --- Mostra ruolo ---
function showMyRoleById(roleId) {
  const role = ROLES.find(r => r.id === roleId);
  if (!role) return;
  showMyRole(role);
}

// --- MOSTRA CARTA RUOLO (NUOVA VERSIONE) ---
function showMyRole(role) {
  const roleCard = document.getElementById("viewRoleCard");

  // Palette colori
  const ROLE_COLORS = {
    lupo: { primary: "#5C2E2E", secondary: "#A84242" },
    contadino: { primary: "#2E5C3A", secondary: "#42A85C" },
    comandante: { primary: "#2E3C5C", secondary: "#4269A8" },
    veggente: { primary: "#5C3C5C", secondary: "#A842A8" },
    mitomane: { primary: "#5C4C2E", secondary: "#A87C42" },
    strega: { primary: "#3C2E5C", secondary: "#6C42A8" }
  };

  const colors = ROLE_COLORS[role.id] || { primary: "#1b263b", secondary: "#354C96" };

  // --- MITOMANE ---
  if (role.id === "mitomane") {
    roleCard.innerHTML = `
      <div class="role-container">
        <div class="role-card-top" style="background:${colors.primary}">
          <img src="${role.img}" alt="${role.label}" />
          <h2 class="role-name-card">${role.label.toUpperCase()}</h2>
        </div>
        <div class="role-card-bottom" style="background:${colors.secondary}">
          <p><strong>Sei il ${role.label.toUpperCase()}!</strong></p>
          <p>${role.description}</p>
        </div>
        <div class="role-actions">
          <button id="btnTransform" class="btn primary">Trasformati</button>
          <button id="btnEndGame" class="btn secondary">Termina partita</button>
        </div>
      </div>

      <div id="mitomanePopup" class="popup hidden">
        <div class="popup-content">
          <h3>Scegli il personaggio in cui trasformarti</h3>
          <div id="popupRoles"></div>
          <button id="btnClosePopup" class="btn" type="button">Chiudi</button>
        </div>
      </div>
    `;
    showView(viewRoleCard);

    // Gestione popup trasformazione
    const transformBtn = document.getElementById("btnTransform");
    const popup = document.getElementById("mitomanePopup");
    const popupRoles = document.getElementById("popupRoles");
    const closePopup = document.getElementById("btnClosePopup");

    if (transformBtn) {
      transformBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        popup.classList.remove("hidden");
        popupRoles.innerHTML = "";
        ROLES.filter(r => r.id !== "mitomane").forEach(r => {
          const btn = document.createElement("button");
          btn.className = "btn";
          btn.innerText = r.label;
          btn.addEventListener("click", () => {
            popup.classList.add("hidden");
            showMyRole(r);
          });
          popupRoles.appendChild(btn);
        });
      });
    }
    if (closePopup) closePopup.addEventListener("click", () => popup.classList.add("hidden"));

    // termina partita
    document.getElementById("btnEndGame").addEventListener("click", async () => {
      if (!currentRoomId) return;
      await db.collection("rooms").doc(currentRoomId).update({ ended: true });
      showView(viewHome);
    });

    return;
  }

  // --- RUOLI NORMALI ---
  roleCard.innerHTML = `
    <div class="role-container">
      <div class="role-card-top" style="background:${colors.primary}">
        <img src="${role.img}" alt="${role.label}" />
        <h2 class="role-name-card">${role.label.toUpperCase()}</h2>
      </div>
      <div class="role-card-bottom" style="background:${colors.secondary}">
        <p><strong>Sei il ${role.label.toUpperCase()}!</strong></p>
        <p>${role.description}</p>
      </div>
      <div class="role-actions">
        <button id="btnEndGame" class="btn primary">Termina partita</button>
      </div>
    </div>
  `;
  showView(viewRoleCard);

  document.getElementById("btnEndGame").addEventListener("click", async () => {
    if (!currentRoomId) return;
    await db.collection("rooms").doc(currentRoomId).update({ ended: true });
    showView(viewHome);
  });
}

// --- UTILITY: shuffle ---
function shuffleArray(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- ANNULLA PARTITA ---
async function cancelGame() {
  if (!currentRoomId) return;
  try {
    await db.collection("rooms").doc(currentRoomId).delete();
    unsubscribeRoom();
    currentRoomId = null;
    currentPlayerName = null;
    isHost = false;
    alert("La partita è stata annullata.");
    showView(viewHome);
  } catch (err) {
    console.error("Errore nell'annullare la partita:", err);
  }
}

// Listener da schermata RUOLI
document.getElementById("btnCancelGameRoles")?.addEventListener("click", cancelGame);

// Listener da schermata ROOM
document.getElementById("btnCancelGameRoom")?.addEventListener("click", cancelGame);