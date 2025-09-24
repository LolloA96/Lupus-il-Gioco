// app.js (versione aggiornata con gestione host/player, fix Inizia Partita, ruolo nascosto, header logo e UI ruoli responsive con colori dedicati)

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
  { id: "comandante", label: "Comandante", description: "Proteggi una persona a tua scelta ogni notte. Può salvare anche se stesso per una notte.", img: "img/comandante.png" },
  { id: "veggente", label: "Veggente", description: "Scopri i lupi per aiutare il villaggio.", img: "img/veggente.png" },
  { id: "mitomane", label: "Mitomane", description: "Indica un giocatore e ne prende i poteri (il potere vale solo ad inizio partita).", img: "img/mitomane.png" },
  { id: "strega", label: "Strega", description: "Scopri chi è il lupo e resuscita una persona (i poteri potranno essere usati dalla seconda notte).", img: "img/strega.png" }
];

const selectedCounts = {};
ROLES.forEach(r => selectedCounts[r.id] = 0);

// --- UTILITY: shuffle ---
function shuffleArray(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- FUNZIONE DI ASSEGNAZIONE (ora richiamabile da qualsiasi button creato dinamicamente) ---
async function assignRolesAction() {
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
}

// --- RENDER CARD RUOLI (con bottoni fluttuanti creati in sicurezza) ---
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

  // --- BOTTONI FLUTTUANTI (sicuri, non dipendono da elementi esistenti) ---
  // rimuovo eventuali container precedenti per evitare duplicati
  const existing = document.getElementById("rolesFloatingActions");
  if (existing) existing.remove();

  const actions = document.createElement("div");
  actions.id = "rolesFloatingActions";
  actions.className = "roles-actions";

  // crea assign button (se vuoi puoi anche spostare il pulsante statico esistente invece di crearne uno nuovo)
  const assignBtn = document.createElement("button");
  assignBtn.id = "btnAssignRoles_floating";
  assignBtn.className = "btn primary";
  assignBtn.textContent = "Assegna ruoli";
  assignBtn.addEventListener("click", assignRolesAction);

  // crea cancel button
  const cancelBtn = document.createElement("button");
  cancelBtn.id = "btnCancelGameRoles_floating";
  cancelBtn.className = "btn secondary";
  cancelBtn.textContent = "Annulla partita";
  cancelBtn.addEventListener("click", cancelGame);

  actions.appendChild(assignBtn);
  actions.appendChild(cancelBtn);

  // append su body così è sempre visibile/posizionato fixed
 const ruoliView = document.getElementById("viewRoles");
if (ruoliView) {
  ruoliView.appendChild(actions);
}

  // nascondo il bottone statico originale (se presente nel markup) per evitare confusione
  const staticAssign = document.getElementById("btnAssignRoles");
  if (staticAssign) staticAssign.style.display = "none";

  const staticCancel = document.getElementById("btnCancelGameRoles");
if (staticCancel) staticCancel.remove();

}

// aggiorna numeri
function updateCount(roleId) {
  const el = document.getElementById(`count-${roleId}`);
  if (el) el.innerText = selectedCounts[roleId];
}

// --- Mostra ruolo ---
function showMyRoleById(roleId) {
  const role = ROLES.find(r => r.id === roleId);
  if (!role) return;
  showMyRole(role);
}

// --- MOSTRA CARTA RUOLO RESPONSIVE ---
function showMyRole(role) {
  const roleCard = document.getElementById("viewRoleCard");

  // Palette colori -> identici agli screenshot
  const ROLE_COLORS = {
    lupo: "#354C96",
    contadino: "#8B2D2D",
    comandante: "#C28A2E",
    veggente: "#A87BA8",
    mitomane: "#2E7D68",
    strega: "#2E5C3A"
  };

  const bgColor = ROLE_COLORS[role.id] || "#1b263b";

  // --- MITOMANE ---
  if (role.id === "mitomane") {
    roleCard.innerHTML = `
      <div class="role-container">
        <div class="role-card-top" style="background:${bgColor}">
          <img src="${role.img}" alt="${role.label}" />
        </div>
        <div class="role-card-bottom" style="background:${bgColor}">
          <p><strong>Sei il ${role.label.toUpperCase()}!</strong></p>
          <p>${role.description}</p>
        </div>
        <div class="role-actions">
          <button id="btnTransform" class="btn primary">Trasformati</button>
          <button id="btnEndGame" class="btn primary">Termina partita</button>
        </div>
      </div>
    `;
    showView(viewRoleCard);

   document.getElementById("btnTransform").addEventListener("click", async () => {
  const snapshot = await db.collection("rooms").doc(currentRoomId).get();
  const data = snapshot.data();
  if (!data || !data.assignments) return;

  // Creo il popup
  const popup = document.createElement("div");
  popup.className = "popup";
  popup.id = "mitoPopupCustom";
  popup.innerHTML = `
    <div class="popup-content">
      <h3>Trasformazione Mitomane</h3>
      <p>Scegli il ruolo che vuoi assumere. Questa scelta è irreversibile!</p>
      <div id="mitoOptions"></div>
      <button id="mitoCloseBtn" class="btn">Chiudi</button>
    </div>
  `;
  document.body.appendChild(popup);

  const options = document.getElementById("mitoOptions");

  // Creo i bottoni per ogni ruolo
  ROLES.forEach(role => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.margin = "8px 0";
    btn.textContent = role.label.toUpperCase();
    btn.addEventListener("click", async () => {
      await db.collection("rooms").doc(currentRoomId).update({
        [`assignments.${currentPlayerName}`]: role.id
      });
      document.body.removeChild(popup);
      alert(`Ti sei trasformato! Ora hai il ruolo di ${role.label.toUpperCase()}.`);
      showMyRole(role);
    });
    options.appendChild(btn);
  });

  document.getElementById("mitoCloseBtn").addEventListener("click", () => {
    const el = document.getElementById("mitoPopupCustom");
    if (el) document.body.removeChild(el);
  });
});


    // --- TERMINE PARTITA (vale per tutti i giocatori) ---
    document.getElementById("btnEndGame").addEventListener("click", async () => {
      if (!currentRoomId) return;
      await db.collection("rooms").doc(currentRoomId).update({
        ended: true,
        endedAt: Date.now(),
        endedBy: currentPlayerName || null
      });

      showView(viewHome);
    });

    return;
  }

  // --- RUOLI NORMALI ---
  roleCard.innerHTML = `
    <div class="role-container">
      <div class="role-card-top" style="background:${bgColor}">
        <img src="${role.img}" alt="${role.label}" />
      </div>
      <div class="role-card-bottom" style="background:${bgColor}">
        <p><strong>Sei il ${role.label.toUpperCase()}!</strong></p>
        <p>${role.description}</p>
      </div>
      <div class="role-actions">
        <button id="btnEndGame" class="btn primary">Termina partita</button>
      </div>
    </div>
  `;
  showView(viewRoleCard);

  // --- TERMINE PARTITA (vale per tutti i giocatori) ---
  document.getElementById("btnEndGame").addEventListener("click", async () => {
    if (!currentRoomId) return;
    await db.collection("rooms").doc(currentRoomId).update({
      ended: true,
      endedAt: Date.now(),
      endedBy: currentPlayerName || null
    });
    showView(viewHome);
  });
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

// Listener da schermata ROOM (se esistono pulsanti statici)
document.getElementById("btnCancelGameRoom")?.addEventListener("click", cancelGame);